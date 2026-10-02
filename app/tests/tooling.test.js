// The build, the development server, the service worker and the checksum script (spec section 8).
// Every test works in a temporary folder under os.tmpdir() and removes it; nothing is written to the repository.
import assert from 'node:assert/strict';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { build, versionImports } from '../scripts/build.mjs';

const app = fileURLToPath(new URL('../', import.meta.url));
const script = name => join(app, 'scripts', name);
const { version } = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
const git = (args, cwd = app) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
// Other work may commit while a test runs, so a stamp may name the HEAD read just before or just after.
const head = () => git(['rev-parse', '--short', 'HEAD']);
const importText = text => import(`data:text/javascript,${encodeURIComponent(text)}`);
const sha256 = text => createHash('sha256').update(text).digest('hex');
const temporary = name => mkdtemp(join(tmpdir(), `portland-trail-${name}-`));
const remove = path => rm(path, { recursive: true, force: true });
const exists = path =>
  stat(path).then(
    () => true,
    () => false,
  );

/** Runs a Node script from app/ and resolves with its exit code and everything it printed. */
function node(args, env = {}) {
  return new Promise(resolve => {
    const options = { cwd: app, encoding: 'utf8', env: { ...process.env, ...env } };
    execFile(process.execPath, args, options, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ code, output: `${stdout}${stderr}` });
    });
  });
}

async function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

async function listFiles(root, folder = '') {
  const found = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await listFiles(root, path)));
    else found.push(path);
  }
  return found.sort();
}

// A stand-in for the service worker global scope: just enough of caches, fetch and clients.
const SCOPE = 'https://game.test/trail/';
// The checked-in worker's cache: stamp 'dev', digest 'dev'.
const DEV_CACHE = 'portland-trail-dev-dev';
const key = request => new URL(typeof request === 'string' ? request : request.url, `${SCOPE}sw.js`).href;
const reply = (body, type = 'text/html; charset=utf-8') => ({
  status: 200,
  type: 'basic',
  ok: true,
  headers: new Headers({ 'Content-Type': type }),
  body,
  clone: () => reply(body, type),
});

/**
 * Runs a worker script in a fresh realm against the stand-ins above.
 * @param {string} source
 * @param {{ setTimeout: (callback: () => void, ms: number) => unknown, clearTimeout: (timer: any) => void }} [timers]
 */
function startWorker(source, timers = { setTimeout, clearTimeout }) {
  const worker = { listeners: {}, stores: new Map(), precached: [], posted: [], claimed: false };
  worker.network = async request => reply(`network ${key(request)}`);
  const open = name => {
    if (!worker.stores.has(name)) worker.stores.set(name, new Map());
    const store = worker.stores.get(name);
    return {
      async match(request, { ignoreSearch = false } = {}) {
        const plain = url => (ignoreSearch ? url.split('?')[0] : url);
        for (const [url, response] of store) if (plain(url) === plain(key(request))) return response;
        return undefined;
      },
      async put(request, response) {
        store.set(key(request), response);
      },
      async addAll(requests) {
        for (const request of requests) {
          worker.precached.push(request.url);
          store.set(key(request), reply(`precached ${key(request)}`));
        }
      },
    };
  };
  const self = {
    location: new URL(`${SCOPE}sw.js`),
    registration: { scope: SCOPE },
    addEventListener: (type, listener) => (worker.listeners[type] = listener),
    skipWaiting: async () => {},
    clients: {
      claim: async () => (worker.claimed = true),
      // Two windows; messages are copied out of the worker's realm so they compare as plain objects.
      matchAll: async () => [1, 2].map(() => ({ postMessage: message => worker.posted.push({ ...message }) })),
    },
  };
  const caches = {
    open: async name => open(name),
    keys: async () => [...worker.stores.keys()],
    delete: async name => worker.stores.delete(name),
  };
  vm.runInNewContext(source, {
    self,
    caches,
    fetch: request => worker.network(request),
    Request: class {
      constructor(url, init = {}) {
        this.url = url;
        this.cache = init.cache;
      }
    },
    Response,
    URL,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
  });
  return worker;
}

async function lifecycle(listener, event = {}) {
  const pending = [];
  listener({ ...event, waitUntil: promise => pending.push(promise) });
  await Promise.all(pending);
}

function fetchEvent(worker, url, init = {}) {
  const pending = [];
  let response;
  worker.listeners.fetch({
    request: { url, method: 'GET', mode: 'cors', destination: '', ...init },
    respondWith: promise => (response = Promise.resolve(promise)),
    waitUntil: promise => pending.push(promise),
  });
  const settled = (async () => {
    await response;
    await Promise.all(pending);
  })();
  return { handled: response !== undefined, response, settled };
}

test('versionImports adds ?v= to the four relative import forms and leaves everything else alone', () => {
  const source = [
    "import { a, b as c } from './a.js';",
    'import {',
    "  d, // the comment's quote and slash",
    '  /* e */ e,',
    "} from '../lib/d.js';",
    "import * as f from './f.js';",
    'import "./side-effect.js";',
    "export { g } from './g.js';",
    "export * from '../h.js';",
    "const i = await import('./i.js');",
    'const j = await import( /* lazy */ "./j.js" );',
    "import k from 'node:fs';",
    "import l from 'https://example.com/l.js';",
    "import m from '/root/m.js';",
    "export { n } from 'pkg';",
    "import o from './o.js?raw';",
    'const p = await import(name);',
    'const q = await import(`./${name}.js`);',
    "const r = loader.import('./r.js');",
    "navigator.serviceWorker.register('./sw.js');",
    "const s = './s.js';",
  ].join('\n');
  const expected = [
    "import { a, b as c } from './a.js?v=abc1234';",
    'import {',
    "  d, // the comment's quote and slash",
    '  /* e */ e,',
    "} from '../lib/d.js?v=abc1234';",
    "import * as f from './f.js?v=abc1234';",
    'import "./side-effect.js?v=abc1234";',
    "export { g } from './g.js?v=abc1234';",
    "export * from '../h.js?v=abc1234';",
    "const i = await import('./i.js?v=abc1234');",
    'const j = await import( /* lazy */ "./j.js?v=abc1234" );',
    "import k from 'node:fs';",
    "import l from 'https://example.com/l.js';",
    "import m from '/root/m.js';",
    "export { n } from 'pkg';",
    "import o from './o.js?raw';",
    'const p = await import(name);',
    'const q = await import(`./${name}.js`);',
    "const r = loader.import('./r.js');",
    "navigator.serviceWorker.register('./sw.js');",
    "const s = './s.js';",
  ].join('\n');
  assert.equal(versionImports(source, 'abc1234'), expected);
});

test('versionImports stays fast on a long run of comments that leads to no import', { timeout: 5000 }, () => {
  const comments = Array.from({ length: 40 }, (_, line) => `  // note ${line} about the words in this list`);
  const source = ['export {', ...comments, '  a,', '};', "import b from './b.js';"].join('\n');
  assert.equal(versionImports(source, 'abc1234'), source.replace("'./b.js'", "'./b.js?v=abc1234'"));
});

describe('build', () => {
  let folder;
  let out;
  let BUILD;
  let heads;

  before(async () => {
    folder = await temporary('build');
    out = join(folder, 'dist');
    const first = head();
    const result = await node([script('build.mjs'), '--out', out]);
    heads = [first, head()];
    assert.equal(result.code, 0, result.output);
    ({ BUILD } = await importText(await readFile(join(out, 'src/build-info.js'), 'utf8')));
  });
  after(() => remove(folder));

  test('writes the page, manifest, worker, sources and assets, without asset manifests', async () => {
    assert.deepEqual((await readdir(out)).sort(), ['assets', 'index.html', 'manifest.webmanifest', 'src', 'sw.js']);
    for (const path of ['src/build-info.js', 'src/main.js', 'src/styles.css']) {
      assert.ok(await exists(join(out, path)), path);
    }
    const assets = await listFiles(join(out, 'assets'));
    assert.ok(assets.length > 0, 'assets are copied');
    assert.deepEqual(
      assets.filter(path => path.endsWith('.json')),
      [],
    );
  });

  test('stamps the commit, branch, commit date, dirty flag and package version, in mode build', () => {
    assert.equal(BUILD.mode, 'build');
    assert.equal(BUILD.version, version);
    assert.ok(heads.includes(BUILD.sha), `sha ${BUILD.sha} is HEAD (${heads.join(' or ')})`);
    assert.equal(BUILD.date, git(['log', '-1', '--no-show-signature', '--format=%cd', '--date=short', BUILD.sha]));
    assert.match(BUILD.date, /^\d{4}-\d{2}-\d{2}$/);
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
    assert.equal(BUILD.branch, branch === 'HEAD' ? '' : branch);
    assert.equal(BUILD.dirty, git(['--no-optional-locks', 'status', '--porcelain']) !== '');
  });

  test('adds ?v=<sha> to the page stylesheet and script and to every relative import', async () => {
    const page = await readFile(join(out, 'index.html'), 'utf8');
    for (const path of ['./src/styles.css', './src/main.js']) {
      assert.match(page, new RegExp(`=(["'])${path.replaceAll('.', '\\.')}\\?v=${BUILD.sha}\\1`), path);
      assert.doesNotMatch(page, new RegExp(`=(["'])${path.replaceAll('.', '\\.')}\\1`), `no unversioned ${path}`);
    }
    for (const path of await listFiles(join(out, 'src'))) {
      if (!path.endsWith('.js')) continue;
      const built = await readFile(join(out, 'src', path), 'utf8');
      // A second pass changes nothing only when every relative import already carries a version.
      assert.equal(versionImports(built, 'again'), built, `${path}: every relative import carries ?v=`);
    }
    const main = await readFile(join(out, 'src/main.js'), 'utf8');
    assert.match(main, new RegExp(`from '\\./[\\w./-]+\\.js\\?v=${BUILD.sha}'`));
  });

  test('names the worker cache portland-trail-<sha>-<digest> and precaches the shell but no scene', async () => {
    const worker = startWorker(await readFile(join(out, 'sw.js'), 'utf8'));
    await lifecycle(worker.listeners.install);
    const names = [...worker.stores.keys()];
    assert.equal(names.length, 1);
    assert.ok(names[0].startsWith(`portland-trail-${BUILD.sha}-`), names[0]);
    assert.match(names[0], /-[0-9a-f]{10}$/, 'a short hex digest follows the sha');
    const shell = [
      './',
      './index.html',
      './manifest.webmanifest',
      `./src/main.js?v=${BUILD.sha}`,
      `./src/styles.css?v=${BUILD.sha}`,
      `./src/build-info.js?v=${BUILD.sha}`,
      './assets/icons/icon-192.png',
    ];
    for (const url of shell) assert.ok(worker.precached.includes(url), `${url} is precached`);
    assert.deepEqual(
      worker.precached.filter(url => /\/scenes\/|\.(?:jpe?g|webp)$/.test(url)),
      [],
      'no scene art is precached',
    );
    for (const url of worker.precached) {
      const path =
        url === './' ? 'index.html' : decodeURIComponent(new URL(url, SCOPE).pathname.slice('/trail/'.length));
      assert.ok(await exists(join(out, path)), `${url} is in the build`);
    }
  });

  test('stamps sha nogit when Git is not available', async t => {
    const scratch = await temporary('build-nogit');
    t.after(() => remove(scratch));
    const noGit = join(scratch, 'empty-path');
    await mkdir(noGit);
    const result = await node([script('build.mjs'), '--out', join(scratch, 'dist')], { PATH: noGit });
    assert.equal(result.code, 0, result.output);
    const { BUILD: stamp } = await importText(await readFile(join(scratch, 'dist/src/build-info.js'), 'utf8'));
    assert.equal(stamp.sha, 'nogit');
    assert.equal(stamp.mode, 'build');
    assert.match(await readFile(join(scratch, 'dist/index.html'), 'utf8'), /\.\/src\/main\.js\?v=nogit/);
  });

  test('refuses to replace a folder that holds anything but a build', async t => {
    const scratch = await temporary('build-refuse');
    t.after(() => remove(scratch));
    await writeFiles(scratch, { 'notes.txt': 'keep me' });
    const result = await node([script('build.mjs'), '--out', scratch]);
    assert.equal(result.code, 1);
    assert.match(result.output, /notes\.txt/);
    assert.equal(await readFile(join(scratch, 'notes.txt'), 'utf8'), 'keep me');
  });

  test('the cache digest is stable for identical input and changes with one byte of a scene', async t => {
    // A small app of its own, outside any repository, so that nothing else can change between the builds.
    const scratch = await temporary('build-digest');
    t.after(() => remove(scratch));
    const root = join(scratch, 'app');
    await writeFiles(root, {
      'package.json': '{ "version": "9.9.9" }',
      'index.html':
        '<link rel="stylesheet" href="./src/styles.css" />\n<script type="module" src="./src/main.js"></script>\n',
      'manifest.webmanifest': '{}',
      'sw.js': await readFile(join(app, 'sw.js'), 'utf8'),
      'src/main.js': "import './other.js';",
      'src/other.js': 'export {};',
      'src/styles.css': 'body {}',
      'assets/icons/icon-192.png': 'icon',
      'assets/scenes/road.webp': 'scene A',
    });
    const workerOf = async name => readFile(join(scratch, name, 'sw.js'), 'utf8');
    const cacheOf = async name => {
      const worker = startWorker(await workerOf(name));
      await lifecycle(worker.listeners.install);
      return [...worker.stores.keys()][0];
    };

    await build({ root, out: join(scratch, 'one') });
    await build({ root, out: join(scratch, 'two') });
    assert.equal(await workerOf('two'), await workerOf('one'), 'identical input, identical worker');
    assert.match(await cacheOf('one'), /^portland-trail-nogit-[0-9a-f]{10}$/);

    await writeFile(join(root, 'assets/scenes/road.webp'), 'scene B');
    await build({ root, out: join(scratch, 'three') });
    assert.notEqual(await cacheOf('three'), await cacheOf('one'), 'a changed scene changes the cache name');
    const withoutDigest = text => text.replace(/^const DIGEST = .*$/m, '');
    assert.notEqual(await workerOf('three'), await workerOf('one'), 'so the browser installs a new worker');
    assert.equal(withoutDigest(await workerOf('three')), withoutDigest(await workerOf('one')), 'only the digest moved');
  });
});

describe('service worker', () => {
  let source;
  before(async () => {
    source = await readFile(join(app, 'sw.js'), 'utf8');
  });

  test('as checked in it is valid on its own: stamp and digest dev, nothing to precache', async () => {
    const worker = startWorker(source);
    await lifecycle(worker.listeners.install);
    assert.deepEqual([...worker.stores.keys()], [DEV_CACHE]);
    assert.deepEqual(worker.precached, []);
  });

  test('activation deletes every other portland-trail cache, same sha included, and takes control', async () => {
    const worker = startWorker(source);
    const others = ['portland-trail-0123abc', 'portland-trail-0123abc-0123456789', 'portland-trail-dev-0123456789'];
    for (const name of [...others, DEV_CACHE, 'another-app']) worker.stores.set(name, new Map());
    await lifecycle(worker.listeners.activate);
    assert.deepEqual([...worker.stores.keys()].sort(), ['another-app', DEV_CACHE]);
    assert.equal(worker.claimed, true);
  });

  test('cache-scenes caches the scenes in its scope and answers every client with scenes-cached', async () => {
    const worker = startWorker(source);
    const fetched = [];
    worker.network = async request => {
      fetched.push(key(request));
      return key(request).includes('missing') ? { status: 404, type: 'basic', ok: false } : reply('scene');
    };
    worker.stores.set(DEV_CACHE, new Map([[`${SCOPE}assets/scenes/title-960.webp`, reply('already')]]));
    const urls = [
      './assets/scenes/road-960.webp',
      `${SCOPE}assets/scenes/title-960.webp`,
      './assets/scenes/missing-960.webp',
      'https://elsewhere.test/trail/x.webp',
      42,
    ];
    await lifecycle(worker.listeners.message, { data: { type: 'cache-scenes', urls } });
    assert.deepEqual(worker.posted, [
      { type: 'scenes-cached', count: 2 },
      { type: 'scenes-cached', count: 2 },
    ]);
    assert.deepEqual(fetched.sort(), [`${SCOPE}assets/scenes/missing-960.webp`, `${SCOPE}assets/scenes/road-960.webp`]);
    assert.equal(worker.stores.get(DEV_CACHE).get(`${SCOPE}assets/scenes/road-960.webp`).body, 'scene');
    await lifecycle(worker.listeners.message, { data: { type: 'something-else', urls } });
    assert.equal(worker.posted.length, 2, 'other messages are ignored');
  });

  test('pages, scripts and styles come from the network first; other files from the cache first', async () => {
    const worker = startWorker(source);
    const store = () => worker.stores.get(DEV_CACHE);
    const script = `${SCOPE}src/main.js?v=1`;
    let event = fetchEvent(worker, script, { destination: 'script' });
    assert.equal((await event.response).body, `network ${script}`);
    await event.settled;
    assert.equal(store().get(script).body, `network ${script}`, 'the network copy refreshes the cache');

    worker.network = async () => {
      throw new TypeError('Failed to fetch');
    };
    event = fetchEvent(worker, script, { destination: 'script' });
    assert.equal((await event.response).body, `network ${script}`, 'offline, the cache answers');
    store().set(SCOPE, reply('shell'));
    event = fetchEvent(worker, `${SCOPE}?seed=kale`, { mode: 'navigate', destination: 'document' });
    assert.equal((await event.response).body, 'shell', 'offline, any page of the game gets the shell');
    store().set(SCOPE, { ...reply('redirected shell'), redirected: true, statusText: 'OK' });
    event = fetchEvent(worker, `${SCOPE}?seed=kale`, { mode: 'navigate', destination: 'document' });
    const page = await event.response;
    assert.equal(page.redirected, false, 'a page the host had redirected is served as a plain copy');
    assert.equal(await page.text(), 'redirected shell');

    let version = 1;
    worker.network = async () => reply(`scene v${version++}`, 'image/webp');
    const scene = `${SCOPE}assets/scenes/road.webp`;
    event = fetchEvent(worker, scene, { destination: 'image' });
    assert.equal((await event.response).body, 'scene v1');
    await event.settled;
    event = fetchEvent(worker, scene, { destination: 'image' });
    assert.equal((await event.response).body, 'scene v1', 'cached on first use, then served from the cache');

    for (const [method, url] of [
      ['POST', `${SCOPE}src/main.js`],
      ['GET', 'https://elsewhere.test/trail/src/main.js'],
      ['GET', 'https://game.test/other/index.html'],
    ]) {
      assert.equal(fetchEvent(worker, url, { method }).handled, false, `${method} ${url} is left alone`);
    }
  });

  test('navigations keep one page entry under ./ whatever their query, and only HTML replaces it', async () => {
    const worker = startWorker(source);
    for (const query of ['?seed=kale', '?seed=fern']) {
      const event = fetchEvent(worker, `${SCOPE}${query}`, { mode: 'navigate', destination: 'document' });
      assert.equal((await event.response).body, `network ${SCOPE}${query}`);
      await event.settled;
    }
    const store = worker.stores.get(DEV_CACHE);
    assert.deepEqual([...store.keys()], [SCOPE], 'one page entry');
    assert.equal(store.get(SCOPE).body, `network ${SCOPE}?seed=fern`, 'holding the latest page');

    worker.network = async request => reply(`image ${key(request)}`, 'image/webp');
    const event = fetchEvent(worker, `${SCOPE}assets/scenes/road.webp`, { mode: 'navigate', destination: 'document' });
    await event.response;
    await event.settled;
    assert.deepEqual([...store.keys()], [SCOPE]);
    assert.equal(store.get(SCOPE).body, `network ${SCOPE}?seed=fern`, 'an image opened as a page leaves the shell');
  });

  test('a network that takes longer than three seconds gives way to the cached copy', async () => {
    const timers = [];
    const worker = startWorker(source, {
      setTimeout: (callback, ms) => timers.push({ callback, ms }),
      clearTimeout() {},
    });
    const script = `${SCOPE}src/main.js`;
    worker.stores.set(DEV_CACHE, new Map([[script, reply('cached')]]));
    worker.network = () => new Promise(() => {});
    const event = fetchEvent(worker, script, { destination: 'script' });
    let answered = false;
    event.response.then(() => (answered = true));
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(answered, false, 'still waiting for the network');
    assert.deepEqual(
      timers.map(timer => timer.ms),
      [3000],
    );
    timers[0].callback();
    assert.equal((await event.response).body, 'cached');
  });
});

describe('development server', () => {
  const stamp =
    "export const BUILD = { version: '0.0.0', sha: 'fixture', branch: '', date: '', dirty: false, mode: 'dev' };\n";
  let folder;
  let server;

  async function startServer(args, env = {}) {
    const child = spawn(process.execPath, [script('serve.mjs'), ...args], {
      cwd: app,
      env: { ...process.env, ...env, PORT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    let output = '';
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`serve.mjs printed no address: ${output}`)), 10_000);
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
        if (match && match[1] !== '0') {
          clearTimeout(timer);
          resolve(match[0]);
        }
      });
      child.stderr.on('data', chunk => (output += chunk));
      child.on('exit', code => {
        clearTimeout(timer);
        reject(new Error(`serve.mjs exited with ${code}: ${output}`));
      });
    });
    return { child, url };
  }

  async function stopServer({ child }) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill();
    await once(child, 'exit');
  }

  /** Sends the path exactly as written, which fetch would normalise first. */
  function raw(url, path, method = 'GET') {
    return new Promise((resolve, reject) => {
      const outgoing = request(url, { path, method, agent: false }, response => {
        response.resume();
        response.on('end', () => resolve(response));
      });
      outgoing.on('error', reject);
      outgoing.end();
    });
  }

  before(async () => {
    folder = await temporary('serve');
    await writeFiles(folder, {
      'AGENTS.md': 'beside the served folder',
      'app/index.html': '<!doctype html><title>Fixture</title>',
      'app/manifest.webmanifest': '{}',
      'app/sw.js': '// worker',
      'app/package.json': '{}',
      'app/scripts/serve.mjs': '// not served',
      'app/src/main.js': 'export {};',
      'app/src/build-info.js': stamp,
      'app/assets/scenes/road.webp': 'RIFF\0\0\0\0WEBPVP8 ',
    });
    server = await startServer(['--root', join(folder, 'app')]);
  });
  after(async () => {
    if (server) await stopServer(server);
    await remove(folder);
  });

  test('answers src/build-info.js with the Git stamp in mode dev', async () => {
    const first = head();
    const response = await fetch(new URL('src/build-info.js', server.url));
    const last = head();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/javascript/);
    const { BUILD } = await importText(await response.text());
    assert.equal(BUILD.mode, 'dev');
    assert.equal(BUILD.version, version);
    assert.ok([first, last].includes(BUILD.sha), `sha ${BUILD.sha} is HEAD`);
  });

  test('serves the page, the worker, the manifest and WebP art with their types, uncached and nosniff', async () => {
    for (const { path, type } of [
      { path: '/', type: /^text\/html/ },
      { path: '/sw.js', type: /^text\/javascript/ },
      { path: '/manifest.webmanifest', type: /^application\/manifest\+json/ },
      { path: '/assets/scenes/road.webp', type: /^image\/webp$/ },
    ]) {
      const response = await fetch(new URL(path, server.url));
      await response.arrayBuffer();
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), type, path);
      assert.equal(response.headers.get('cache-control'), 'no-store', path);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    }
  });

  test('answers 404 outside the game files and 405 to other methods', async () => {
    for (const path of [
      '/package.json',
      '/../AGENTS.md',
      '/%2e%2e/AGENTS.md',
      '/src/..%2fpackage.json',
      '/scripts/serve.mjs',
      '/src/',
      '/assets',
      '/missing.html',
    ]) {
      assert.equal((await raw(server.url, path)).statusCode, 404, path);
    }
    const post = await raw(server.url, '/', 'POST');
    assert.equal(post.statusCode, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
  });

  test('serves the checked-in stamp without Git, and the files unchanged with --dist', async () => {
    const noGit = join(folder, 'empty-path');
    await mkdir(noGit, { recursive: true });
    for (const { args, env } of [
      { args: ['--root', join(folder, 'app')], env: { PATH: noGit } },
      { args: ['--dist', '--root', join(folder, 'app')], env: {} },
    ]) {
      const other = await startServer(args, env);
      try {
        const response = await fetch(new URL('src/build-info.js', other.url));
        assert.equal(await response.text(), stamp, args.join(' '));
      } finally {
        await stopServer(other);
      }
    }
  });
});

describe('checksums', () => {
  const check = root => node([script('checksums.mjs'), '--root', root, '--check']);

  test('without Git: walks the folder, writes sorted manifests that leave themselves out, and checks them', async t => {
    const root = await temporary('checksums');
    t.after(() => remove(root));
    const files = {
      'README.md': 'read me',
      'a.txt': 'alpha',
      'b/c.txt': 'gamma',
      'docs/handoff/notes.txt': 'notes',
      '.git/HEAD': 'not a repository',
      'node_modules/x/index.js': 'skipped',
      'app/dist/index.html': 'skipped',
      'app/test-results/report.json': 'skipped',
    };
    await writeFiles(root, files);
    const written = await node([script('checksums.mjs'), '--root', root]);
    assert.equal(written.code, 0, written.output);

    const handoff = await readFile(join(root, 'docs/handoff/checksums.json'), 'utf8');
    assert.equal(handoff, `${JSON.stringify({ 'notes.txt': sha256('notes') }, null, 2)}\n`);
    const manifest = await readFile(join(root, 'checksums.json'), 'utf8');
    const expected = {
      'README.md': sha256('read me'),
      'a.txt': sha256('alpha'),
      'b/c.txt': sha256('gamma'),
      'docs/handoff/checksums.json': sha256(handoff),
      'docs/handoff/notes.txt': sha256('notes'),
    };
    assert.deepEqual(Object.keys(expected), Object.keys(expected).sort(), 'the expectation itself is sorted');
    assert.equal(manifest, `${JSON.stringify(expected, null, 2)}\n`);

    const clean = await check(root);
    assert.equal(clean.code, 0, clean.output);
    assert.equal(await readFile(join(root, 'checksums.json'), 'utf8'), manifest, '--check changes nothing');

    await writeFile(join(root, 'a.txt'), 'changed');
    let result = await check(root);
    assert.equal(result.code, 1);
    assert.match(result.output, /a\.txt/);
    await writeFile(join(root, 'a.txt'), 'alpha');

    await writeFile(join(root, 'b/new.txt'), 'new');
    result = await check(root);
    assert.equal(result.code, 1);
    assert.match(result.output, /b\/new\.txt/);
    await unlink(join(root, 'b/new.txt'));
    assert.equal((await check(root)).code, 0);

    await unlink(join(root, 'b/c.txt'));
    result = await check(root);
    assert.equal(result.code, 1);
    assert.match(result.output, /b\/c\.txt/);
  });

  test('with Git: lists tracked and untracked files that are not ignored', async t => {
    const root = await temporary('checksums-git');
    t.after(() => remove(root));
    await writeFiles(root, {
      '.gitignore': 'ignored.txt\nbuild/\n',
      'tracked.txt': 'tracked',
      'gone.txt': 'deleted after it was added',
      'untracked.txt': 'untracked',
      'sub/new.txt': 'new',
      'ignored.txt': 'ignored',
      'build/out.txt': 'ignored',
    });
    git(['init', '-q'], root);
    git(['add', 'tracked.txt', 'gone.txt'], root);
    await unlink(join(root, 'gone.txt'));
    const written = await node([script('checksums.mjs'), '--root', root]);
    assert.equal(written.code, 0, written.output);
    const manifest = JSON.parse(await readFile(join(root, 'checksums.json'), 'utf8'));
    assert.deepEqual(Object.keys(manifest), ['.gitignore', 'sub/new.txt', 'tracked.txt', 'untracked.txt']);
    assert.equal((await check(root)).code, 0);
  });
});
