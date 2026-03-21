import { test, expect } from '@playwright/test';

// ─── Configuration ────────────────────────────────────────────────────────────

const HN_URL = 'https://news.ycombinator.com';

/**
 * A well-known, long-standing HN account used as a stable test fixture.
 * Paul Graham (pg) is the founder of HN — his profile will always exist
 * and always have karma, an about section, and a creation date.
 */
const TEST_USER = 'pg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the text content of the last <td> in the profile table row
 * that contains the given label text (e.g. "karma:", "created:").
 */
function profileRow(page: import('@playwright/test').Page, label: string) {
  return page.locator('tr').filter({ hasText: label }).locator('td').last();
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — User Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${HN_URL}/user?id=${TEST_USER}`, { waitUntil: 'domcontentloaded' });
  });

  // ── Identity & presence ────────────────────────────────────────────────────

  test('profile page loads and shows the correct username', async ({ page }) => {
    await expect(page).toHaveURL(`${HN_URL}/user?id=${TEST_USER}`);
    // The username cell contains a link with the username as its text.
    const usernameCell = profileRow(page, 'user:');
    await expect(usernameCell).toContainText(TEST_USER);
  });

  // ── Profile fields ─────────────────────────────────────────────────────────

  test('profile shows a karma score that is a positive integer', async ({ page }) => {
    const karmaText = await profileRow(page, 'karma:').innerText();
    // Karma can be formatted with commas (e.g. "155,543") — strip them before parsing.
    const karma = parseInt(karmaText.replace(/,/g, ''), 10);
    expect(karma, `Expected a positive karma score, got "${karmaText}"`).toBeGreaterThan(0);
  });

  test('profile shows an account creation date in YYYY-MM-DD format', async ({ page }) => {
    const dateText = await profileRow(page, 'created:').innerText();
    expect(dateText.trim()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('profile creation date is a date in the past', async ({ page }) => {
    const dateText = await profileRow(page, 'created:').innerText();
    const created = new Date(dateText.trim());
    expect(created.getTime()).toBeLessThan(Date.now());
  });

  // ── Navigation links ───────────────────────────────────────────────────────

  test('profile has a working link to the user\'s submissions', async ({ page }) => {
    const link = page.locator(`a[href="submitted?id=${TEST_USER}"]`);
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`submitted\\?id=${TEST_USER}`));

    // The submissions page should list at least one article.
    await expect(page.locator('.athing').first()).toBeVisible();
  });

  test('profile has a working link to the user\'s comments', async ({ page }) => {
    const link = page.locator(`a[href="threads?id=${TEST_USER}"]`);
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`threads\\?id=${TEST_USER}`));
  });

  // ── Navigation from article list ───────────────────────────────────────────

  test('clicking an author link on the front page opens that user\'s profile', async ({ page }) => {
    await page.goto(HN_URL, { waitUntil: 'domcontentloaded' });

    const firstAuthorLink = page.locator('.hnuser').first();
    const authorName = await firstAuthorLink.innerText();

    await firstAuthorLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(`${HN_URL}/user?id=${authorName}`);
    // The username should appear in the profile table.
    await expect(profileRow(page, 'user:')).toContainText(authorName);
  });
});
