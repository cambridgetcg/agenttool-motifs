import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  readdir,
  rm,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildPublication, PUBLIC_FILES } from '../scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
async function fixture(t) {
  await mkdir(join(root, '.private'), { recursive: true });
  const base = await mkdtemp(join(root, '.private', 'export-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = join(base, 'source'),
    destination = join(base, 'export');
  await mkdir(source);
  for (const name of PUBLIC_FILES) await copyFile(join(root, 'web', name), join(source, name));
  return { base, source, destination };
}

test('the public export contains only allowlisted bytes and a deterministic manifest', async (t) => {
  const f = await fixture(t);
  const first = await buildPublication(f.source, f.destination);
  assert.deepEqual((await readdir(f.destination)).sort(), [...PUBLIC_FILES, 'edition.json'].sort());
  for (const item of first.files) {
    const bytes = await readFile(join(f.destination, item.name));
    assert.equal(item.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.equal(item.bytes, bytes.length);
  }
  assert.deepEqual(await buildPublication(f.source, f.destination), first);
  assert.equal(first.data, 'synthetic');
});

test('unreviewed source files are rejected, not silently uploaded', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.source, 'PRIVATE-NOTES.md'), 'Synthetic secret fixture.');
  await assert.rejects(buildPublication(f.source, f.destination), /unreviewed/i);
});

test('local paths and credential-shaped material stop the export without echoing content', async (t) => {
  const f = await fixture(t);
  for (const text of ['<p>/Users/example/private-note</p>', 'hf_' + 'x'.repeat(30)]) {
    await writeFile(join(f.source, 'index.html'), text);
    await assert.rejects(buildPublication(f.source, f.destination), (error) => {
      assert.match(error.message, /private material/i);
      assert.ok(!error.message.includes(text));
      return true;
    });
  }
});

test('source and destination links do not become publication paths', async (t) => {
  const f = await fixture(t);
  await rm(join(f.source, 'app.js'));
  await writeFile(join(f.base, 'outside.txt'), 'Synthetic secret fixture.');
  await symlink(join(f.base, 'outside.txt'), join(f.source, 'app.js'));
  await assert.rejects(buildPublication(f.source, f.destination), /regular file|symlink/i);
  await rm(join(f.source, 'app.js'));
  await copyFile(join(root, 'web', 'app.js'), join(f.source, 'app.js'));
  await symlink(f.source, f.destination);
  await assert.rejects(buildPublication(f.source, f.destination), /directory|symlink/i);
});

test('the application uses local assets and synthetic inputs, without telemetry code', async () => {
  const html = await readFile(join(root, 'web', 'index.html'), 'utf8');
  const app = await readFile(join(root, 'web', 'app.js'), 'utf8');
  assert.ok(/synthetic\s+records/i.test(html), 'Synthetic-data provenance must remain explicit.');
  assert.ok(
    /not\s+a\s+live\s+safety\s+check/i.test(html),
    'The safety-check limitation must remain explicit.'
  );
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(
    app,
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|innerHTML/
  );
});
