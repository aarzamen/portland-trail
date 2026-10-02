# The Portland Trail — agent instructions

This file is the single source of truth for every agent working here (Claude, Codex or any other). `CLAUDE.md` only points to it.

## Project and intent

The user-designated project root is `/Users/ama/The Portland Trail` on ama's MacBook Pro. Use this checkout as the working project. Derive paths from the actual project root when running elsewhere; do not hard-code cloud scratch paths into the app or documentation.

Preserve the premise: a funny Oregon Trail-inspired road trip to Portland, five named travelers, four satirical backgrounds, a scruffy loaded van, scarce resources and absurd Pacific Northwest encounters. Preserve the green handheld-game / terminal visual identity. The delivered audit and artwork provide a starting point, not a requirement to reproduce every defect or accept every proposal.

The game is a working static browser game in `app/` (version 0.2.0). A request to build, fix, continue an approved implementation, or publish authorizes the work necessary to complete that request. Do not infer a deployment request from the mere presence of this file.

## Work autonomously within the user's task

- Carry an authorized task through inspection, implementation, relevant verification, documentation and a usable result. Do not stop after a plan or ask whether to continue routine work.
- Make ordinary reversible choices yourself: file organization, small refactors, bug fixes, local previews, targeted tests, dependency changes needed by the task, art inventory and document maintenance. Use the existing project conventions and prefer the smallest sound solution.
- Resolve routine implementation details from the brief and source. State reasonable assumptions and keep moving. Ask only when missing information materially changes scope or an action is destructive, costly, externally consequential, or outside the authorization already given.
- An explicit request to deploy or publish is authorization for that deployment. Prepare and verify the concrete result before any genuinely required final approval. Do not ask again for approval already given.
- Inspect the working tree first. Preserve unrelated user edits and original artwork. Use an isolated branch or worktree where it helps (`.worktrees/` is ignored by Git). Do not reset, force-push, delete original assets, or overwrite unrelated work as a shortcut.
- Report progress briefly and regularly. Finish with what changed, what was checked and any actual remaining blocker. Do not claim a file was inspected, an image was integrated, or a test passed without evidence.
- These instructions do not override system/tool restrictions or authorize access to unrelated private data, secrets, paid services, or messages to other people.

## How the game is built

Static, dependency-free runtime: native ES modules, no bundler, no backend. Node 22 or newer for the scripts and tests.

| Path | Role |
|---|---|
| `app/src/data.js` | All content and every tunable number: backgrounds, items, stops, regions, encounters, deaths, ranks, sentences |
| `app/src/engine.js` and `app/src/engine/` | Pure rules engine. `transition(state, action)` returns `{ state, error, notes }` and never mutates its input. Read-only helpers (`availableActions`, `forecast`, `shopItems`, `summarize`, `routeStops`, …) tell the interface what can be done and what it costs. `save.js` reads save versions 1, 2 and 3 |
| `app/src/main.js` and `app/src/ui/` | Browser interface: a projection of the engine. Regions redraw only when they change |
| `app/src/styles.css` | Look and layout |
| `app/assets/` | Derived files only: `scenes/*.webp`, `sprites/`, `icons/`, `fonts/`, `manifest.json`. Regenerate with the asset script; never edit by hand |
| `app/scripts/` | `serve.mjs`, `build.mjs` (stamped, versioned build in `app/dist/`), `prepare-assets.py`, `pixelfont.py` and `pixel-font.txt` (the Portland Pixel typeface), `balance.mjs`, `checksums.mjs`, `test-browser.mjs` |
| `app/sw.js` | Service worker for offline play (registered only in a built copy) |
| `app/tests/` | `*.test.js` rules tests (Node test runner); `browser-*.mjs` Playwright suites with installed Chrome; `support/browser.mjs` shared helper |
| `docs/superpowers/specs/2026-10-01-review-implementation-design.md` | The current design specification: rules, engine contract, save format, assets, build, interface |
| `docs/reviews/2026-10-01-code-and-architecture-review.md` | The review the 0.2 work implements, with item ids (B1…F13) |

Commands, from `app/`:

```bash
npm run dev            # serve the source on http://127.0.0.1:4173
npm start              # build, then serve the build
npm test               # rules, fuzz and balance tests; no install needed
npm ci                 # once, for the development tools below
npm run test:browser   # build, start servers on free ports, run every browser suite
npm run build
npm run assets         # regenerate every file in app/assets (needs uv)
npm run balance        # print win rates for three bots
npm run checksums      # refresh checksums.json and docs/handoff/checksums.json
npm run format         # Prettier
npm run typecheck      # TypeScript over JSDoc
```

## Rules that keep the code sound

- One rule lives in one place. The interface contains no game logic: every button, label, reason, cost and forecast comes from the engine's read-only functions. If the interface needs a fact, add a read-only engine function.
- Every tunable number lives in `app/src/data.js`. No sentence spells out a number; sentences take numbers from `{slots}`, and a counted noun uses the `{one|many}` form.
- Tests read numbers from `data.js` instead of copying them. `app/tests/balance.test.js` holds the balance targets; run `npm run balance` after changing numbers.
- Saves are versioned. Never break loading of an older save; add a migration in `app/src/engine/save.js` with tests.
- Escape all text that came from a save or a player before it reaches HTML.
- Controls stay at least 44 by 44 CSS pixels on phones, editable text at least 16px, no horizontal scrolling from 320px to 1440px, and all motion stops under reduced motion.
- Port 4173 is the default dev server for the main checkout. In a second checkout or worktree use `PORT=0` (or another free port) so two servers never collide.
- Commit only the files your task owns, by path. Refresh the checksum manifests (`npm run checksums`) before a merge to `main`; CI checks them.

## Adding new scenes and artwork

New art must stay inside the existing style and contracts. Read `docs/handoff/ASSET_BRIEF.txt` (style, palette, prompts) and spec section 7 first.

1. **Style.** Green handheld-game pixel illustration on near-black: palette near ink `#07110A`, pine `#18331B`, moss `#426E35`, phosphor `#A4C96A`, with restrained amber accents. Pacific Northwest scenery, the same scruffy loaded van (`app/assets/sprites/van.png` is the reference silhouette), heavy consistent outlines, dry humor from props. No titles, captions, UI, watermarks or generated lettering; signs only if they are decorative and spelled correctly. The reusable style prompt is in `ASSET_BRIEF.txt`.
2. **Size.** Opaque landscape masters, 1536×1024 (3:2), with the subject inside the central 75% width and 80% height so phone crops keep it. Road scenes leave the lower third clear for the animated van.
3. **Masters.** Save each original master as `docs/handoff/graphics-vN/<scene-id>.png` in a new numbered folder (the next is `graphics-v5`), with a `README.md` and a `generation.json` listing id, tool, prompt and date, as `graphics-v2` and `graphics-v3` do. Masters are never edited afterwards.
4. **Pipeline.** Add the scene to `SCENES` in `app/scripts/prepare-assets.py` (source path and crop or `None`), run `npm run assets`, and look at `app/test-results/assets/scenes.png`. Never put files into `app/assets/` by hand; the script writes the WebP pair and the manifest.
5. **Use.** Point a stop, region or encounter at the scene id in `app/src/data.js` (`scene: '<id>'`). New encounters are data: an entry in `EVENTS` with weight, optional `where` range, choices and numbers, plus its effect in `app/src/engine/events.js` and a test in `app/tests/events.test.js`; keep `npm run balance` inside its targets.
6. **Check.** `npm test`, `npm run test:browser`, then look at the scene in the game at 390px and 1440px.

The regions `pines` and `outskirts` and the encounters `sasquatch`, `toll_troll` and `brunch_line` now have dedicated graphics-v4 scenes. See [docs/handoff/graphics-v4/README.md](docs/handoff/graphics-v4/README.md) for the completed batch and [docs/art/2026-10-02-scene-brief-v4.md](docs/art/2026-10-02-scene-brief-v4.md) for its shared style block, steering words, prompts and acceptance checklist.

## Read and maintain these documents

All paths below are relative to this project root:

| Path | Role |
|---|---|
| `README.md` | What the game is and how to run it |
| `PROJECT_SETUP.md` | Placement, known state and verification commands |
| `docs/handoff/README.md` | Handoff index and evidence scope |
| `docs/handoff/Portland_Trail_Audit.pdf` | Illustrated evaluation of the original app |
| `docs/handoff/HANDOFF_TO_CODEX.txt` | Original rebuild priorities and acceptance criteria |
| `docs/handoff/ASSET_BRIEF.txt` | Style and graphic-production contract |
| `docs/handoff/findings.json` | 18 findings on the original app |
| `docs/handoff/graphics-v1/` … `graphics-v4/` | Preserved generated masters with prompts |
| `docs/handoff/LOCAL_IMAGE_REVIEW.md` | Review of the original local images in `images/` |
| `docs/validation/` | Validation records, balance measurements and screenshots |

Keep links relative within the project. Whenever a document or asset moves, update all affected links, manifests and code references. Preserve historical evidence paths and original filenames unless making a clearly recorded copy.

## Source and image preservation

`docs/handoff/evidence/`, `docs/handoff/graphics-v*/` and `images/` are preserved originals: never modify them. Everything in `app/assets/` is derived from them by `app/scripts/prepare-assets.py`, which records the source and hash of each file in `app/assets/manifest.json`.

Preserve original data ids: resources `money`, `food`, `fuel`, `ammo`, `parts`, `kombucha`, `nft`; professions `influencer`, `dev`, `prepper`, `barista`. Here `ammo` means seed bombs and `parts` means repair supplies.

## Verification

Run checks relevant to the change. Verify one successful route and one losing route when changing the game loop (the browser journey suite does both). For UI work, inspect 390/414/430px phone widths and a desktop viewport, keyboard operation and dialog focus. State when a real-device browser was unavailable. Use meaningful tests for behavioral changes; do not invent tests that merely restate markup or over-test simple documentation edits.
