// Builds the static game into app/dist, or into --out <dir>: index.html, manifest.webmanifest, sw.js, src/**
// and assets/** without the asset manifests (*.json). It writes the real build stamp into src/build-info.js
// (mode 'build'), adds ?v=<sha> to the page's stylesheet and script and to every relative import, and writes
// the stamp and the list of shell files into sw.js for offline play.
//
//   node scripts/build.mjs [--out <dir>]
//
// The functions below are also used by serve.mjs and by tests/tooling.test.js.
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';

const run = promisify(execFile);

export const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
const BUILD_ENTRIES = ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'assets'];
const PAGE_REFERENCES = ['./src/styles.css', './src/main.js'];
// The shell the worker precaches: the page, the manifest, all of src, and these asset folders. Scenes are
// cached on first use or when the page asks for them.
const SHELL_ASSET_FOLDERS = ['icons/', 'sprites/', 'fonts/'];

/** The version in app/package.json. */
export async function readVersion() {
  return JSON.parse(await readFile(join(APP_ROOT, 'package.json'), 'utf8')).version;
}

/** Short commit, branch ('' when detached), commit date and dirty flag from Git, or null without Git. */
export async function readGitStamp() {
  // --no-optional-locks keeps `git status` from taking the index lock that a concurrent commit needs.
  const git = async (...args) => {
    const options = { cwd: APP_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
    return String((await run('git', ['--no-optional-locks', ...args], options)).stdout).trim();
  };
  try {
    const [sha, branch, date, status] = await Promise.all([
      git('rev-parse', '--short', 'HEAD'),
      git('rev-parse', '--abbrev-ref', 'HEAD'),
      git('log', '-1', '--no-show-signature', '--format=%cd', '--date=short'),
      git('status', '--porcelain'),
    ]);
    return { sha, branch: branch === 'HEAD' ? '' : branch, date, dirty: status !== '' };
  } catch {
    return null;
  }
}

/** The stamp for a build. Without Git (or without a commit) the sha is 'nogit' and the date is the build date. */
export async function readStamp(mode = 'build') {
  const today = new Date().toISOString().slice(0, 10);
  const git = (await readGitStamp()) ?? { sha: 'nogit', branch: '', date: today, dirty: false };
  return { version: await readVersion(), ...git, mode };
}

// A JavaScript string literal in single quotes, escaped by JSON.
const literal = value =>
  typeof value === 'string'
    ? `'${JSON.stringify(value).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`
    : JSON.stringify(value);

/** The stamp as a one-line object literal, in the field order of the checked-in src/build-info.js. */
export function stampLiteral(stamp) {
  const fields = ['version', 'sha', 'branch', 'date', 'dirty', 'mode'].map(key => `${key}: ${literal(stamp[key])}`);
  return `{ ${fields.join(', ')} }`;
}

/** The text of src/build-info.js for this stamp. */
export function stampModule(stamp) {
  return `// Generated build stamp; app/src/build-info.js holds the defaults.\nexport const BUILD = ${stampLiteral(stamp)};\n`;
}

/** The stamp as the footer shows it: v0.2.0 · abc1234+ · main · 2026-10-01 (+ marks uncommitted changes). */
export function describeStamp(stamp) {
  return [`v${stamp.version}`, `${stamp.sha}${stamp.dirty ? '+' : ''}`, stamp.branch, stamp.date]
    .filter(Boolean)
    .join(' · ');
}

// The four import forms with a relative specifier: import … from '…', import '…', export … from '…' and
// import('…'). This is a regular expression, not a parser: a specifier that already carries a query or a
// hash is left alone, and so is a dynamic import of anything but a plain string literal. Comments may sit
// inside an import clause and before a dynamic import's specifier. Each comment is matched atomically (a
// lookahead captures it, a back-reference consumes it) so that a run of comments cannot make the pattern
// backtrack through every way of splitting them.
const COMMENT = String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`;
const RELATIVE_IMPORT = new RegExp(
  [
    String.raw`(?<![\w$.#])(`,
    String.raw`(?:import|export)(?:[\w$\s{},*]|(?=(${COMMENT}))\2)*?\bfrom\s*`,
    String.raw`|import\s*\((?:\s|(?=(${COMMENT}))\3)*`,
    String.raw`|import\s*`,
    String.raw`)(['"])(\.{1,2}\/[^'"?#\n]*)\4`,
  ].join(''),
  'g',
);

/** Adds ?v=<version> to every relative import specifier in a module's source. */
export function versionImports(source, version) {
  const query = `?v=${encodeURIComponent(version)}`;
  return source.replace(
    RELATIVE_IMPORT,
    (match, head, clauseComment, callComment, quote, specifier) => `${head}${quote}${specifier}${query}${quote}`,
  );
}

/** Adds ?v=<version> to the page's ./src/styles.css and ./src/main.js references; both must be present. */
export function versionPage(html, version) {
  const query = `?v=${encodeURIComponent(version)}`;
  const seen = new Set();
  const page = html.replace(
    /(\s(?:href|src)=)(["'])(\.\/src\/(?:styles\.css|main\.js))\2/g,
    (match, name, quote, path) => {
      seen.add(path);
      return `${name}${quote}${path}${query}${quote}`;
    },
  );
  const missing = PAGE_REFERENCES.filter(path => !seen.has(path));
  if (missing.length) throw new Error(`index.html does not reference ${missing.join(' and ')}.`);
  return page;
}

/** Relative paths ('/' separated, sorted) of the files under a folder, without dotfiles such as .DS_Store. */
async function listFiles(root, folder = '') {
  let entries;
  try {
    entries = await readdir(join(root, folder), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' && !folder) return [];
    throw error;
  }
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await listFiles(root, path)));
    else found.push(path);
  }
  return found.sort();
}

async function writeText(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

async function copy(path, target) {
  await mkdir(dirname(join(target, path)), { recursive: true });
  // A copy-on-write clone where the file system offers one, a plain copy elsewhere.
  await copyFile(join(APP_ROOT, path), join(target, path), constants.COPYFILE_FICLONE);
}

// The output folder is deleted first, so it must be new, empty, or hold nothing but an earlier build.
async function assertReplaceable(target) {
  let entries;
  try {
    entries = await readdir(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const strangers = entries.filter(name => !BUILD_ENTRIES.includes(name) && name !== '.DS_Store');
  if (strangers.length) {
    throw new Error(
      `${target} holds ${strangers.slice(0, 3).join(', ')}, which a build does not write. ` +
        'Choose a new or empty folder for --out.',
    );
  }
}

function replaceLine(text, pattern, line) {
  const count = text.match(new RegExp(pattern.source, 'gm'))?.length ?? 0;
  if (count !== 1) throw new Error(`sw.js must contain exactly one line matching ${pattern.source}; found ${count}.`);
  return text.replace(pattern, () => line);
}

function shellFiles(stamp, sourceFiles, assetFiles) {
  const query = `?v=${encodeURIComponent(stamp.sha)}`;
  const url = path => `./${path.split('/').map(encodeURIComponent).join('/')}`;
  return [
    './',
    './index.html',
    './manifest.webmanifest',
    // Modules (and JSON imported as modules) are requested with ?v=, like the page's stylesheet.
    ...sourceFiles.filter(path => /\.(?:js|mjs|json|css)$/.test(path)).map(path => `${url(`src/${path}`)}${query}`),
    ...assetFiles
      .filter(path => SHELL_ASSET_FOLDERS.some(folder => path.startsWith(folder)))
      .map(path => url(`assets/${path}`)),
  ];
}

/** Builds the game into `out` and returns the stamp, the precache list and the number of files written. */
export async function build({ out = join(APP_ROOT, 'dist') } = {}) {
  const target = resolve(out);
  await assertReplaceable(target);
  const stamp = await readStamp('build');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  const page = await readFile(join(APP_ROOT, 'index.html'), 'utf8');
  await writeText(join(target, 'index.html'), versionPage(page, stamp.sha));
  await copy('manifest.webmanifest', target);
  for (const path of await listFiles(join(APP_ROOT, 'src'))) {
    if (path === 'build-info.js') continue;
    if (!path.endsWith('.js')) {
      await copy(`src/${path}`, target);
      continue;
    }
    const source = await readFile(join(APP_ROOT, 'src', path), 'utf8');
    await writeText(join(target, 'src', path), versionImports(source, stamp.sha));
  }
  await writeText(join(target, 'src/build-info.js'), stampModule(stamp));
  for (const path of await listFiles(join(APP_ROOT, 'assets'))) {
    if (!path.endsWith('.json')) await copy(`assets/${path}`, target);
  }

  const precache = shellFiles(stamp, await listFiles(join(target, 'src')), await listFiles(join(target, 'assets')));
  const worker = await readFile(join(APP_ROOT, 'sw.js'), 'utf8');
  const stamped = replaceLine(worker, /^const BUILD = \{.*\};$/m, `const BUILD = ${stampLiteral(stamp)};`);
  await writeText(
    join(target, 'sw.js'),
    replaceLine(stamped, /^const PRECACHE = \[\];$/m, `const PRECACHE = ${JSON.stringify(precache, null, 2)};`),
  );
  return { out: target, stamp, precache, files: (await listFiles(target)).length };
}

const invoked = process.argv[1] ? await realpath(process.argv[1]).catch(() => process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { out: { type: 'string' } } });
    const result = await build({ out: values.out });
    console.log(
      `Built The Portland Trail ${describeStamp(result.stamp)} in ${result.out}: ` +
        `${result.files} files, ${result.precache.length} precached for offline play.`,
    );
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
