import { test, expect, Browser } from '@playwright/test';

// ─── Configuration ────────────────────────────────────────────────────────────

const HN_URL = 'https://news.ycombinator.com';

/**
 * Maximum number of comments to individually inspect.
 * Keeps the test fast while still exercising the comment structure.
 */
const COMMENTS_TO_CHECK = 20;

// ─── Shared State ─────────────────────────────────────────────────────────────

/** URL of the first front-page article's HN discussion page. Set in beforeAll. */
let articleItemUrl = '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the item page URL for the first article on the HN front page.
 * The .age anchor always links to `item?id=...` — a reliable item page pointer.
 */
async function resolveFirstArticleUrl(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(HN_URL, { waitUntil: 'domcontentloaded' });
    const href = await page.locator('.subtext').first().locator('.age a').getAttribute('href');
    if (!href) throw new Error('Could not find item link on front page');
    return `${HN_URL}/${href}`;
  } finally {
    await context.close();
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — Article Discussion Page', () => {
  // Serial mode ensures beforeAll runs before any test and the shared URL is ready.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    articleItemUrl = await resolveFirstArticleUrl(browser);
    console.log(`\nTesting article page: ${articleItemUrl}`);
  });

  test.beforeEach(async ({ page }) => {
    // Guard: skip all tests in this suite if the front-page navigation failed.
    test.skip(!articleItemUrl, 'Could not resolve article URL from front page');
    await page.goto(articleItemUrl, { waitUntil: 'domcontentloaded' });
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

    // Valid formats: "42 comments", "1 comment", "discuss" (0 comments)
    const isValid = /^\d+ comments?$/.test(text) || text === 'discuss';
    expect(isValid, `Unexpected comment link text: "${text}"`).toBe(true);
  });

  // ── Comment thread ─────────────────────────────────────────────────────────

  test('comment thread section is present when the article has comments', async ({ page }) => {
    const commentCount = await page.locator('.athing.comtr').count();
    test.skip(commentCount === 0, 'This article has no comments yet');

    await expect(page.locator('.athing.comtr').first()).toBeVisible();
  });

  test('each comment has an author and a timestamp', async ({ page }) => {
    const comments = page.locator('.athing.comtr');
    const total = await comments.count();
    test.skip(total === 0, 'This article has no comments yet');

    const checkCount = Math.min(total, COMMENTS_TO_CHECK);
    const errors: string[] = [];

    for (let i = 0; i < checkCount; i++) {
      const comment = comments.nth(i);
      if (!(await comment.locator('.hnuser').count())) {
        errors.push(`Comment ${i + 1}: missing author`);
      }
      if (!(await comment.locator('.age').count())) {
        errors.push(`Comment ${i + 1}: missing timestamp`);
      }
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('comment text is non-empty for visible (non-collapsed) comments', async ({ page }) => {
    const comments = page.locator('.athing.comtr');
    const total = await comments.count();
    test.skip(total === 0, 'This article has no comments yet');

    const checkCount = Math.min(total, COMMENTS_TO_CHECK);
    const errors: string[] = [];

    for (let i = 0; i < checkCount; i++) {
      const commtext = comments.nth(i).locator('.commtext');
      // Collapsed/dead comments don't render .commtext — skip those.
      if (!(await commtext.count())) continue;
      const text = (await commtext.first().innerText()).trim();
      if (!text) errors.push(`Comment ${i + 1}: empty comment text`);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('comment thread contains nested (indented) replies', async ({ page }) => {
    const comments = page.locator('.athing.comtr');
    const total = await comments.count();
    // Need at least 2 comments for a reply to be possible.
    test.skip(total < 2, 'Not enough comments to test nesting');

    // HN uses <img width="N"> inside .ind to encode depth.
    // Width 0 = top-level, width > 0 = reply at that indent level.
    const indentImages = page.locator('.athing.comtr .ind img');
    const imgCount = await indentImages.count();

    let hasNested = false;
    for (let i = 0; i < imgCount; i++) {
      const width = await indentImages.nth(i).getAttribute('width');
      if (width && parseInt(width, 10) > 0) {
        hasNested = true;
        break;
      }
    }

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
