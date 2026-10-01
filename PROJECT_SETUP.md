# The Portland Trail project setup

Updated October 1, 2026. Project root: `/Users/ama/The Portland Trail` on the MacBook Pro.

## Current state

The first playable rebuild lives in [app/](app/). It is a static browser game with no runtime dependencies or backend. The original audit, source snapshots, and graphics masters are unpacked under [docs/handoff/](docs/handoff/). Their evidence and image bytes remain unchanged. The archive's duplicate AGENTS.md was removed at the user's request; the root [AGENTS.md](AGENTS.md) remains authoritative.

A local Git repository now tracks the project on `feat/playable-rebuild`. There is no remote or publication configured. The original staging README and local-image status are preserved as `docs/handoff/README.archive-v2.md` and `docs/handoff/LOCAL_IMAGE_REVIEW.archive-v2.md`. The original setup document remains inside the handoff ZIP.

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
```

Start the local server first. Other machines can supply their own Playwright module through PLAYWRIGHT_MODULE. Browser screenshots and the report are written to `app/test-results/browser/`; this generated directory is excluded from Git.

## Development map

- [Game data](app/src/data.js): professions, items, route, paces, rations, encounters.
- [Game rules](app/src/engine.js): pure transitions, seeded randomness, versioned save validation.
- [Browser interface](app/src/main.js) and [styles](app/src/styles.css): setup, shops, travel, dialogs, endings, local saves.
- [Asset manifest](app/assets/manifest.json): source paths, hashes, extraction rectangles, and output sizes.
- [Validation record](docs/validation/2026-10-01.md): checks, outcomes, and limits.

This version uses static illustrations. Animated van frames, a strict pixel palette, real-device Safari validation, and hosting remain future work. The broad original art inventory remains preserved; only selected reviewed copies are used by the app.
