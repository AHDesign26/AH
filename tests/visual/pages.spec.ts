import { expect, test } from '@playwright/test';
import { PUBLIC_PAGES, SAMPLE_POST_SLUGS, settle } from './helpers';

for (const { path, name } of PUBLIC_PAGES) {
  test(`page: ${name}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.ok(), `${path} did not return 2xx`).toBeTruthy();
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}

for (const slug of SAMPLE_POST_SLUGS) {
  test(`post: ${slug}`, async ({ page }) => {
    const response = await page.goto(`/post/${slug}`);
    expect(response?.ok(), `/post/${slug} did not return 2xx`).toBeTruthy();
    await settle(page);
    await expect(page).toHaveScreenshot(`post-${slug}.png`, { fullPage: true });
  });
}

test('category: website', async ({ page }) => {
  const response = await page.goto('/category/website');
  expect(response?.ok()).toBeTruthy();
  await settle(page);
  await expect(page).toHaveScreenshot('category-website.png', { fullPage: true });
});

test('author: 1', async ({ page }) => {
  const response = await page.goto('/author/1');
  expect(response?.ok()).toBeTruthy();
  await settle(page);
  await expect(page).toHaveScreenshot('author-1.png', { fullPage: true });
});

test('404 page', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status(), '404 should return 404').toBe(404);
  await settle(page);
  await expect(page).toHaveScreenshot('not-found.png', { fullPage: true });
});
