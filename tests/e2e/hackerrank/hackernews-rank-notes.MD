# Playwright Setup

## Install Dependencies
```bash
npm ci
```

## Install Playwright Browsers
```bash
npx playwright install --with-deps
```

## Run Tests

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run tests under `/tests` |
| `npx playwright test --headed` | Run tests with browser window |
| `npx playwright test --ui` | Run tests with UI debugger |
| `npx playwright show-report` | Show reports |

**UI Debugger:** http://localhost:9323/

## Update Playwright
```bash
npm install -D @playwright/test@latest
npx playwright install --with-deps
```

---

# Task

Create tests to validate that articles on https://news.ycombinator.com/newest are sorted from newest to oldest.

## Manual Observations

- Assume articles 1–100 will already be sorted
- Clicking "More" loads additional articles
- For the sort comparison limit: hours being equal is acceptable, but minutes must be compared at minimum
- Article timestamps are in anchor tags like:
  ```html
  <a href="item?id=45677351">56 minutes ago</a>
  ```
  - Can select by `href="item?id=*"` and read the text of the `<a>` element
  - Use a parser to handle minutes, hours, days, weeks, etc.
  - The item ID itself contains a millisecond timestamp, which can also be used

## Assumptions

- Articles 1–100 are already sorted, since we are on `/newest` (source of truth is both the rank number and the timestamp)
- For time comparisons above minutes, equality is valid — e.g., `"1 hour ago" == "1 hour ago"` is acceptable
- Sort order by unit: minutes < hours < days < weeks < months < years
- Each page loads 30 entries at a time

## Automation Steps

1. Visit https://news.ycombinator.com/newest
2. For each article, verify the rank index matches the expected position (i=0 → article #1)
   - Check `<tr class="athing submission">` → `<span class="rank">` for the rank value
3. Check the article's timestamp and compare it to the previous article's timestamp
   - Skip comparison for the first entry
4. If the rank is out of order or the timestamp is not ≥ the previous, error out immediately
5. If all checks pass, click "More" to load the next page (page 1: articles 1–30, page 2: articles 31–60, etc.)
6. Repeat until article #100 is validated successfully
