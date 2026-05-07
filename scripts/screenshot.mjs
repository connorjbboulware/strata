// Headless screenshots of the empty + loaded states. Throwaway dev script.
//   node scripts/screenshot.mjs
import puppeteer from 'puppeteer-core';

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
];
const executablePath = CHROME_PATHS.find(() => true);

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  defaultViewport: { width: 1440, height: 1100, deviceScaleFactor: 2 },
  args: ['--hide-scrollbars'],
});

try {
  const page = await browser.newPage();

  // ── 1. Empty state (Mag 7 form pre-filled by default; presets visible) ──
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  // The default state should now show Mag 7 in the form + EmptyState on right with 3 preset cards
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('h2')).some((el) => el.textContent?.includes('No backtest yet')),
    { timeout: 30000 },
  );
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some((el) => el.textContent?.includes('Magnificent 7')),
    { timeout: 30000 },
  );
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({
    path: 'docs/screenshots/v1-empty-fixed.png',
    type: 'png',
    fullPage: false,
  });
  console.log('saved docs/screenshots/v1-empty-fixed.png');

  // ── 2. Loaded state (click Run → wait for chart + metrics) ──
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('dt')).some((el) => el.textContent?.includes('Total Return')),
    { timeout: 90000 },
  );
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({
    path: 'docs/screenshots/v1-loaded-fixed.png',
    type: 'png',
    fullPage: false,
  });
  console.log('saved docs/screenshots/v1-loaded-fixed.png');

  // Pull the warnings out of the page state to verify (read from sessionStorage indirectly)
  const warningsCount = await page.evaluate(() => {
    const liEls = Array.from(document.querySelectorAll('section ul li'));
    return liEls.length;
  });
  console.log(`warnings rendered in DOM: ${warningsCount}`);
} finally {
  await browser.close();
}
