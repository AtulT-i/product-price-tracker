const { chromium } = require('playwright');
const db = require('./db');

function cleanText(str) {
  if (!str) return '';
  return str.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
}

function extractPriceAndStock(rawText) {
  const cleaned = cleanText(rawText);

  const priceMatches = [...cleaned.matchAll(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]+)?)/gi)];
  let price = null;

  if (priceMatches.length > 0) {
    const numbers = priceMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
    if (numbers.length >= 2) {
      price = Math.min(...numbers);
    } else {
      price = numbers[0];
    }
  }

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
        slowMo: headed ? 150 : 0
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      const url = `https://demo.inelabteamdev.com/product/${pId}`;

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      // Check if store returned error
      const errorIndicator = page.locator('.grid-error');
      if (await errorIndicator.isVisible()) {
        const errMsg = await errorIndicator.innerText();
        throw new Error(`Store page returned error: ${errMsg}`);
      }

      // Remove any random cookie banner or modal overlay that blocks pointer clicks
      await page.evaluate(() => {
        document.querySelectorAll('.cookie-overlay, .modal-backdrop, [role="dialog"]').forEach(el => el.remove());
      });

      const priceBlockLocator = page.locator('.price-block');
      await priceBlockLocator.waitFor({ state: 'visible', timeout: 10000 });
      await priceBlockLocator.scrollIntoViewIfNeeded();

      // Human-like mouse trajectory to unlock "Reveal price" (minMoves: 8, minDwellMs: 600)
      const box = await priceBlockLocator.boundingBox();
      if (box) {
        const startX = box.x + 30;
        const startY = box.y + 25;
        for (let i = 1; i <= 12; i++) {
          await page.mouse.move(startX + i * 14, startY + (i % 2 === 0 ? 8 : -8));
          await page.waitForTimeout(65);
        }
      }
      // Dwell to exceed threshold
      await page.waitForTimeout(750);

      // Re-remove cookie overlay if it popped up late
      await page.evaluate(() => {
        document.querySelectorAll('.cookie-overlay, .modal-backdrop').forEach(el => el.remove());
      });

      const revealBtn = page.locator('button:has-text("Reveal price")');
      await revealBtn.waitFor({ state: 'visible', timeout: 5000 });

      // Click with automatic retry if mock store drops the click (Xn() drops 17.5% of clicks)
      let clickAccepted = false;
      for (let clickAttempt = 1; clickAttempt <= 4; clickAttempt++) {
        console.log(`[Scraper] Clicking "Reveal price" (click attempt ${clickAttempt})...`);
        await revealBtn.click({ timeout: 4000 });
        await page.waitForTimeout(1000);

        const isSpinner = await page.locator('.spinner').isVisible();
        const isIdle = await page.locator('.price-idle').isVisible();
        const isError = await page.locator('button:has-text("Try again")').isVisible();

        if (isSpinner || !isIdle || isError) {
          clickAccepted = true;
          console.log('[Scraper] Click registered by mock storefront.');
          break;
        }
        console.log('[Scraper] Store dropped the click event. Retrying click...');
      }

      // Poll for price or handle "Try again"
      let resolvedPrice = null;
      let resolvedStock = 0;
      let resolvedInStock = true;

      const waitStart = Date.now();
      while (Date.now() - waitStart < 15000) {
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

        await page.waitForTimeout(300);
      }

      if (resolvedPrice === null) {
        throw new Error('Price extraction timed out after reveal attempt');
      }

      const durationMs = Date.now() - overallStart;
      const status = attempt > 1 ? 'retried' : 'success';

      console.log(`[Scraper] SUCCESS on attempt ${attempt}: Price=₹${resolvedPrice}, Stock=${resolvedStock} (${durationMs}ms)`);

      await db.recordPriceSnapshot({
        productId: pId,
        price: resolvedPrice,
        currency: 'INR',
        inStock: resolvedInStock,
        stockCount: resolvedStock
      });

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
      console.warn(`[Scraper] Attempt ${attempt} encountered issue: ${err.message}`);
      if (attempt < maxRetries) {
        const backoffMs = attempt * 1200;
        console.log(`[Scraper] Backing off for ${backoffMs}ms before retry...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    } finally {
      if (browser) {
        try { await browser.close(); } catch (_) {}
      }
    }
  }

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
    await new Promise(r => setTimeout(r, 800));
  }

  return results;
}

module.exports = {
  scrapeProduct,
  scrapeAllTracked,
  cleanText,
  extractPriceAndStock
};
