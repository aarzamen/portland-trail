# Task 6 report: build stamp, offline support and repository tooling

Status: DONE_WITH_CONCERNS. Commit `b9dced8` on `feat/review-implementation` (13 files, by path; nothing pushed).

## What was implemented, file by file

- `app/src/build-info.js` (new). Exactly the spec's checked-in default
  `export const BUILD = { version: '0.2.0', sha: 'dev', branch: '', date: '', dirty: false, mode: 'dev' };`
  with a JSDoc type (`mode: 'dev' | 'build'`) and a two-line comment.
- `app/scripts/build.mjs` (rewritten). Importable without side effects (main-module guard), so tests and
  `serve.mjs` reuse it. Exports `build({ out })`, `versionImports(source, version)`, `versionPage(html, version)`,
  `readGitStamp()`, `readStamp(mode)`, `readVersion()`, `stampLiteral()`, `stampModule()`, `describeStamp()`, `APP_ROOT`.
  - `--out <dir>` (default `app/dist`). Writes `index.html`, `manifest.webmanifest`, `sw.js`, `src/**`,
    `assets/**` without `*.json` (dotfiles such as `.DS_Store` skipped). Copies use copy-on-write clones where
    available (0.16 s for the whole build).
  - Stamp: `version` from `app/package.json`; `sha` = `git rev-parse --short HEAD`; `branch` =
    `git rev-parse --abbrev-ref HEAD` ('' when detached, e.g. CI pull requests); `date` = commit date
    (`git log -1 --format=%cd --date=short`); `dirty` = `git status --porcelain` not empty. All Git calls use
    `--no-optional-locks`, so a build or a dev-server stamp never takes `index.lock` from a concurrent commit.
    Without Git or without a commit: `sha: 'nogit'`, and `date` falls back to the build date (UTC). The spec only
    fixes `sha` for that case; the build date keeps the stamp informative.
  - `dist/src/build-info.js` holds the real stamp with `mode: 'build'`.
  - `?v=<sha>` on `./src/styles.css` and `./src/main.js` in `index.html` (the build fails with a clear message if
    either reference is missing), and on every relative specifier in `src/**/*.js` for the four forms: static
    `import … from`, bare `import '…'`, `export … from`, dynamic `import('…')`. Everything else is untouched
    (bare/URL/root-absolute specifiers, specifiers already carrying `?`/`#`, non-literal dynamic imports,
    `x.import(…)`, `register('./sw.js')`, plain strings). Comments inside import clauses and before a dynamic
    import's specifier are allowed. They are matched atomically (a lookahead captures, a back-reference consumes) so
    a run of comments cannot cause exponential backtracking (measured: the naive form grows ~30× per added comment
    line; the atomic form is flat).
  - `dist/sw.js`: replaces exactly one `const BUILD = {…};` line and exactly one `const PRECACHE = [];` line (the
    build fails otherwise). Precache list: `./`, `./index.html`, `./manifest.webmanifest`, every `src` module
    (`.js/.mjs/.json/.css`) with `?v=<sha>`, and `assets/icons/`, `assets/sprites/`, `assets/fonts/`. No scenes.
  - Safety: `--out` must be new, empty, or hold only what a build writes. Anything else is refused and left
    untouched, because the folder is deleted before building.
- `app/scripts/serve.mjs` (rewritten). Still binds 127.0.0.1 only, keeps `Cache-Control: no-store` and
  `X-Content-Type-Options: nosniff` (now on every response), serves only `index.html`, `manifest.webmanifest`,
  `sw.js`, `src/**`, `assets/**`. New types: `.webp`, `.woff2` (`font/woff2`). `PORT=0` picks a free port, and the
  printed URL carries the real port (`The Portland Trail (source|build): http://127.0.0.1:<port>/`). In source mode,
  `src/build-info.js` is answered from Git with `mode: 'dev'` (about 15 ms); without Git, the checked-in file is
  served. `--dist` serves `app/dist` unchanged and prints a hint if there is no build. New `--root <dir>` serves
  another folder (the tests use it). No `Service-Worker-Allowed` header.
  - Fixed a path-check hole in the original: it tested the allow-list before normalising, so
    `/src/..%2fpackage.json` returned `app/package.json` (any file under `app/`). Evidence: the original script, run
    from a scratch copy, answered that path with the file and HTTP 200, while `/package.json` was 404. The new server
    decodes, normalises, allow-lists, then re-checks the real path after `realpath` (symbolic links).
- `app/sw.js` (new). Cache `portland-trail-<sha>`. Install: precache with `cache: 'reload'`, then `skipWaiting`.
  Activate: delete other `portland-trail-*` caches (other apps' caches untouched), then `clients.claim()`. Fetch
  (same-origin GET inside the registration scope only):
  - HTML/JS/CSS (navigations, `document`/`script`/`style`/`worker` destinations, `.html/.js/.mjs/.css`, directory
    URLs) are network-first with a 3 s timeout and a cache fallback. The comment states why: a newer build, or the
    source server later run on the same origin, is never shadowed. The fresh copy refreshes the cache (the clone
    reaction is registered before the race, so it precedes the page reading the body). The timer is cleared when the
    race settles. An offline navigation falls back to the cached shell whatever its query. A cached response that a
    host had redirected (for example `/index.html` → `/`) is served as a plain copy, because browsers reject
    redirected responses for navigations.
  - Everything else is cache-first and cached on first use (status 200, type basic).
  - Message `{ type: 'cache-scenes', urls }`: string URLs are resolved against the worker and kept if inside the
    scope; already-cached ones count without refetching; then every window client (`includeUncontrolled`) receives
    `{ type: 'scenes-cached', count }`, where count = URLs now available offline.
  - The checked-in file is valid on its own: stamp `dev`, empty precache.
- `app/scripts/checksums.mjs` (new). `--root <dir>` (default: project root from its own path), `--check`. Writes
  `docs/handoff/checksums.json` first, then `checksums.json`, which lists the fresh handoff manifest. Each manifest
  excludes itself; SHA-256 hex; keys sorted (written by hand to keep sorted order even for numeric-looking keys);
  two-space indent; trailing newline; unchanged files are not rewritten. Git mode is used only when the root is the
  top of a work tree: `git ls-files -z --cached --others --exclude-standard`, minus tracked files deleted from the
  work tree. Otherwise it walks the folder, skipping `.git`, `node_modules`, `dist`, `test-results` (and
  `.DS_Store`). `--check` changes nothing, prints `stale` / `missing` / `extra` lines naming each file, and exits 1.
- `app/scripts/test-browser.mjs` (new). Checks that Playwright is installed, builds, starts `serve.mjs` and
  `serve.mjs --dist` on `PORT=0`, runs `tests/browser-*.mjs` in name order with `TEST_URL`, `TEST_DIST_URL` and
  `PLAYWRIGHT_CHANNEL` (default `chrome`), with output streamed. It stops the servers (also on SIGINT/SIGTERM), prints
  one summary line per suite, and exits 1 on any failure or when no suite matches. Optional name filters:
  `npm run test:browser -- layout`.
- `app/package.json` (rewritten). Version `0.2.0`, scripts `test`, `test:browser`, `build`, `start`, `dev`, `assets`,
  `balance`, `checksums`, `checksums:check`, `format`, `format:check`, `typecheck` with the brief's exact commands.
  `start` = build, then serve the build; `dev` = serve the source. The spec did not define the two; the old file had
  both serving the source. Dev dependencies were installed with `npm install --save-dev playwright prettier
  typescript`: playwright ^1.63.0, prettier ^3.9.9, typescript ^7.0.2.
- `app/package-lock.json` (new). lockfileVersion 3 with all 20 TypeScript native packages, including
  `linux-x64` for CI.
- `app/jsconfig.json` (new). `allowJs`, `checkJs`, `noEmit`, `strict: false`, `target` ES2023, `lib` ES2023 + DOM +
  DOM.Iterable, `module`/`moduleResolution` NodeNext, `skipLibCheck`; includes `src` and `tests/*.test.js`.
- `app/.prettierrc.json` (new): `printWidth` 120, `tabWidth` 2, `useTabs` false, `semi`, `singleQuote`,
  `arrowParens` "avoid". `app/.prettierignore` (new): `dist`, `test-results`, `assets`, `node_modules`,
  `package-lock.json`.
- `.github/workflows/test.yml` (new). Runs on push and pull_request with `permissions: contents: read`;
  `actions/checkout@v7` and `actions/setup-node@v7` (latest majors, checked with `gh api`) with Node 22. Steps:
  `npm test` in `app/`, then `node app/scripts/checksums.mjs --check`, then `npm ci`, `npm run format:check` and
  `npm run typecheck` in `app/`.
- `app/tests/tooling.test.js` (new, 19 tests, about 0.7 s, no installs needed). Every test works in a folder under
  `os.tmpdir()` and removes it; nothing is written to the repository, and no temporary folders were left after runs.
  - versionImports fixture: all four forms (with multi-line, comments, double quotes, `../`), plus ten things left
    alone. A 40-comment-line run must finish (5 s timeout guards against backtracking).
  - Build into a temporary folder:
    - exact top-level listing; no `*.json` under `assets/`;
    - stamp `mode: 'build'`, the package version, and a `sha` equal to `git rev-parse --short HEAD` read just before
      or just after the build (other lanes commit concurrently); the commit date of that sha; the branch; the dirty
      flag;
    - `?v=<sha>` on both page references, none unversioned; every built module is a fixed point of `versionImports`
      (no relative import left unversioned);
    - the built `sw.js`, run in a `node:vm` realm, opens `portland-trail-<sha>` and precaches `./`, `./index.html`,
      `./src/main.js?v=<sha>` and more, but no scene; every precache URL exists in the build;
    - `PATH` without Git gives `sha: 'nogit'` and `?v=nogit`;
    - `--out` on a folder with other files is refused and left intact.
  - Service worker (source file, in `vm` with stand-ins):
    - valid on its own;
    - activation deletes only older `portland-trail-*` caches and claims clients;
    - `cache-scenes` → `{ type: 'scenes-cached', count }` to every client: in-scope only, no refetch of cached
      scenes, 404s not counted, other messages ignored;
    - network-first refreshes the cache and falls back offline, including the navigation shell and the redirected
      copy;
    - cache-first on first use;
    - POST, cross-origin and out-of-scope requests left alone;
    - a stalled network gives way to the cache after exactly 3000 ms (injected fake timer, not the experimental
      MockTimers API, whose warning broke pristine output).
  - Server on `PORT=0` over a fixture folder:
    - `/src/build-info.js` gives the Git stamp with `mode: 'dev'`;
    - `/`, `/sw.js`, `/manifest.webmanifest` and a `.webp` get the right types, `no-store` and `nosniff`;
    - existing `/package.json`, `/../AGENTS.md` (sent raw), `/%2e%2e/AGENTS.md`, `/src/..%2fpackage.json`,
      `/scripts/serve.mjs`, `/src/`, `/assets` and a missing file get 404;
    - POST gets 405 with `Allow: GET, HEAD`;
    - without Git, the checked-in stamp is served verbatim, and so is the file with `--dist`.
  - Checksums:
    - walk mode: sorted manifests that exclude themselves, exact JSON layout, skipped folders, the handoff manifest;
    - `--check` exits 0 and changes nothing, then exits 1 naming a changed, an added and a removed file;
    - Git mode in a `git init` fixture: tracked plus untracked files, minus ignored files and a tracked file deleted
      from the work tree.

## TDD evidence

Command each time: `cd app && node --test tests/tooling.test.js`.

1. Red, before any implementation: the file failed at link time:
   `SyntaxError: The requested module '../scripts/build.mjs' does not provide an export named 'versionImports'`
   (1 file-level failure; the old build never ran, so no side effects).
2. Red, after `build-info.js`, `sw.js` and `build.mjs`: 18 tests, 12 pass, 6 fail. The server tests failed on the
   old script's `Error: PORT must be 1–65535.` (it rejected `PORT=0`). The checksum tests failed on
   `Cannot find module '…/app/scripts/checksums.mjs'`.
3. Green after `serve.mjs` and `checksums.mjs`: 18/18. Output showed
   `ExperimentalWarning: The MockTimers API is an experimental feature`; I replaced MockTimers with an injected fake
   timer, and the warning is gone.
4. Red again during self-review: I added comment cases to the fixture before changing the regex, and the test failed
   showing `} from '../lib/d.js';` and `import( /* lazy */ "./j.js" )` left unversioned. Green after the atomic
   comment matching.
5. Final: `# tests 19 # pass 19 # fail 0`, `duration_ms` ≈ 684. No warnings and no stray output. The duration fell
   from about 3.2 s to 0.7 s when `networkFirst` started clearing its 3 s timer; dangling timers had been holding the
   process open. Re-run after the commit (HEAD `b9dced8`): 19/19.

`cd app && npm test` (whole suite, other lanes in progress): 53 tests, 43 pass. All 6 tooling entries pass. The 10
failures are in `engine.test.js`, `routes.test.js` and `supplies.test.js`, which the rules lane is changing:
`app/src/data.js` has uncommitted changes from that lane.

## Manual checks

- `cd app && npm install --save-dev playwright prettier typescript` (with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`;
  Playwright 1.63.0 has no install script anyway): 5 packages, 0 vulnerabilities.
  - `node -e "require('playwright')"` from `app/`: OK.
  - `npx tsc -v`: Version 7.0.2.
  - `npx tsc -p jsconfig.json --showConfig` shows the jsconfig defaults (`maxNodeModuleJsDepth: 2`) and the right
    file list.
  - `tsc` reports errors inside `.js`/`.mjs` files, so `checkJs` is honoured and pinning TypeScript 5.x was not
    needed.
- `cd app && npm run build`: `Built The Portland Trail v0.2.0 · 1b5b3bd+ · feat/review-implementation · 2026-10-01
  in …/app/dist: 98 files, 14 precached for offline play.` (0.16 s). `dist/src/build-info.js` holds
  `mode: 'build'`, `dist/index.html` has `?v=1b5b3bd` on both references, the built modules import
  `'./data.js?v=1b5b3bd'`, and `dist/assets` has no JSON.
- `PORT=0 node scripts/serve.mjs --dist` → `The Portland Trail (build): http://127.0.0.1:55389/`.
  - `/` → 200 `text/html; charset=utf-8`, with `no-store` and `nosniff`.
  - `/sw.js` → 200 `text/javascript; charset=utf-8`, with the stamped `BUILD` line and `PRECACHE` list.
  - `/package.json` and `/src/..%2fpackage.json` → 404.
- `PORT=0 node scripts/serve.mjs` → `/src/build-info.js` answers the live stamp with `mode: 'dev'`; the woff2 type is
  `font/woff2`.
- Worker in installed Chrome (headless, Playwright, `channel: 'chrome'`, scratch script, not committed; the current
  interface does not register the worker yet, so the script registered `./sw.js` itself) against the final build:
  - registered at the root scope; the page is controlled after a reload; cache `portland-trail-1b5b3bd` holds the
    14 shell entries, plus the title scene cached on first use;
  - `cache-scenes` for two real scenes and one missing one → `{"type":"scenes-cached","count":2}`;
  - offline reload: the title screen renders, the cached scene decodes (1024 px wide), an uncached scene fails
    offline, `BUILD.mode` is `build`, and there are no page errors.
- `node app/scripts/checksums.mjs --check` on the real repository (read-only, about 1.9 s): exit 1, 4 stale (exactly
  the 4 modified tracked files), 16 missing (new files), 0 extra. `docs/handoff/checksums.json` is current, which
  confirms hash and format compatibility with the existing manifest. `shasum -c` confirms both manifests are
  unchanged.
- `npm run test:browser` with today's old suites:
  - builds, starts both servers, runs 4 suites in name order, prints summary lines, exits 1;
  - `browser-icons` passes through the runner's `TEST_URL`;
  - `browser-smoke` and `browser-enhancements` fail on game behaviour (a losing route now wins; the auto-buy button
    never appears), from the rules lane's in-progress `data.js`;
  - `browser-iphone` needs WebKit, which is not installed;
  - filter runs: `icons` → pass, exit 0; `no-such-suite` → message, exit 1.
- `npm run format:check` runs and flags 14 files, none of them mine. All 11 files of mine that Prettier covers pass
  `prettier --check`; Prettier was run only on my files.
- `npm run typecheck` runs and fails (see concern 1).
- All servers I started were stopped by PID after checking their port and folder. The main checkout's servers on
  4173 and 4174 (started 07:47) were left alone.

## Files changed (commit b9dced8)

`.github/workflows/test.yml`, `app/.prettierignore`, `app/.prettierrc.json`, `app/jsconfig.json`,
`app/package-lock.json`, `app/package.json`, `app/scripts/build.mjs`, `app/scripts/checksums.mjs`,
`app/scripts/serve.mjs`, `app/scripts/test-browser.mjs`, `app/src/build-info.js`, `app/sw.js`,
`app/tests/tooling.test.js`. Untracked and ignored by Git: `app/node_modules/` and `app/dist/` (the manual build).

## Concerns, deviations and anything unverified

1. **`npm run typecheck` cannot pass without Node types, and TypeScript 7 needs them named.** `tests/*.test.js`, and
   `scripts/build.mjs` imported by the tooling test, use `node:` modules and `process` (TS2591). Since TypeScript 6,
   `types` defaults to `[]`, so installing `@types/node` alone is not enough. Verified experimentally (installed with
   `--no-save`, then `npm ci` restored `node_modules`; `package.json` and the lock are byte-identical): with
   `@types/node@22` plus `--types node`, my files type-check clean and 56 errors remain, all in other tasks' files.
   I did not add the dependency because the brief and spec name exactly three. Recommended fix (Task 10, or me on
   resume): `cd app && npm install --save-dev @types/node@22`, and add `"types": ["node"]` to `jsconfig.json`
   `compilerOptions`.
2. **Commit attribution.** I ended the commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, not
   the brief's `Claude Fable 5.1`. This task ran on Opus (the ledger confirms), and my harness's attribution rule
   gives that line; the Fable line would misattribute the commit. Amend if the project prefers uniform lines.
3. **Port 4174 is taken** by the main checkout's `serve.mjs --dist` (pid 38121). Task 7's plan step says
   `PORT=4174 node app/scripts/serve.mjs`, which will fail with EADDRINUSE; suggest another port or `PORT=0`.
4. **CI is unverified**: it cannot run from here. It will also fail at `checksums --check` until Task 10 refreshes the
   manifests, and at format and typecheck until Task 10 (plus concern 1).
5. `npm start` now builds and serves the build; `npm run dev` serves the source (both default to port 4173).
   `PROJECT_SETUP.md` should say so (Task 10).
6. Task 7 notes:
   - footer: `branch` is '' when HEAD is detached; skip empty parts (`describeStamp` in `build.mjs` shows the
     intended `v0.2.0 · sha+ · branch · date` format but imports `node:` modules, so the browser cannot reuse it);
   - `cache-scenes` URLs resolve against the worker (the app root), which is the page's base when `index.html` is at
     the root; absolute URLs are safest;
   - a new version's activation deletes the previous version's cache, scenes included, so the page should send
     `cache-scenes` on each load (the spec's flow already does).
7. Import rewriting is a regular expression, not a parser. Not versioned:
   - dynamic imports of non-literal specifiers;
   - string-named import bindings;
   - comments between `from` and the specifier.

   Such modules would load unversioned and miss the precache offline. None exist today.
8. Flake risk is low but real in this concurrent session. The build test accepts `HEAD` read before or after the
   build. The `dirty` assertion could still flip if another lane commits the whole tree clean exactly between the
   build and the assertion. CI has no concurrency.

## Fix round 1

Commit `613b1cf` "fix: worker cache named by sha and build digest, one page entry for navigations, Node types for
the type check". It touches 6 of my files: `app/jsconfig.json`, `app/package-lock.json`, `app/package.json`,
`app/scripts/build.mjs`, `app/sw.js`, `app/tests/tooling.test.js`. The earlier commit was not amended.

1. **Node types for the type check.**
   - Ran `cd app && npm install --save-dev @types/node@22`, which installed `@types/node` 22.20.5 (with
     `undici-types`); package.json now records `^22.20.5`.
   - Added `"types": ["node"]` to `compilerOptions` in the single `app/jsconfig.json`.
   - Covering check: `cd app && npm run typecheck` reports 0 errors in my files and 0 TS2591 (missing Node types)
     anywhere. The 93 remaining errors are all in other lanes' files: `src/engine/actions.js`,
     `src/engine/save.js`, `src/engine/state.js`, `src/main.js` and the engine, events, routes, rules, save, shop
     and supplies tests.
2. **Lines over 120 characters.**
   - `build.mjs`: `stampModule` now builds its text from a `comment` constant.
   - The test title became "writes the page, manifest, worker, sources and assets, without asset manifests".
   - The new fixture `index.html` string, which would also have been too long, is split.
   - Covering check: a scan of all 12 files I own for lines over 120 characters finds none.
3. **Cache name `portland-trail-<sha>-<digest>`.**
   - After every other file is written, `build.mjs` computes the digest over every built file except `sw.js`:
     SHA-256 over `path\0sha256(content)\n` in sorted path order, first 10 hex characters. It writes the digest only
     into the built worker's `const DIGEST = '…';` line, which must appear exactly once, like the other two
     replaced lines. `build-info.js` and its `BUILD` shape are unchanged.
   - `sw.js` adds `const DIGEST = 'dev';`, so the checked-in cache is `portland-trail-dev-dev`, and names the cache
     `` `${PREFIX}${BUILD.sha}-${DIGEST}` ``. Activation was already "every `portland-trail-*` but mine", which now
     includes the same sha with another digest.
   - `build()` takes a `root` (default `app/`; there is no new CLI flag), so the test can build a hermetic fixture
     app. The CLI summary prints the cache name.
   - Covering tests:
     - the real-app build's cache name starts with `portland-trail-<sha>-` and ends in 10 hex characters;
     - new test "the cache digest is stable for identical input and changes with one byte of a scene": a fixture
       app outside any repository is built twice to identical `sw.js` bytes with cache `portland-trail-nogit-<10
       hex>`. One byte of `assets/scenes/road.webp` is changed, and the rebuild gets another cache name and other
       worker bytes, identical apart from the `DIGEST` line;
     - the source worker test expects `portland-trail-dev-dev`;
     - the activation test now also holds `portland-trail-dev-0123456789` (same sha, other digest) and an old
       `portland-trail-0123abc`, and both are deleted.
4. **`.mjs` dropped** from the shell rules: the precache filter in `build.mjs` is now `.js/.json/.css`, and the
   network-first test in `sw.js` is `.html/.js/.css`. There is no dedicated test; the existing network-first and
   cache-first tests cover the remaining rules.
5. **One page entry for navigations.**
   - A new `refresh()` in `sw.js` stores a successful navigation answer under `./` instead of its full URL, but
     only when the answer is HTML. Without that guard, an image opened directly as a page would replace the shell.
     The clone is still taken before the page reads the body.
   - Offline lookup is unchanged (exact, then `ignoreSearch`, then `./`).
   - Covering test, new: "navigations keep one page entry under ./ whatever their query, and only HTML replaces
     it". Two navigations (`?seed=kale`, `?seed=fern`) leave exactly one entry, the scope root, holding the latest
     page; a navigation answered with `image/webp` leaves it untouched. Stub responses now carry a `Content-Type`.

TDD evidence (`cd app && node --test tests/tooling.test.js`; a 20 s per-test timeout was added for the red runs,
because one test waits forever against the old worker):

- Red, after the test changes and before any implementation: 7 fail and 7 are cancelled.
  - The build's cache name was `portland-trail-01310b4` with no digest.
  - The fixture build ignored `root` and gave the same name.
  - The source worker used `portland-trail-dev`, so the cache-name tests missed.
  - The cancellations were fallout: the timeout test's promise stayed pending once the event loop emptied.
- Red, after item 3 only: 20 pass, 1 fail. The navigation test failed with "one page entry" and an extra entry
  `https://game.test/trail/?seed=kale`.
- Green, final:

  ```
  $ cd app && node --test tests/tooling.test.js
  TAP version 13
  # tests 21
  # suites 4
  # pass 21
  # fail 0
  # cancelled 0
  # skipped 0
  # todo 0
  # duration_ms 783.471334
  ```

  The output has no warnings and no stray lines.

Manual checks:

- `npm run build`: `… v0.2.0 · 01310b4+ · feat/review-implementation · 2026-10-01 in …/app/dist: 104 files, 20
  precached for offline play (cache portland-trail-01310b4-ca2dbb0a16).`
- Installed Chrome against `PORT=0 serve.mjs --dist`, with a scratch script that is not committed:
  - the page is controlled after a reload; the cache is `portland-trail-01310b4-ca2dbb0a16`;
  - its page entries are `/index.html`, `/manifest.webmanifest` and `/`, both after install and after navigating
    to `?seed=kale` and `?seed=fern`;
  - an offline navigation to `?seed=moss` gets the shell (title and `#app`);
  - no page errors.
- `prettier --check` passes on all my files.
- The server was stopped by PID; only the main checkout's 4173 and 4174 servers remain.

Concerns: none new. The deferred items (failure paths of `versionPage` and `replaceLine`, HEAD responses, the
duplicated spawn-server helper, the dirty-flag flake risk) are untouched, as ruled.
