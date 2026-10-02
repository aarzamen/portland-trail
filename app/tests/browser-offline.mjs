// The built game (TEST_DIST_URL): the build stamp (F6), the worker and the scene message, offline play (F5),
// a visit that installs a newer build (the scenes land in the new build's cache before offline play is
// announced), the manifest and its icons at the root and under a nested path; and the source (TEST_URL), which
// registers no worker.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST_URL, SOURCE_URL, launch, openPage, pause, readGame, suite } from './support/browser.mjs';

const report = suite('browser-offline');
const { check, step } = report;
const browser = await launch();
const READY = 'Ready to play offline';

/** Counts the toasts that announce offline play, from the first moment of every load. */
const countReadyToasts = text => {
  window.__readyToasts = 0;
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.textContent.includes(text)) window.__readyToasts += 1;
      }
    }
  }).observe(document, { childList: true, subtree: true });
};

async function stampAndWorker() {
  const { context, page, errors } = await openPage(browser, { url: DIST_URL, width: 390, height: 664 });
  await context.addInitScript(countReadyToasts, READY);
  const stamp = await page.locator('#build-stamp').innerText();
  check(/^v\d+\.\d+\.\d+ · [0-9a-f]{7,}/.test(stamp), 'the footer shows the build stamp (F6)', stamp);
  check(await page.locator('#build-stamp').isVisible(), 'the stamp is visible on a phone');

  const registered = await page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).active));
  check(registered, 'the worker registers in the build');
  await page.reload();
  await page.locator('[data-key="start"]').waitFor();
  check(
    await page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    'the worker controls the page after a reload',
  );
  await page.locator('#toasts .toast', { hasText: READY }).waitFor({ timeout: 20_000 });
  await pause(800);
  check(
    (await page.evaluate(() => window.__readyToasts)) === 1,
    `"${READY}" is shown once`,
    await page.evaluate(() => window.__readyToasts),
  );

  // Offline: the title, a new journey and a drive with its scene art.
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-key="start"]').waitFor();
  check(true, 'offline, a reload shows the title');
  await page.locator('[data-key="start"]').click();
  await page.locator('[data-key="to-crew"]').click();
  await page.locator('[data-key="pack"]').click();
  await page.locator('[data-key="travel"]').click();
  const game = await readGame(page);
  check(game?.distance > 0, 'offline, a new journey starts and drives', game?.distance);
  const broken = await page.evaluate(async () => {
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    return [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src);
  });
  const scene = await page
    .locator('[data-region="scene"] img')
    .first()
    .evaluate(image => image.currentSrc);
  check(/\/assets\/scenes\/[a-z-]+-960\.webp$/.test(scene), 'offline, the drive shows its phone scene art', scene);
  check(broken.length === 0, 'offline, every image of the drive loads, scene art included', { broken, scene });
  await context.setOffline(false);
  check(
    errors.filter(error => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(error)).length === 0,
    'no page errors',
    errors,
  );
  await context.close();
}

async function manifestAt(url, label) {
  const { context, page, errors } = await openPage(browser, { url, width: 1440, height: 900 });
  const metadata = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const response = await fetch(link.href);
    const manifest = await response.json();
    const icons = [
      ...manifest.icons.map(icon => ({ ...icon, src: new URL(icon.src, link.href).href })),
      ...[...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map(icon => ({
        src: icon.href,
        sizes: icon.sizes.value,
      })),
    ];
    const decoded = await Promise.all(
      icons.map(async icon => {
        const image = new Image();
        image.src = icon.src;
        await image.decode();
        return { ...icon, width: image.naturalWidth, height: image.naturalHeight };
      }),
    );
    return {
      type: response.headers.get('Content-Type'),
      display: manifest.display,
      icons: decoded,
      start: new URL(manifest.start_url, link.href).href,
      scope: new URL(manifest.scope, link.href).href,
    };
  });
  check(/application\/manifest\+json/.test(metadata.type ?? ''), `${label}: the manifest has its type`, metadata.type);
  check(metadata.display === 'standalone', `${label}: standalone display`);
  check(
    metadata.start === new URL('./', page.url()).href && metadata.scope === metadata.start,
    `${label}: starts in scope`,
  );
  const misfits = metadata.icons.filter(icon => icon.sizes !== `${icon.width}x${icon.height}`);
  check(misfits.length === 0, `${label}: icons decode at their declared sizes`, misfits);
  const sizes = [16, 32, 180, 192, 512].filter(size => !metadata.icons.some(icon => icon.width === size));
  check(sizes.length === 0, `${label}: every icon size is present`, sizes);
  const session = await context.newCDPSession(page);
  const parsed = await session.send('Page.getAppManifest');
  check(parsed.errors.length === 0, `${label}: Chrome parses the manifest without errors`, parsed.errors);
  check(errors.length === 0, `${label}: the game starts without errors`, errors);
  await context.close();
}

/**
 * Serves app/dist/ under a path prefix on a free port. `rewrite(path, bytes)` may change a file on its way out.
 * Resolves with the URL and a function that stops the server.
 */
async function serveDist(prefix, rewrite = (path, bytes) => bytes) {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
  };
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const path = decodeURIComponent(pathname.slice(prefix.length)) || 'index.html';
    const file = resolve(root, path);
    if (!pathname.startsWith(prefix) || !file.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      const bytes = rewrite(path, await readFile(file));
      response.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${server.address().port}${prefix}`,
    close: () => new Promise(done => server.close(done)),
  };
}

async function nestedPath() {
  const served = await serveDist('/games/portland/');
  try {
    await manifestAt(served.url, 'nested path');
  } finally {
    await served.close();
  }
}

/** The game's caches in the page: each name with how many scene images it holds. */
const sceneCaches = page =>
  page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith('portland-trail-'));
    return Promise.all(
      names.map(async name => {
        const keys = await (await caches.open(name)).keys();
        return { name, scenes: keys.filter(request => /\/assets\/scenes\/.+\.webp$/.test(request.url)).length };
      }),
    );
  });

/**
 * A returning player whose page is controlled by build 1 opens build 2 (the same files, a worker with another
 * digest). The outgoing worker answers the first scene message, then the new one activates and deletes its
 * cache: "Ready to play offline" must wait for the new worker, whose cache then holds every scene.
 */
async function upgrade() {
  let build = 1;
  const served = await serveDist('/upgrade/', (path, bytes) => {
    if (path !== 'sw.js' || build === 1) return bytes;
    const text = bytes.toString('utf8');
    const changed = text.replace(/^const DIGEST = '([^']*)';$/m, "const DIGEST = '$1-next';");
    if (changed === text) throw new Error('sw.js has no DIGEST line to change.');
    return changed;
  });
  const { context, page, errors } = await openPage(browser, { url: served.url, width: 390, height: 664 });
  try {
    await context.addInitScript(countReadyToasts, READY);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.locator('#toasts .toast', { hasText: READY }).waitFor({ timeout: 20_000 });
    const first = await sceneCaches(page);
    check(first.length === 1 && first[0].scenes > 0, 'build 1: one cache, holding the scenes', first);

    build = 2;
    await page.reload();
    await page.locator('[data-key="start"]').waitFor();
    await page.locator('#toasts .toast', { hasText: READY }).waitFor({ timeout: 20_000 });
    const next = `${first[0].name}-next`;
    const second = (await sceneCaches(page)).find(entry => entry.name === next);
    check(
      second?.scenes === first[0].scenes,
      'build 2: "Ready to play offline" comes after the new build’s cache holds every scene',
      { first, second: await sceneCaches(page) },
    );
    // The new worker's activation deletes the old cache, perhaps a moment after it has answered.
    let left = await sceneCaches(page);
    for (let tries = 0; tries < 20 && left.length > 1; tries += 1) {
      await pause(250);
      left = await sceneCaches(page);
    }
    check(left.length === 1 && left[0].name === next, 'build 2: only the new build’s cache remains', left);
    await pause(800);
    check(
      (await page.evaluate(() => window.__readyToasts)) === 1,
      `build 2: "${READY}" is shown once`,
      await page.evaluate(() => window.__readyToasts),
    );
    check(errors.length === 0, 'build 2: no page errors', errors);
  } finally {
    await context.close();
    await served.close();
  }
}

async function sourceHasNoWorker() {
  const { context, page } = await openPage(browser, { url: SOURCE_URL });
  await pause(500);
  const count = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
  check(count === 0, 'the source registers no worker', count);
  await context.close();
}

try {
  await step('stamp, worker and offline play', stampAndWorker);
  await step('a visit that installs a newer build', upgrade);
  await step('manifest at the root', () => manifestAt(DIST_URL, 'root'));
  await step('manifest under a nested path', nestedPath);
  await step('source without a worker', sourceHasNoWorker);
} finally {
  await browser.close();
}
await report.finish();
