# Version 0.2: review implementation

Verified October 2, 2026 on the MacBook Pro, on branch `feat/review-implementation` at `6fe1c72` plus this documentation commit. Version 0.2.0 implements the [code and architecture review](../reviews/2026-10-01-code-and-architecture-review.md) as specified in the [design](../superpowers/specs/2026-10-01-review-implementation-design.md) and carried out by the [plan](../superpowers/plans/2026-10-01-review-implementation.md). The review now opens with a status table, one row per item. Return to [project setup](../../PROJECT_SETUP.md).

## What was delivered

- **Rules engine, save version 3.** `app/src/engine/` holds a pure `transition(state, action)` with an action table, data-driven encounters chosen by weight, one `hurt` function that records every death with its cause, weather that lasts and clears, sickness with a daily cost, last resorts for a dry tank, and scored endings. Read-only functions (`availableActions`, `forecast`, `shopItems`, `recommendSupplies`, `summarize`, `routeStops`, …) tell the interface what it can do and what it costs. Saves of versions 1, 2 and 3 load; old saves are repaired rather than rejected where the repair is safe.
- **Content.** Every tunable number and every sentence that carries a number lives in [data.js](../../app/src/data.js). Fourteen encounters (five new; five encounters offer a response only one background can take), nineteen death causes with default epitaphs, ranks, a name pool and daily or typed seeds. The outbreak is now answerable: kombucha, quarantine or driving through, and nobody dies of a roll the player could not influence.
- **Interface.** `app/src/main.js` is the controller; `app/src/ui/` holds storage, region patching, views, dialogs and sound. The game screen is a fixed set of regions that are replaced only when their HTML changes. Encounters show what happened and cannot be dismissed by Escape; deaths open a memorial with an editable epitaph; the ending shows a score, a rank, rent days, headstones, the whole journal, records and the seed with Replay. Journeys move between devices with a `PT2.` code or a save file.
- **Look and sound.** One token block of ten colours, a rem type scale, the in-house Portland Pixel typeface for headings, banded health bars with numbers, a labelled route map with a moving van, scanlines, a typed encounter text and a blinking cursor, and generated chiptune tones behind a toggle that starts off. All motion stops under reduced motion.
- **Assets.** One script, `app/scripts/prepare-assets.py`, derives every file in `app/assets/` from the preserved originals and records sources, crops, sign repairs and hashes in [app/assets/manifest.json](../../app/assets/manifest.json). 27 scenes as WebP at two sizes (54 files, 5.66 MB, down from 13.9 MB of JPEG), the sprites unchanged, the icons and the font. The title, victory, loss and breakdown signs were repaired in the pixel face.
- **Build, offline and tooling.** `npm start` builds a stamped copy into `app/dist/` with versioned module URLs and serves it; the built copy registers a service worker and plays offline. The footer shows `v0.2.0 · <sha> · <branch> · <date>`. Prettier, TypeScript over JSDoc, Playwright as a development dependency with a lock file, a checksum script with a check mode, and a GitHub Actions workflow.

### Where the old asset files went

[graphics-v2/README.md](../handoff/graphics-v2/README.md) and [graphics-v3/README.md](../handoff/graphics-v3/README.md) are preserved handoff documents and were not edited. Their links to `app/assets/generated-manifest.json`, `app/assets/mobile-art-manifest.json`, `app/assets/mobile-images.json`, `app/assets/mobile/`, `app/scripts/prepare-generated-assets.mjs` and `app/scripts/prepare-mobile-art.mjs` no longer resolve. Those files were replaced by one pipeline: [prepare-assets.py](../../app/scripts/prepare-assets.py) writes every scene, sprite, icon and the font, and [app/assets/manifest.json](../../app/assets/manifest.json) records each source path and hash, crop, repair, size and output hash. The JPEG scenes and the 640px phone set no longer exist; each scene is now `app/assets/scenes/<id>.webp` and `<id>-960.webp`.

## Checks run

All from `app/`, on this commit, with Node 22.19.0, Playwright 1.63.0 and installed Google Chrome 154.

| Check | Result |
|---|---|
| `npm test`: rules, encounters, shop, selectors, route, saves, fuzz, balance and tooling (9 files) | 210 of 210 pass |
| `npm run test:browser`, against the source and the built copy | 6 suites of 6 pass: encounters 50 checks, flow 192 (widths 390, 414, 430, 768, 1440), journey 180 (a win at 1440 and a loss at 390, played through the visible controls), layout 249 (12 viewports), look 84, offline 25; 780 checks, 0 failed |
| `npm run format:check` | every file Prettier covers is formatted; no changes were needed in this task |
| `npm run typecheck` | no errors |
| `node scripts/balance.mjs 2000` | the same figures as the balance note (below) |
| `node scripts/checksums.mjs --check` | exits 0 after the refresh in this commit |
| Relative links in the documents touched by this task | every link resolves to an existing file |

The browser suites cover the twelve viewports of spec section 11 (320×568 to 1440×900), keyboard play of setup, a drive, an encounter and a purchase, Escape pressed twice on an encounter, a dry tank at a shop and on the road, the drive drawn from the previous state, reduced motion, the memorial and epitaphs, markup in names and epitaphs shown as text, records, the transfer dialog, another tab changing the save, the build stamp, and an offline reload that starts a journey and drives with its scene art. The journey suite checks after every action that the saved journey equals the engine's own result.

## Balance

Measured over 2,000 seeds per background with three bots; full tables, the bots' rules and the tuning history are in the [balance validation](2026-10-01-balance.md). Every target in spec section 3.11 holds.

| Bot | Won | Mean alive | Target |
|---|---:|---:|---|
| Never shops | 0.0% for every background | 0.00 | at most 5% |
| Autopilot (Auto-buy, never rests or uses anything) | 43.5–45.5% | 1.94–2.08 | 30–55% |
| Careful | 100% for every background | 5.00 | at least 80%, at least 3.5 alive |

Three numbers changed from their starting values: the encounter chance per driving day (0.3 to 0.5), the heatwave's damage (6 to 16) and the influencer's Wi-Fi damage (8 to 5). The spec now shows the final values; `data.js` is authoritative.

Careful play almost never loses a traveler: across 8,000 careful journeys none was lost. A ruling first asked for a riskier careful target (85–97% wins, a death in a quarter of journeys); it was not reachable with the tunable numbers alone, because the careful bot opens kombucha below 40 health and rests while the crew's mean health is under 70. The target went back to the floor above, and the game's risk lives in the gap between attentive play and Autopilot. A human plays somewhere between the two. The balance note lists the rule changes that would add risk to careful play if it is ever wanted.

## Screenshots

From the look suite of this run (`app/test-results/look/`), copied into [review-implementation/](review-implementation/). Each was looked at.

Phone, 390×664:

- [Title](review-implementation/title-390x664.png), [step 1: background](review-implementation/step1-390x664.png), [shop with Auto-buy](review-implementation/shop-390x664.png)
- [On the road with the forecast and route map](review-implementation/road-390x664.png), [encounter](review-implementation/encounter-390x664.png), [what happened](review-implementation/outcome-390x664.png), [memorial](review-implementation/memorial-390x664.png)
- [Won ending](review-implementation/won-390x664.png), [lost ending](review-implementation/lost-390x664.png), [whole journal](review-implementation/journal-390x664.png)

Landscape phone, 844×390: [road](review-implementation/road-844x390.png), [encounter](review-implementation/encounter-844x390.png).

Desktop, 1440×900: [title with the build stamp](review-implementation/title-1440x900.png), [road](review-implementation/road-1440x900.png), [shop](review-implementation/shop-1440x900.png), [won ending with two headstones](review-implementation/won-1440x900.png).

## Limits

- **No physical iPhone.** Every browser check ran in installed Chrome through Playwright with phone viewports. Battery, thermal behavior, real touch and the installed home-screen app on a device were not tested.
- **No WebKit run.** The Playwright WebKit runtime is a download that was not authorized. The plan's check of Safari and the installed app in the iOS Simulator (masthead clear of the status bar, portrait and landscape) belongs to the controller's final checks and is not recorded here.
- **Sound not heard.** The tones were checked for errors with a real `AudioContext` after a gesture in headless Chrome. Nobody has listened to them on a device.
- **CI on GitHub has not run on this version.** The workflow ran once, on `main` at `b3d1cdb` (an intermediate state of 0.2): `npm test`, the checksum check and `npm ci` passed, and the format check failed on `app/src/styles.css`, which Task 9 has since formatted. The type-check step was not reached. This branch has not been pushed, so the workflow has not run on it.
- **Careful play almost never loses a traveler** (see Balance).
- **Some decorative lettering stays garbled** in the wifi, motel, nft, food-carts, free-box and rest-stop scenes (for example "NO SIGGNAL" and "VAC_NCY"). The title, victory, loss and breakdown signs are repaired. New art needs an image-generation tool; [AGENTS.md](../../AGENTS.md) describes how to add it.
- **The handoff archive** is still in the repository (review item E6); moving it needs a published release and a history rewrite, which are the owner's decision.
- The won ending's line under the heading still reads "at least some of its passengers" even when all five arrive (review item B18, in `app/src/ui/trip-views.js`).
