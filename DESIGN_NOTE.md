# Design Note: Scraper Reliability, Trade-Offs & AI Correction

## 1. Reliability & The Core Challenge

The INE mock storefront (`demo.inelabteamdev.com`) is designed to simulate realistic, hostile web scraping environments. Through reverse engineering of the client bundle, three specific challenges were identified:

1. **Human Interaction & Bot Detection**:
   - The storefront calculates mouse velocity, moves, and hover dwell time:
     ```javascript
     new Ar({ minMoves: 8, minDwellMs: 600 })
     ```
   - The "Reveal price" button remains disabled until at least 8 distinct mouse moves and a 600ms dwell time occur over the price container. Simple HTTP `curl` or `fetch` requests will find price data hidden or locked.
2. **Intentional Random Latencies and Failures**:
   - The store applies a simulated 35% failure rate (`Math.random() < 0.35`), resulting in slow or dropped quote responses and presenting a "Try again" error state.
3. **DOM Obfuscation & Dynamic Classes**:
   - Class names rotate dynamically (`pw-k2`, `pv-k2`, etc.) via an internal layout revision service (`/api/layout`).
   - The store injects zero-width non-joiners/spaces (`\u200B`) between digits of the actual selling price to defeat naive regexes, while displaying a strike-through MRP alongside the real price.

### Our Solution
- **Playwright Automation**: We utilize Playwright with fine-grained mouse control. The scraper moves to the price block, generates 10 intermediate jittered mouse coordinates, dwells for >700ms, and monitors button readiness before clicking.
- **Self-Healing Error Recovery**: If the store presents the "Try again" error button, the scraper clicks it in-session. If the page fails entirely, it employs exponential backoff (retrying up to 3 times) before closing and relaunching the browser context.
- **Accurate Price Sanitization**: Our parser strips all zero-width characters (`[\u200B-\u200D\uFEFF\u00A0]`) and differentiates between strike-through MRP and the discounted selling price.
- **Honest Logging**: Every execution records attempts, duration, and outcomes (`success`, `retried`, `failed`). On persistent failures, no corrupt or null data is stored in the price history, preserving data integrity.

---

## 2. Technical Trade-Offs

| Decision | Alternative | Rationale & Trade-Off |
| :--- | :--- | :--- |
| **Playwright vs. Pure HTTP Fetching** | Cheerio / Axios | The prompt advised: *"Reach for a headless browser only where the page genuinely requires it."* Because the mock store requires client-side JavaScript execution, mouse event dispatching, and dynamic layout decryption, a headless browser is genuinely necessary. The trade-off is higher CPU/memory usage, mitigated by running short, isolated browser instances. |
| **External Cron vs. In-Process Timer** | `setInterval` in Node | Free-tier host instances (Render) sleep after 15 minutes of inactivity. An internal `setInterval` stops when the server sleeps. Using `cron-job.org` to ping `POST /api/scrape-now` guarantees execution every 2 hours while keeping the instance active. |
| **Dual Database Strategy** | Supabase-only | We implemented Supabase PostgreSQL client with a seamless local JSON store fallback. This allows local development and screen recording without requiring live network database credentials, while connecting to Supabase in production. |

---

## 3. What AI Tools Got Wrong & How It Was Corrected

### AI Mistake 1: Assuming Simple HTML or Direct API Scraping
- **Initial Attempt**: When asked to scrape the product, standard AI suggestions recommended fetching the HTML with `axios` and parsing `<span class="price">` with `cheerio`, or simply querying `https://demo.inelabteamdev.com/api/product/:id`.
- **The Failure**: Querying `/api/product/:id` returns specs and reviews, but **no price or stock information whatsoever**. Furthermore, the static HTML contains only an empty `<div id="root"></div>` because the storefront is a client-side React SPA.
- **Correction**: We inspected the JavaScript bundle (`index-B9UiQq4X.js`), uncovered the internal `Dr()` quote challenge function and mouse dwell requirements, and switched to Playwright with mouse motion simulation.

### AI Mistake 2: Failing on Zero-Width Space Obfuscation
- **Initial Attempt**: AI code used standard regex `/₹([0-9,]+)/`.
- **The Failure**: The regex returned null or only the first digit because the mock store splits price digits with `\u200B` (e.g. `₹\u200B1\u200B,\u200B6\u200B4...`).
- **Correction**: We introduced a unicode-aware cleaner `.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')` prior to numerical parsing, and extracted the lower discounted selling price rather than the strike-through MRP.

### AI Mistake 3: Naive Timeout Waiters vs. Dynamic State Handling
- **Initial Attempt**: The initial AI scraper used hardcoded `waitForTimeout(5000)` after clicking reveal.
- **The Failure**: In 35% of runs, the store returned an error state with a "Try again" button, causing the scraper to time out and crash.
- **Correction**: We implemented a polling loop that checks for the "Try again" error button, clicks it automatically, and recovers without restarting the browser.
