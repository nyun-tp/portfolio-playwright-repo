import { test, expect } from '@playwright/test';
import {
  gotoHN,
  parseRank,
  collectSublineMetadataErrors,
} from './helpers';

// ─── Configuration ────────────────────────────────────────────────────────────

const ARTICLES_PER_PAGE = 30;

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News — Front Page Structure', () => {
  test.beforeEach(async ({ page }) => {
    await gotoHN(page);
  });

  // ── Identity ───────────────────────────────────────────────────────────────

  test('page title is "Hacker News"', async ({ page }) => {
    await expect(page).toHaveTitle('Hacker News');
  });

  // ── Navigation bar ─────────────────────────────────────────────────────────

  test('navigation bar contains all expected section links', async ({ page }) => {
    const nav = page.locator('span.pagetop');
    const sections = ['new', 'past', 'comments', 'ask', 'show', 'jobs'];

    for (const name of sections) {
      await expect(
        nav.getByRole('link', { name, exact: true }),
        `Nav link "${name}" should be visible`,
      ).toBeVisible();
    }
  });

  // ── Article list ───────────────────────────────────────────────────────────

  test(`front page lists exactly ${ARTICLES_PER_PAGE} articles`, async ({ page }) => {
    await expect(page.locator('.athing.submission')).toHaveCount(ARTICLES_PER_PAGE);
  });

  test('article ranks are sequential from 1 to 30', async ({ page }) => {
    const ranks = page.locator('.rank');
    const count = await ranks.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const rank = parseRank(await ranks.nth(i).innerText());
      if (rank !== i + 1) {
        errors.push(`Position ${i + 1}: expected rank ${i + 1}, found rank ${rank}`);
      }
    }

    expect(errors, `Rank sequence errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  test('every article has a non-empty title with an href', async ({ page }) => {
    const titles = page.locator('.titleline > a');
    const count = await titles.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = (await titles.nth(i).innerText()).trim();
      const href = await titles.nth(i).getAttribute('href');
      if (!text) errors.push(`Article ${i + 1}: empty title`);
      if (!href) errors.push(`Article ${i + 1}: missing href`);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('story articles each have a score, author link, and timestamp', async ({ page }) => {
    const errors = await collectSublineMetadataErrors(page);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('article scores are positive integers', async ({ page }) => {
    const scores = page.locator('.score');
    const count = await scores.count();
    const errors: string[] = [];

    for (let i = 0; i < count; i++) {
      // innerText of ".score" is like "42 points" — parseInt stops at the space.
      const text = await scores.nth(i).innerText();
      const points = parseInt(text, 10);
      if (isNaN(points) || points < 1) {
        errors.push(`Article ${i + 1}: invalid score "${text}"`);
      }
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  // ── Pagination ─────────────────────────────────────────────────────────────

  test('"More" link exists at the bottom of the page', async ({ page }) => {
    await expect(page.locator('.morelink')).toBeVisible();
  });

  test('"More" link loads the next page starting at rank 31', async ({ page }) => {
    await page.locator('.morelink').click();
    await page.waitForLoadState('domcontentloaded');

    const firstRank = parseRank(await page.locator('.rank').first().innerText());
    expect(firstRank).toBe(31);
  });
});
