# The Portland Trail project setup

Updated October 1, 2026. Project root: `/Users/ama/The Portland Trail` on the MacBook Pro.

## Current state

The first playable rebuild lives in [app/](app/). It is a static browser game with no runtime dependencies or backend. The original audit, source snapshots, and graphics masters are unpacked under [docs/handoff/](docs/handoff/). Their evidence and image bytes remain unchanged. The archive's duplicate AGENTS.md was removed at the user's request; the root [AGENTS.md](AGENTS.md) remains authoritative.

The project is tracked on `main` in the public GitHub repository [aarzamen/portland-trail](https://github.com/aarzamen/portland-trail). The `origin` remote uses SSH; `feat/playable-rebuild` preserves the last development checkpoint. The existing private `aarzamen/The-Portland-Trail` repository is separate. The original staging README and local-image status are preserved as `docs/handoff/README.archive-v2.md` and `docs/handoff/LOCAL_IMAGE_REVIEW.archive-v2.md`. The original setup document remains inside the handoff ZIP.

The roadtrip update adds Auto-buy essentials, animated travel and daily summaries, four new illustrated stops (11 locations total), and desktop/home-screen icons. Save version 2 imports the original version 1 journeys without resetting progress. See the [update validation](docs/validation/2026-10-01-roadtrip-update.md).

The [iPhone polish pass](docs/validation/2026-10-01-iphone-polish.md) adds compact portrait and landscape playback, 44px touch controls, 16px editable text, three new scenes, brief atmosphere effects, and smaller phone images. Safari in the iPhone 17 Pro simulator was checked alongside WebKit and Chrome at 11 viewports. Physical iPhone performance remains untested.

## Run and verify

Node 22 or newer is required. No npm install is needed.

```bash
cd "/Users/ama/The Portland Trail/app"
npm start
```

Open [the local game](http://127.0.0.1:4173). Keep that terminal running. Saves belong to that browser and origin; switching ports or browsers creates a separate save area.

```bash
cd "/Users/ama/The Portland Trail/app"
npm test
npm run build
```

The build writes portable static files to `app/dist/`. To serve that build:

```bash
cd "/Users/ama/The Portland Trail/app"
node scripts/serve.mjs --dist
```

Stop the existing server first if it already occupies port 4173. The server binds to localhost only.

Browser checks use Playwright with installed Chrome. On this Mac, the bundled runtime supplies Playwright:

```bash
cd "/Users/ama/The Portland Trail"
PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" node app/tests/browser-smoke.mjs
PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" node app/tests/browser-enhancements.mjs
PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" node app/tests/browser-icons.mjs
PLAYWRIGHT_MODULE="/Users/ama/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" BROWSER=chromium node app/tests/browser-iphone.mjs
```

Start the local server first. Other machines can supply their own Playwright module through PLAYWRIGHT_MODULE. Browser evidence is written beneath `app/test-results/`; this generated directory is excluded from Git. The iPhone validation record includes the WebKit command and saved reports.

## Development map

- [Game data](app/src/data.js): professions, items, route, paces, rations, encounters.
- [Game rules](app/src/engine.js): pure transitions, seeded randomness, versioned save validation.
- [Browser interface](app/src/main.js) and [styles](app/src/styles.css): setup, shops, travel, dialogs, endings, local saves.
- [Asset manifest](app/assets/manifest.json): source paths, hashes, extraction rectangles, and output sizes.
- [Validation record](docs/validation/2026-10-01.md): checks, outcomes, and limits.

The travel screen animates the existing van over illustrated scenery. The [location artwork](docs/handoff/graphics-v2/README.md) and [river, city and heatwave artwork](docs/handoff/graphics-v3/README.md) preserve the generated masters and exact prompts. A strict pixel palette, physical-device Safari validation, and hosting remain future work. Phone scene variants can be regenerated on macOS with `node app/scripts/prepare-mobile-art.mjs` from the project root; they are already included in the app and do not require regeneration to build.

## Desktop and home-screen icon

The game supplies browser icons, a 180px Apple touch icon, and 192/512px app icons through a web manifest. Launch paths are relative, including when hosted in a subdirectory. The app still needs its server running; there is no offline cache. A shortcut saved before this update may need to be removed and added again to refresh its cached icon. Native OS installation has not been tested.
