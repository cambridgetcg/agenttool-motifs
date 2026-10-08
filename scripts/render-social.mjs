import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath =
  process.env.CHROME_BIN ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-background-networking'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(join(root, 'web', 'social.svg')).href);
  await page.screenshot({ path: join(root, 'web', 'social.png') });
  console.log('Rendered the authored social cover: web/social.png');
} finally {
  await browser.close();
}
