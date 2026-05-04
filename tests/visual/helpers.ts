import type { Page } from '@playwright/test';

/**
 * Stop layout/animation jitter that ruins pixel diffs. Call after navigation,
 * before any toHaveScreenshot.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    // Wait for fonts so text metrics are final.
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // Scroll back to top in case AOS or smooth-scroll moved us.
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      [data-aos] { opacity: 1 !important; transform: none !important; }
      .vlt-cursor { display: none !important; }
    `,
  });
  // One frame for the style to commit.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

/**
 * Like settle() but keeps the cursor follower visible — used by cursor-specific
 * tests that need to assert the follower's appearance.
 */
export async function settleKeepCursor(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    window.scrollTo(0, 0);
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
      [data-aos] { opacity: 1 !important; transform: none !important; }
    `,
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
}

/**
 * Public routes Flask currently serves. Update this list when adding/removing
 * pages. Blog post slugs come from scraper output and are tested separately.
 */
export const PUBLIC_PAGES = [
  { path: '/', name: 'home' },
  { path: '/about-us', name: 'about-us' },
  { path: '/services', name: 'services' },
  { path: '/web_development', name: 'web-development' },
  { path: '/ads-service', name: 'ads-service' },
  { path: '/projects', name: 'projects' },
  { path: '/price', name: 'price' },
  { path: '/contact', name: 'contact' },
  { path: '/order', name: 'order' },
  { path: '/blog', name: 'blog' },
] as const;

export const SAMPLE_POST_SLUGS = [
  '10-things-to-check-before-launch',
  'building-website',
  'how-long-and-how-much-to-launch-a-website',
  'seo-for-beginners',
  'technical-side-of-seo',
  'web-development-dictionary',
  'website',
] as const;
