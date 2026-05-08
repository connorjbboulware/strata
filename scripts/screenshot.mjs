// Headless screenshots. One-shot dev tool.
//   node scripts/screenshot.mjs               # all
//   node scripts/screenshot.mjs <mode>        # one of: empty | loaded | comparison | tooltip | heatmap | mobile
import puppeteer from 'puppeteer-core';

const ALL = ['splash', 'empty', 'loaded', 'comparison', 'tooltip', 'heatmap', 'mobile'];
const requested = process.argv[2] ?? 'all';
const modes = requested === 'all' ? ALL : [requested];

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
];
const executablePath = CHROME_PATHS.find(() => true);

async function newPage(browser, viewport, { skipSplash = true } = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  await page.setViewport(viewport);
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  if (skipSplash) {
    // Click "Enter →" if visible, then wait for the dashboard form to appear
    await page.evaluate(() => {
      const enter = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Enter →'),
      );
      enter?.click();
    });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('h2, label')).some((el) => el.textContent?.includes('Strategy name')),
      { timeout: 10000 },
    ).catch(() => {});
    await new Promise((r) => setTimeout(r, 500));
  }
  return page;
}

async function clickPreset(page, label) {
  await page.waitForFunction(
    (lbl) => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes(lbl)),
    { timeout: 30000 },
    label,
  );
  await page.evaluate((lbl) => {
    const t = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(lbl));
    t?.click();
  }, label);
  await page.waitForFunction(
    () =>
      document.querySelectorAll('canvas').length >= 2 ||
      Array.from(document.querySelectorAll('th, dt')).some((el) => el.textContent?.includes('Total')),
    { timeout: 120000 },
  );
  await new Promise((r) => setTimeout(r, 2500));
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--hide-scrollbars'],
});

try {
  for (const mode of modes) {
    if (mode === 'splash') {
      const page = await newPage(browser, { width: 1440, height: 900, deviceScaleFactor: 2 }, { skipSplash: false });
      // Wait for the splash wordmark
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('h1')).some((el) => el.textContent?.trim() === 'Strata' && parseFloat(getComputedStyle(el).fontSize) > 80),
        { timeout: 10000 },
      ).catch(() => {});
      // Hold long enough for the entrance animations to finish (~1.2s for bands)
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: 'docs/screenshots/v1-splash.png', type: 'png', fullPage: false });
      console.log('saved docs/screenshots/v1-splash.png');
      await page.close();
      continue;
    }

    if (mode === 'empty') {
      const page = await newPage(browser, { width: 1440, height: 900, deviceScaleFactor: 2 });
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('h2')).some((el) => el.textContent?.includes('Backtest a portfolio strategy')),
        { timeout: 30000 },
      );
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({ path: 'docs/screenshots/v1-empty.png', type: 'png', fullPage: false });
      console.log('saved docs/screenshots/v1-empty.png');
      await page.close();
    }

    if (mode === 'loaded') {
      const page = await newPage(browser, { width: 1440, height: 1100, deviceScaleFactor: 2 });
      await clickPreset(page, 'Magnificent 7');
      await page.screenshot({ path: 'docs/screenshots/v1-loaded.png', type: 'png', fullPage: true });
      console.log('saved docs/screenshots/v1-loaded.png');
      await page.close();
    }

    if (mode === 'comparison') {
      const page = await newPage(browser, { width: 1440, height: 1100, deviceScaleFactor: 2 });
      await clickPreset(page, 'Magnificent 7');
      // Click "+ Add for comparison"
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Add for comparison'),
        );
        t?.click();
      });
      await new Promise((r) => setTimeout(r, 400));
      // Switch to 60/40 preset via the form's preset row inside StrategyForm — but that
      // doesn't exist. Instead fill the form for a contrasting strategy by using the
      // form's existing fields, or clicking a preset card from EmptyState (which only
      // appears on first load). Easiest: type a different ticker basket via the form.
      // Use applyRequest from the form ref isn't accessible here; the simplest route is
      // to dispatch a Run after editing the strategy name in the form. Skipping the
      // edit and just hitting Run will append the SAME strategy (not useful).
      // Instead: edit the Strategy name field in the form and run again.
      await page.evaluate(() => {
        // Update strategy name
        const nameInput = document.querySelector('input#name');
        if (nameInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(nameInput, '60/40 Classic');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // Remove all chip tickers and add VTI + BND
        const removeButtons = Array.from(document.querySelectorAll('button[aria-label^="Remove "]'));
        removeButtons.forEach((b) => b.click());
        const tickerInput = document.querySelector('input#ticker-input');
        if (tickerInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          for (const t of ['VTI', 'BND']) {
            setter.call(tickerInput, t);
            tickerInput.dispatchEvent(new Event('input', { bubbles: true }));
            tickerInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          }
        }
      });
      await new Promise((r) => setTimeout(r, 400));
      // Submit form
      await page.evaluate(() => {
        const t = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) =>
          b.textContent?.includes('Run backtest'),
        );
        t?.click();
      });
      // Wait for the metrics table (multi-strategy mode shows table with Strategy column)
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('th')).some((th) => th.textContent?.trim() === 'Strategy'),
        { timeout: 120000 },
      );
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({ path: 'docs/screenshots/v1-comparison.png', type: 'png', fullPage: true });
      console.log('saved docs/screenshots/v1-comparison.png');
      await page.close();
    }

    if (mode === 'tooltip') {
      const page = await newPage(browser, { width: 1440, height: 1100, deviceScaleFactor: 2 });
      await clickPreset(page, 'Magnificent 7');
      const inner = await page.evaluate(() => {
        const c = Array.from(document.querySelectorAll('div')).find(
          (d) => d.querySelectorAll('canvas').length >= 2 && d.style.height,
        );
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { x: r.left, y: r.top, width: r.width, height: r.height };
      });
      if (inner) {
        await page.mouse.move(inner.x + inner.width * 0.4, inner.y + inner.height * 0.35);
        await new Promise((r) => setTimeout(r, 200));
        await page.mouse.move(inner.x + inner.width * 0.65, inner.y + inner.height * 0.22);
        await new Promise((r) => setTimeout(r, 900));
        const handle = await page.evaluateHandle(() => {
          const c = Array.from(document.querySelectorAll('div')).find(
            (d) => d.querySelectorAll('canvas').length >= 2 && d.style.height,
          );
          return c?.parentElement;
        });
        await handle.asElement()?.screenshot({
          path: 'docs/screenshots/v1-equity-tooltip.png',
          type: 'png',
        });
        console.log('saved docs/screenshots/v1-equity-tooltip.png');
      }
      await page.close();
    }

    if (mode === 'heatmap') {
      const page = await newPage(browser, { width: 1440, height: 1100, deviceScaleFactor: 2 });
      await clickPreset(page, 'Magnificent 7');
      await page.evaluate(() => {
        const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes('Monthly Returns'));
        const section = h?.parentElement;
        const wrap = section?.querySelector('.overflow-x-auto');
        if (wrap) (wrap).style.overflowX = 'visible';
        section?.scrollIntoView({ block: 'start' });
      });
      await new Promise((r) => setTimeout(r, 400));
      const handle = await page.evaluateHandle(() => {
        const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes('Monthly Returns'));
        return h?.parentElement;
      });
      await handle.asElement()?.screenshot({
        path: 'docs/screenshots/v1-heatmap.png',
        type: 'png',
      });
      console.log('saved docs/screenshots/v1-heatmap.png');
      await page.close();
    }

    if (mode === 'mobile') {
      const page = await newPage(browser, { width: 414, height: 896, deviceScaleFactor: 2, isMobile: true });
      await clickPreset(page, 'Magnificent 7');
      await page.screenshot({ path: 'docs/screenshots/v1-mobile.png', type: 'png', fullPage: true });
      console.log('saved docs/screenshots/v1-mobile.png');
      await page.close();
    }
  }
} finally {
  await browser.close();
}
