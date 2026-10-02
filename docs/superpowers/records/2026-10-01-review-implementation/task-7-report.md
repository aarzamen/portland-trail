# Task 7 report: the journey interface as a projection of the engine

Status: DONE_WITH_CONCERNS (concerns are small and listed in section 7).

## 1. What I built, file by file

- `app/index.html` (rewritten): `viewport-fit=cover`; `<main id="app" tabindex="-1">`; a storage banner `#banner`
  (`role="alert"`); a toast region `#toasts`; `<dialog>`s `#event-dialog`, `#memorial-dialog`, `#confirm-dialog` and empty
  `#journal-dialog` and `#transfer-dialog` for Task 8; the footer stamp `#build-stamp` (fallback text `v0.2.0 · dev`); the
  brand link returns to the title (`data-key="home"`); `mobile-web-app-capable` added so Chrome logs no deprecation warning.
  Still references exactly `./src/styles.css` and `./src/main.js`.
- `app/src/main.js` (rewritten, the controller): keeps the journey, one `dispatch(action)` for every engine action and one
  `show(screen)` for every screen change; nothing global. After an action (spec 9.3): save → drive played from the previous
  state for 950 ms with the next scene (and a pending encounter's art) preloaded → draw → memorials for travelers who died in
  this action → the encounter (typed text, choices usable at once) → after a choice the result lines and "Keep going", then
  that choice's memorials. Refusals go to the open dialog's error line, else an amber toast. Toasts clear after 5 s, on the
  next action and on screen change. Banner holds storage problems (unreadable save, storage unavailable, save failed; the last
  one clears when a later save succeeds). B16 confirmation only for a journey in progress. Worker registered only in build
  mode, otherwise unregistered and `portland-trail-*` caches deleted; after `ready` it sends `cache-scenes` with absolute URLs
  for this device's variant and toasts "Ready to play offline" once per load. `storage` event refreshes the title. `sound.play`
  at drive, arrive, event, good, bad, buy, death, win, lose.
- `app/src/ui/storage.js`: `loadJourney`, `saveJourney`, `readRecords`, `writeRecords`, `readSettings`, `writeSettings`,
  `exportCode`, `importCode` (+ `PROBLEMS`, keys). One record `{ app, format: 2, game, ui: { lastLeg } }` under
  `the-portland-trail:save`; legacy `:v1` save and `:last-leg:v1` receipt (bound to the exact save text) migrated, legacy keys
  removed only after the new write succeeds; unreadable saves never touched. Export `PT2.` + base64url UTF-8; import takes the
  code, a record's JSON or a bare state.
- `app/src/ui/render.js`: `patchRegions` (replaces a region only when its HTML changed; focus returns to the same `data-key`,
  keeping a text field's selection, else to the fallback), `drawScreen`, `forget`.
- `app/src/ui/views.js`: `escapeHtml` (the one escaper), `formatNumber`, `signed`, `picture` (`<source>` 960 for
  `(max-width: 760px), (max-height: 500px) and (pointer: coarse)`), `stampText`, `supplyLabel`, `optionButton`, and the title,
  step 1 (radio cards, `describeAbility`, starting kit, Back to the title) and step 2 (name drafts, Shuffle, road choice as
  radio buttons Surprise me / Today's road / A seed of your own + seed field, Back, Pack the van).
- `app/src/ui/trip-views.js`: the fixed shell and one function per region with `data-region` = topline, scene, notes (polite
  live region), route (`data-mile`), leg, supplies (`data-list="supplies"`), crew (`data-list="crew"`, bars with `data-band`
  and the number, epitaph under the dead), actions (stop/road groups, or the shop, or the ending: heading, cause, survivors,
  Start another journey), settings (pace and rations from the engine labels), journal (last six lines). The scene holds the
  art or the road stage, stamp, heading, text, primary action and the forecast (today's miles/fuel/health, range, next fuel
  stop, warning when `shortfall.fuel > 0`); in the shop it also holds the Auto-buy plan so it is in the first viewport.
- `app/src/ui/dialogs.js`: `encounterDialog`, `memorialDialog`, `confirmDialog`.
- `app/src/ui/sound.js`: stub `play`, `setEnabled`, `isEnabled`.
- `app/src/styles.css`: additions only for the new components (regions layout, toasts, `aria-disabled` buttons, forecast,
  stepper, road choice, notes, health bands, memorial, ending, stamp); the old `:has(+ .auto-buy-preview)` rules became
  `.scene-shop`; supply names are no longer truncated; the footer stamp is no longer hidden on phones. Look otherwise unchanged.
- `app/manifest.webmanifest`: the 512 icon's purpose is `any`.
- Tests: `app/tests/support/browser.mjs` (launch with `PLAYWRIGHT_CHANNEL`, fixtures stored as the save record, `readGame`,
  `probeLayout`, reporter), four suites (section 3). Deleted the four old suites.

Every actionable control has `data-key` (engine option keys; shop `less:/qty:/more:/max:/buy:<id>`, `autoPurchase`,
`setPace`, `setRations`, setup keys). Blocked options are `aria-disabled="true"` rather than `disabled`: they stay focusable,
show their reason, and a click is answered by the engine's refusal (toast, or inside the encounter dialog — B1's "a refused
action redraws the dialog").

## 2. No rule logic in the interface

Labels, details, reasons, forecast, shop rows, Auto-buy plan, pace/ration labels, status labels and ending text come from
`availableActions`, `forecast`, `shopItems`, `recommendSupplies`, `paceOptions`, `rationOptions`, `statusOf`, `summarize`,
`weatherName`, `currentStop`, `nextStop`, `regionAt`. Where the interface needs "would this be accepted?" without an option
(Buy reason when `canBuy` is 0, Auto-buy enabled), it asks `transition` itself, which is pure. The health band ignoring
sickness is `statusOf({ health, sick: false }).id`. The stepper clamps to the engine's `canBuy`.

## 3. Suites and their checks (all from the brief)

- `browser-flow.mjs` (390/414/430/768/1440): title, arrow keys, Back to the title (B19), markup name stored verbatim and
  shown as text with no element, names survive Back/Continue (B13), focus and click select a name, Shuffle → five distinct pool
  names; own seed `kale` = `seedFromText('kale')`; stepper never past `canBuy` (+, typed value, − to 0); Buy adds the quantity;
  Max = `canBuy`; Auto-buy shows and buys the plan; Leave for Portland drives at once; reload + Resume = same saved state, route
  `data-mile`, encounter open only if pending. Plus: same seed + clicks twice → identical saves; Today's road = `dailySeed()`;
  record format; v2 legacy save + receipt migrated, legacy keys gone; three unreadable saves → banner, no Resume, untouched;
  throwing `setItem` → banner "could not save", play continues; refusal → one amber `role=alert` toast that does not follow to
  the title (B12); confirmation for a journey in progress, none after an ending (B16), ending heading/cause from `summarize`.
- `browser-encounters.mjs`: pending encounter opens on Resume with focus inside; Escape twice → open (B1); unmet need disabled
  with its reason; refused choice keeps dialog open with the reason; `only` choice per background; outcome lines + saved state
  already the result + Keep going closes (F1); memorial Carve (markup epitaph saved and shown as text) and Leave (default kept)
  (F2); typed text with motion, click completes, whole at once with reduced motion (L4); latest notes after talk and rest, polite;
  dry tank at a shop: Drive disabled with reason, shop offered, buy fuel, Drive works; dry tank on the road: three last resorts,
  push moves the van to the engine's mile (B2, F3).
- `browser-layout.mjs` (12 viewports × road, shop, encounter): no overflow, images loaded, controls ≥ 43.5px and 16px inputs
  below 1000px, primary action and trip numbers in the first viewport, Auto-buy in the first viewport on portrait phones, every
  encounter choice in the viewport, whole van inside the scene, `-960.webp` below 1000px wide, one crew list (5 members) and one
  supplies list (B11); route list stays open after an action (B10); drive with motion at 1440 and 390: playing, saved state
  already new (B7), top line unchanged, no ending region, counter animates, second click ignored; reduced motion: nothing
  animates, receipt shows `+N mi`; keyboard: Tab reaches every shop control, focus stays on + and on Buy after redraws, Enter on
  the primary action drives.
- `browser-offline.mjs` (dist): stamp regex and visible on a phone (F6); worker registers and controls after reload; "Ready to
  play offline" shown exactly once (MutationObserver count); offline reload → title, new journey, drive with the phone scene
  art loaded (F5); manifest type, standalone, scope, icons decode at declared sizes, Chrome `Page.getAppManifest` no errors,
  at the root and under `/games/portland/`; source registers no worker.

## 4. Command output

Failing first (old interface, `node scripts/test-browser.mjs offline encounters`): every case threw
`locator.waitFor: Timeout 30000ms exceeded.` (no `[data-key="start"]`); `browser-encounters: 8 checks, 8 failed`,
`browser-offline: 4 checks, 4 failed`, exit 1.

Passing (final, `cd app && npm run test:browser`):

```
browser-encounters: 46 checks, 0 failed.
browser-flow: 169 checks, 0 failed (widths 390/414/430/768/1440).
browser-layout: 249 checks, 0 failed (12 viewports).
browser-offline: 25 checks, 0 failed.
4 suites, 4 passed, 0 failed.
```

`cd app && npm test`: `# tests 205 # pass 205 # fail 0` (no warnings). Along the way: one run of the full runner caught the
encounter reopening late (rAF) — the dialog now reopens synchronously in its `close` handler and the test polls up to 2 s.

## 5. Screenshots looked at, and fixes

Scratch shots (390×664 and 1440×900): title, step 1, step 2, shop (viewport and full), road, stop (forest camp), encounter,
outcome, memorial, the road after a memorial; suite shots in `app/test-results/browser-layout/` (road/shop/encounter at all 12
sizes, looked at 756×352, 844×390, 1440×900, 320×568). Fixed after looking: Auto-buy below the fold at 320×568 (heading 20px
and the plan's subtitle hidden at ≤360px); primary button wrapping on desktop (full width of its column); stepper input
misaligned with its buttons; the build stamp hidden on phones by an old footer rule (now wraps instead).

## 6. Files changed

`app/index.html`, `app/manifest.webmanifest`, `app/src/main.js`, `app/src/styles.css`, `app/src/ui/{storage,render,views,
trip-views,dialogs,sound}.js`, `app/tests/support/browser.mjs`, `app/tests/browser-{flow,encounters,layout,offline}.mjs`;
deleted `app/tests/browser-{smoke,enhancements,iphone,icons}.mjs`.

## 7. Self-review, interpretations and concerns

1. The route list labels stops "Supplies / Rest stop / Destination / Explore" from `LOCATIONS[].activities` (map legend, as the
   old list did). It decides no action; if the reviewer reads requirement 1 strictly, an engine helper for stop kinds is needed.
2. Spec 8 says `index.html` preloads the typeface; I left the preload out because nothing uses the face yet and Chrome would
   warn "preloaded but not used". Task 9 should add it with the `@font-face`.
3. Layout: document order of regions is as spec 9.1; three wrappers (upper: scene, notes, route, leg; side: supplies, crew;
   lower: actions, settings, journal) give the desktop sidebar. Visually route sits above the latest notes (CSS `order`) so the
   trip numbers fit the first viewport on 375×548. On desktop the journal moved from the sidebar to the bottom of the main column.
4. "Ready to play offline" is once per page load, not once ever.
5. The drive (playback and receipt) covers `travel`; the receipt also records a `push`; a drizzle encounter extends the leg.
6. `styles.css` is not Prettier-formatted (the old file wasn't; my new rules are long single-line rules in its style) — left to
   Task 9/10. All JS/HTML/test files I own pass `prettier --check` and are ≤ 120 characters; `tsc` reports nothing in my files.
7. Test speed/timing: the typed-text check reads the text right after the dialog opens (~1.5 s typing window); robust here,
   but it is the one timing-sensitive check.
8. Task 3 was tuning `data.js` in parallel; all my tests read numbers through the engine and passed against its state at the
   time (HEAD b270f2c plus its later edits).

## Fix round 1

1. **Quantity typing (Important).** While a shop quantity field has focus, it keeps exactly what was typed
   (`quantityDraft` in main.js, drawn through `row.qtyText`). An empty field stays empty and digits stay as typed. Only a
   number past `canBuy` is replaced by `canBuy`, and that is written to the field directly, because the region's HTML can
   be unchanged (56 typed over 6). The draft ends only when focus has really left the field. A redraw that replaces the
   field and moves focus to its replacement also fires `focusout`; the first version cleared the draft there, which gave
   a flaky "0". Test (browser-flow, all five widths): click the food quantity, Backspace ×4 → `''`,
   `keyboard.type('12')` → `'12'`, Buy shows "Buy 12" and adds 12. Red against 396e480: `'0'`, then `'68'` (120
   clamped), save +68.
2. **Route without `activities` (Important).** New `routeStops(state)` in `app/src/engine/selectors.js`, exported from
   `app/src/engine.js`. It returns every stop with `id, name, shortName, miles, kind
   ('shop'|'rest'|'explore'|'destination'), passed, current`. The shop rule is now one helper (`sells`), shared with
   `stretchAhead` and `forecast`, which used to repeat it. The route list consumes `routeStops` (labels mapped in
   trip-views), and main.js no longer reads LOCATIONS for stops. New `app/tests/route.test.js` (5 tests):
   - order and names;
   - `kind === 'shop'` exactly where `availableActions` offers `openShop`;
   - rest, explore and destination agree with the offered actions;
   - passed and current follow the van;
   - the state is not changed.

   Red: "does not provide an export named 'routeStops'".
3. **Minors.**
   - A successful save clears every storage problem, so the "cannot be read" banner goes once a new journey is saved.
     Test: all three unreadable cases, banner hidden after packing the van.
   - A refused epitaph keeps its typed text and shows the reason. Test: carve "   " → dialog open, field still "   ",
     error visible. Red: the field was reset to the default.
   - Deaths are decided with `statusOf(member).id === 'dead'`.
   - main.js's own scene choice is gone. `sceneIdOf` in trip-views is the one choice, used by the scene, the road stage
     and the preload. `phoneArt()` in views replaces the repeated media query.
   - The `storage` event now also adopts the save's latest note and its problem (`adopt()`, shared with start-up).
4. **Minor tests.**
   - "Reported once" counts the sentence in the page text after two failed saves (=1).
   - An encounter closed by `dialog.close()` reopens while it is pending.
   - The typed-text check waits until typing has begun before reading. This settles concern 7 above.

Concern 1 above is resolved by item 2. Output:

```
cd app && npm test            # tests 210, pass 210, fail 0
cd app && npm run test:browser
browser-encounters: 50 checks, 0 failed.
browser-flow: 192 checks, 0 failed (widths 390/414/430/768/1440).
browser-layout: 249 checks, 0 failed (12 viewports).
browser-offline: 25 checks, 0 failed.
4 suites, 4 passed, 0 failed.
```

Files: `app/src/engine/selectors.js`, `app/src/engine.js`, `app/tests/route.test.js`, `app/src/main.js`,
`app/src/ui/trip-views.js`, `app/src/ui/views.js`, `app/tests/browser-flow.mjs`, `app/tests/browser-encounters.mjs`.
