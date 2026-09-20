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

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const localDbFile = path.join(dataDir, 'local_db.json');

function readLocalDb() {
  if (!fs.existsSync(localDbFile)) {
    const initial = {
      tracked_products: [],
      price_history: [],
      scrape_logs: [],
      alerts: [],
      store_health: {
        last_revision: 626003,
        classes: { priceWrap: 'pw-k2', priceValue: 'pv-k2', stock: 'st-k2' },
        status: 'STABLE',
        drift_detected: false,
        last_checked: new Date().toISOString()
      }
    };
    fs.writeFileSync(localDbFile, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(localDbFile, 'utf8'));
    if (!data.alerts) data.alerts = [];
    if (!data.store_health) {
      data.store_health = {
        last_revision: 626003,
        classes: { priceWrap: 'pw-k2', priceValue: 'pv-k2', stock: 'st-k2' },
        status: 'STABLE',
        drift_detected: false,
        last_checked: new Date().toISOString()
      };
    }
    return data;
  } catch {
    return { tracked_products: [], price_history: [], scrape_logs: [], alerts: [], store_health: {} };
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
    if (!error && data) return data;
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
    target_price: product.target_price ? Number(product.target_price) : null,
    frequency: product.frequency || '2h', // '15m' | '2h' | '6h'
    created_at: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('tracked_products')
      .upsert(record, { onConflict: 'product_id' })
      .select()
      .single();
    if (!error && data) return data;
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

// 3. Update target alert price & frequency
async function updateProductSettings(productId, { targetPrice, frequency }) {
  const pId = Number(productId);
  const updates = {};
  if (targetPrice !== undefined) updates.target_price = targetPrice ? Number(targetPrice) : null;
  if (frequency !== undefined) updates.frequency = frequency;

  if (supabase) {
    await supabase.from('tracked_products').update(updates).eq('product_id', pId);
  }
  const db = readLocalDb();
  const prod = db.tracked_products.find(p => p.product_id === pId);
  if (prod) {
    Object.assign(prod, updates);
    writeLocalDb(db);
  }
  return prod;
}

// 4. Remove tracked product
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

// 5. Record price snapshot & check for price-drop / back-in-stock alerts
async function recordPriceSnapshot({ productId, price, currency = 'INR', inStock = true, stockCount = 0 }) {
  const pId = Number(productId);
  const recordedAt = new Date().toISOString();
  const record = {
    product_id: pId,
    price: Number(price),
    currency,
    in_stock: Boolean(inStock),
    stock_count: Number(stockCount),
    recorded_at: recordedAt
  };

  const db = readLocalDb();
  const prod = db.tracked_products.find(p => p.product_id === pId);

  // Check for alert triggers
  if (prod) {
    const prevPrice = prod.last_price;
    const prevStock = prod.in_stock;

    // Price Drop Alert
    if (prevPrice && Number(price) < prevPrice) {
      const dropPct = Math.round(((prevPrice - price) / prevPrice) * 100);
      db.alerts.unshift({
        id: Date.now() + Math.random(),
        product_id: pId,
        product_name: prod.name,
        type: 'PRICE_DROP',
        message: `Price dropped by ${dropPct}%! Was ₹${prevPrice.toLocaleString('en-IN')}, now ₹${Number(price).toLocaleString('en-IN')}.`,
        timestamp: recordedAt,
        read: false
      });
    } else if (prod.target_price && Number(price) <= prod.target_price) {
      db.alerts.unshift({
        id: Date.now() + Math.random(),
        product_id: pId,
        product_name: prod.name,
        type: 'TARGET_REACHED',
        message: `Target price reached! Currently ₹${Number(price).toLocaleString('en-IN')} (Target: ₹${prod.target_price.toLocaleString('en-IN')}).`,
        timestamp: recordedAt,
        read: false
      });
    }

    // Back in Stock Alert
    if (prevStock === false && inStock === true) {
      db.alerts.unshift({
        id: Date.now() + Math.random(),
        product_id: pId,
        product_name: prod.name,
        type: 'BACK_IN_STOCK',
        message: `Item is back in stock! ${stockCount} units available.`,
        timestamp: recordedAt,
        read: false
      });
    }

    prod.last_price = Number(price);
    prod.last_stock = Number(stockCount);
    prod.in_stock = Boolean(inStock);
    prod.last_scraped_at = recordedAt;
  }

  if (supabase) {
    await supabase.from('price_history').insert(record);
    await supabase
      .from('tracked_products')
      .update({
        last_price: Number(price),
        last_stock: Number(stockCount),
        in_stock: Boolean(inStock),
        last_scraped_at: recordedAt
      })
      .eq('product_id', pId);
  }

  db.price_history.push({ id: Date.now() + Math.random(), ...record });
  writeLocalDb(db);
  return record;
}

// 6. Get price history
async function getPriceHistory(productId) {
  const pId = Number(productId);
  if (supabase) {
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', pId)
      .order('recorded_at', { ascending: true });
    if (!error && data) return data;
  }
  const db = readLocalDb();
  return db.price_history
    .filter(h => h.product_id === pId)
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
}

// 7. Record scrape log
async function recordScrapeLog({
  productId,
  productName = '',
  status,
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
    await supabase.from('scrape_logs').insert(record);
  }

  const db = readLocalDb();
  db.scrape_logs.unshift({ id: Date.now() + Math.random(), ...record });
  if (db.scrape_logs.length > 500) db.scrape_logs = db.scrape_logs.slice(0, 500);
  writeLocalDb(db);
  return record;
}

// 8. Get scrape logs
async function getScrapeLogs(productId = null, limit = 50) {
  if (supabase) {
    let query = supabase
      .from('scrape_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (productId) query = query.eq('product_id', Number(productId));
    const { data, error } = await query;
    if (!error && data) return data;
  }
  const db = readLocalDb();
  let logs = db.scrape_logs || [];
  if (productId) {
    logs = logs.filter(l => l.product_id === Number(productId));
  }
  return logs.slice(0, limit);
}

// 9. Store layout health & drift detection
async function updateStoreHealth(layoutData) {
  const db = readLocalDb();
  const currentRevision = layoutData?.revision;
  const prevRevision = db.store_health?.last_revision;
  const driftDetected = prevRevision && currentRevision && prevRevision !== currentRevision;

  db.store_health = {
    last_revision: currentRevision || prevRevision,
    classes: layoutData?.classes || db.store_health.classes,
    status: driftDetected ? 'MUTATED_ADAPTED' : 'STABLE',
    drift_detected: Boolean(driftDetected),
    last_checked: new Date().toISOString()
  };

  if (driftDetected) {
    db.alerts.unshift({
      id: Date.now() + Math.random(),
      type: 'LAYOUT_DRIFT',
      message: `Storefront layout mutated! Revision shifted from ${prevRevision} to ${currentRevision}. Scraper automatically adapted to new dynamic selectors.`,
      timestamp: new Date().toISOString(),
      read: false
    });
  }

  writeLocalDb(db);
  return db.store_health;
}

function getStoreHealth() {
  const db = readLocalDb();
  return db.store_health;
}

function getAlerts() {
  const db = readLocalDb();
  return db.alerts || [];
}

function clearAlerts() {
  const db = readLocalDb();
  db.alerts = [];
  writeLocalDb(db);
  return true;
}

module.exports = {
  getTrackedProducts,
  addTrackedProduct,
  updateProductSettings,
  removeTrackedProduct,
  recordPriceSnapshot,
  getPriceHistory,
  recordScrapeLog,
  getScrapeLogs,
  updateStoreHealth,
  getStoreHealth,
  getAlerts,
  clearAlerts
};
