import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { buildPublication, PUBLIC_FILES } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = new Set([...PUBLIC_FILES, 'edition.json']);
const mime = {
  html: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  svg: 'image/svg+xml',
  png: 'image/png',
  json: 'application/json',
};
const executablePath =
  process.env.CHROME_BIN ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);

test(
  'the gallery works with pointers, keyboard, narrow screens and no scripts',
  { timeout: 90000 },
  async (t) => {
    await buildPublication(join(root, 'web'), join(root, 'docs'));
    const server = createServer(async (req, res) => {
      const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
      if (!allowed.has(name)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        const body = await readFile(join(root, 'docs', name));
        res.writeHead(200, {
          'Content-Type': mime[name.split('.').pop()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--disable-background-networking'],
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [],
        external = [];
      const localOnly = (route) => {
        const url = route.request().url();
        if (new URL(url).origin === origin) return route.continue();
        external.push(url);
        return route.abort();
      };
      await context.route('**/*', localOnly);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'load' });
      assert.equal(
        await page.locator('#begin-anywhere').isEnabled(),
        true,
        'The real interactive app must load.'
      );
      assert.equal(await page.locator('#observations').isVisible(), true);
      assert.equal(await page.locator('#doors').isVisible(), false);

      await t.test(
        'the browser gate verifies the built docs edition and served bytes',
        async () => {
          const response = await context.request.get(`${origin}/edition.json`);
          assert.equal(response.status(), 200, 'Serve the built edition manifest, not just web/.');
          const manifest = await response.json();
          assert.deepEqual(
            manifest,
            JSON.parse(await readFile(join(root, 'docs', 'edition.json'), 'utf8'))
          );
          assert.equal(manifest.data, 'synthetic');
          assert.deepEqual(
            manifest.files.map((item) => item.name).sort(),
            [...PUBLIC_FILES].sort()
          );
          for (const item of manifest.files) {
            const served = await context.request.get(`${origin}/${item.name}`);
            assert.equal(served.status(), 200, item.name);
            const bytes = await served.body();
            assert.deepEqual(bytes, await readFile(join(root, 'docs', item.name)), item.name);
            assert.deepEqual(bytes, await readFile(join(root, 'web', item.name)), item.name);
            assert.equal(bytes.length, item.bytes, item.name);
            assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.name);
          }
        }
      );

      await page.locator('#observation-age').focus();
      await page.keyboard.press('End');
      assert.match(await page.locator('#observation-freshness').innerText(), /last known/);
      await page.locator('#observation-result').selectOption('missing');
      assert.equal(await page.locator('#observation-age').isDisabled(), true);
      assert.match(await page.locator('#observation-output').innerText(), /unknown/i);
      await page.locator('#observation-result').selectOption('negative');
      await page.locator('#observation-age').focus();
      await page.keyboard.press('Home');
      await page.getByRole('button', { name: 'Data', exact: true }).click();
      const card = JSON.parse(await page.locator('#observation-output').innerText());
      assert.equal(card.condition, 'not_intact');
      assert.equal(card.freshness, 'fresh');

      await page.locator('[data-study="doors"]').click();
      assert.equal(await page.locator('#observations').isVisible(), false);
      assert.equal(await page.locator('#doors').isVisible(), true);
      assert.match(await page.locator('#door-state').innerText(), /unstated/);
      await page.locator('#door-record').selectOption('partial');
      assert.match(await page.locator('#door-state').innerText(), /partly stated/);
      assert.equal(await page.locator('#door-data-flow').innerText(), 'Unstated');
      await page.locator('#door-record').selectOption('stated');
      assert.match(await page.locator('#door-state').innerText(), /^stated/);

      await page.locator('[data-study="branches"]').click();
      await page.locator('#branch-count').selectOption('3');
      assert.equal(await page.locator('.branch-leaf:visible').count(), 3);
      assert.match(await page.locator('#fork-statement').innerText(), /Three continuations/);
      await page.locator('#shared-author').uncheck();
      assert.match(await page.locator('#fork-statement').innerText(), /Different authors/);
      assert.deepEqual(JSON.parse(await page.locator('#fork-data').textContent()), []);

      await page.locator('#begin-anywhere').focus();
      await page.keyboard.press('Enter');
      assert.notEqual(
        await page.locator('.study-index [aria-current="true"]').getAttribute('data-study'),
        'branches'
      );
      assert.equal(
        await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
        'auto'
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);

      const cdp = await context.newCDPSession(page);
      const axNode = async (selector) => {
        const { root: document } = await cdp.send('DOM.getDocument');
        const { nodeId } = await cdp.send('DOM.querySelector', {
          nodeId: document.nodeId,
          selector,
        });
        const { nodes } = await cdp.send('Accessibility.getPartialAXTree', {
          nodeId,
          fetchRelatives: false,
        });
        assert.equal(nodes[0].ignored, false, selector);
        return nodes[0];
      };

      await t.test(
        'completed observation changes are polite, associated and quiet during slider input',
        async () => {
          await page.locator('[data-study="observations"]').click();
          await page.locator('#observation-result').selectOption('positive');
          await page.getByRole('button', { name: 'Brief', exact: true }).click();
          const changes = await page.evaluate(async () => {
            const status = document.getElementById('app-status');
            const slider = document.getElementById('observation-age');
            const before = status.textContent;
            let mutations = 0;
            const observer = new MutationObserver((records) => {
              mutations += records.length;
            });
            observer.observe(status, { childList: true, characterData: true, subtree: true });
            for (const minutes of [3, 6, 12]) {
              slider.value = String(minutes);
              slider.dispatchEvent(new Event('input', { bubbles: true }));
            }
            await Promise.resolve();
            const inputMutations = mutations;
            const afterInput = status.textContent;
            slider.dispatchEvent(new Event('change', { bubbles: true }));
            await Promise.resolve();
            observer.disconnect();
            return {
              before,
              afterInput,
              inputMutations,
              completedMutations: mutations - inputMutations,
            };
          });
          assert.equal(changes.afterInput, changes.before);
          assert.equal(
            changes.inputMutations,
            0,
            'Continuous slider input must not update the live summary.'
          );
          assert.equal(
            changes.completedMutations,
            1,
            'A completed change must announce its result once.'
          );
          assert.match(await page.locator('#app-status').innerText(), /last known.*12 minutes/);
          assert.match(
            await page.locator('#observation-output').innerText(),
            /2026-01-01T12:00:00\.000Z/
          );

          const status = await axNode('#app-status');
          assert.equal(status.role.value, 'status');
          assert.equal(
            status.properties.find((property) => property.name === 'live')?.value.value,
            'polite'
          );
          assert.equal(
            status.properties.find((property) => property.name === 'atomic')?.value.value,
            true
          );
          const age = await axNode('#age-value');
          assert.equal(await page.locator('#age-value').getAttribute('aria-live'), 'off');
          // Chromium omits the AX live property when aria-live is explicitly off.
          assert.equal(
            age.properties.find((property) => property.name === 'live')?.value.value ?? 'off',
            'off'
          );
          assert.match(
            (await axNode('#observation-age')).description.value,
            /five-minute.*last known/s
          );
          assert.match(
            (await axNode('#observation-result')).description.value,
            /Recorded intact.*last known/s
          );
          for (const selector of [
            '#observation-result',
            '#observation-age',
            'button[data-surface="brief"]',
            'button[data-surface="full"]',
            'button[data-surface="data"]',
          ]) {
            assert.ok(
              ((await page.locator(selector).getAttribute('aria-controls')) || '')
                .split(' ')
                .includes('observation-output'),
              selector
            );
          }
          await page.locator('#observation-result').selectOption('missing');
          assert.match(await page.locator('#app-status').innerText(), /Unknown.*no observation/);
          await page.locator('#observation-result').selectOption('negative');
          assert.match(await page.locator('#app-status').innerText(), /not intact.*last known/);
          for (const name of ['Full', 'Data']) {
            await page.getByRole('button', { name, exact: true }).click();
            const summary = await page.locator('#app-status').innerText();
            assert.ok(summary.startsWith(`${name} view.`));
            assert.match(summary, /not intact.*last known/);
            assert.doesNotMatch(summary, /"asOf"|\{/);
          }
        }
      );

      await t.test(
        'completed boundary changes announce the interpretation and expose result associations',
        async () => {
          await page.locator('[data-study="doors"]').click();
          for (const [value, expected] of [
            ['partial', /Boundary partly stated.*gaps stay visible/s],
            ['stated', /Boundary stated.*not independent verification/s],
            ['unstated', /Boundary unstated.*not the same as nothing to question/s],
          ]) {
            await page.locator('#door-record').selectOption(value);
            assert.match(await page.locator('#app-status').innerText(), expected);
          }
          const control = await axNode('#door-record');
          assert.match(control.description.value, /unstated.*not the same as nothing to question/s);
          assert.deepEqual(
            control.properties
              .find((property) => property.name === 'describedby')
              .value.relatedNodes.map((node) => node.idref),
            ['door-state', 'door-meaning']
          );
          assert.ok(
            ((await page.locator('#door-record').getAttribute('aria-controls')) || '')
              .split(' ')
              .includes('door-data-flow')
          );
        }
      );

      await t.test(
        'completed fork changes announce scope without arbitration and associate both controls',
        async () => {
          await page.locator('[data-study="branches"]').click();
          await page.locator('#shared-author').check();
          for (const [count, expected] of [
            ['1', /One continuation.*No fork is asserted/s],
            ['2', /Two continuations.*No branch is chosen or discarded/s],
            ['3', /Three continuations.*No branch is chosen or discarded/s],
          ]) {
            await page.locator('#branch-count').selectOption(count);
            assert.match(await page.locator('#app-status').innerText(), expected);
          }
          await page.locator('#shared-author').uncheck();
          assert.match(
            await page.locator('#app-status').innerText(),
            /Different authors.*not merged/s
          );
          const beforeCountChange = await page.locator('#app-status').innerText();
          await page.locator('#branch-count').selectOption('2');
          const afterCountChange = await page.locator('#app-status').innerText();
          assert.notEqual(
            afterCountChange,
            beforeCountChange,
            'A count change still matters in distinct author scopes.'
          );
          assert.match(afterCountChange, /2 continuations.*Different authors.*not merged/s);
          for (const selector of ['#branch-count', '#shared-author']) {
            const control = await axNode(selector);
            assert.match(
              control.description.value,
              /Different authors.*not merged.*distinct author labels/s
            );
            assert.ok(
              ((await page.locator(selector).getAttribute('aria-controls')) || '')
                .split(' ')
                .includes('fork-data'),
              selector
            );
          }
        }
      );
      await cdp.detach();

      await page.locator('[data-study="observations"]').click();
      await page.locator('#observation-result').selectOption('positive');
      await page.getByRole('button', { name: 'Brief', exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await mkdir(join(root, '.private', 'qa'), { recursive: true });
      await page.screenshot({ path: join(root, '.private', 'qa', 'desktop.png'), fullPage: true });

      const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      });
      const phone = await mobile.newPage();
      await mobile.route('**/*', localOnly);
      phone.on('pageerror', (error) => errors.push(error.message));
      await phone.goto(origin, { waitUntil: 'load' });
      await phone.locator('[data-study="doors"]').tap();
      assert.equal(await phone.locator('#doors').isVisible(), true);
      await phone.locator('#door-record').selectOption('stated');
      assert.match(await phone.locator('#door-state').innerText(), /^stated/);
      assert.equal(
        await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
        'No horizontal overflow at a real narrow viewport.'
      );
      await phone.evaluate(() => window.scrollTo(0, 0));
      await phone.screenshot({ path: join(root, '.private', 'qa', 'mobile.png'), fullPage: true });

      const plainContext = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 844 },
      });
      const plain = await plainContext.newPage();
      await plainContext.route('**/*', localOnly);
      plain.on('pageerror', (error) => errors.push(error.message));
      await plain.goto(origin, { waitUntil: 'load' });
      assert.equal(await plain.locator('.script-note').isVisible(), true);
      for (const id of ['observations', 'doors', 'branches'])
        assert.equal(await plain.locator(`#${id}`).isVisible(), true);
      assert.equal(await plain.locator('#begin-anywhere').isDisabled(), true);
      await plain.locator('[data-study="branches"]').click();
      assert.equal(new URL(plain.url()).hash, '#branches');
      await t.test(
        'the no-script branch count, visible paths and leaves agree with the default prose',
        async () => {
          assert.equal(await plain.locator('#branch-count').inputValue(), '2');
          assert.equal(await plain.locator('.branch-leaf:visible').count(), 2);
          assert.equal(await plain.locator('[data-branch]:visible').count(), 2);
          assert.match(
            await plain.locator('#branch-description').textContent(),
            /2 illustrative continuations/
          );
          assert.match(await plain.locator('#fork-statement').innerText(), /Neither|Two/);
          assert.equal(await plain.locator('[data-leaf="2"]').isVisible(), false);
          assert.equal(await plain.locator('[data-branch="2"]').isVisible(), false);
        }
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(external, []);
    } finally {
      if (browser) await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
);
