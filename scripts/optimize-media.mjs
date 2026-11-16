#!/usr/bin/env node
/**
 * Resize and compress every image/video under the site's media folders so
 * uploads are automatically "web ready" — no one has to remember to shrink a
 * phone photo or a screen-recorded MP4 before it ships.
 *
 * Runs automatically before every `npm run build` (wired up as `prebuild` in
 * package.json), so it covers both ways media reaches this repo: the Decap
 * CMS at /admin (public/uploads/cms) and anything copied straight into
 * public/static/img. Cloudflare Pages triggers a build on every commit to
 * main, so a CMS upload gets optimized the moment it's published — no manual
 * step. It's also safe (and useful, for a faster `astro dev`) to run by hand:
 *
 *   npm run optimize-media            # process everything that changed
 *   npm run optimize-media -- --dry-run
 *   npm run optimize-media -- --force # ignore the cache, reprocess everything
 *
 * What it does, per file:
 *   - Images (jpg/jpeg/png/gif): shrink to a sane max dimension (2000px,
 *     512px under any `icon/` folder) if larger, re-compress in place, and
 *     write a same-name `.webp` sibling (smaller, and nearly universally
 *     supported — Safari has shipped it since 2020). Pages can opt into
 *     serving it with a <picture> element; nothing is required to change.
 *   - Images already .webp: capped/recompressed in place, no sibling.
 *   - SVGs: left alone — already vector, already small.
 *   - Videos (mp4/mov/webm/m4v): capped to 1920px wide and re-encoded to
 *     H.264 + AAC with `+faststart`, the combination every modern browser
 *     and device can play and that starts playback before the whole file
 *     downloads. ffmpeg comes from the `ffmpeg-static` devDependency, so
 *     this doesn't depend on whatever (if anything) is installed on the
 *     machine running the build.
 *
 * A file is only reprocessed if its content hash changed since the last run
 * (tracked in .cache/media-optimize.json, gitignored) — safe to run on every
 * build without repeatedly re-compressing the same JPEG into mush, and fast
 * once a repo's media has already been optimized once.
 *
 * Never fails the build over one bad file: a per-file error is logged and
 * skipped so the rest of the batch (and the deploy) still goes through.
 */

import { readdir, stat, readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
// public/uploads (not just .../cms) — also covers public/uploads/blog and
// public/uploads/authors, the Decap-imported blog hero/thumbnail images and
// author photos, which otherwise never got swept.
const TARGET_DIRS = ['public/static/img', 'public/uploads'];
const CACHE_PATH = path.join(ROOT, '.cache', 'media-optimize.json');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const WEBP_EXT = '.webp';
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm']);

const MAX_DIM = 2000;
// Icons render at 180px at most anywhere on the site (2x retina = 360px);
// 400px leaves headroom without shipping 512px of icon for a 180px box.
const MAX_ICON_DIM = 400;
const MAX_VIDEO_WIDTH = 1920;
const IMAGE_CONCURRENCY = 4;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');

function isIconPath(filePath) {
  return /[\\/]icon[\\/]/i.test(filePath);
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function hashFile(filePath) {
  const buf = await readFile(filePath);
  return crypto.createHash('sha1').update(buf).digest('hex');
}

async function loadCache() {
  try {
    return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

/** Resize-if-needed + re-encode an image in place, plus a .webp sibling. */
async function processImage(filePath, cache) {
  const ext = path.extname(filePath).toLowerCase();
  const before = (await stat(filePath)).size;
  const maxDim = isIconPath(filePath) ? MAX_ICON_DIM : MAX_DIM;
  const animated = ext === '.gif';

  const base = sharp(filePath, { animated });
  const meta = await base.metadata();
  const oversized = (meta.width ?? 0) > maxDim || (meta.height ?? 0) > maxDim;

  function resized() {
    const img = sharp(filePath, { animated });
    return oversized
      ? img.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true })
      : img;
  }

  let outBuffer;
  if (ext === '.jpg' || ext === '.jpeg') {
    outBuffer = await resized().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toBuffer();
  } else if (ext === '.png') {
    outBuffer = await resized().png({ compressionLevel: 9, effort: 10, palette: true }).toBuffer();
  } else if (ext === '.gif') {
    outBuffer = oversized ? await resized().gif().toBuffer() : null;
  } else if (ext === WEBP_EXT) {
    outBuffer = await resized().webp({ quality: 82, animated }).toBuffer();
  }

  let changed = false;
  if (outBuffer && (outBuffer.length < before || oversized)) {
    if (!DRY_RUN) await writeFile(filePath, outBuffer);
    changed = true;
  }

  // Modern-format sibling for every non-webp raster image, so pages can
  // progressively serve it via <picture> without anything else changing.
  // Its cache entry is recorded right here, from the buffer already in
  // memory, rather than left for the next scan to discover it as a "new"
  // file — otherwise every sibling would get a redundant, slightly lossy
  // re-encode pass the run after it was created.
  let webpWritten = false;
  if (ext !== WEBP_EXT) {
    const webpPath = filePath.slice(0, -ext.length) + WEBP_EXT;
    const webpBuf = await resized().webp({ quality: 82, animated }).toBuffer();
    if (!DRY_RUN) {
      await writeFile(webpPath, webpBuf);
      cache[path.relative(ROOT, webpPath)] = {
        hash: crypto.createHash('sha1').update(webpBuf).digest('hex'),
        processedAt: Date.now(),
      };
    }
    webpWritten = true;
  }

  const after = changed && !DRY_RUN ? (await stat(filePath)).size : before;
  return { changed, before, after, webpWritten };
}

/**
 * Re-encode a video to web-safe H.264, capped to MAX_VIDEO_WIDTH wide, with
 * its audio track dropped. Every <video> on this site is `autoplay muted
 * loop` background decoration (checked across every page that uses one) —
 * none is ever heard, so the audio track is pure dead weight.
 */
async function processVideo(filePath) {
  const before = (await stat(filePath)).size;
  if (DRY_RUN) return { changed: true, before, after: before };

  const tmpOut = `${filePath}.optimizing${path.extname(filePath)}`;
  try {
    await execFileAsync(ffmpegPath, [
      '-y',
      '-i',
      filePath,
      '-vf',
      `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-an',
      '-movflags',
      '+faststart',
      tmpOut,
    ]);
  } catch (err) {
    await unlink(tmpOut).catch(() => {});
    throw err;
  }

  const optSize = (await stat(tmpOut)).size;
  if (optSize > 0 && optSize < before) {
    await rename(tmpOut, filePath);
    return { changed: true, before, after: optSize };
  }
  await unlink(tmpOut).catch(() => {});
  return { changed: false, before, after: before };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  if (!existsSync(ffmpegPath)) {
    console.warn(
      `optimize-media: ffmpeg binary not found at ${ffmpegPath} — videos will be skipped this run.`,
    );
  }

  const cache = await loadCache();
  const allFiles = (await Promise.all(TARGET_DIRS.map((d) => walk(path.join(ROOT, d))))).flat();

  const images = [];
  const videos = [];
  for (const f of allFiles) {
    const ext = path.extname(f).toLowerCase();
    if (IMAGE_EXT.has(ext) || ext === WEBP_EXT) images.push(f);
    else if (VIDEO_EXT.has(ext)) videos.push(f);
  }

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let totalBefore = 0;
  let totalAfter = 0;

  async function handle(filePath, kind) {
    const rel = path.relative(ROOT, filePath);
    let hash;
    try {
      hash = await hashFile(filePath);
    } catch (err) {
      console.warn(`optimize-media: couldn't read ${rel}: ${err.message}`);
      errorCount++;
      return;
    }

    if (!FORCE && cache[rel]?.hash === hash) {
      skippedCount++;
      return;
    }

    try {
      const result =
        kind === 'image' ? await processImage(filePath, cache) : await processVideo(filePath);
      totalBefore += result.before;
      totalAfter += result.after;
      if (result.changed) {
        processedCount++;
        console.log(
          `  ${rel}: ${fmtBytes(result.before)} -> ${fmtBytes(result.after)}` +
            (result.webpWritten ? ' (+ .webp)' : ''),
        );
      }
      if (!DRY_RUN) {
        cache[rel] = { hash: await hashFile(filePath), processedAt: Date.now() };
      }
    } catch (err) {
      console.warn(`optimize-media: failed on ${rel}: ${err.message}`);
      errorCount++;
    }
  }

  if (images.length) {
    console.log(`optimize-media: scanning ${images.length} image(s)...`);
    await mapWithConcurrency(images, IMAGE_CONCURRENCY, (f) => handle(f, 'image'));
  }

  if (videos.length && existsSync(ffmpegPath)) {
    console.log(`optimize-media: scanning ${videos.length} video(s)...`);
    for (const f of videos) await handle(f, 'video');
  }

  if (!DRY_RUN) await saveCache(cache);

  const savedBytes = totalBefore - totalAfter;
  console.log(
    `optimize-media: ${processedCount} changed, ${skippedCount} unchanged (cached), ${errorCount} errors` +
      (savedBytes > 0 ? `, saved ${fmtBytes(savedBytes)}` : '') +
      (DRY_RUN ? ' [dry run — nothing written]' : ''),
  );

  // A bad/corrupt file shouldn't fail the whole site build; only exit
  // non-zero if literally nothing could be read at all.
  if (errorCount > 0 && processedCount === 0 && skippedCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('optimize-media: fatal error:', err);
  process.exitCode = 1;
});
