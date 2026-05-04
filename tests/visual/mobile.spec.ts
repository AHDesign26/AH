import { expect, test } from '@playwright/test';
import { settle, PUBLIC_PAGES } from './helpers';

/**
 * Mobile-only assertions that aren't covered by the cross-viewport `pages.spec.ts`
 * full-page diffs. The mobile menu (off-canvas), the hidden mix-blend-mode
 * banner mask, and the disappearance of the service `.vlt-service__icon` all
 * need their own check.
 */

test('home — banner has no mix-blend-mode mask on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
  await page.goto('/');
  await settle(page);

  // The `.mask` element was removed from the DOM in commit e68199d. The
  // `.original` element still exists, but the >=768px-only mix-blend-mode
  // rule is inactive at mobile width, so it should render as plain coloured
  // text. This test pins that rendering.
  const banner = page.locator('.vlt-project-showcase--style-6').first();
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot('banner-mobile.png');
});

test('home — service card icons hidden on small viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
  await page.goto('/');
  await settle(page);
  const firstCard = page.locator('.vlt-service--style-3').first();
  await firstCard.scrollIntoViewIfNeeded();
  // Per vlt-main.min.css line ~6566, .vlt-service__icon is `display: none`
  // below 991px. Confirm it.
  const icon = firstCard.locator('.vlt-service__icon');
  await expect(icon).toBeHidden();
});

test('mobile nav toggle — open and close', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
  await page.goto('/');
  await settle(page);

  // The vlt theme uses an off-canvas hamburger. Common selectors: `.vlt-burger`
  // or `[data-toggle="vlt-fullscreen-menu"]`. We try a few.
  const triggerSelectors = [
    '.vlt-menu-burger',
    '.vlt-burger',
    '.vlt-burger-menu',
    '[data-toggle="vlt-fullscreen-menu"]',
    '.vlt-header__burger',
  ];

  let trigger = page.locator(triggerSelectors[0]).first();
  for (const sel of triggerSelectors) {
    const candidate = page.locator(sel).first();
    if (await candidate.isVisible().catch(() => false)) {
      trigger = candidate;
      break;
    }
  }

  await expect(trigger, 'a mobile menu trigger should be visible').toBeVisible();
  await trigger.click();
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  await expect(page).toHaveScreenshot('mobile-nav-open.png', { fullPage: false });

  // Close: click trigger again or press Escape.
  await trigger.click({ trial: true }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
});

// Sanity: every public page renders without horizontal scrollbar at mobile.
for (const { path, name } of PUBLIC_PAGES) {
  test(`mobile no horizontal overflow: ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only');
    await page.goto(path);
    await settle(page);
    const overflow = await page.evaluate(() => {
      return {
        bodyScroll: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(
      overflow.bodyScroll,
      `${path} body scroll width (${overflow.bodyScroll}) > viewport (${overflow.clientWidth}) — horizontal overflow detected`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
}
