const { scrapeProduct } = require('./scraper');
const db = require('./db');

async function runHeadedDemo() {
  console.log('====================================================');
  console.log('  INE PRODUCT PRICE TRACKER - HEADED SCRAPER DEMO   ');
  console.log('====================================================');
  console.log('Starting observable run with visible Chromium browser...\n');

  // Products to demonstrate:
  // Product 411: Ironwood Workstation Plus
  // Product 833: Cobalt Keyboard XL
  const demoProducts = [
    { id: 411, name: 'Ironwood Workstation Plus' },
    { id: 833, name: 'Cobalt Keyboard XL' }
  ];

  for (const prod of demoProducts) {
    console.log(`\n>>> [DEMO] Scraping Product #${prod.id}: "${prod.name}"`);
    console.log('----------------------------------------------------');

    const result = await scrapeProduct(prod.id, {
      headed: true,
      maxRetries: 3,
      productName: prod.name
    });

    console.log('>>> [DEMO] Outcome for Product #' + prod.id + ':', result);
    console.log('----------------------------------------------------');

    // Small delay between demos
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n====================================================');
  console.log('  HEADED DEMO COMPLETE! All attempts logged to DB   ');
  console.log('====================================================\n');
  const recentLogs = await db.getScrapeLogs(null, 5);
  console.log('Recent Audit Logs in Database:');
  console.table(recentLogs.map(l => ({
    product_id: l.product_id,
    product_name: l.product_name,
    status: l.status,
    attempts: l.attempts,
    price: l.price_found,
    stock: l.stock_found,
    duration_ms: l.duration_ms
  })));
}

runHeadedDemo().catch(err => {
  console.error('[DEMO FATAL ERROR]:', err);
  process.exit(1);
});
