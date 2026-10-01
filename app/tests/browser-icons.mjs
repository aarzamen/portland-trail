import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/icons/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
// Serve the actual built files under a subdirectory as well as the usual root.
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/games/portland/')) { response.writeHead(404); response.end(); return; }
  const file = resolve(root, decodeURIComponent(pathname.slice('/games/portland/'.length)) || 'index.html');
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(404); response.end(); return; }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); response.end(bytes);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const results = [];
try {
  for (const url of [process.env.TEST_URL || 'http://127.0.0.1:4173', `http://127.0.0.1:${server.address().port}/games/portland/`]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.locator('.title-screen').waitFor();
    const metadata = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      const response = await fetch(link.href);
      const manifest = await response.json();
      const icons = [...manifest.icons.map(icon => ({ ...icon, src: new URL(icon.src, link.href).href })),
        ...[...document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]')].map(icon => ({ src: icon.href, sizes: icon.sizes.value }))];
      const images = await Promise.all(icons.map(async icon => {
        const image = new Image(); image.src = icon.src; await image.decode();
        return { ...icon, width: image.naturalWidth, height: image.naturalHeight };
      }));
      return { status: response.status, type: response.headers.get('Content-Type'), manifest, images,
        start: new URL(manifest.start_url, link.href).href, scope: new URL(manifest.scope, link.href).href };
    });
    assert.equal(metadata.status, 200);
    assert.match(metadata.type, /application\/manifest\+json/);
    assert.equal(metadata.manifest.display, 'standalone');
    assert.equal(metadata.start, new URL('./', page.url()).href);
    assert.equal(metadata.scope, metadata.start);
    for (const icon of metadata.images) assert.equal(icon.sizes, `${icon.width}x${icon.height}`);
    for (const size of [16, 32, 180, 192, 512]) assert.ok(metadata.images.some(icon => icon.width === size), `Icon ${size}`);
    const session = await page.context().newCDPSession(page);
    const parsed = await session.send('Page.getAppManifest');
    assert.deepEqual(parsed.errors, [], 'Chrome parses manifest without errors');
    assert.deepEqual(errors, [], 'App loads at this installation path');
    results.push({ url, ...metadata, browserManifestErrors: parsed.errors });
    await page.close();
  }
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'report.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('Icon checks passed at root and nested paths: 5 sizes decode, manifest launches in scope, Chrome reports no manifest errors.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
