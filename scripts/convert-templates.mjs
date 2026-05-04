#!/usr/bin/env node
// One-shot, idempotent converter: templates/*.html → src/pages/*.astro.
//
// Strips Jinja {% extends %} + {% block body %} ... {% endblock body %} so
// the body content survives byte-for-byte (modulo Jinja); wraps it in a
// <BaseLayout> import; carries the original <html> classlist over as the
// htmlClass prop. Templates with substantive Jinja inside the body
// (loops, conditionals on dynamic data) are listed in `SKIP` and converted
// by hand to keep this script honest.
//
// Run from repo root: node scripts/convert-templates.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Templates that only render static body content — safe to auto-convert.
// (Templates with dynamic Jinja loops, like blog list / single-post /
// homepage's recent_posts section, are converted manually.)
const TEMPLATES = [
  // already done by hand:
  //   '404.html', 'ads-service.html', 'web_development.html'
  { src: 'contact.html', dest: 'contact.astro', title: 'Contact — AH-design' },
  { src: 'order.html', dest: 'order.astro', title: 'Order — AH-design' },
  { src: 'services.html', dest: 'services.astro', title: 'Services — AH-design' },
  { src: 'projects.html', dest: 'projects.astro', title: 'Projects — AH-design' },
  { src: 'price.html', dest: 'price.astro', title: 'Prices — AH-design' },
  { src: 'about-us.html', dest: 'about-us.astro', title: 'About us — AH-design' },
  { src: 'index.html', dest: 'index.astro', title: 'AH-design', needsRecentPosts: true },
];

function htmlClassOf(src) {
  const m = src.match(/<html\s+class="([^"]*)"\s+lang="en"\s*>/);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function bodyOf(src) {
  // Capture between {% block body %} and {% endblock body? %}.
  const m = src.match(/\{%\s*block\s+body\s*%\}([\s\S]*?)\{%\s*endblock\s+body\s*%?\}/);
  if (!m) throw new Error('no {% block body %} found');
  return m[1];
}

function stripJinja(s) {
  // url_for("page_handler", page="X") → /X
  s = s.replace(
    /\{\{\s*url_for\(\s*['"]page_handler['"]\s*,\s*page\s*=\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    '/$1',
  );
  // url_for('static', filename='X') → /static/X
  s = s.replace(
    /\{\{\s*url_for\(\s*['"]static['"]\s*,\s*filename\s*=\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    '/static/$1',
  );
  // url_for("X") → /X (route names like "router" → "/")
  s = s.replace(/\{\{\s*url_for\(\s*['"]router['"]\s*\)\s*\}\}/g, '/');
  s = s.replace(/\{\{\s*url_for\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g, '/$1');
  // {# Jinja comments #} — drop entirely
  s = s.replace(/\{#[\s\S]*?#\}/g, '');
  // {% for post in recent_posts %} ... {% endfor %} → Astro JSX map. Used by
  // the homepage; the block is wrapped in a single sentinel so we can post-
  // process it after the file is on disk (we don't try to fully translate
  // here because the inner {{ post.X }} interpolations need their own pass).
  s = s.replace(
    /\{%\s*for\s+post\s+in\s+recent_posts\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_m, inner) => {
      // Inside the loop body, rewrite {{ post.X }} → {post.X}, and {{ post.X.Y }} → {post.X.Y}.
      const body = inner
        .replace(/\{\{\s*post\.([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g, '{post.$1}');
      // Special: post.category.title → post.category_title (we flattened in import).
      const flat = body.replace(/\{post\.category\.title\}/g, '{post.category_title}');
      return `{recentPosts.map((post) => (${'\n'}${flat}${'\n'}))}`;
    },
  );
  // Plain {{ X }} where X looks like a static literal (no fields) — leave for the
  // hand-converter to deal with.  Just warn.
  const remaining = s.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g);
  if (remaining) {
    console.warn(`  ⚠  ${remaining.length} unhandled Jinja tag(s):`);
    for (const r of remaining.slice(0, 3)) console.warn(`     ${r.slice(0, 80)}`);
  }
  return s;
}

function escapeForAstro(s) {
  // Astro/JSX treats `{` and `}` as expression delimiters.  In stripped Jinja
  // there should be no remaining braces.  But the source may contain literal
  // `{` / `}` in inline JS or content (rare in this codebase).  We do not
  // currently escape — log a warning if any survive.
  const bare = s.match(/\{(?!\s*\/\*)|\}(?!\s*\*\/)/g);
  if (bare) {
    // Suppress: countless harmless ones in inline styles (e.g. `style="..."`
    // doesn't contain raw braces).  Only flag real curlies.
    const real = s.match(/(?<![\w"'])\{[^{}]*\}/g);
    if (real && real.length) {
      console.warn(`  ⚠  ${real.length} bare {...} expression(s) — review manually.`);
    }
  }
  return s;
}

const HEADER = (htmlClass, title, needsRecentPosts) => {
  const fmExtra = needsRecentPosts
    ? `import { getCollection } from 'astro:content';\n\nconst recentPosts = (await getCollection('blog'))\n  .sort((a, b) => b.data.published_date.localeCompare(a.data.published_date))\n  .slice(0, 3)\n  .map((p) => p.data);\n`
    : '';
  return `---
import BaseLayout from '../layouts/BaseLayout.astro';
${fmExtra}---

<BaseLayout
  title="${title.replace(/"/g, '&quot;')}"
  htmlClass="${htmlClass}"
>
`;
};
const FOOTER = `</BaseLayout>
`;

let ok = 0;
let bad = 0;
for (const { src, dest, title, needsRecentPosts } of TEMPLATES) {
  console.log(`→ ${src}`);
  try {
    const raw = readFileSync(join(repoRoot, 'templates', src), 'utf8');
    const klass = htmlClassOf(raw);
    let body = bodyOf(raw);
    body = stripJinja(body);
    body = escapeForAstro(body);
    body = body.trim() + '\n';
    const out = HEADER(klass, title, needsRecentPosts) + body + FOOTER;
    const destPath = join(repoRoot, 'src', 'pages', dest);
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, out);
    console.log(`  ✓ ${dest} (${out.length.toLocaleString()} bytes)`);
    ok++;
  } catch (e) {
    console.error(`  ✘ ${dest}: ${e.message}`);
    bad++;
  }
}
console.log(`\n${ok} converted, ${bad} failed.`);
