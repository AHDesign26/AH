import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Real pixel dimensions for a site-relative image path (e.g.
 * `/uploads/blog/website/thumbnail.png`), read from the file under
 * `public/` at build time. Used to set <img width height> on images whose
 * source varies per entry (blog thumbnails, hero images, author photos) —
 * without these, the browser can't reserve layout space before the image
 * loads, so the page jumps as each one comes in.
 *
 * Memoized (same file is looked up many times — every post card on /blog,
 * every sidebar "recent posts" thumbnail) and never throws: a missing or
 * unreadable file just means no width/height attribute gets rendered,
 * same as today.
 */
const cache = new Map<string, Promise<{ width: number; height: number } | null>>();

export function imageDims(publicPath: string | null | undefined): Promise<{
  width: number;
  height: number;
} | null> {
  if (!publicPath) return Promise.resolve(null);

  const cached = cache.get(publicPath);
  if (cached) return cached;

  const promise = (async () => {
    const fsPath = path.join(process.cwd(), 'public', publicPath);
    if (!existsSync(fsPath)) return null;
    try {
      const meta = await sharp(fsPath).metadata();
      return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    } catch {
      return null;
    }
  })();

  cache.set(publicPath, promise);
  return promise;
}
