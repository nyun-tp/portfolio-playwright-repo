import { test, expect, Browser, Page } from '@playwright/test';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Number of articles to collect and validate.
 * Override with: ARTICLES_TO_VALIDATE=10 npx playwright test
 */
const ARTICLES_TO_VALIDATE = parseInt(process.env.ARTICLES_TO_VALIDATE ?? '100', 10);

const MAX_NAV_RETRIES = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleData {
  rank: number;
  title: string;
  timestampMs: number;
  /** Pre-formatted ISO string used in error messages and reports */
  timestampIso: string;
  articleId: string;
}

interface CollectionReport {
  articles: ArticleData[];
  pagesVisited: number;
  collectionDurationMs: number;
}

// ─── Data Collection ──────────────────────────────────────────────────────────

/**
 * Navigates through HN /newest pages and collects `count` articles.
 * All tests share this single collection pass — no redundant page loads.
 */
async function collectArticles(browser: Browser, count: number): Promise<CollectionReport> {
  const startTime = Date.now();
  const context = await browser.newContext();
  const page = await context.newPage();
  const articles: ArticleData[] = [];
  let pagesVisited = 0;

  try {
    await navigateWithRetry(page, 'https://news.ycombinator.com/newest');
    pagesVisited++;

    let tableLocator = page.locator('#bigbox');
    let pageArticleCount = await tableLocator.locator('.athing.submission').count();
    let pageIndex = 0;

    while (articles.length < count) {
      const submissionRow = tableLocator.locator('.athing.submission').nth(pageIndex);
      const subtextRow = tableLocator.locator('.subtext').nth(pageIndex);

      // Read all four fields in parallel to reduce collection time
      const [rankText, title, articleId, timestampAttr] = await Promise.all([
        submissionRow.locator('.rank').innerText(),
        submissionRow.locator('.titleline > a').first().innerText(),
        submissionRow.getAttribute('id').then((id: string | null) => id ?? ''),
        subtextRow.locator('.age').getAttribute('title'),
      ]);

      const rank = parseInt(rankText.replace('.', ''), 10);

      if (!timestampAttr) {
        throw new Error(`Missing .age[title] for article at rank ${rank} ("${title}")`);
      }

      const timestampMs = extractTimestampMs(timestampAttr);

      articles.push({
        rank,
        title,
        timestampMs,
        timestampIso: new Date(timestampMs).toISOString(),
        articleId,
      });

      // Paginate when the current page is exhausted
      if (pageIndex + 1 >= pageArticleCount && articles.length < count) {
        await tableLocator.locator('.morelink').click();
        await page.waitForLoadState('domcontentloaded');
        tableLocator = page.locator('#bigbox');
        pageArticleCount = await tableLocator.locator('.athing.submission').count();
        pageIndex = 0;
        pagesVisited++;
      } else {
        pageIndex++;
      }
    }
  } finally {
    await context.close();
  }

  return {
    articles: articles.slice(0, count),
    pagesVisited,
    collectionDurationMs: Date.now() - startTime,
  };
}

/**
 * Navigates to `url` and retries up to `retries` times on failure,
 * with an increasing back-off delay between attempts.
 */
async function navigateWithRetry(page: Page, url: string, retries = MAX_NAV_RETRIES): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      const delayMs = attempt * 1_000;
      console.warn(`  [nav] Attempt ${attempt} failed — retrying in ${delayMs}ms...`);
      await page.waitForTimeout(delayMs);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses the HN timestamp attribute format "2025-10-27T03:26:55 1761535615"
 * and returns the Unix timestamp in milliseconds.
 */
function extractTimestampMs(raw: string): number {
  const unixSeconds = raw.split(' ')[1];
  const parsed = parseInt(unixSeconds, 10);

  if (!unixSeconds || isNaN(parsed)) {
    throw new Error(`Cannot parse Unix timestamp from: "${raw}"`);
  }

  return parsed * 1_000;
}

// ─── Shared State ─────────────────────────────────────────────────────────────

let collectionResult: CollectionReport;

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe('Hacker News /newest — article validation', () => {
  // Serial mode ensures beforeAll runs once and collectionResult is populated
  // before any test body executes.
  test.describe.configure({ mode: 'serial' });

  /**
   * Collect all articles once up front.
   * Every test below reads from `collectionResult` — no repeated page loads.
   */
  test.beforeAll(async ({ browser }) => {
    collectionResult = await collectArticles(browser, ARTICLES_TO_VALIDATE);
    const { articles, pagesVisited, collectionDurationMs } = collectionResult;
    console.log(
      `\nCollected ${articles.length} articles across ${pagesVisited} page(s) in ${collectionDurationMs}ms`,
    );
  });

  // ── Core requirement ──────────────────────────────────────────────────────

  test(`first ${ARTICLES_TO_VALIDATE} articles are sorted newest to oldest`, async () => {
    const { articles } = collectionResult;
    const violations: string[] = [];

    await test.step('compare each consecutive pair of timestamps', async () => {
      for (let i = 1; i < articles.length; i++) {
        const prev = articles[i - 1];
        const curr = articles[i];

        // Newer articles have larger Unix timestamps.
        // If curr > prev, the list went backwards → ordering violation.
        if (curr.timestampMs > prev.timestampMs) {
          violations.push(
            `Rank ${prev.rank} → ${curr.rank}: ` +
            `"${prev.title.slice(0, 50)}" (${prev.timestampIso}) ` +
            `comes before "${curr.title.slice(0, 50)}" (${curr.timestampIso}) ` +
            `but is actually older`,
          );
        }
      }
    });

    // Attach the full article dataset to the HTML report for debugging
    await test.info().attach('articles.json', {
      body: JSON.stringify(articles, null, 2),
      contentType: 'application/json',
    });

    expect(
      violations,
      `Found ${violations.length} sorting violation(s):\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });

  // ── Data-integrity checks ─────────────────────────────────────────────────

  test(`article ranks are sequential from 1 to ${ARTICLES_TO_VALIDATE}`, () => {
    const { articles } = collectionResult;
    const rankErrors: string[] = [];

    articles.forEach((article, i) => {
      const expected = i + 1;
      if (article.rank !== expected) {
        rankErrors.push(
          `Position ${i + 1}: expected rank ${expected}, ` +
          `found ${article.rank} ("${article.title.slice(0, 50)}")`,
        );
      }
    });

    expect(
      rankErrors,
      `Rank sequence errors:\n${rankErrors.join('\n')}`,
    ).toHaveLength(0);
  });

  test('no duplicate article IDs', () => {
    const { articles } = collectionResult;
    const seen = new Map<string, number>();
    const duplicates: string[] = [];

    for (const article of articles) {
      if (seen.has(article.articleId)) {
        duplicates.push(
          `id "${article.articleId}" appears at ranks ${seen.get(article.articleId)} and ${article.rank}: ` +
          `"${article.title.slice(0, 50)}"`,
        );
      } else {
        seen.set(article.articleId, article.rank);
      }
    }

    expect(
      duplicates,
      `Duplicate articles:\n${duplicates.join('\n')}`,
    ).toHaveLength(0);
  });

  test('no articles have timestamps in the future', () => {
    const now = Date.now();
    const { articles } = collectionResult;
    const future = articles.filter(a => a.timestampMs > now);

    expect(
      future,
      `Articles with future timestamps:\n` +
      future.map(a => `  Rank ${a.rank}: ${a.timestampIso} — "${a.title.slice(0, 50)}"`).join('\n'),
    ).toHaveLength(0);
  });

  test('all articles have non-empty titles', () => {
    const { articles } = collectionResult;
    const empty = articles.filter(a => !a.title.trim());

    expect(
      empty,
      `Articles with empty titles at ranks: ${empty.map(a => a.rank).join(', ')}`,
    ).toHaveLength(0);
  });

  // ── Summary report ────────────────────────────────────────────────────────

  test.afterAll(() => {
    if (!collectionResult) return;

    const { articles, pagesVisited, collectionDurationMs } = collectionResult;
    const newest = articles[0];
    const oldest = articles[articles.length - 1];
    const spanMinutes = Math.round((newest.timestampMs - oldest.timestampMs) / 60_000);
    const rankWidth = articles.length.toString().length;

    console.log([
      '',
      '══════════════════════════════════════════',
      '  VALIDATION SUMMARY',
      '══════════════════════════════════════════',
      `  Articles validated : ${articles.length} of ${ARTICLES_TO_VALIDATE} required`,
      `  Pages visited      : ${pagesVisited}`,
      `  Newest (rank ${'1'.padStart(rankWidth)}) : ${newest.timestampIso}`,
      `  Oldest (rank ${articles.length.toString().padStart(rankWidth)}) : ${oldest.timestampIso}`,
      `  Time span          : ~${spanMinutes} min`,
      `  Collection time    : ${collectionDurationMs}ms`,
      '══════════════════════════════════════════',
      '',
    ].join('\n'));
  });
});
