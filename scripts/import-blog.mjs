#!/usr/bin/env node
// One-shot importer: blog_django_backend/scraper/output/ → src/content/* and
// public/uploads/*. Run from repo root; idempotent (overwrites).
//
//   node scripts/import-blog.mjs [--source <path-to-scraper-output>]
//
// Source defaults to ../blog_django_backend/scraper/output relative to this
// repo, which matches the layout described in blog_incident.md.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const sourceArgIdx = process.argv.indexOf('--source');
const sourceRoot =
  sourceArgIdx >= 0
    ? resolve(process.argv[sourceArgIdx + 1])
    : resolve(repoRoot, '..', 'blog_django_backend', 'scraper', 'output');

if (!statSafely(sourceRoot)) {
  console.error(`Scraper output not found at: ${sourceRoot}`);
  console.error('Pass --source <path> to override.');
  process.exit(1);
}

console.log(`Importing from: ${sourceRoot}`);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const blogDir = join(repoRoot, 'src', 'content', 'blog');
const authorsDir = join(repoRoot, 'src', 'content', 'authors');
const categoriesDir = join(repoRoot, 'src', 'content', 'categories');
const uploadsBlog = join(repoRoot, 'public', 'uploads', 'blog');
const uploadsAuthors = join(repoRoot, 'public', 'uploads', 'authors');
[blogDir, authorsDir, categoriesDir, uploadsBlog, uploadsAuthors].forEach((d) =>
  mkdirSync(d, { recursive: true }),
);

// --- Categories ---------------------------------------------------------
const categories = JSON.parse(readFileSync(join(sourceRoot, 'categories.json'), 'utf8'));
for (const cat of categories) {
  const out = { slug: cat.slug, title: cat.title };
  writeFileSync(join(categoriesDir, `${cat.slug}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`  category: ${cat.slug}`);
}

// --- Authors ------------------------------------------------------------
let authorIdCounter = 1;
const authorIdBySlug = new Map();
const authorSlugs = readdirSync(join(sourceRoot, 'authors')).sort();
for (const slug of authorSlugs) {
  const dir = join(sourceRoot, 'authors', slug);
  if (!statSafely(dir)?.isDirectory()) continue;

  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const id = authorIdCounter++;
  authorIdBySlug.set(slug, id);

  // Find a usable image. Skip videos (Ivaylo's autor.mp4 case).
  let photoUrl = null;
  const files = readdirSync(dir);
  for (const f of files) {
    const lower = f.toLowerCase();
    if (lower.startsWith('photo.') && IMAGE_EXT.has(extname(lower))) {
      mkdirSync(join(uploadsAuthors, slug), { recursive: true });
      copyFileSync(join(dir, f), join(uploadsAuthors, slug, f));
      photoUrl = `/uploads/authors/${slug}/${f}`;
      break;
    }
  }

  const out = {
    id,
    slug,
    name: meta.name,
    position: meta.position ?? null,
    bio_html: meta.bio_html ?? '',
    photo: photoUrl,
    photo_alt: meta.photo_alt ?? '',
  };
  writeFileSync(join(authorsDir, `${slug}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(`  author: ${slug} (id=${id}${photoUrl ? '' : ', no photo'})`);
}

// --- Posts --------------------------------------------------------------
const postSlugs = readdirSync(join(sourceRoot, 'posts')).sort();
let postCount = 0;
for (const slug of postSlugs) {
  const dir = join(sourceRoot, 'posts', slug);
  if (!statSafely(dir)?.isDirectory()) continue;

  const meta = JSON.parse(readFileSync(join(dir, 'post.json'), 'utf8'));
  const body = readFileSync(join(dir, meta.body_file ?? 'body.html'), 'utf8');

  let heroUrl = null;
  if (meta.hero_image?.file) {
    const src = join(dir, meta.hero_image.file);
    if (statSafely(src)) {
      mkdirSync(join(uploadsBlog, slug), { recursive: true });
      copyFileSync(src, join(uploadsBlog, slug, meta.hero_image.file));
      heroUrl = `/uploads/blog/${slug}/${meta.hero_image.file}`;
    }
  }
  let thumbnailUrl = null;
  if (meta.thumbnail?.file) {
    const src = join(dir, meta.thumbnail.file);
    if (statSafely(src)) {
      mkdirSync(join(uploadsBlog, slug), { recursive: true });
      copyFileSync(src, join(uploadsBlog, slug, meta.thumbnail.file));
      thumbnailUrl = `/uploads/blog/${slug}/${meta.thumbnail.file}`;
    }
  }

  const date = parseDate(meta.published_date);
  const frontmatter = {
    slug,
    title: meta.title,
    subtitle: meta.subtitle ?? null,
    published_date: meta.published_date,
    published_date_raw: meta.published_date_raw,
    published_date_day: date ? String(date.getUTCDate()).padStart(2, '0') : '',
    published_date_month: date ? MONTHS_SHORT[date.getUTCMonth()] : '',
    category_slug: meta.category?.slug ?? null,
    category_title: meta.category?.title ?? null,
    author_slug: meta.author_slug ?? null,
    author_id: authorIdBySlug.get(meta.author_slug ?? '') ?? null,
    hero_image: heroUrl,
    hero_alt: meta.hero_image?.alt ?? '',
    thumbnail: thumbnailUrl,
    thumbnail_alt: meta.thumbnail?.alt ?? '',
    brief: meta.brief ?? '',
    meta_title: meta.meta_title ?? meta.title,
    meta_desc: meta.meta_desc ?? '',
    original_url: meta.original_url ?? null,
  };

  // Body is HTML (Quill output). Astro Content Collections render the body
  // through markdown — which would mangle the Quill HTML.  We stash it on
  // frontmatter so pages can render it via <Fragment set:html={...}/>.
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${yamlValue(v)}`)
    .join('\n');
  const md = `---
${fm}
body_html: |\n${body
    .split('\n')
    .map((line) => '  ' + line)
    .join('\n')}
---
`;
  writeFileSync(join(blogDir, `${slug}.md`), md);
  console.log(`  post: ${slug}`);
  postCount++;
}

console.log(`\n${postCount} posts, ${authorIdBySlug.size} authors, ${categories.length} categories.`);

// ---- helpers -----------------------------------------------------------

function statSafely(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function extname(p) {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i) : '';
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(+d) ? null : d;
}

function yamlValue(v) {
  if (v === null || v === undefined) return '~';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  // Always JSON-quote strings — bare YAML strings get auto-coerced to Date /
  // number / bool when they look like one (`2022-08-12`, `12`, `true`), and
  // Astro's zod schema then refuses them.
  return JSON.stringify(String(v));
}
