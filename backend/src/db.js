const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith('http')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[DB] Connected to Supabase at:', SUPABASE_URL);
  } catch (err) {
    console.warn('[DB] Failed to initialize Supabase, falling back to local store:', err.message);
  }
} else {
  console.log('[DB] No Supabase credentials configured. Using local JSON store.');
}

// Local Fallback Store
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const localDbFile = path.join(dataDir, 'local_db.json');

function readLocalDb() {
  if (!fs.existsSync(localDbFile)) {
    const initial = { tracked_products: [], price_history: [], scrape_logs: [] };
    fs.writeFileSync(localDbFile, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(localDbFile, 'utf8'));
  } catch {
    return { tracked_products: [], price_history: [], scrape_logs: [] };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(localDbFile, JSON.stringify(data, null, 2));
}

// 1. Get all tracked products
async function getTrackedProducts() {
  if (supabase) {
    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) return data;
    console.warn('[DB] Supabase error in getTrackedProducts, falling back:', error.message);
  }
  const db = readLocalDb();
  return db.tracked_products || [];
}

// 2. Add or update tracked product
async function addTrackedProduct(product) {
  const record = {
    product_id: Number(product.id || product.product_id),
    name: product.name,
    slug: product.slug || '',
    brand: product.brand || '',
    category: product.category || '',
    sku: product.sku || '',
    description: product.description || '',
    created_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('tracked_products')
      .upsert(record, { onConflict: 'product_id' })
      .select()
      .single();
    if (!error) return data;
    console.warn('[DB] Supabase error in addTrackedProduct:', error.message);
  }

  const db = readLocalDb();
  const existingIdx = db.tracked_products.findIndex(p => p.product_id === record.product_id);
  if (existingIdx >= 0) {
    db.tracked_products[existingIdx] = { ...db.tracked_products[existingIdx], ...record };
  } else {
    db.tracked_products.push(record);
  }
  writeLocalDb(db);
  return record;
}

// 3. Remove tracked product
async function removeTrackedProduct(productId) {
  const pId = Number(productId);
  if (supabase) {
    await supabase.from('tracked_products').delete().eq('product_id', pId);
    await supabase.from('price_history').delete().eq('product_id', pId);
    return true;
  }
  const db = readLocalDb();
  db.tracked_products = db.tracked_products.filter(p => p.product_id !== pId);
  db.price_history = db.price_history.filter(p => p.product_id !== pId);
  writeLocalDb(db);
  return true;
}

// 4. Record price snapshot
async function recordPriceSnapshot({ productId, price, currency = 'INR', inStock = true, stockCount = 0 }) {
  const pId = Number(productId);
  const record = {
    product_id: pId,
    price: Number(price),
    currency,
    in_stock: Boolean(inStock),
    stock_count: Number(stockCount),
    recorded_at: new Date().toISOString()
  };

  if (supabase) {
    const { error } = await supabase.from('price_history').insert(record);
    if (!error) {
      await supabase
        .from('tracked_products')
        .update({
          last_price: Number(price),
          last_stock: Number(stockCount),
          in_stock: Boolean(inStock),
          last_scraped_at: record.recorded_at
        })
        .eq('product_id', pId);
      return record;
    }
    console.warn('[DB] Supabase error in recordPriceSnapshot:', error.message);
  }

  const db = readLocalDb();
  db.price_history.push({ id: Date.now() + Math.random(), ...record });
  const prod = db.tracked_products.find(p => p.product_id === pId);
  if (prod) {
    prod.last_price = Number(price);
    prod.last_stock = Number(stockCount);
    prod.in_stock = Boolean(inStock);
    prod.last_scraped_at = record.recorded_at;
  }
  writeLocalDb(db);
  return record;
}

// 5. Get price history
async function getPriceHistory(productId) {
  const pId = Number(productId);
  if (supabase) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', pId)
      .order('recorded_at', { ascending: true });
    if (!error) return data;
  }
  const db = readLocalDb();
  return db.price_history
    .filter(h => h.product_id === pId)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
}

// 6. Record scrape log
async function recordScrapeLog({
  productId,
  productName = '',
  status, // 'success' | 'retried' | 'failed'
  attempts = 1,
  durationMs = 0,
  priceFound = null,
  stockFound = null,
  errorMessage = null
}) {
  const record = {
    product_id: Number(productId),
    product_name: productName,
    status,
    attempts: Number(attempts),
    duration_ms: Math.round(durationMs),
    price_found: priceFound !== null ? Number(priceFound) : null,
    stock_found: stockFound !== null ? Number(stockFound) : null,
    error_message: errorMessage || null,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    const { error } = await supabase.from('scrape_logs').insert(record);
    if (!error) return record;
    console.warn('[DB] Supabase error in recordScrapeLog:', error.message);
  }

  const db = readLocalDb();
  db.scrape_logs.unshift({ id: Date.now() + Math.random(), ...record });
  if (db.scrape_logs.length > 500) db.scrape_logs = db.scrape_logs.slice(0, 500);
  writeLocalDb(db);
  return record;
}

// 7. Get scrape logs
async function getScrapeLogs(productId = null, limit = 50) {
  if (supabase) {
    let query = supabase
      .from('scrape_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (productId) query = query.eq('product_id', Number(productId));
    const { data, error } = await query;
    if (!error) return data;
  }
  const db = readLocalDb();
  let logs = db.scrape_logs || [];
  if (productId) {
    logs = logs.filter(l => l.product_id === Number(productId));
  }
  return logs.slice(0, limit);
}

module.exports = {
  getTrackedProducts,
  addTrackedProduct,
  removeTrackedProduct,
  recordPriceSnapshot,
  getPriceHistory,
  recordScrapeLog,
  getScrapeLogs
};
