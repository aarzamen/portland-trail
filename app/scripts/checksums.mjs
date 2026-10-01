// Writes or checks the SHA-256 manifests of the project (E5):
//   checksums.json               every tracked or untracked-and-not-ignored file except itself
//   docs/handoff/checksums.json  the same for the files under docs/handoff/, keys relative to that folder
// Keys are sorted, the JSON has a two-space indent and a trailing newline.
//
//   node app/scripts/checksums.mjs [--root <dir>] [--check]
//
// --root defaults to the project root (two folders above this script). Without a Git repository at the root
// the script walks the folder and skips .git, node_modules, dist and test-results (and .DS_Store files).
// --check changes nothing, lists the stale, missing and extra entries, and exits 1 when there are any.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const run = promisify(execFile);
const SKIPPED_FOLDERS = new Set(['.git', 'node_modules', 'dist', 'test-results']);
// The handoff manifest comes first: the project manifest lists it, so it must be current by then.
const MANIFESTS = [
  { file: 'docs/handoff/checksums.json', folder: 'docs/handoff/' },
  { file: 'checksums.json', folder: '' },
];

/** Every tracked or untracked-and-not-ignored file when the root is a Git work tree's top; otherwise null. */
async function gitFiles(root) {
  try {
    const top = (await run('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' })).stdout.trim();
    if ((await realpath(top)) !== (await realpath(root))) return null;
    const args = ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
    const { stdout } = await run('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    return stdout.split('\0').filter(Boolean);
  } catch {
    return null;
  }
}

async function walk(root, folder = '') {
  const found = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.has(entry.name)) found.push(...(await walk(root, path)));
    } else if (entry.name !== '.DS_Store') {
      found.push(path);
    }
  }
  return found;
}

/** Sorted relative paths ('/' separated) of the regular files to list. */
async function listFiles(root) {
  const candidates = (await gitFiles(root)) ?? (await walk(root));
  const files = [];
  for (const path of [...new Set(candidates)].sort()) {
    // Git also lists tracked files that were deleted from the work tree; only files that exist count.
    const info = await stat(join(root, path)).catch(() => null);
    if (info?.isFile()) files.push(path);
  }
  return files;
}

async function hash(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

async function expected(root, { file, folder }) {
  const entries = new Map();
  for (const path of await listFiles(root)) {
    if (path === file || !path.startsWith(folder)) continue;
    entries.set(path.slice(folder.length), await hash(join(root, path)));
  }
  return entries;
}

// JSON.stringify(object, null, 2) layout, written by hand so that keys keep their sorted order.
function format(entries) {
  if (!entries.size) return '{}\n';
  const lines = [...entries].map(([path, digest]) => `  ${JSON.stringify(path)}: ${JSON.stringify(digest)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

async function readManifest(path) {
  const text = await readFile(path, 'utf8');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a JSON object');
  return new Map(Object.entries(parsed));
}

function compare(listed, actual) {
  const problems = [];
  for (const [path, digest] of actual) {
    if (!listed.has(path)) problems.push(`  missing: ${path} (not in the manifest)`);
    else if (listed.get(path) !== digest) problems.push(`  stale:   ${path} (contents changed)`);
  }
  for (const path of listed.keys()) if (!actual.has(path)) problems.push(`  extra:   ${path} (no such file)`);
  return problems;
}

async function main() {
  const { values } = parseArgs({ options: { root: { type: 'string' }, check: { type: 'boolean', default: false } } });
  const root = values.root ? resolve(values.root) : fileURLToPath(new URL('../../', import.meta.url));
  const summary = [];
  let failed = false;
  for (const manifest of MANIFESTS) {
    const folder = await stat(join(root, manifest.folder)).catch(() => null);
    if (!folder?.isDirectory()) continue;
    const actual = await expected(root, manifest);
    const path = join(root, manifest.file);
    if (!values.check) {
      const text = format(actual);
      const current = await readFile(path, 'utf8').catch(() => null);
      if (current !== text) await writeFile(path, text);
      summary.push(`${manifest.file} (${actual.size} files)`);
      continue;
    }
    let listed;
    try {
      listed = await readManifest(path);
    } catch (error) {
      console.error(`${manifest.file} cannot be read: ${error.code === 'ENOENT' ? 'no such file' : error.message}.`);
      failed = true;
      continue;
    }
    const problems = compare(listed, actual);
    if (problems.length) {
      console.error(`${manifest.file} is out of date:\n${problems.join('\n')}`);
      failed = true;
    } else {
      summary.push(`${manifest.file} (${actual.size} files)`);
    }
  }
  if (!values.check) console.log(`Wrote ${summary.join(' and ')}.`);
  else if (failed) {
    console.error('Run node app/scripts/checksums.mjs to rewrite the manifests.');
    process.exitCode = 1;
  } else console.log(`Checksums are current: ${summary.join(' and ')}.`);
}

try {
  await main();
} catch (error) {
  console.error(`checksums: ${error.message}`);
  process.exitCode = 1;
}
