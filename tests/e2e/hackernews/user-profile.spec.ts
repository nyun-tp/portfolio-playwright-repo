import { test, expect, Page } from '@playwright/test';
import { HN_URL, gotoHN } from './helpers';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * A well-known, long-standing HN account used as a stable test fixture.
 * Paul Graham (pg) is the founder of HN — his profile will always exist
 * and always have karma, an about section, and a creation date.
 */
const TEST_USER = 'pg';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the value <td> adjacent to the label cell for the given profile field.
 *
 * `filter({ hasText })` does a substring match, so a label like "user:" would
 * also match rows whose about text happens to contain "user:". Instead, we find
 * the <td> whose text content is *exactly* the label, then use XPath to navigate
 * to its immediate sibling value cell — unambiguous regardless of page content.
 */
function profileRow(page: Page, label: string) {
  return page
    .locator('td')
    .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
    .first()
    .locator('xpath=following-sibling::td[1]');
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — User Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHN(page, `/user?id=${TEST_USER}`);
  });

  // ── Identity & presence ────────────────────────────────────────────────────

  test('profile page loads and shows the correct username', async ({ page }) => {
    await expect(page).toHaveURL(`${HN_URL}/user?id=${TEST_USER}`);
    await expect(profileRow(page, 'user:')).toContainText(TEST_USER);
  });

  // ── Profile fields ─────────────────────────────────────────────────────────

  test('profile shows a karma score that is a positive integer', async ({ page }) => {
    const karmaText = await profileRow(page, 'karma:').innerText();
    // Karma can be formatted with commas (e.g. "155,543") — strip them before parsing.
    const karma = parseInt(karmaText.replace(/,/g, ''), 10);
    expect(karma, `Expected a positive karma score, got "${karmaText}"`).toBeGreaterThan(0);
  });

  test('profile shows a valid creation date in the past', async ({ page }) => {
    const dateText = (await profileRow(page, 'created:').innerText()).trim();
    // HN renders "YYYY-MM-DD" server-side, but page JS may reformat it to a
    // locale string (e.g. "October 9, 2006") before we read it, depending on
    // browser timing. Accept whichever format arrives.
    const parsed = new Date(dateText);
    expect(parsed.getTime(), `Could not parse creation date: "${dateText}"`).not.toBeNaN();
    expect(parsed.getTime(), `Creation date "${dateText}" should be in the past`).toBeLessThan(Date.now());
  });

  // ── Navigation links ───────────────────────────────────────────────────────

  test("profile has a working link to the user's submissions", async ({ page }) => {
    const link = page.locator(`a[href="submitted?id=${TEST_USER}"]`);
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`submitted\\?id=${TEST_USER}`));

    // The submissions page should list at least one article.
    await expect(page.locator('.athing').first()).toBeVisible();
  });

  test("profile has a working link to the user's comments", async ({ page }) => {
    const link = page.locator(`a[href="threads?id=${TEST_USER}"]`);
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(new RegExp(`threads\\?id=${TEST_USER}`));
  });

  // ── Navigation from article list ───────────────────────────────────────────

  test("clicking an author link on the front page opens that user's profile", async ({ page }) => {
    await gotoHN(page);

    const firstAuthorLink = page.locator('.hnuser').first();
    const authorName = await firstAuthorLink.innerText();

    await firstAuthorLink.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(`${HN_URL}/user?id=${authorName}`);
    await expect(profileRow(page, 'user:')).toContainText(authorName);
  });
});
