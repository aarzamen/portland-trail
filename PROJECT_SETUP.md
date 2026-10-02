# The Portland Trail project setup

Updated October 2, 2026. Project root: `/Users/ama/The Portland Trail` on the MacBook Pro.

Public game: [The Portland Trail](https://the-portland-trail.annonable.chatgpt.site). No sign-in is required. Sites registration lives in [.openai/hosting.json](.openai/hosting.json), and [publication validation](docs/validation/2026-10-02-sites-publication.md) records the public checks. The [session closeout](docs/handoff/SESSION_CLOSEOUT.md) is the next-session starting point.

## Current state

Version 0.2.0 of the game lives in [app/](app/). It is a static browser game with no runtime dependencies or backend. It implements the [code and architecture review](docs/reviews/2026-10-01-code-and-architecture-review.md) as designed in [the 0.2 spec](docs/superpowers/specs/2026-10-01-review-implementation-design.md); the review opens with a status row for each item, and the [0.2 validation record](docs/validation/2026-10-01-review-implementation.md) lists the checks and the limits. The original audit, source snapshots, and graphics masters are unpacked under [docs/handoff/](docs/handoff/). Their evidence and image bytes remain unchanged. The archive's duplicate AGENTS.md was removed at the user's request; the root [AGENTS.md](AGENTS.md) remains authoritative.

The project is tracked on `main` in the public GitHub repository [aarzamen/portland-trail](https://github.com/aarzamen/portland-trail). The `origin` remote uses SSH; `feat/playable-rebuild` preserves the first development checkpoint, and version 0.2 was built on `feat/review-implementation`. The v4 scenes and selected v5 splash are now merged to `main`; `codex/scene-art-v4` preserves that artwork checkpoint. The local `sites` remote is the registered Site's separate source repository. The existing private `aarzamen/The-Portland-Trail` repository is separate. The original staging README and local-image status are preserved as `docs/handoff/README.archive-v2.md` and `docs/handoff/LOCAL_IMAGE_REVIEW.archive-v2.md`. The original setup document remains inside the handoff ZIP.

What 0.2 changed, in short: a rules engine that tells the interface what it can do (save version 3, older saves still load), every number in [data.js](app/src/data.js), fourteen encounters, deaths with epitaphs, last resorts instead of an empty-tank loss, scored endings with headstones and records, moving a journey between devices, a token-based look with the in-house Portland Pixel typeface, a route map, optional sound, WebP art from one asset script, a stamped build that plays offline, and Prettier, type checking, a checksum script and CI. Earlier records: the [first rebuild](docs/validation/2026-10-01.md), the [roadtrip update](docs/validation/2026-10-01-roadtrip-update.md) and the [iPhone polish pass](docs/validation/2026-10-01-iphone-polish.md).

## Run and verify

Node 22 or newer is required. Playing needs no install.

```bash
cd "/Users/ama/The Portland Trail/app"
npm run dev
```

Open [the local game](http://127.0.0.1:4173). Keep that terminal running. Saves belong to that browser and origin; switching ports or browsers creates a separate save area. `npm start` builds a stamped copy into `app/dist/` and serves that instead; the built copy registers a service worker and plays offline. In a second checkout or worktree, start servers with `PORT=0` (a free port is chosen and printed) so they never collide with the main checkout on 4173.

```bash
cd "/Users/ama/The Portland Trail/app"
npm test               # rules, encounters, saves, fuzz, balance and tooling tests; no install needed
npm ci                 # once: Playwright, Prettier, TypeScript
npm run test:browser   # builds, starts servers on free ports, runs every browser suite in installed Chrome
npm run build          # stamped, versioned copy in app/dist/
npm run balance        # win rates of three bots over 2,000 seeds per background
npm run format         # Prettier (npm run format:check only reports)
npm run typecheck      # TypeScript over the JSDoc types
npm run assets         # regenerate every file in app/assets from the preserved originals (needs uv)
npm run checksums      # refresh checksums.json and docs/handoff/checksums.json before merging to main
```

`npm run test:browser -- layout` runs only the suites whose names match. Browser evidence and screenshots are written beneath `app/test-results/`, which Git ignores. Asset previews go to `app/test-results/assets/`. `npm run assets` needs [uv](https://docs.astral.sh/uv/); its Python dependencies are pinned inside the script. `npm run checksums:check` (or `node app/scripts/checksums.mjs --check` from the root) reports stale, missing and extra entries without changing anything; CI runs it.

CI is [.github/workflows/test.yml](.github/workflows/test.yml): on every push and pull request it runs `npm test`, the checksum check, `npm ci`, the format check and the type check with Node 22.

The publication commits have passed CI on GitHub. Publish a clean committed build through Sites: push its exact SHA to both source repositories, build `app/dist/`, and package its contents as top-level `dist/` beside `.openai/hosting.json` in the deployment archive. Sites accepts the top-level output directory declared in the hosting configuration; do not declare `app/dist` there. The publishing sequence and credential rules are in [AGENTS.md](AGENTS.md).

## Development map

- [Game data](app/src/data.js): every tunable number and every sentence: rules, paces, rations, items, backgrounds and abilities, stops, regions, encounters, deaths, ranks, names.
- [Engine facade](app/src/engine.js) and [app/src/engine/](app/src/engine/): `random.js` (generator, seeds), `state.js` (new game, journal, health, days, the van), `actions.js` (the action table, `transition`, `availableActions`), `events.js` (encounter choice and effects), `selectors.js` (forecast, status, shop rows, Auto-buy plan, summary, route), `save.js` (save versions 1–3).
- [Controller](app/src/main.js) and [app/src/ui/](app/src/ui/): `storage.js` (the save record, records, settings, transfer codes), `render.js` (region patching and focus), `views.js` (title and setup), `trip-views.js` (the game screen and the ending), `dialogs.js` (encounter, memorial, journal, transfer, confirm), `sound.js` (generated tones).
- [Styles](app/src/styles.css): tokens, type scale, components; the [Portland Pixel glyphs](app/scripts/pixel-font.txt) are the source of the heading face.
- [Build stamp](app/src/build-info.js), [service worker](app/sw.js), [web manifest](app/manifest.webmanifest).
- Scripts in [app/scripts/](app/scripts/): `serve.mjs`, `build.mjs`, `test-browser.mjs`, `balance.mjs`, `checksums.mjs`, `prepare-assets.py`, `pixelfont.py`.
- Tests in [app/tests/](app/tests/): `*.test.js` for the Node test runner; `browser-*.mjs` suites (encounters, flow, journey, layout, look, offline) with the shared helper in `support/browser.mjs`.
- [Asset manifest](app/assets/manifest.json): source paths and hashes, crops, sign repairs, sizes and output hashes for every derived file.
- Records: the [0.2 validation record](docs/validation/2026-10-01-review-implementation.md), the [balance measurement](docs/validation/2026-10-01-balance.md), the [review](docs/reviews/2026-10-01-code-and-architecture-review.md) with its historical [evidence scripts](docs/reviews/evidence/) (they run only at commit `3e02b8a`), the [design](docs/superpowers/specs/2026-10-01-review-implementation-design.md) and the [plan](docs/superpowers/plans/2026-10-01-review-implementation.md).

The preserved masters are documented in [location artwork](docs/handoff/graphics-v2/README.md), [river, city and heatwave artwork](docs/handoff/graphics-v3/README.md), [five region and encounter scenes](docs/handoff/graphics-v4/README.md), and [three splash alternatives](docs/handoff/graphics-v5/README.md). The first v5 image, The Road Ahead, is the selected live splash. The v2/v3 READMEs still mention the old JPEG exports and scripts; [prepare-assets.py](app/scripts/prepare-assets.py) and the asset manifest replaced them. New art goes through the steps in the "Adding new scenes and artwork" section of [AGENTS.md](AGENTS.md).

## Offline and the installed app

The game supplies browser icons, a 180px Apple touch icon, and 192/512px app icons through a web manifest. Their public URLs decode at the declared sizes and match the built files, and the public page links them correctly. This verifies the home-screen configuration. The user also confirmed successful testing on their physical iPhone 15 Pro on October 2; see the [publication record](docs/validation/2026-10-02-sites-publication.md). Launch paths are relative, including when hosted in a subdirectory. `index.html` sets `viewport-fit=cover`, so the safe-area paddings take effect in an installed app with a translucent status bar.

Only a built copy (`npm start`, or `app/dist/` on any static host) registers the service worker. It precaches the page, code, icons, sprites and font, and caches the scenes for the device's image size in the background; "Ready to play offline" appears once that finishes. Code and pages are fetched network-first, so a new build replaces an old one on the next load; each build has its own cache. `npm run dev` registers no worker and removes one left by a built copy on the same port. A shortcut saved before 0.2 may need to be removed and added again to refresh its icon.

## What remains

- An optional automated WebKit run (it needs a browser download) and Safari check in the iOS Simulator; physical iPhone play is already confirmed by the user.
- Garbled decorative lettering in six older scenes, new art for the regions and encounters that reuse road scenes (see AGENTS.md), and one ending line (review B18).
- Careful play almost never loses a traveler; more risk would need rule changes, listed in the [balance note](docs/validation/2026-10-01-balance.md).
- Moving the handoff archive to a GitHub release (review E6) remains the owner's decision. Public hosting is complete at the Site linked above.
