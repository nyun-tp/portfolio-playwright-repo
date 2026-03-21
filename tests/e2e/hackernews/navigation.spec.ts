import { test, expect } from '@playwright/test';
import { HN_URL, gotoHN, parseRank } from './helpers';

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — Site Navigation', () => {
  // ── Logo ───────────────────────────────────────────────────────────────────

  test('HN logo navigates back to the front page from a section page', async ({ page }) => {
    await gotoHN(page, '/ask');
    await page.locator('.hnname a').click();
    await page.waitForLoadState('domcontentloaded');

    // Front page URL can be / or /news
    await expect(page).toHaveURL(/news\.ycombinator\.com\/?(?:news)?(?:\?.*)?$/);
    await expect(page.locator('.athing.submission').first()).toBeVisible();
  });

  // ── Section links ──────────────────────────────────────────────────────────

  const sections: { name: string; urlPattern: RegExp }[] = [
    { name: 'new',      urlPattern: /\/newest/      },
    { name: 'past',     urlPattern: /\/front/       },
    { name: 'comments', urlPattern: /\/newcomments/ },
    { name: 'ask',      urlPattern: /\/ask/         },
    { name: 'show',     urlPattern: /\/show/        },
    { name: 'jobs',     urlPattern: /\/jobs/        },
  ];

  for (const { name, urlPattern } of sections) {
    test(`clicking "${name}" navigates to the correct section`, async ({ page }) => {
      await gotoHN(page);
      await page.locator('span.pagetop').getByRole('link', { name, exact: true }).click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(urlPattern);
    });
  }

  // ── Pagination ─────────────────────────────────────────────────────────────

  test('"More" on the front page loads page 2 starting at rank 31', async ({ page }) => {
    await gotoHN(page);
    await page.locator('.morelink').click();
    await page.waitForLoadState('domcontentloaded');

    const firstRank = parseRank(await page.locator('.rank').first().innerText());
    expect(firstRank).toBe(31);
  });

  test('"More" on /newest loads the next page of new articles', async ({ page }) => {
    await gotoHN(page, '/newest');

    // Record the last article ID on page 1 to confirm page 2 is truly different
    const lastIdPage1 = await page.locator('.athing.submission').last().getAttribute('id');

    await page.locator('.morelink').click();
    await page.waitForLoadState('domcontentloaded');

    const firstIdPage2 = await page.locator('.athing.submission').first().getAttribute('id');
    expect(firstIdPage2).not.toBe(lastIdPage1);
  });

  // ── Browser history ────────────────────────────────────────────────────────

  test('browser back returns to the previous page', async ({ page }) => {
    await gotoHN(page);
    await page.locator('span.pagetop').getByRole('link', { name: 'ask', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/ask/);

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/news\.ycombinator\.com/);
    await expect(page.locator('.athing.submission').first()).toBeVisible();
  });

  test('browser forward re-applies the navigation after going back', async ({ page }) => {
    await gotoHN(page);
    await page.locator('span.pagetop').getByRole('link', { name: 'show', exact: true }).click();
    await page.waitForLoadState('domcontentloaded');

    await page.goBack();
    await page.waitForLoadState('domcontentloaded');

    await page.goForward();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/show/);
  });
});
