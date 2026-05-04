import { expect, test } from '@playwright/test';
import { settle } from './helpers';

/**
 * Hover state of the four service cards on the homepage. The cards switch from
 * white background to dark on hover, the icon should be visible against the
 * dark background, and the red accent must be preserved (the
 * `invert(1) hue-rotate(180deg)` filter on Advertising Solutions / Business
 * Development is the specific reason this test exists).
 */

const CARDS = [
  { index: 0, name: 'web-design' },
  { index: 1, name: 'advertising-solutions' },
  { index: 2, name: 'web-development' },
  { index: 3, name: 'business-development' },
] as const;

for (const { index, name } of CARDS) {
  test(`service card hover: ${name}`, async ({ page }, testInfo) => {
    // The cards live on the homepage services section.
    await page.goto('/');
    await settle(page);

    const card = page.locator('.vlt-service.vlt-service--style-3').nth(index);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeVisible();

    // Hover.
    await card.hover();
    // Allow the (now zero-duration) hover style to commit one frame.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

    await expect(card).toHaveScreenshot(`hover-${name}-${testInfo.project.name}.png`);
  });
}

test('service cards — non-hover baseline', async ({ page }, testInfo) => {
  await page.goto('/');
  await settle(page);
  const services = page.locator('.vlt-services-list, .row').filter({ has: page.locator('.vlt-service--style-3') }).first();
  await services.scrollIntoViewIfNeeded();
  // Park the mouse off-screen so no card is hovered.
  await page.mouse.move(0, 0);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  await expect(services).toHaveScreenshot(`services-row-idle-${testInfo.project.name}.png`);
});
