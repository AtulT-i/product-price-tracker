const { chromium } = require('playwright');

async function testScrape(productId = 411, headed = false) {
  console.log(`[TestScraper] Starting scrape for product ${productId} (headed=${headed})...`);
  const browser = await chromium.launch({
    headless: !headed,
    slowMo: headed ? 400 : 0
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    const url = `https://demo.inelabteamdev.com/product/${productId}`;
    console.log(`[TestScraper] Navigating to ${url}...`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for the detail card or price block to appear
    await page.waitForSelector('.price-block, .detail-info', { timeout: 15000 });
    console.log('[TestScraper] Detail page loaded.');

    // Look for price block
    const priceBlock = await page.$('.price-block');
    if (!priceBlock) {
      throw new Error('Price block not found on page');
    }

    const box = await priceBlock.boundingBox();
    if (!box) {
      throw new Error('Could not get price-block bounding box');
    }

    console.log(`[TestScraper] Simulating human mouse movement over price box (${Math.round(box.x)}, ${Math.round(box.y)})...`);
    // Move mouse across the box with multiple points and dwell > 700ms
    const startX = box.x + 20;
    const startY = box.y + 20;
    await page.mouse.move(startX, startY);

    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(80);
      await page.mouse.move(startX + i * 15, startY + (i % 2 === 0 ? 10 : -10));
    }
    // Dwell to satisfy minDwellMs (600ms)
    await page.waitForTimeout(800);

    // Wait for Reveal price button to become enabled
    console.log('[TestScraper] Waiting for Reveal price button to become enabled...');
    const revealBtn = page.locator('button:has-text("Reveal price")');
    await revealBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if button is enabled
    const isEnabled = await revealBtn.isEnabled();
    console.log('[TestScraper] Button isEnabled:', isEnabled);

    if (!isEnabled) {
      // Move a bit more if needed
      for (let i = 1; i <= 5; i++) {
        await page.mouse.move(box.x + 50 + i * 10, box.y + 30);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(500);
    }

    console.log('[TestScraper] Clicking "Reveal price"...');
    await revealBtn.click();

    // The store may go into loading or retrying. Let's wait for either:
    // 1. Success: price is revealed (not price-idle and not price-error and not price-block:has(.spinner))
    // 2. Error button: "Try again"
    console.log('[TestScraper] Waiting for quote result...');

    // We wait up to 15 seconds for price to appear or handle "Try again"
    const startTime = Date.now();
    let extractedPrice = null;
    let extractedStock = null;

    while (Date.now() - startTime < 15000) {
      // Check for error button
      const tryAgainBtn = page.locator('button:has-text("Try again")');
      if (await tryAgainBtn.isVisible()) {
        console.log('[TestScraper] Mock store showed error state, clicking "Try again"...');
        await tryAgainBtn.click();
        await page.waitForTimeout(1000);
        continue;
      }

      // Check if price-idle is gone and spinner is gone
      const isSpinner = await page.locator('.spinner').isVisible();
      const isIdle = await page.locator('.price-idle').isVisible();

      if (!isSpinner && !isIdle) {
        // Inspect price text in price-block
        const text = await priceBlock.innerText();
        console.log('[TestScraper] Current price-block text:\n' + text);

        // Parse price (look for numbers with currency symbol or comma)
        // Ir formats price with currency, e.g. "₹24,999" or "Rs. 24,999" or digits
        const priceMatch = text.match(/(?:₹|Rs\.?)\s*([0-9,]+(?:\.[0-9]+)?)/i) || text.match(/([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?)/);
        if (priceMatch) {
          extractedPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        }

        // Parse stock
        const stockMatch = text.match(/([0-9]+)\s*(?:in stock|left)/i) || text.match(/(?:In stock ·\s*|Only\s*)([0-9]+)\s*left/i);
        if (stockMatch) {
          extractedStock = parseInt(stockMatch[1], 10);
        } else if (text.toLowerCase().includes('in stock')) {
          extractedStock = 1;
        }

        if (extractedPrice !== null) {
          console.log(`[TestScraper] SUCCESS! Extracted Price: ${extractedPrice}, Stock: ${extractedStock}`);
          break;
        }
      }

      await page.waitForTimeout(500);
    }

    if (!extractedPrice) {
      throw new Error('Failed to extract price within timeout');
    }

    return { price: extractedPrice, stock: extractedStock };
  } finally {
    await browser.close();
  }
}

testScrape(411, false)
  .then(res => console.log('[TestScraper] Result:', res))
  .catch(err => console.error('[TestScraper] Error:', err));
