import { test, expect } from '@playwright/test';
import {
  gotoHN,
  collectTitleLinks,
  collectSublineMetadataErrors,
} from './helpers';

// ─── Ask HN ───────────────────────────────────────────────────────────────────

test.describe('Hacker News — Ask HN (/ask)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHN(page, '/ask');
  });

  test('all articles are self-posts that link to internal HN item pages', async ({ page }) => {
    // The /ask page shows discussion-type posts (Ask HN, Tell HN, and others).
    // All of them are self-posts with no external URL — their href is always
    // "item?id=..." rather than an external link.
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => !a.href.startsWith('item?id='))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 50)}" has unexpected href: "${a.href}"`);

    expect(violations, `External href violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Ask HN articles have a score, author, and timestamp', async ({ page }) => {
    const errors = await collectSublineMetadataErrors(page);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('Ask HN articles have a comment link in their subline', async ({ page }) => {
    // Every Ask HN post should invite discussion — so a comment link is expected.
    const errors = await page.locator('.subtext .subline').evaluateAll(sublines =>
      sublines.flatMap((sub, i) => {
        const links = sub.querySelectorAll('a');
        const lastLink = links[links.length - 1];
        if (!lastLink) return [`Article ${i + 1}: no links in subline`];
        // Use innerText (not textContent) so the non-breaking space (\u00A0)
        // that HN places between the number and "comments" is normalised to a
        // regular space. \s+ in the regex also handles it defensively.
        const text = (lastLink as HTMLElement).innerText.trim();
        const isCommentLink = /^\d+\s+comments?$/.test(text) || text === 'discuss';
        return isCommentLink ? [] : [`Article ${i + 1}: unexpected last link text "${text}"`];
      })
    );

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('"More" link exists to paginate through older Ask HN posts', async ({ page }) => {
    await expect(page.locator('.morelink')).toBeVisible();
  });
});

// ─── Show HN ──────────────────────────────────────────────────────────────────

test.describe('Hacker News — Show HN (/show)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHN(page, '/show');
  });

  test('all articles start with "Show HN:"', async ({ page }) => {
    const articles = await collectTitleLinks(page);
    const violations = articles
      .filter(a => !a.title.startsWith('Show HN:'))
      .map(a => `  Article ${a.index}: "${a.title.slice(0, 70)}" does not start with "Show HN:"`);

    expect(violations, `Prefix violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  test('Show HN articles have a score, author, and timestamp', async ({ page }) => {
    const errors = await collectSublineMetadataErrors(page);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('"More" link exists to paginate through older Show HN posts', async ({ page }) => {
    await expect(page.locator('.morelink')).toBeVisible();
  });
});
