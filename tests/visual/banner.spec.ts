import { expect, test } from '@playwright/test';
import { settle } from './helpers';

/**
 * The home banner has a split-color background (white left half, black right
 * half) with the title "Expanding Possibilities" rendered via mix-blend-mode:
 * difference. Result: the left half of the title reads black-on-white, the
 * right half reads white-on-black. These tests pin that visual exactly.
 *
 * Note: a previous version of this file also tried a numeric pixel-luminance
 * check via getComputedStyle().color — that returns the unblended source
 * colour, not the rendered pixel, so it can't validate mix-blend-mode output.
 * The screenshot diff already catches any regression in the blended result.
 */

test('home banner — split mix-blend-mode', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const banner = page.locator('.vlt-project-showcase--style-6').first();
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot('banner-split.png');
});

test('home banner — title element only', async ({ page }) => {
  await page.goto('/');
  await settle(page);
  const title = page.locator('.vlt-project-showcase__title.original').first();
  await expect(title).toBeVisible();
  await expect(title).toHaveScreenshot('banner-title.png');
});
