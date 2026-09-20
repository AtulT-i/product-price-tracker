# INE Product Price Tracker (Web Scraping Assignment)

A resilient, full-stack product price and stock tracking application built for the INE Software Engineer Intern Assignment. It tracks products from INE's mock storefront (`https://demo.inelabteamdev.com/`), scrapes price and availability data on a schedule with anti-bot dwell handling and exponential retries, stores historical data in Supabase (PostgreSQL), and visualizes price trends and audit logs on a modern React dashboard.

---

## 🌟 Live Demo & Repositories

- **Live Application (Frontend)**: [Deployed on Vercel](https://your-vercel-app.vercel.app) *(Replace with your live link)*
- **Live Backend API**: [Deployed on Render](https://your-render-app.onrender.com) *(Replace with your live link)*
- **Target Mock Store**: [https://demo.inelabteamdev.com/](https://demo.inelabteamdev.com/)
- **GitHub Repository**: [https://github.com/AtulT-i/product-price-tracker](https://github.com/AtulT-i/product-price-tracker)

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React (Vite), Lucide Icons, Recharts | Interactive dashboard, search catalog, price trend visualizer, scrape logs |
| **Backend API** | Node.js, Express.js | REST API endpoints, catalog search proxy, scheduled scrape coordinator |
| **Scraper** | Playwright (Chromium) | Headless & headed automation, human mouse dwell simulation, anti-bot bypass |
| **Database** | Supabase (PostgreSQL) + Local fallback | Relational tables for tracked products, price history snapshots, and audit logs |
| **Scheduling** | cron-job.org / Scheduled Webhook | Triggers `POST /api/scrape-now` every 2 hours to wake free-tier instances |

---

## 🚀 Core Features

1. **Catalog Search & Tracking**:
   - Instant search across 1,000 products by partial/full name, brand, category, or SKU.
   - 1-click tracking that immediately initiates a background scrape for instant price discovery.
2. **Resilient Scraper Engine**:
   - **Anti-Bot Dwell Handling**: Bypasses the store's `minMoves: 8, minDwellMs: 600` mouse movement detection to unlock the "Reveal price" button.
   - **Exponential Backoff & Retries**: Recovers from the mock store's intentional 35% random dropouts, delays, and 429/500 errors (retries up to 3 times per run).
   - **Accurate Price Sanitization**: Handles dynamic class rotations and strips zero-width spaces (`\u200B`) to cleanly extract the real selling price vs. strike-through MRP.
3. **Price & Stock History**:
   - Interactive Area Charts showing price variations over time.
   - Tabular view of every recorded price and inventory snapshot.
4. **Transparent Scrape Audit Logs**:
   - Full per-product audit log tracking every scrape attempt: Timestamp, Status (`SUCCESS`, `RETRIED`, `FAILED`), Attempts Count, Latency (ms), and Error Messages.
   - Failures are recorded honestly and never hidden.
5. **Observable (Headed) Mode**:
   - Built-in headed runner (`npm run scrape:headed`) to visually observe the browser hovering, clicking, handling errors, and extracting data.

---

## 📋 Environment Variables

### Backend (`backend/.env`)

```env
PORT=4000
HEADED=false

# Supabase Credentials (Optional for local testing, required for production)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

*(Note: If Supabase credentials are not provided, the backend automatically uses a local JSON-backed persistent store in `backend/data/local_db.json`.)*

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:4000
# For production on Vercel:
# VITE_API_URL=https://your-backend-render-app.onrender.com
```

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)

### 2. Backend Setup
```bash
cd backend
npm install
npx playwright install chromium

# Start the backend server (runs on http://localhost:4000)
npm start
```

### 3. Frontend Setup
```bash
cd frontend
npm install

# Start development server (runs on http://localhost:5173)
npm run dev
```

---

## 🎥 Running the Headed Scraper (Video Recording)

To record the 2–4 minute video demonstration required by the assignment:

```bash
cd backend
npm run scrape:headed
```

This launches a visible Chromium browser window with slow-motion execution. You will clearly see:
1. The browser navigating to product pages.
2. The cursor moving across the price block to satisfy human dwell thresholds.
3. The "Reveal price" button unlocking and being clicked.
4. How the scraper handles simulated errors or "Try again" prompts.
5. The extracted price and stock being saved and displayed in the terminal audit table.

---

## ⏰ Scraping Schedule (cron-job.org)

Free-tier cloud backends (like Render) sleep after 15 minutes of inactivity. To satisfy the 2-hour scraping schedule:
1. Create a free account on [cron-job.org](https://cron-job.org).
2. Create a new cron job:
   - **URL**: `https://your-backend-app.onrender.com/api/scrape-now`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Request Method**: `POST`
3. This reliably wakes up the backend server, runs the scraper across all tracked items, and saves historical records.

---

## 🗄️ Database Schema (Supabase PostgreSQL)

Run the script in `backend/schema.sql` in your Supabase SQL Editor:
- `tracked_products`: Stores tracked products and latest known price/stock.
- `price_history`: Append-only time series of prices and stock levels.
- `scrape_logs`: Audit log of every scrape attempt (status, attempts, duration, errors).
