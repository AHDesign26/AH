import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Astro 5, pure SSG. Form endpoints will live in `functions/` as Cloudflare
// Pages Functions; no SSR adapter is needed at this stage.
//
// Static assets reach Astro via a directory junction at `public/static`
// pointing at the Flask app's existing `static/` directory, so URLs like
// `/static/css/vlt-main.min.css` continue to resolve identically. See
// astro-cloudflare-migration-plan.md.
export default defineConfig({
  site: 'https://ahdesign.website',
  output: 'static',
  // Cloudflare Pages 308-redirects /about-us to /about-us/ for a directory
  // build, so the canonical form of every page URL has the trailing slash.
  // This makes the generated sitemap agree with what is actually served.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      // 404, the author/category archives, and home-v1 (the previous
      // homepage design, kept for reference) all carry a noindex meta tag.
      // The one post with a `canonical_slug` in its front matter is a
      // scraped duplicate of /post/website and is listed there.
      filter: (page) =>
        !/\/(404|author|category|home-v1)(\/|$)/.test(page) &&
        !/\/post\/website-design-first-steps-to-consider\/?$/.test(page),
      changefreq: 'weekly',
      lastmod: new Date(),
      serialize(item) {
        // Marketing pages outrank blog archives for crawl priority.
        if (item.url === 'https://ahdesign.website/') item.priority = 1.0;
        else if (/\/(services|price|projects|web-development|ads-service)\/?$/.test(item.url))
          item.priority = 0.9;
        else if (/\/(post|blog)/.test(item.url)) item.priority = 0.7;
        else item.priority = 0.8;
        return item;
      },
    }),
  ],
  vite: {
    server: {
      fs: {
        // Allow serving the sibling Django repo's scraper output during the
        // blog import script (Phase 5). Read-only; no security concern.
        allow: ['..'],
      },
    },
    // Limit Vite's dep-scan to source files. Without this, Vite walks the
    // public/static directory (which is a junction back into static/) and
    // tries to resolve the bundled require() calls in vlt-plugins.min.js,
    // failing because jquery/masonry/isotope etc. aren't in node_modules.
    // Files under public/ are served as-is by Astro and need no scanning.
    optimizeDeps: {
      entries: ['src/**/*.{ts,astro}', 'src/**/*.{js,jsx,tsx}'],
      // src/lib/email.ts matches the entries glob above and imports
      // worker-mailer, which needs `cloudflare:sockets` — real only inside
      // the Workers runtime the Cloudflare Pages Function that calls it
      // actually runs in, not in Vite's Node-based dev/dep-scan. Excluding
      // it here stops that scan from failing on every `astro dev` start.
      exclude: ['worker-mailer'],
    },
  },
});
