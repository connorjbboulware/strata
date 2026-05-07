// Quick verification that the preset click flash + auto-submit fires.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('60/40 Portfolio')),
  );

  // Click 60/40 and immediately check border state at +50ms
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('60/40 Portfolio'));
    t?.click();
  });
  await new Promise((r) => setTimeout(r, 50));
  const flashState = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('60/40 Portfolio'));
    return {
      hasFlash: t?.className.includes('border-accent') ?? false,
      disabled: t?.disabled ?? false,
    };
  });
  console.log(`60/40 click @ +50ms — flash class: ${flashState.hasFlash}, disabled: ${flashState.disabled}`);

  // Wait for loading state to appear (within 1s after the 200ms flash)
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('p')).some((p) => p.textContent?.includes('Running your strategy')),
    { timeout: 5000 },
  );
  console.log('LoadingState rendered after click ✓ (flash → auto-submit chain works)');
} finally {
  await browser.close();
}
