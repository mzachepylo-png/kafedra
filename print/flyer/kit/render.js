// Рендер зібраних SVG у PNG і PDF (Chromium через Playwright).
// Вхід: JSON-масив завдань [{svg, png, pdf, pw, ph, wmm, hmm}] у файлі argv[2].
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  for (const j of jobs) {
    const svg = fs.readFileSync(j.svg, 'utf8');
    const page = await browser.newPage({ viewport: { width: j.pw, height: j.ph } });
    const html = `<!doctype html><html><head><style>html,body{margin:0;padding:0;background:#fff}
      svg{display:block;width:${j.pw}px;height:${j.ph}px}
      @page{size:${j.wmm}mm ${j.hmm}mm;margin:0}
      @media print{svg{width:${j.wmm}mm;height:${j.hmm}mm}}</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: j.png });
    await page.pdf({ path: j.pdf, width: `${j.wmm}mm`, height: `${j.hmm}mm`, printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' });
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
