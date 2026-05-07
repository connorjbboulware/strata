// Headless screenshots. Throwaway dev script.
//   node scripts/screenshot.mjs               # both v1-empty-v2 + v1-loaded-v2
//   node scripts/screenshot.mjs empty         # only empty-state
//   node scripts/screenshot.mjs loaded        # only loaded-state
import puppeteer from 'puppeteer-core';

const mode = process.argv[2] ?? 'both';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
];
const executablePath = CHROME_PATHS.find(() => true);

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  args: ['--hide-scrollbars'],
});

try {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });

  if (mode === 'empty' || mode === 'both') {
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('h2')).some((el) => el.textContent?.includes('Backtest a portfolio strategy')),
      { timeout: 30000 },
    );
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((el) => el.textContent?.includes('Magnificent 7')),
      { timeout: 30000 },
    );
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: 'docs/screenshots/v1-empty-v2.png',
      type: 'png',
      fullPage: false,
    });
    console.log('saved docs/screenshots/v1-empty-v2.png');
  }

  if (mode === 'loaded' || mode === 'both') {
    // Click "60/40 Portfolio" preset (per user's verification: confirm flash + auto-submit)
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((b) => b.textContent?.includes('60/40 Portfolio'));
      target?.click();
    });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('dt')).some((el) => el.textContent?.includes('Total Return')),
      { timeout: 90000 },
    );
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({
      path: 'docs/screenshots/v1-loaded-v2.png',
      type: 'png',
      fullPage: false,
    });
    console.log('saved docs/screenshots/v1-loaded-v2.png');
  }
} finally {
  await browser.close();
}
