const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const { scrapeProduct, scrapeAllTracked } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory catalog cache to make searches instant and avoid hitting rate limits
let catalogCache = [];
let lastCatalogFetch = 0;

async function fetchCatalog(force = false) {
  const now = Date.now();
  if (!force && catalogCache.length > 0 && now - lastCatalogFetch < 1000 * 60 * 15) {
    return catalogCache;
  }
  try {
    console.log('[Server] Fetching full catalog from INE mock store...');
    const allItems = [];
    // The store has 1000 items in pages of 50
    for (let page = 1; page <= 5; page++) { // fetch first 250 for quick responsiveness
      const res = await fetch(`https://demo.inelabteamdev.com/api/catalog?page=${page}&pageSize=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          allItems.push(...data.items);
        } else {
          break;
        }
      }
    }
    catalogCache = allItems;
    lastCatalogFetch = now;
    console.log(`[Server] Cached ${catalogCache.length} catalog items.`);
    return catalogCache;
  } catch (err) {
    console.error('[Server] Failed to fetch catalog:', err.message);
    return catalogCache;
  }
}

// 1. Health check & Render Keep-Alive
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'INE Product Price Tracker Backend',
    timestamp: new Date().toISOString()
  });
});

// 2. Search catalog by partial or full product name / brand / category
app.get('/api/catalog/search', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  const catalog = await fetchCatalog();
  if (!query) {
    return res.json({ items: catalog.slice(0, 20) });
  }

  const results = catalog.filter(item => {
    return (
      (item.name && item.name.toLowerCase().includes(query)) ||
      (item.brand && item.brand.toLowerCase().includes(query)) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.sku && item.sku.toLowerCase().includes(query))
    );
  });

  res.json({ items: results.slice(0, 30) });
});

// 3. Get all tracked products
app.get('/api/tracked', async (req, res) => {
  try {
    const products = await db.getTrackedProducts();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Track a new product
app.post('/api/track', async (req, res) => {
  try {
    const product = req.body;
    if (!product || !product.id) {
      return res.status(400).json({ error: 'Product id is required' });
    }

    const tracked = await db.addTrackedProduct(product);

    // Trigger an initial asynchronous scrape so price and stock are recorded immediately
    scrapeProduct(product.id, { productName: product.name }).catch(err => {
      console.error(`[Server] Background initial scrape failed for ${product.id}:`, err.message);
    });

    res.status(201).json({ message: 'Product tracked successfully', product: tracked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Remove tracked product
app.delete('/api/track/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    await db.removeTrackedProduct(productId);
    res.json({ message: 'Product removed from tracking' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get price history for a product
app.get('/api/history/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const history = await db.getPriceHistory(productId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Get scrape audit logs
app.get('/api/logs', async (req, res) => {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : null;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await db.getScrapeLogs(productId, limit);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Trigger immediate scrape (for cron-job.org or manual button)
let isScrapingInProgress = false;
app.post('/api/scrape-now', async (req, res) => {
  if (isScrapingInProgress) {
    return res.status(429).json({ message: 'Scrape already in progress' });
  }

  isScrapingInProgress = true;
  res.json({ message: 'Scheduled scrape initiated' });

  // Run in background
  (async () => {
    try {
      console.log('[Server] /api/scrape-now triggered');
      await scrapeAllTracked();
    } catch (err) {
      console.error('[Server] Scrape all error:', err.message);
    } finally {
      isScrapingInProgress = false;
    }
  })();
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Product Price Tracker backend running on port ${PORT}`);
  // Preload catalog
  fetchCatalog().catch(() => {});
});
