// The Portland Trail service worker (F5): the built game reloads and plays with no signal.
// The page registers it only when BUILD.mode is 'build'. scripts/build.mjs rewrites the next two lines with
// the build stamp and the list of shell files; as checked in, the file is valid on its own (stamp 'dev',
// nothing to precache).
const BUILD = { version: '0.2.0', sha: 'dev', branch: '', date: '', dirty: false, mode: 'dev' };
const PRECACHE = [];

const PREFIX = 'portland-trail-';
const CACHE = `${PREFIX}${BUILD.sha}`;
const NETWORK_TIMEOUT_MS = 3000;
const SCOPE = self.registration.scope;

self.addEventListener('install', event => {
  event.waitUntil(precache());
});

self.addEventListener('activate', event => {
  event.waitUntil(activate());
});

// { type: 'cache-scenes', urls } caches those URLs in the background, then every window of the game hears
// { type: 'scenes-cached', count }, where count is how many of them are now available offline.
self.addEventListener('message', event => {
  const { data } = event;
  if (data && data.type === 'cache-scenes' && Array.isArray(data.urls)) event.waitUntil(cacheScenes(data.urls));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (!isShell(request, url)) {
    event.respondWith(cacheFirst(event));
    return;
  }
  // HTML, JS and CSS go to the network first, so a newer build, or the source server when one is later run
  // on the same origin, is never shadowed by this cache. The cache answers only when the network fails or
  // takes longer than three seconds.
  const network = fetch(request);
  // This reaction is registered before the ones in networkFirst, so the copy is taken before the page reads
  // the body.
  event.waitUntil(network.then(response => keepable(response) && store(request, response.clone())).catch(() => {}));
  event.respondWith(networkFirst(request, network));
});

async function precache() {
  const cache = await caches.open(CACHE);
  // Skip the HTTP cache so that this version never stores a file left over from an older one.
  await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
  await self.skipWaiting();
}

async function activate() {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
  await self.clients.claim();
}

function isShell(request, url) {
  return (
    request.mode === 'navigate' ||
    ['document', 'script', 'style', 'worker'].includes(request.destination) ||
    url.pathname.endsWith('/') ||
    /\.(?:html|js|mjs|css)$/.test(url.pathname)
  );
}

function keepable(response) {
  return response.status === 200 && response.type === 'basic';
}

async function store(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

async function networkFirst(request, network) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(resolve, NETWORK_TIMEOUT_MS);
  });
  const first = await Promise.race([network.catch(() => undefined), timeout]);
  clearTimeout(timer);
  if (first) return first;
  // Offline or slow: the cached copy if there is one, otherwise keep waiting for (or fail with) the network.
  return (await fromCache(request)) || network;
}

async function fromCache(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit || request.mode !== 'navigate') return unredirected(hit);
  // Every page of the game falls back to the shell, whatever its query.
  return unredirected((await cache.match(request, { ignoreSearch: true })) || (await cache.match('./')));
}

// A host may have redirected a stored page (say /index.html to /); browsers refuse a redirected response as
// the answer to a navigation, so serve a plain copy of it.
function unredirected(response) {
  if (!response || !response.redirected) return response;
  const { status, statusText, headers } = response;
  return new Response(response.body, { status, statusText, headers });
}

async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const response = await fetch(event.request);
  if (keepable(response)) event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
  return response;
}

function inScope(url) {
  try {
    const href = new URL(url, self.location.href).href;
    return href.startsWith(SCOPE) ? href : null;
  } catch {
    return null;
  }
}

async function cacheScenes(urls) {
  const cache = await caches.open(CACHE);
  const wanted = new Set(
    urls
      .filter(url => typeof url === 'string')
      .map(inScope)
      .filter(Boolean),
  );
  const cached = await Promise.all([...wanted].map(href => cacheOne(cache, href)));
  const count = cached.filter(Boolean).length;
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    client.postMessage({ type: 'scenes-cached', count });
  }
}

async function cacheOne(cache, href) {
  try {
    if (await cache.match(href)) return true;
    const response = await fetch(href);
    if (!keepable(response)) return false;
    await cache.put(href, response);
    return true;
  } catch {
    return false;
  }
}
