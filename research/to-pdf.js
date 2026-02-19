const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function convert(htmlFile) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const filePath = path.resolve(htmlFile);
  await page.goto('file://' + filePath, { waitUntil: 'networkidle0' });
  const pdfPath = filePath.replace('.html', '.pdf');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: { top: '40px', bottom: '40px', left: '40px', right: '40px' },
    printBackground: true
  });
  await browser.close();
  console.log('Created: ' + pdfPath);
}

(async () => {
  const files = process.argv.slice(2);
  for (const f of files) await convert(f);
})();
