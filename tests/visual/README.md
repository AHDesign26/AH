# Visual regression tests

Pixel-diff suite that runs against the **live current site** to capture golden
masters, then re-runs against the future Astro dev server / preview URL during
the migration. A full-page diff under `maxDiffPixels: 100` is the binary
success criterion for porting each page.

## One-time setup

```bash
npm install
npx playwright install chromium
```

(Node 20+ recommended.)

## Capturing baselines from the live site

Run once, before any Astro work begins:

```bash
npm run test:visual:live:update
```

This points the suite at `https://ahdesign.website` and writes screenshots
into `tests/visual/__screenshots__/`. **Commit the resulting directory** — it
is the source of truth.

## Running diffs against a different URL

```bash
BASE_URL=http://localhost:4321 npm run test:visual         # local dev server
BASE_URL=https://astro-migration.ah.pages.dev npm run test:visual   # CF Pages preview
```

Failed diffs land in `playwright-report/` and `test-results/`; open with
`npm run test:visual:report`.

## Updating snapshots intentionally

After a sanctioned visual change (e.g., the migration is finished and the site
genuinely looks different), regenerate from whatever URL is canonical:

```bash
BASE_URL=<canonical-url> npm run test:visual:update
```

Review the snapshot diff in git before committing.

## What's covered

| File | What it pins |
|---|---|
| `pages.spec.ts` | Full-page screenshots of every public route + 7 known blog posts + category + author + 404, at desktop / tablet / mobile |
| `banner.spec.ts` | The home banner's split mix-blend-mode title (split-screen background, text reads opposite of background on each side) — both as a screenshot and as a pixel-luminance assertion |
| `services.spec.ts` | Hover state for all four service cards on the homepage. The two with raster PNG icons (Advertising Solutions, Business Development) are pinned separately to confirm `invert(1) hue-rotate(180deg)` preserves the red accent |
| `cursor.spec.ts` | The `.vlt-cursor` follower's existence, activation when hovering a `.has-cursor` element, and idle appearance |
| `mobile.spec.ts` | Mobile-only checks: banner without the desktop `.mask`, service icons hidden below 991px, hamburger menu open/close, no horizontal overflow on any page |

## Notes on flake control

- All animations and transitions are disabled in `helpers.settle()` before any
  screenshot is taken.
- `data-aos` elements are forced to their final state so AOS scroll-reveal
  doesn't depend on scroll position.
- The custom cursor follower is hidden in `settle()` (and explicitly kept in
  `settleKeepCursor()` only for the cursor tests).
- `workers: 1` and `fullyParallel: false` in `playwright.config.ts` so two
  tests don't compete for the same window's render state.
- `scale: 'css'` to dodge HiDPI inconsistencies.

## Why this lives at repo root for now

Once Astro is bootstrapped, this Playwright config and the `package.json` will
either merge into the Astro project's `package.json` (preferred) or stay
side-by-side. Either way, no test file under `tests/visual/` needs to change.
