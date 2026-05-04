import { expect, test } from '@playwright/test';
import { settleKeepCursor } from './helpers';

/**
 * Smoke test for the custom cursor follower.
 *
 * The element (`.vlt-cursor`) is constantly re-positioned by the
 * vlt-controllers script on mousemove, which makes a stable visual snapshot
 * impossible (Playwright's screenshot stabilisation never settles). Behavioural
 * verification (activates over `.has-cursor`) is too timing-sensitive for the
 * baseline pass and lives in Phase 6's integration tests instead.
 *
 * For this baseline we only assert the element exists in the DOM on desktop /
 * tablet, and is not relied on at mobile width.
 */

test('cursor follower exists in DOM', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'no cursor on mobile');
  await page.goto('/');
  await settleKeepCursor(page);
  const cursor = page.locator('.vlt-cursor');
  await expect(cursor).toHaveCount(1);
});
