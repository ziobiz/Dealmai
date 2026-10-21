'use strict';

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch (err) {
      const missing = new Error('PDF renderer is not installed');
      missing.cause = err;
      throw missing;
    }
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }).catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(String(html || ''), { waitUntil: 'load', timeout: 20000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' }
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { htmlToPdf };
