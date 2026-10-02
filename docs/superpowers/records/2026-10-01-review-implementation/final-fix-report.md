# Final fix wave: report

Worktree `.worktrees/review-implementation`, branch `feat/review-implementation`, from 3d6ac82.

Commits (not pushed):

- `47fb116` fix: final review wave (all six items, tests, spec, review status, validation record)
- `73fdbb8` chore: checksums refreshed after the final review fix wave

## 1. B18: the ending's scene line (IMPORTANT)

- `app/src/data.js`: new `ENDINGS` export holding the ending sentences. `everyoneArrived`, `someArrived`, `lost`, `fellNear` and `ranDry` moved here from `TEXT` in `selectors.js`. New sentences: `everyoneLine` ("Against the odds, the van and everyone in it made the city.") and `someLine` (the old sentence).
- `app/src/engine/selectors.js`: `endingOf` now returns `line` next to `heading` and `cause`. With five survivors it returns `everyoneLine`, with fewer `someLine`, for a loss the cause, and while the journey is under way `''`. The `Summary` typedef documents the field.
- `app/src/ui/trip-views.js` `sceneText`: `text: summary.line`. The hard-coded sentence is gone.
- `tests/rules.test.js`: the "All five made it" and "of five made it" headings are now in data.js, so the spelled-number check sees them. I added both to `NOT_A_NUMBER`, under the existing "the crew is five" rationale, so the visible wording does not change.
- Tests:
  - `selectors.test.js` "summarize: headings and causes for each ending" now checks `line` for all five (`ENDINGS.everyoneLine`), for three survivors (`someLine`), for a loss (equal to the cause) and for a journey under way (`''`).
  - `browser-journey.mjs`: `endingShows` checks that the scene shows summarize's heading and line for every ending. The winning journey (seed 5, all five alive) checks that the scene line contains `everyoneLine` and not `someLine`.
- Spec `Summary` typedef gains `line`. Review status B18 is now "Done". The B18 residue bullet is removed from the validation record.

## 2. Scene pre-caching during an upgrade

- `app/src/main.js` `setUpOffline`:
  - **The bug.** `register()` does not look for a newer build when a registration with the same script URL already exists. Chrome's own update check after a navigation runs later. So the old worker answered `cache-scenes` at once and the toast showed. Then the new worker activated and deleted that cache.
  - **The fix.** After `ready` the page calls `registration.update()`; an offline failure is ignored. When no worker is installing or waiting, it posts to `registration.active`. Otherwise it waits.
  - A `controllerchange` listener posts `cache-scenes` to the new `navigator.serviceWorker.controller`.
  - If the pending worker becomes `redundant` (a failed install), the active worker is asked instead.
  - The message handler accepts `scenes-cached` only from `registration.active` when nothing is installing or waiting. This compares `event.source`. So "Ready to play offline" appears only after the worker that will serve the page has filled its own cache.
- `tests/browser-offline.mjs`:
  - The `nestedPath` static server is now a reusable `serveDist(prefix, rewrite)`.
  - New step "a visit that installs a newer build". It serves build 1, waits for control and the toast, and counts the scenes in the cache. It then switches `sw.js` to a different `DIGEST` (build 2) and reloads.
  - After the toast, it checks that the `…-next` cache already holds as many scenes as build 1's cache did, and that only the new cache remains. Activation deletes the old cache a moment later, so the test polls for up to 5 s. It also checks the toast appears once and there are no page errors.
- Checked against the old code: with HEAD's `main.js` restored temporarily, this step fails. Both "comes after the new build's cache holds every scene" and "only the new build's cache remains" failed, because the toast came from the old worker before the update was found. With the fix it passes.
- Spec 9.5 Offline line updated.

## 3. Imported endings do not enter local records

- `app/src/main.js`: `adopt` (start-up and the `storage` event) and `adoptImport` (transfer) no longer call `recordEnding`. Only `dispatch` records, on the transition into an outcome. The `recordEnding` doc comment says so.
- `tests/browser-journey.mjs`:
  - `fallenWin` used to rely on start-up adoption recording. The engine now plays seed 14 to one action before the end. That state, with the markup name, is loaded with ten older records. The last drive is made through the visible control, and the saved game must equal the engine's.
  - Both deaths happen on that last drive, so the markup epitaph is carved through the ending's Edit → memorial → Carve it. It is checked as saved and then shown as text.
  - The ten-record limit (best first, weakest dropped, top five listed) is still checked, now after a real ending.
  - `playInEngine` returns `previous` and `last`. `withMarkup` sets only the name.
  - New step "endings that did not happen here": a saved won ending loaded at start-up is shown, and records stay empty, the list is empty and the title shows no best score. Then a lost ending is imported over it by transfer and confirmed: still no records after viewing it and after a reload.
- Spec 9.5 Records line updated.

## 4. Save repair: travel at a stop's mile

- `app/src/engine/save.js` `repair`: a `travel` phase whose distance is exactly a stop's mile becomes `location`. This applies to all versions, since repair runs for 1, 2 and 3. No arrival line is written. The rules never produce that state: `moveVan` sets `location` on arrival, and every move out of a stop goes at least one mile.
- `tests/save.test.js`:
  - The earlier test "an old save on a mile that has since become a stop stays on the road" asserted the opposite on purpose. It is replaced by "a save on the road exactly at a stop has arrived there". For versions 1 and 2 at the Mushroom Market, it checks phase `location`, `currentStop` is the market, no journal line is added, `talk` is accepted, and the save round-trips. A version 3 state gets the same repair, and mile + 1 stays `travel`.
  - In "unknown fields are dropped…", a minimal version 3 save with no phase at mile 0 now loads as `location`, because mile 0 is the departure stop. Travel from it is still accepted.
- Spec section 6 repair list gains: "a `travel` phase exactly at a stop's mile becomes `location` at that stop (no arrival line is written)".

## 5. Wording

- `overMax`: `actions.js` passes the short name as a word in the sentence, `inSentence(short)`. It lower-cases a leading capital that is followed by a lower-case letter, so "Food" becomes "food" while "NFTs" stays as written. Examples: "The van can hold only 100 food." and "… only 5 NFTs." `shop.test.js` builds the expected sentence from `REFUSALS.overMax` and the item data.
- `JOURNAL.hitchhiked`: "… came back with {fuel} fuel." `rules.test.js` compares against `fill(JOURNAL.hitchhiked, …)` for the party's names and checks the ending "{fuel} fuel.".
- An empty tank no longer says "It cost 0 fuel":
  - New optional choice field `dry`, documented in the `EVENTS` comment, on `ebike_convoy.wait`, `brunch_line.wait` and `brunch_line.detour`.
  - `events.js` picks it through `burned(choice, fuel)` when `spend` took nothing.
  - New test in `events.test.js`, "a response that burns fuel on an empty tank says there was none to spend, never '0 fuel'". For each of the three it checks the `dry` line with 0 fuel, that no note contains "0 fuel", and the normal `result` line with fuel in the tank.
- Spec encounter and refusal text updated.

## 6. SHOP_MARK

- `app/src/ui/trip-views.js`: `title="Supplies"` removed. `role="img"` and `aria-label="supplies"` remain. Review status S6 is now "Done".

## Command output (final run, after both commits)

```
app$ npm test
# tests 211
# pass 211
# fail 0

app$ npm run test:browser
browser-encounters: 50 checks, 0 failed.
browser-flow: 192 checks, 0 failed (widths 390/414/430/768/1440).
browser-journey: 230 checks, 0 failed (win seed 5 at 1440, loss seed 3 at 390).
browser-layout: 249 checks, 0 failed (12 viewports).
look: 84 checks, 0 failed (look and feel).
browser-offline: 30 checks, 0 failed.
6 suites, 6 passed, 0 failed.

app$ npx prettier --check .
All matched files use Prettier code style!

app$ npm run typecheck
tsc -p jsconfig.json   (exit 0, no output)

$ node app/scripts/checksums.mjs
Wrote docs/handoff/checksums.json (112 files) and checksums.json (319 files).
$ node app/scripts/checksums.mjs --check
Checksums are current: docs/handoff/checksums.json (112 files) and checksums.json (319 files).
```

The working tree is clean after `73fdbb8`.

## Concerns

- Item 4 reverses a decision an earlier task made on purpose: the old test said migration "does not replay an arrival". The brief asked for the new behaviour. No arrival line is written, and only the phase changes.
- Item 2 adds one extra `sw.js` request per load in a built copy, from `registration.update()`. The server sends it `no-store` anyway, and Chrome makes a similar check after navigation.
- Out of scope, not changed: the toll troll's failed riddle reads "The fine was $0" when there is no cash, which is the same pattern as "It cost 0 fuel" but for money.
