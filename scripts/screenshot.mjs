// Headless screenshot of the loaded-results state. Throwaway dev script.
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

  // Pre-populate sessionStorage with the Mag 7 request so the form hydrates.
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });

  // Type tickers one by one
  const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
  await page.click('#ticker-input');
  for (const t of tickers) {
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }

  // Click Run
  await page.click('button[type="submit"]');

  // Wait for the metrics grid to render — its <dt> tags contain "Total Return"
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('dt')).some((el) => el.textContent?.includes('Total Return')),
    { timeout: 90000 },
  );
  // Settle for chart paths to draw
  await new Promise((r) => setTimeout(r, 2000));

  await page.screenshot({
    path: 'docs/screenshots/v1-app.png',
    type: 'png',
    fullPage: false,
  });
  console.log('saved docs/screenshots/v1-app.png');
} finally {
  await browser.close();
}
