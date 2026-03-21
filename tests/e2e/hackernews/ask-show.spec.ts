import { test, expect } from '@playwright/test';

// ─── Configuration ────────────────────────────────────────────────────────────

const HN_URL = 'https://news.ycombinator.com';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collects all title links on the current page and returns
 * an array of { title, href } objects.
 */
async function collectTitleLinks(
  page: import('@playwright/test').Page,
): Promise<{ title: string; href: string; index: number }[]> {
  const links = page.locator('.titleline > a');
  const count = await links.count();
  const results: { title: string; href: string; index: number }[] = [];

  for (let i = 0; i < count; i++) {
    results.push({
      title: (await links.nth(i).innerText()).trim(),
      href: (await links.nth(i).getAttribute('href')) ?? '',
      index: i + 1,
    });
  }

  return results;
}

// ─── Ask HN ───────────────────────────────────────────────────────────────────

test.describe('Hacker News — Ask HN (/ask)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${HN_URL}/ask`, { waitUntil: 'domcontentloaded' });
  });

  test('all articles start with "Ask HN:"', async ({ page }) => {
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => !a.title.startsWith('Ask HN:'))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 70)}" does not start with "Ask HN:"`);

    expect(violations, `Prefix violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Ask HN articles link to internal HN item pages (not external URLs)', async ({ page }) => {
    // Ask HN posts are self-posts on HN — they have no external URL.
    // Their titleline href is always "item?id=..." (a relative internal link).
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => !a.href.startsWith('item?id='))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 50)}" has unexpected href: "${a.href}"`);

    expect(violations, `External href violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Ask HN articles have a score, author, and timestamp', async ({ page }) => {
    const sublines = page.locator('.subtext .subline');
    const count = await sublines.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const sub = sublines.nth(i);
      if (!(await sub.locator('.score').count())) errors.push(`Article ${i + 1}: missing score`);
      if (!(await sub.locator('.hnuser').count())) errors.push(`Article ${i + 1}: missing author`);
      if (!(await sub.locator('.age').count())) errors.push(`Article ${i + 1}: missing timestamp`);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('Ask HN articles have a comment link in their subline', async ({ page }) => {
    // Every Ask HN post should invite discussion — so a comment link is expected.
    const sublines = page.locator('.subtext .subline');
    const count = await sublines.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const lastLink = sublines.nth(i).getByRole('link').last();
      const text = await lastLink.innerText();
      const isCommentLink = /^\d+ comments?$/.test(text) || text === 'discuss';
      if (!isCommentLink) errors.push(`Article ${i + 1}: unexpected last link text "${text}"`);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('"More" link exists to paginate through older Ask HN posts', async ({ page }) => {
    await expect(page.locator('.morelink')).toBeVisible();
  });
});

// ─── Show HN ──────────────────────────────────────────────────────────────────

test.describe('Hacker News — Show HN (/show)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${HN_URL}/show`, { waitUntil: 'domcontentloaded' });
  });

  test('all articles start with "Show HN:"', async ({ page }) => {
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => !a.title.startsWith('Show HN:'))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 70)}" does not start with "Show HN:"`);

    expect(violations, `Prefix violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Show HN articles link to external URLs, not internal item pages', async ({ page }) => {
    // Show HN posts showcase an external project — they should never be self-posts.
    // A link starting with "item?id=" would indicate a self-post, which violates
    // HN guidelines for the Show HN section.
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => a.href.startsWith('item?id='))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 50)}" links internally (expected external URL)`);

    expect(violations, `Internal link violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Show HN articles display an external domain next to the title', async ({ page }) => {
    // When an article links to an external URL, HN renders a (.sitebit) domain tag.
    const articles = page.locator('.athing.submission');
    const count = await articles.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const hasDomain = (await articles.nth(i).locator('.sitebit').count()) > 0;
      if (!hasDomain) {
        const title = await articles.nth(i).locator('.titleline > a').innerText();
        errors.push(`Article ${i + 1}: "${title.slice(0, 50)}" has no domain shown`);
      }
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('Show HN articles have a score, author, and timestamp', async ({ page }) => {
    const sublines = page.locator('.subtext .subline');
    const count = await sublines.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const sub = sublines.nth(i);
      if (!(await sub.locator('.score').count())) errors.push(`Article ${i + 1}: missing score`);
      if (!(await sub.locator('.hnuser').count())) errors.push(`Article ${i + 1}: missing author`);
      if (!(await sub.locator('.age').count())) errors.push(`Article ${i + 1}: missing timestamp`);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('"More" link exists to paginate through older Show HN posts', async ({ page }) => {
    await expect(page.locator('.morelink')).toBeVisible();
  });
});
