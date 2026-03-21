# portfolio-playwright-repo
Nyun Tran-Phan's Playwright automation portfolio

---

## Setup

```bash
npm ci
npx playwright install --with-deps
```

## Running tests

```bash
npx playwright test                   # all tests, headless
npx playwright test --headed          # with browser window
npx playwright test --ui              # interactive UI mode
npx playwright show-report            # open last HTML report
```

Run a single file:

```bash
npx playwright test tests/e2e/hackernews/homepage.spec.ts
```

Override the article count for the sort validation:

```bash
ARTICLES_TO_VALIDATE=50 npx playwright test tests/e2e/hackerrank/hackernews.spec.ts
```

---

## Test suites

### 1. Hacker News — Newest article sort (`tests/e2e/hackerrank/`)

Validates that the first 100 articles on [/newest](https://news.ycombinator.com/newest) are sorted from newest to oldest.

| Test | What it checks |
|---|---|
| Articles sorted newest to oldest | Each consecutive pair of timestamps is in descending order |
| Sequential ranks | Rank numbers run 1 → N with no gaps or duplicates |
| No duplicate article IDs | Same article does not appear at two positions |
| No future timestamps | All article timestamps are ≤ current time |
| Non-empty titles | No article has a blank or whitespace-only title |

Collects all article data in a single paginated pass (`beforeAll`) so each assertion runs against the same snapshot — no repeated page loads.

---

### 2. Hacker News — Front page structure (`tests/e2e/hackernews/homepage.spec.ts`)

Validates the layout and content of the HN front page.

| Test | What it checks |
|---|---|
| Page title | Title is exactly "Hacker News" |
| Navigation bar | All 6 section links (new, past, comments, ask, show, jobs) are visible |
| Article count | Front page always shows exactly 30 articles |
| Sequential ranks | Ranks run 1 → 30 with no gaps |
| Title links | Every article has a non-empty title and a valid href |
| Article metadata | Every story article has a score, author link, and timestamp |
| Score validity | Every score is a positive integer |
| Pagination | "More" link exists and loads rank 31 on click |

---

### 3. Hacker News — Site navigation (`tests/e2e/hackernews/navigation.spec.ts`)

Validates navigation between sections and browser history behavior.

| Test | What it checks |
|---|---|
| Logo link | Clicking "Hacker News" from a section page returns to the front page |
| Section links (×6) | Each nav link (new, past, comments, ask, show, jobs) routes to the correct URL |
| Front page "More" | Page 2 starts at rank 31 |
| /newest "More" | Page 2 contains different article IDs than page 1 |
| Browser back | Going back returns to the previous page with articles visible |
| Browser forward | Going forward after back restores the section page |

---

### 4. Hacker News — Article discussion page (`tests/e2e/hackernews/article-page.spec.ts`)

Dynamically picks the top article from the front page and validates its discussion thread.

| Test | What it checks |
|---|---|
| Article title | Title is visible and non-empty |
| Article header | Score, author, and timestamp are all present |
| Comment count label | Text matches `N comment(s)` or `discuss` |
| Comment tree presence | Comment rows exist (skips gracefully if article has 0 comments) |
| Comment author + timestamp | First 20 comments each have an author and a timestamp |
| Comment text | Visible (non-collapsed) comments are non-empty |
| Nested replies | At least one comment is indented, confirming thread structure |
| Title href | Article title link has a non-empty href |

---

### 5. Hacker News — Ask HN and Show HN (`tests/e2e/hackernews/ask-show.spec.ts`)

Validates that each section enforces its content rules.

| Test | What it checks |
|---|---|
| Ask HN prefix | All `/ask` titles start with `"Ask HN:"` |
| Ask HN internal links | All Ask HN articles link to `item?id=…` (no external URLs) |
| Ask HN metadata | Score, author, and timestamp present on every article |
| Ask HN comment links | Every subline has a valid comment count link |
| Ask HN pagination | "More" link is present |
| Show HN prefix | All `/show` titles start with `"Show HN:"` |
| Show HN external links | No Show HN article links to an internal `item?id=…` page |
| Show HN domain tag | Every Show HN article displays a `.sitebit` domain next to its title |
| Show HN metadata | Score, author, and timestamp present on every article |
| Show HN pagination | "More" link is present |

---

### 6. Hacker News — User profile page (`tests/e2e/hackernews/user-profile.spec.ts`)

Validates the structure and navigation of HN user profile pages using `pg` (Paul Graham) as a stable test account.

| Test | What it checks |
|---|---|
| Profile loads | Page URL matches the expected user ID |
| Username displayed | Profile table shows the correct username |
| Karma score | Karma is a positive integer |
| Creation date format | Date matches `YYYY-MM-DD` |
| Creation date value | Date is in the past |
| Submissions link | Navigates to the user's submission history |
| Comments link | Navigates to the user's comment history |
| Author link from front page | Clicking an article author opens the correct profile |

---

## Project structure

```
tests/
└── e2e/
    └── hackernews/
        ├── homepage.spec.ts            # Front page structure
        ├── navigation.spec.ts          # Section routing and browser history
        ├── article-page.spec.ts        # Article discussion page and comments
        ├── ask-show.spec.ts            # Ask HN and Show HN content rules
        ├── user-profile.spec.ts        # User profile page
        ├── hackernews.spec.ts          # Newest article sort validation
        └── hackernews-rank-notes.MD    # Test design notes

```

## CI

Tests run automatically on every push and pull request to `main` via GitHub Actions across Chromium, Firefox, and WebKit. The HTML report is uploaded as an artifact and retained for 30 days.
