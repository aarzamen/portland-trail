// Local server for the game, bound to 127.0.0.1 only. It serves index.html, manifest.webmanifest, sw.js,
// src/** and assets/**, nothing else, with Cache-Control: no-store and X-Content-Type-Options: nosniff.
//
//   node scripts/serve.mjs            the source, with src/build-info.js answered from Git in mode 'dev'
//   node scripts/serve.mjs --dist     the built output in app/dist, unchanged
//   --root <dir>                      serve another folder instead (tests use it)
//
// PORT selects the port (default 4173); PORT=0 picks a free one. The address is printed either way.
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { APP_ROOT, readGitStamp, readVersion, stampModule } from './build.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

let options;
try {
  options = parseArgs({ options: { dist: { type: 'boolean', default: false }, root: { type: 'string' } } }).values;
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const dev = !options.dist;
const folder = options.root ? resolve(options.root) : options.dist ? join(APP_ROOT, 'dist') : APP_ROOT;
let root;
try {
  root = await realpath(folder);
} catch {
  console.error(
    options.dist && !options.root ? 'No build in app/dist. Run npm run build first.' : `No folder at ${folder}.`,
  );
  process.exit(1);
}
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be a whole number from 0 to 65535; 0 picks a free port.');
  process.exit(1);
}

const servable = path =>
  path === 'index.html' ||
  path === 'manifest.webmanifest' ||
  path === 'sw.js' ||
  path.startsWith('src/') ||
  path.startsWith('assets/');

/** The file a request path names, or null when it is not one of the game's files. */
async function locate(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  // Normalised after decoding, so an encoded "../" cannot climb out of src/ or assets/.
  const wanted = pathname === '/' ? 'index.html' : posix.normalize(pathname).replace(/^\/+/, '');
  if (!servable(wanted)) return null;
  let file;
  try {
    file = await realpath(join(root, wanted));
  } catch {
    return null;
  }
  // A symbolic link must lead to a servable file inside the served folder too.
  const inside = relative(root, file).split(sep).join('/');
  if (inside.startsWith('../') || isAbsolute(inside) || !servable(inside)) return null;
  if (!(await stat(file)).isFile()) return null;
  return { file, path: inside };
}

const server = createServer(async (request, response) => {
  const send = (status, headers, body) => {
    response.writeHead(status, { ...HEADERS, ...headers });
    response.end(request.method === 'HEAD' ? undefined : body);
  };
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(405, { Allow: 'GET, HEAD' });
      return;
    }
    const found = await locate(request.url);
    if (!found) {
      send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      return;
    }
    const type = { 'Content-Type': TYPES[extname(found.file)] || 'application/octet-stream' };
    if (dev && found.path === 'src/build-info.js') {
      // The live stamp; without Git the checked-in defaults are served as they are.
      const git = await readGitStamp();
      if (git) {
        send(200, type, stampModule({ version: await readVersion(), ...git, mode: 'dev' }));
        return;
      }
    }
    send(200, type, await readFile(found.file));
  } catch {
    if (!response.headersSent) send(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    else response.end();
  }
});
server.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`The Portland Trail (${dev ? 'source' : 'build'}): http://127.0.0.1:${server.address().port}/`);
});
