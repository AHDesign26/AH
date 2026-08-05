import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Cache-busting suffix for the hand-edited stylesheets under /static.
 *
 * Cloudflare Pages serves everything in /static with `max-age=2678400`, and the
 * filenames never change, so an edit to custom.css keeps being served from the
 * edge (and from browser caches) for up to 31 days. That shipped once: new HTML
 * went live against a stylesheet 26 hours stale, and the pages that depended on
 * the new rules rendered unstyled.
 *
 * Hashing the file at build time gives each version its own URL, so a changed
 * stylesheet is fetched immediately and an unchanged one stays cached.
 * Runs in the Astro build (Node), never in the browser.
 */
function hash(path: string): string {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 8);
  } catch {
    // Missing file: fall back to no suffix rather than breaking the build.
    return '';
  }
}

/** Append to a /static URL, e.g. `/static/css/custom.css${assetVersion(...)}`. */
export function versioned(publicPath: string): string {
  const h = hash(`./public${publicPath}`);
  return h ? `${publicPath}?v=${h}` : publicPath;
}
