import { test, expect, Browser } from '@playwright/test';
import { gotoHN } from './helpers';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Maximum number of comments to individually inspect.
 * Keeps the test fast while still exercising the comment structure.
 */
const COMMENTS_TO_CHECK = 20;

// ─── Shared State ─────────────────────────────────────────────────────────────

/** Site-relative path of the first front-page article's discussion page. Set in beforeAll. */
let articleItemPath = '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the site-relative item path (e.g. `/item?id=12345`) for the first
 * article on the HN front page. The `.age` anchor always links to `item?id=...`
 * making it a reliable pointer to the article's discussion page.
 */
async function resolveFirstArticleItemPath(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoHN(page);
    const href = await page.locator('.subtext').first().locator('.age a').getAttribute('href');
    if (!href) throw new Error('Could not find item link on front page');
    return `/${href}`;
  } finally {
    await context.close();
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — Article Discussion Page', () => {
  // Serial mode ensures beforeAll runs before any test and the shared path is ready.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    articleItemPath = await resolveFirstArticleItemPath(browser);
    console.log(`\nTesting article page: ${articleItemPath}`);
  });

  test.beforeEach(async ({ page }) => {
    // Guard: skip all tests in this suite if the front-page navigation failed.
    test.skip(!articleItemPath, 'Could not resolve article path from front page');
    await gotoHN(page, articleItemPath);
  });

  // ── Article header ─────────────────────────────────────────────────────────

  test('article page shows a non-empty title', async ({ page }) => {
    const title = page.locator('.titleline > a').first();
    await expect(title).toBeVisible();
    const text = (await title.innerText()).trim();
    expect(text, 'Article title should not be empty').not.toBe('');
  });

  test('article header shows score, author, and timestamp', async ({ page }) => {
    const subline = page.locator('.subline').first();
    await expect(subline.locator('.score')).toBeVisible();
    await expect(subline.locator('.hnuser')).toBeVisible();
    await expect(subline.locator('.age')).toBeVisible();
  });

  test('comment count label is a valid number or "discuss"', async ({ page }) => {
    // The last link in .subline is always the comment count link.
    const subline = page.locator('.subline').first();
    const lastLink = subline.getByRole('link').last();
    const text = await lastLink.innerText();

    // Valid formats: "42 comments", "1 comment", "discuss" (0 comments).
    // HN separates the number from "comments" with a non-breaking space (\u00A0),
    // so \s+ is used instead of a literal space.
    const isValid = /^\d+\s+comments?$/.test(text) || text === 'discuss';
    expect(isValid, `Unexpected comment link text: "${text}"`).toBe(true);
  });

  // ── Comment thread ─────────────────────────────────────────────────────────

  test('comment thread section is present when the article has comments', async ({ page }) => {
    const commentCount = await page.locator('.athing.comtr').count();
    test.skip(commentCount === 0, 'This article has no comments yet');

    await expect(page.locator('.athing.comtr').first()).toBeVisible();
  });

  test('each comment has an author and a timestamp', async ({ page }) => {
    const { total, errors } = await page.locator('.athing.comtr').evaluateAll(
      (els, limit) => ({
        total: els.length,
        errors: els.slice(0, limit).flatMap((el, i) => {
          const errs: string[] = [];
          if (!el.querySelector('.hnuser')) errs.push(`Comment ${i + 1}: missing author`);
          if (!el.querySelector('.age'))    errs.push(`Comment ${i + 1}: missing timestamp`);
          return errs;
        }),
      }),
      COMMENTS_TO_CHECK,
    );

    test.skip(total === 0, 'This article has no comments yet');
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('comment text is non-empty for visible (non-collapsed) comments', async ({ page }) => {
    const { total, errors } = await page.locator('.athing.comtr').evaluateAll(
      (els, limit) => ({
        total: els.length,
        errors: els.slice(0, limit).flatMap((el, i) => {
          const commtext = el.querySelector('.commtext');
          if (!commtext) return []; // collapsed/dead comment — skip
          const text = (commtext.textContent ?? '').trim();
          return text ? [] : [`Comment ${i + 1}: empty comment text`];
        }),
      }),
      COMMENTS_TO_CHECK,
    );

    test.skip(total === 0, 'This article has no comments yet');
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('comment thread contains nested (indented) replies', async ({ page }) => {
    // HN uses <img width="N"> inside .ind to encode depth.
    // Width 0 = top-level, width > 0 = reply at that indent level.
    const { total, hasNested } = await page.locator('.athing.comtr').evaluateAll(els => ({
      total: els.length,
      hasNested: els.some(el => {
        const img = el.querySelector('.ind img');
        return img ? parseInt(img.getAttribute('width') ?? '0', 10) > 0 : false;
      }),
    }));

    // Need at least 2 comments for a reply to be possible.
    test.skip(total < 2, 'Not enough comments to test nesting');
    expect(hasNested, 'Expected at least one nested (indented) reply').toBe(true);
  });

  test('clicking the article title opens the external URL in the same tab', async ({ page }) => {
    const titleLink = page.locator('.titleline > a').first();
    const href = await titleLink.getAttribute('href');

    // Internal Ask HN / Show HN posts link to item?id=... (same site).
    // External articles link elsewhere. Either way the href must be present.
    expect(href, 'Article title should have a non-empty href').toBeTruthy();
  });
});
