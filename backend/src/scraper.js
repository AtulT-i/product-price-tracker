const { chromium } = require('playwright');
const db = require('./db');

/**
 * Clean text by stripping zero-width spaces, non-breaking spaces, and extra whitespace.
 */
function cleanText(str) {
  if (!str) return '';
  return str.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
}

/**
 * Extract selling price and stock from the price-block element text and DOM
 */
function extractPriceAndStock(rawText) {
  const cleaned = cleanText(rawText);

  // Look for currency amounts, e.g. ₹1,64,054 or Rs. 164054
  // If there are multiple prices (e.g. MRP and selling price), the selling price is the final discounted price
  const priceMatches = [...cleaned.matchAll(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]+)?)/gi)];
  let price = null;

  if (priceMatches.length > 0) {
    // If multiple prices exist (e.g., MRP strike-through and selling price),
    // the actual selling price is usually the second one or the lower one
    const numbers = priceMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
    if (numbers.length >= 2) {
      // Selling price is the smaller one (discounted price)
      price = Math.min(...numbers);
    } else {
      price = numbers[0];
    }
  }

  // Look for stock count: "HURRY, JUST 164 LEFT", "12 in stock", "Only 5 left"
  let stockCount = 0;
  let inStock = true;

  const stockMatch = cleaned.match(/(?:hurry,\s*just|only|in\s*stock\s*·?)\s*([0-9]+)\s*(?:left|in\s*stock)/i)
    || cleaned.match(/([0-9]+)\s*(?:left|in\s*stock)/i);

  if (stockMatch) {
    stockCount = parseInt(stockMatch[1], 10);
    inStock = stockCount > 0;
  } else if (/out\s*of\s*stock/i.test(cleaned)) {
    inStock = false;
    stockCount = 0;
  } else if (/in\s*stock/i.test(cleaned)) {
    inStock = true;
    stockCount = 1;
  }

  return { price, stockCount, inStock };
}

/**
 * Scrape a single product by ID with full resilience, anti-bot mouse simulation,
 * exponential retries, and honest logging.
 *
 * @param {number|string} productId
 * @param {object} options { headed: boolean, maxRetries: number, productName: string }
 */
async function scrapeProduct(productId, options = {}) {
  const pId = Number(productId);
  const headed = options.headed || process.env.HEADED === 'true' || false;
  const maxRetries = options.maxRetries || 3;
  const productName = options.productName || `Product #${pId}`;

  const overallStart = Date.now();
  let attempts = 0;
  let lastError = null;

  console.log(`[Scraper] Starting scrape for product ${pId} ("${productName}") [headed=${headed}]`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    let browser = null;

    try {
      console.log(`[Scraper] Attempt ${attempt}/${maxRetries} for product ${pId}...`);
      browser = await chromium.launch({
        headless: !headed,
        slowMo: headed ? 300 : 0
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      const url = `https://demo.inelabteamdev.com/product/${pId}`;

      // Set timeout of 20s
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Check if page failed to load product details (e.g. 35% random error in mock store)
      const errorIndicator = page.locator('.grid-error');
      if (await errorIndicator.isVisible()) {
        const errMsg = await errorIndicator.innerText();
        throw new Error(`Store page returned error: ${errMsg}`);
      }

      // Wait for price block or container
      const priceBlockLocator = page.locator('.price-block');
      await priceBlockLocator.waitFor({ state: 'visible', timeout: 10000 });

      const box = await priceBlockLocator.boundingBox();
      if (!box) {
        throw new Error('Price block bounding box unavailable');
      }

      // Human-like mouse movements to satisfy: minMoves >= 8 and minDwellMs >= 600
      const startX = box.x + 30;
      const startY = box.y + 25;
      await page.mouse.move(startX, startY);

      for (let i = 1; i <= 10; i++) {
        await page.waitForTimeout(70 + Math.floor(Math.random() * 30));
        await page.mouse.move(startX + i * 15, startY + (i % 2 === 0 ? 8 : -8));
      }
      // Dwell time to exceed the 600ms threshold
      await page.waitForTimeout(700);

      // Look for "Reveal price" button
      const revealBtn = page.locator('button:has-text("Reveal price")');
      await revealBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Verify button is enabled
      const enabled = await revealBtn.isEnabled();
      if (!enabled) {
        // Extra wiggle
        for (let i = 1; i <= 6; i++) {
          await page.mouse.move(box.x + 40 + i * 10, box.y + 20);
          await page.waitForTimeout(80);
        }
        await page.waitForTimeout(600);
      }

      await revealBtn.click();

      // Poll for price to be revealed (or handle "Try again" if random failure occurs)
      let resolvedPrice = null;
      let resolvedStock = 0;
      let resolvedInStock = true;

      const waitStart = Date.now();
      while (Date.now() - waitStart < 15000) {
        // Check for error state button in price box
        const tryAgainBtn = page.locator('button:has-text("Try again")');
        if (await tryAgainBtn.isVisible()) {
          console.log(`[Scraper] Encountered simulated store error during reveal. Clicking "Try again"...`);
          await tryAgainBtn.click();
          await page.waitForTimeout(1000);
          continue;
        }

        const isSpinner = await page.locator('.spinner').isVisible();
        const isIdle = await page.locator('.price-idle').isVisible();

        if (!isSpinner && !isIdle) {
          const rawText = await priceBlockLocator.innerText();
          const { price, stockCount, inStock } = extractPriceAndStock(rawText);

          if (price !== null) {
            resolvedPrice = price;
            resolvedStock = stockCount;
            resolvedInStock = inStock;
            break;
          }
        }

        await page.waitForTimeout(400);
      }

      if (resolvedPrice === null) {
        throw new Error('Price extraction timed out after reveal attempt');
      }

      const durationMs = Date.now() - overallStart;
      const status = attempt > 1 ? 'retried' : 'success';

      console.log(`[Scraper] SUCCESS on attempt ${attempt}: Price=${resolvedPrice}, Stock=${resolvedStock} (${durationMs}ms)`);

      // Persist snapshot in database
      await db.recordPriceSnapshot({
        productId: pId,
        price: resolvedPrice,
        currency: 'INR',
        inStock: resolvedInStock,
        stockCount: resolvedStock
      });

      // Record honest log
      await db.recordScrapeLog({
        productId: pId,
        productName,
        status,
        attempts: attempt,
        durationMs,
        priceFound: resolvedPrice,
        stockFound: resolvedStock,
        errorMessage: null
      });

      return {
        success: true,
        status,
        attempts: attempt,
        price: resolvedPrice,
        stock: resolvedStock,
        inStock: resolvedInStock,
        durationMs
      };

    } catch (err) {
      lastError = err;
      console.warn(`[Scraper] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.log(`[Scraper] Backing off for ${backoffMs}ms before retry...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }

  // If all retries failed, record failure honestly without storing corrupt data
  const totalDuration = Date.now() - overallStart;
  console.error(`[Scraper] All ${maxRetries} attempts failed for product ${pId}: ${lastError?.message}`);

  await db.recordScrapeLog({
    productId: pId,
    productName,
    status: 'failed',
    attempts,
    durationMs: totalDuration,
    priceFound: null,
    stockFound: null,
    errorMessage: lastError?.message || 'Unknown error'
  });

  return {
    success: false,
    status: 'failed',
    attempts,
    error: lastError?.message,
    durationMs: totalDuration
  };
}

/**
 * Scrape all tracked products in sequence
 */
async function scrapeAllTracked(options = {}) {
  const products = await db.getTrackedProducts();
  console.log(`[Scraper] Starting scheduled scrape for ${products.length} tracked products...`);
  const results = [];

  for (const prod of products) {
    const res = await scrapeProduct(prod.product_id, {
      ...options,
      productName: prod.name
    });
    results.push({ product_id: prod.product_id, name: prod.name, ...res });
    // Polite 1s pause between products
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

module.exports = {
  scrapeProduct,
  scrapeAllTracked,
  cleanText,
  extractPriceAndStock
};
