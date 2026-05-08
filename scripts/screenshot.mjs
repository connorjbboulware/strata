// Headless screenshots. One-shot dev tool.
//   node scripts/screenshot.mjs               # all states
//   node scripts/screenshot.mjs empty
//   node scripts/screenshot.mjs charts        # full page with all 4 charts
//   node scripts/screenshot.mjs tooltip       # equity chart with crosshair tooltip
//   node scripts/screenshot.mjs heatmap       # monthly heatmap only
import puppeteer from 'puppeteer-core';

const mode = process.argv[2] ?? 'all';

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

async function gotoFresh(page) {
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
}

async function clickMag7(page) {
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('Magnificent 7')),
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Magnificent 7'));
    target?.click();
  });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('dt')).some((el) => el.textContent?.includes('Total Return')),
    { timeout: 90000 },
  );
  await page.waitForFunction(
    () => document.querySelectorAll('canvas').length >= 2,
    { timeout: 30000 },
  );
  await new Promise((r) => setTimeout(r, 2500));
}

/** Get a section bounding box by its <h3> label and scroll it into view first. */
async function scrollAndMeasureSection(page, headingText) {
  await page.evaluate((label) => {
    const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes(label));
    if (h) h.parentElement?.scrollIntoView({ block: 'start' });
  }, headingText);
  await new Promise((r) => setTimeout(r, 350));
  return page.evaluate((label) => {
    const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes(label));
    const el = h?.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  }, headingText);
}

try {
  if (mode === 'empty' || mode === 'all') {
    const page = await browser.newPage();
    await gotoFresh(page);
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('h2')).some((el) => el.textContent?.includes('Backtest a portfolio strategy')),
      { timeout: 30000 },
    );
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: 'docs/screenshots/v1-empty-v2.png', type: 'png', fullPage: false });
    console.log('saved docs/screenshots/v1-empty-v2.png');
    await page.close();
  }

  if (mode === 'charts' || mode === 'all') {
    const page = await browser.newPage();
    await gotoFresh(page);
    await clickMag7(page);
    await page.screenshot({
      path: 'docs/screenshots/v1-charts.png',
      type: 'png',
      fullPage: true,
    });
    console.log('saved docs/screenshots/v1-charts.png');
    await page.close();
  }

  if (mode === 'tooltip' || mode === 'all') {
    const page = await browser.newPage();
    await gotoFresh(page);
    await clickMag7(page);

    // Find both the inner chart container (for hover coords) and the outer
    // EquityChart wrapper (for screenshot clip — the tooltip is its sibling).
    const boxes = await page.evaluate(() => {
      const inner = Array.from(document.querySelectorAll('div')).find(
        (d) => d.querySelectorAll('canvas').length >= 2 && d.style.height,
      );
      if (!inner) return null;
      const outer = inner.parentElement;
      const ir = inner.getBoundingClientRect();
      const or = (outer ?? inner).getBoundingClientRect();
      return {
        inner: { x: ir.left, y: ir.top, width: ir.width, height: ir.height },
        outer: { x: or.left, y: or.top, width: or.width, height: or.height },
      };
    });

    if (boxes) {
      const { inner } = boxes;
      await page.mouse.move(inner.x + inner.width * 0.4, inner.y + inner.height * 0.35);
      await new Promise((r) => setTimeout(r, 200));
      await page.mouse.move(inner.x + inner.width * 0.65, inner.y + inner.height * 0.22);
      await new Promise((r) => setTimeout(r, 900));

      // elementHandle.screenshot() composites canvas + DOM overlays correctly
      // (puppeteer's page.screenshot({clip}) drops absolutely-positioned DOM siblings).
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
    } else {
      console.log('could not locate equity chart container; skipping tooltip shot');
    }
    await page.close();
  }

  if (mode === 'heatmap' || mode === 'all') {
    const page = await browser.newPage();
    await gotoFresh(page);
    await clickMag7(page);
    // Force the 2-col grid that holds {heatmap | histogram+sharpe} into a single
    // column, so the heatmap section gets the full panel width and renders all
    // 12 months + the Year column without horizontal scroll.
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes('Monthly Returns'));
      const section = h?.parentElement;
      const grid = section?.parentElement;
      if (grid) (grid).style.gridTemplateColumns = '1fr';
      const wrap = section?.querySelector('.overflow-x-auto');
      if (wrap) (wrap).style.overflowX = 'visible';
      section?.scrollIntoView({ block: 'start' });
    });
    await new Promise((r) => setTimeout(r, 350));
    const handle = await page.evaluateHandle(() => {
      const h = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.includes('Monthly Returns'));
      return h?.parentElement;
    });
    const el = handle.asElement();
    if (el) {
      await el.screenshot({ path: 'docs/screenshots/v1-heatmap.png', type: 'png' });
      console.log('saved docs/screenshots/v1-heatmap.png');
    } else {
      console.log('could not locate heatmap section; skipping');
    }
    await page.close();
  }
} finally {
  await browser.close();
}
