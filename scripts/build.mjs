import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = Object.freeze([
  'index.html',
  'style.css',
  'app.js',
  'engine.mjs',
  'collection.mjs',
  'mark.svg',
  'social.svg',
  'social.png',
  'README.md',
  'LICENSE',
  'NOTICE',
  '.nojekyll',
]);
const MAX_FILE_BYTES = 1024 * 1024;
const privatePatterns = [
  /\/(?:Users|home)\/[^\s"'<>]+/,
  /[A-Za-z]:\\Users\\/,
  /\b(?:hf_|ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /SOPHIA\.md|wake-sophia|true-love\/|\.hermes\/|cron\/output\//,
];

async function directory(path, create = false) {
  if (create) await mkdir(path, { recursive: true });
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isDirectory())
    throw new Error('Publication requires a real directory, not a symlink.');
}

async function readPublicFile(path, name) {
  const preliminary = await lstat(path);
  if (preliminary.isSymbolicLink() || !preliminary.isFile())
    throw new Error(`Publication requires a regular file: ${name}`);
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW || 0)
  );
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > MAX_FILE_BYTES)
      throw new Error(`Invalid or oversized public file: ${name}`);
    const bytes = await handle.readFile();
    if (bytes.length > MAX_FILE_BYTES || (name !== '.nojekyll' && bytes.length === 0))
      throw new Error(`Invalid public file size: ${name}`);
    if (name.endsWith('.png')) {
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw new Error('Invalid public PNG signature.');
    } else {
      const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (privatePatterns.some((pattern) => pattern.test(content)))
        throw new Error(`Possible private material in public file: ${name}`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function atomicFile(destination, name, bytes) {
  const temporary = join(destination, `.stage-${randomBytes(12).toString('hex')}`);
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
  try {
    await rename(temporary, join(destination, name));
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function buildPublication(source, destination) {
  if (resolve(source) === resolve(destination))
    throw new Error('Source and export directories must differ.');
  await directory(source);
  const names = await readdir(source);
  if (names.length !== PUBLIC_FILES.length || names.some((name) => !PUBLIC_FILES.includes(name))) {
    throw new Error('Unreviewed or missing source files: public export refused.');
  }
  // Validate every selected input before writing any publication bytes.
  const files = [];
  for (const name of PUBLIC_FILES)
    files.push({ name, bytes: await readPublicFile(join(source, name), name) });
  await directory(destination, true);
  for (const name of await readdir(destination)) {
    if (![...PUBLIC_FILES, 'edition.json'].includes(name))
      throw new Error('Unreviewed destination contents: refusing to overwrite.');
    const info = await lstat(join(destination, name));
    if (info.isSymbolicLink() || !info.isFile() || info.nlink !== 1)
      throw new Error('Publication destination contains a nonregular file or symlink.');
  }
  const manifest = {
    edition: '1.0.0',
    kind: 'curated-public-study',
    data: 'synthetic',
    files: files.map((file) => ({
      name: file.name,
      bytes: file.bytes.length,
      sha256: createHash('sha256').update(file.bytes).digest('hex'),
    })),
  };
  for (const file of files) await atomicFile(destination, file.name, file.bytes);
  await atomicFile(destination, 'edition.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = await buildPublication(join(root, 'web'), join(root, 'docs'));
  console.log(
    `Built edition ${manifest.edition}: ${manifest.files.length} allowlisted files plus edition.json.`
  );
}
