-- Schema for INE Product Price Tracker (Supabase PostgreSQL)

-- 1. Tracked Products Table
CREATE TABLE IF NOT EXISTS tracked_products (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  sku TEXT,
  description TEXT,
  last_price NUMERIC,
  last_stock INTEGER,
  in_stock BOOLEAN DEFAULT TRUE,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Price & Stock History Table
CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES tracked_products(product_id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'INR',
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  stock_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_prod ON price_history(product_id, recorded_at DESC);

-- 3. Scrape Attempt Audit Logs
CREATE TABLE IF NOT EXISTS scrape_logs (
  id BIGSERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL,
  product_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  price_found NUMERIC,
  stock_found INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_prod ON scrape_logs(product_id, created_at DESC);
