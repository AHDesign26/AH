import { defineConfig } from 'astro/config';

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
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
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
    },
  },
});
