import { Page } from '@playwright/test';

// ─── Constants ────────────────────────────────────────────────────────────────

export const HN_URL = 'https://news.ycombinator.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TitleLink {
  /** Visible title text of the article. */
  title: string;
  /** Raw href attribute value from the title anchor. */
  href: string;
  /** 1-based position on the page, for use in error messages. */
  index: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Navigates to an HN page and waits for the DOM to be ready.
 *
 * @param path - Site-relative path, e.g. `/ask` or `/user?id=pg`.
 *               Omit or pass `''` to navigate to the front page.
 *
 * @example
 * await gotoHN(page);           // https://news.ycombinator.com
 * await gotoHN(page, '/ask');   // https://news.ycombinator.com/ask
 */
export async function gotoHN(page: Page, path = ''): Promise<void> {
  await page.goto(`${HN_URL}${path}`, { waitUntil: 'domcontentloaded' });
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parses an HN rank string like `"1."` or `" 12. "` into a number.
 * Returns `NaN` if the text cannot be parsed.
 */
export function parseRank(rankText: string): number {
  return parseInt(rankText.replace('.', '').trim(), 10);
}

// ─── Article list helpers ─────────────────────────────────────────────────────

/**
 * Collects every `.titleline > a` on the current page.
 * Returns an array of `{ title, href, index }` objects, one per article.
 */
export async function collectTitleLinks(page: Page): Promise<TitleLink[]> {
  return page.locator('.titleline > a').evaluateAll(els =>
    els.map((el, i) => ({
      title: (el as HTMLAnchorElement).innerText.trim(),
      href: (el as HTMLAnchorElement).getAttribute('href') ?? '',
      index: i + 1,
    }))
  );
}

/**
 * Checks every `.subtext .subline` row for a score, author link, and timestamp.
 * Returns an array of human-readable error strings — empty when everything passes.
 *
 * Designed for story articles; job posts do not render `.subline` and are
 * naturally skipped by this selector.
 *
 * @example
 * const errors = await collectSublineMetadataErrors(page);
 * expect(errors, errors.join('\n')).toHaveLength(0);
 */
export async function collectSublineMetadataErrors(page: Page): Promise<string[]> {
  return page.locator('.subtext .subline').evaluateAll(sublines =>
    sublines.flatMap((sub, i) => {
      const errors: string[] = [];
      if (!sub.querySelector('.score'))  errors.push(`Article ${i + 1}: missing score`);
      if (!sub.querySelector('.hnuser')) errors.push(`Article ${i + 1}: missing author`);
      if (!sub.querySelector('.age'))    errors.push(`Article ${i + 1}: missing timestamp`);
      return errors;
    })
  );
}
