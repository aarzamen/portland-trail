# The Portland Trail 0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every change from the October 1 code and architecture review: fix the defects, give the game real stakes, move rule knowledge into the engine, and add the features, look and tooling the review recommends.

**Architecture:** A pure rules engine (`app/src/engine/`) owns every rule and exposes read-only functions that tell the interface what can be done and what it costs. The interface (`app/src/main.js`, `app/src/ui/`) is a projection of the engine that redraws only the regions that changed. Assets are regenerated from preserved sources by one script; the build stamps and versions the output and a service worker makes it playable offline.

**Tech Stack:** HTML, CSS, native JavaScript modules, Node 22 built-in test runner, Playwright with installed Chrome, Python through `uv` for the asset script (Pillow, fontTools).

**Spec:** [Review implementation design](../specs/2026-10-01-review-implementation-design.md). Read the sections your task names before you start. The spec is the authority; this plan argues from it.

## Global Constraints

- Static, dependency-free runtime. The game must run from `app/` served as plain files, with no install step. Development tools (Playwright, Prettier, TypeScript) are development dependencies only.
- Node 22 or newer. Native ES modules. No transpiler and no bundler.
- App version `0.2.0`. Save version `3`.
- The engine has no browser globals and no I/O. It never mutates the state it is given.
- One rule lives in one place. The interface contains no rule logic: every button, label, reason, cost and forecast comes from the engine's read-only functions (spec section 5). Every tunable number lives in `app/src/data.js`; sentences that mention numbers are built from those numbers.
- Tests assert mechanisms against the constants exported by `data.js`, not against copies of their values, because the balance task retunes them.
- Interface text stays live text. Nothing is baked into images except decorative signs.
- Every interactive control is at least 44 by 44 CSS pixels below 1000px wide. Editable controls use at least 16px text. No text is smaller than 12px. No horizontal scrolling from 320px to 1440px.
- All motion stops under `prefers-reduced-motion: reduce`, and the same information is still shown.
- Source lines are at most 120 characters. Prettier settings: single quotes, semicolons, 2 spaces, `printWidth` 120, `arrowParens` "avoid". A final formatting pass runs in the last task; do not reformat files you do not own.
- Original evidence and artwork under `docs/handoff/` and `images/` are never modified. Files under `app/assets/` are derived copies and may be regenerated or replaced.
- Paths in documents are relative. No machine-specific absolute paths in code.
- Commit only files your task owns, by path: `git add -- <paths>` then `git commit -m "<message>" -- <paths>`. Never `git add -A`, never `git commit -a`. Other tasks are committing to the same branch at the same time; if Git reports `index.lock`, wait two seconds and retry. Do not push.
- Commit messages describe state. End every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Saves from versions 1 and 2 in every phase, including a pending encounter, an ended journey, and dead or sick travelers. A person who played yesterday expects Resume to work today. Tests: Task 1 (`save.test.js`), Task 7 (`browser-flow.mjs`, legacy key).
2. Browser storage that throws or is full, at start and in the middle of a journey. The game must stay playable and say so. Tests: Task 7 (`browser-flow.mjs`).
3. Impatient input: double clicks during the drive, Escape twice or the back gesture on an encounter, a click on a button that a redraw just replaced. Nothing may run twice or freeze. Tests: Task 7 (`browser-encounters.mjs`, `browser-layout.mjs`).
4. Empty resources in awkward places: a dry tank at a shop with cash, a dry tank with no cash, no food, the last traveler dying during a push or an encounter. The journey must continue or end cleanly. Tests: Task 1 (`rules.test.js`), Task 3 (`fuzz.test.js`), Task 7 (`browser-journey.mjs`).
5. Hostile or odd text: names with markup, 32 characters or emoji; epitaphs with markup; a pasted save code that is truncated or edited; a seed made of words. Nothing may be executed, and bad input is refused with a sentence. Tests: Task 1, Task 2 (`selectors.test.js`), Task 7 (`browser-flow.mjs`).

## Lanes

Three lanes share no files and run at the same time: rules (Tasks 1, 2, 3), assets (Tasks 4, 5) and tooling (Task 6). Tasks 7, 8, 9 and 10 follow in order. Each task lists the files it owns; touch nothing else.

---

### Task 1: Rules engine, version 3

**Files:**
- Rewrite: `app/src/data.js`, `app/src/engine.js`
- Create: `app/src/engine/random.js`, `app/src/engine/state.js`, `app/src/engine/actions.js`, `app/src/engine/events.js`, `app/src/engine/selectors.js`, `app/src/engine/save.js`
- Create: `app/tests/rules.test.js`, `app/tests/events.test.js`, `app/tests/shop.test.js`, `app/tests/save.test.js`
- Delete: `app/tests/engine.test.js`, `app/tests/routes.test.js`, `app/tests/supplies.test.js` (port every case that still applies)

**Read first:** spec sections 2, 3 (all), 4, 5 and 6. The current `app/src/engine.js` and `app/src/data.js` show the existing rules and wording; keep every string that the spec does not change.

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces, exported from `app/src/engine.js`: `createGame`, `transition`, `recommendSupplies`, `currentStop`, `lastStop`, `nextStop`, `regionAt`, `weatherName`, `seedFromText`, `dailySeed`, `serializeGame`, `deserializeGame`, `SAVE_VERSION`, with the exact signatures in spec section 5. From `app/src/data.js`: `DEFAULT_NAMES`, `NAME_POOL`, `PROFESSIONS`, `ITEMS`, `PACES`, `RATIONS`, `LOCATIONS`, `REGIONS`, `EVENTS`, `RULES`, `RANKS`, `DEATHS`, `ACTION_TEXT`.
- Task 2 adds `describe` to each entry of the action table and builds `availableActions` on the table's checks. Give every action in `actions.js` this shape so it can: `{ type, check(state, action) -> string | null, apply(next, action, ctx) -> void }`, in one exported table keyed by type. `transition` must be the only caller of `apply`, and it must call `check` first. Keep `check` free of side effects.

**Requirements:**

1. `data.js` holds all content and all numbers exactly as given in spec sections 3.2, 3.4, 3.6, 3.8, 3.9 and 3.10. Locations and encounters name a `scene` id (spec section 7), not an image path. Result sentences are templates with `{name}`-style slots filled by one small `fill(template, values)` helper; no sentence in the engine repeats a number that lives in data. `ACTION_TEXT` holds the label and detail templates for each action (Task 2 uses them): take the wording from this list.
   - travel: "Drive toward {stop}" / "Leave for Portland"; detail "{miles} miles today for {fuel} fuel."
   - rest on the road: "Rest by the road"; "+{heal} health each. Costs a day of food."
   - rest at a stop: the stop's `rest.label` or "Rest here"; "+{heal} health each and cures sickness. Costs a day of food." and, when paid, "Costs ${cost} and a day of food. +{heal} health each and cures sickness."
   - forage: "Forage"; "{min} to {max} food for a day and {damage} health each."
   - meal: the stop's `meal.label`; "${cost} for the crew. +{heal} health each, no day lost."
   - talk: "Talk to locals"; "Hear what this place offers. One conversation per stop."
   - openShop: "Visit the shop"; "Top up supplies before the next stretch."
   - leaveShop: "Back to {stop}"; ""
   - useItem ammo: "Scatter seed bombs"; "{min} to {max} food, right now."
   - useItem kombucha: "Share the kombucha"; "+{heal} health each and cures sickness."
   - sellNft: "Sell one NFT for ${resale}"; ""
   - push: "Push the van"; "{miles} miles for a day and {damage} health each."
   - hitchhike: "Send someone for fuel"; "A day's walk. Sometimes they come back with {fuel} fuel."
   - tradeLuggage: "Trade the roof luggage"; "{fuel} fuel from a passing collector. Once only."
2. Implement spec sections 3.3 to 3.8 exactly, including the order of steps in `passDay`, the order of random rolls each action consumes, and the journal sentences. The generator stays the current 32-bit LCG (`state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0`).
3. `transition` follows the gates in spec section 5, clones with `structuredClone`, and returns `{ state, error, notes }`. `notes` are the journal lines written by this action, found through `logged`.
4. `recommendSupplies` and `autoPurchase` follow spec section 5.
5. Saves follow spec section 6. `deserializeGame` must never throw.
6. No `depart` action exists. An empty tank never ends the journey.
7. Every refusal is a sentence a player can act on, and names things by their display names, never by internal ids (B15): "You have no seed bombs to use.", not "You have no ammo to use."
8. The stop and region helpers (`currentStop`, `lastStop`, `nextStop`, `regionAt`) live in `state.js`. In this task `selectors.js` holds only `recommendSupplies`.

**Tests to write** (Node test runner, `node:assert/strict`; build fixtures by spreading states returned by the engine, as the current tests do):

`app/tests/rules.test.js`
- A new game is version 3, in the starting shop at mile 0 on day 1, with five healthy travelers (`sick` false, `death` null, `epitaph` ''), the background's inventory, the given seed and `rng` equal to the seed. Two new games share no objects. Bad profession, names (count, empty, over 32 characters) and non-integer seeds throw.
- Driving from the starting shop works without any other action. One Steady day moves `PACES.normal.miles` and uses `ceil(miles / milesPerFuel)` fuel. From mile 80 the next Steady day moves 20 miles for 1 fuel (D4). Scenic covers the first 100 miles in 2 days.
- With fuel for only part of the day, the van drives `floor(fuel × milesPerFuel)` miles, ends at 0 fuel, and the journal has "The tank is dry."
- With a dry tank, `travel` is refused with the dry-tank sentence, returns the same state object, and the journey is not over, at a shop stop with cash and on the open road (B2).
- On arrival the last journal line is the arrival line and no "Drove" line was written for that action; on reaching mile 1000 the last line is the win line (B8).
- One day at each rations level and each pace changes health by exactly `RATIONS[r].health` plus the pace's `wear`, clamped to 0–100. Short food costs `RULES.starvationDamage`, empties the food and writes the shortage line.
- Heat lasts `RULES.heat.days` days, multiplies the food need, adds travel damage, then clears with "The weather clears." Drizzle caps Floor it at Steady's miles and heals (B5, F8).
- A sick traveler loses `RULES.sickDamage` each day. Kombucha and a rest at a stop cure; a roadside rest does not (F10).
- A traveler taken to 0 health gets `death` with the day, the mile and the cause, the cause's default epitaph, and the cause's journal line. The dead are not healed by rest, kombucha or a meal and are not hurt again (B6).
- `setEpitaph` works for a dead traveler while an encounter is pending and after the journey ended; it refuses a living traveler, empty text, 61 characters and control characters, and stores markup characters unchanged.
- The journey is lost only when the last traveler dies; afterwards every action but `setEpitaph` is refused with the ended sentence.
- Rest: roadside heals `RULES.roadRest.heal`; a stop heals its own number; the motel charges and refuses without cash; Mushroom Market refuses rest and forage (B3).
- Forage: over 200 seeds the yield is always inside the region's or the stop's range (plus the prepper bonus), a day passes, everyone loses `RULES.forage.damage`, at most one traveler becomes sick, and both outcomes occur in the sample.
- Meal: only at the food carts, once, costs `costEach × living`, passes no day, heals only the living.
- Talk: each of the six talking stops gives its reward once.
- Items: seed bombs yield inside `yield` and pass no day; kombucha heals and cures. A gain never lifts a value above the item's `max` and never lowers a value already above it.
- Abilities: each background's effect and cooldown; the Wi-Fi block; the barista's food cost; scout damage has cause `scout`.
- Last resorts: refused with fuel at 1 or more; `push` moves `min(RULES.push.miles, milesToNextStop)`, costs a day and `push.damage`, arrives at stops, and can win; `hitchhike` has a seed that succeeds and a seed that fails; `tradeLuggage` works once.
- `setPace` and `setRations` refuse `constructor`, `__proto__` and unknown ids.
- `transition` on a deep-frozen state never throws and never mutates it; a refusal returns the same object and no notes; an accepted action's `notes` equal the journal lines it added; `{ type: 'depart' }` is refused as invalid.
- Using seed bombs or kombucha with none in stock is refused with a sentence that contains the item's short name in lower case and not the raw id `ammo` (B15).
- `seedFromText('')` is 2166136261 and `seedFromText('a')` is 3826002220 (FNV-1a); `seedFromText('42')` is 42; `seedFromText('4294967297')` is 1; `seedFromText(' kale ')` equals `seedFromText('kale')`; `dailySeed` is equal for two times on the same local day and differs on the next day.

`app/tests/events.test.js`
- Every encounter has a unique id, a scene, a positive weight and an effect; choice ids are unique within an encounter.
- Table-driven: for every encounter and every choice, with the needed resources, resolving applies exactly the advertised change, taken from the encounter's own numbers.
- `only` choices are refused for other backgrounds; unmet `needs` are refused with a sentence that names what is missing; an `auto` encounter refuses a `choiceId`; a choice encounter refuses a missing or unknown one.
- A wrong token is refused; resolving twice is refused; a pending encounter blocks every other action except `setEpitaph`.
- Over 300 seeded journeys, an encounter is only ever rolled inside its `where` range, and every encounter without a range appears at least once.
- Drizzle on the road adds `RULES.drizzle.bonusMiles` with arrival and win handling and exactly one ending line; at a stop it adds fuel and keeps the phase.
- The outbreak: `kombucha` and `quarantine` kill nobody at full health; `quarantine` passes two days and cures; `push_on` hits the weakest traveler with `worstDamage` and makes every other survivor sick.
- Breakdown: a failed kick passes a day; the tow charges cash; the developer repairs with `repairCost` kits.
- A pending encounter survives a save round trip and then resolves once.

`app/tests/shop.test.js`
- Invalid carts (unknown item, negative, fractional, over 1000, nothing above 0), overspending and exceeding `max` are refused as a whole and leave the state untouched.
- The food carts charge their own food price.
- For every background, auto-buy at the start leaves at least the fuel and food the first stretch needs, keeps the reserve when it can, never buys NFTs or seed bombs, never exceeds `max`, and a second auto-buy is refused. Driving at the default settings then reaches the next shop without a dry tank.
- With little cash, auto-buy buys fuel for the stretch first, then food, never spends more than there is, and reports `complete: false`.
- `sellNft` works only in the shop and pays `resale`. `openShop` then `leaveShop` returns to the stop. `travel` works straight from a shop.

`app/tests/save.test.js`
- Fresh, mid-journey, pending-encounter, won and lost states round-trip to deep equality.
- Rejected with `null`: text that is not JSON, version 999, four travelers, negative fuel, `NaN`, an unknown profession, pace or rations, distance 1001, day 0.
- Repaired: a `location` phase away from any stop becomes `travel`; an unknown pending encounter is dropped; unknown ids in `talked` and `meals` are dropped; nobody alive in a running journey becomes a lost ending; a journal over the limit keeps its newest lines.
- Unknown fields are dropped; a missing `flags.meals` or `flags.luggageTraded` takes its default.
- Version 2 and version 1 fixtures, written as object literals in the old shape (with `locationId`, `shopReturn`, `status` and the weather text): the starting shop; the road with a pending encounter; a stop; a shop mid-route; a won ending; an ending lost to an empty tank; a party with one `Deceased` and one `Sick` traveler. Each migrates with its distance, day, inventory, journal and pending encounter intact.
- `serializeGame` throws on an invalid state. Inventory above `max` is kept.

**Steps:**

- [ ] Read the spec sections and the current engine, data and tests.
- [ ] Write `data.js` and the four test files. Run `cd app && npm test` and confirm the new tests fail because the engine modules do not exist yet.
- [ ] Implement `random.js`, `state.js`, `events.js`, `actions.js`, `selectors.js` (only `recommendSupplies` and the stop and region helpers in this task) and `save.js`; make `engine.js` re-export the public names.
- [ ] Run `cd app && npm test` until every test passes with no warnings in the output.
- [ ] Delete the three old test files after porting their still-valid cases.
- [ ] Commit: `git add -- app/src/data.js app/src/engine.js app/src/engine app/tests/rules.test.js app/tests/events.test.js app/tests/shop.test.js app/tests/save.test.js app/tests/engine.test.js app/tests/routes.test.js app/tests/supplies.test.js` and commit those paths with a message such as `feat: rules engine version 3 with data-driven encounters and tolerant saves`.

---

### Task 2: What the player can do: read-only engine functions

**Files:**
- Modify: `app/src/engine/actions.js`, `app/src/engine/selectors.js`, `app/src/engine.js`
- Create: `app/tests/selectors.test.js`

**Read first:** spec sections 2, 3.9, 3.10 and 5. Read `app/src/engine/actions.js` as Task 1 left it.

**Interfaces:**
- Consumes: Task 1's action table (`{ type, check, apply }` per action), `ACTION_TEXT`, and every export listed in Task 1.
- Produces, exported from `app/src/engine.js` with the shapes in spec section 5: `availableActions`, `forecast`, `statusOf`, `shopItems`, `paceOptions`, `rationOptions`, `summarize`, `shareText`, `describeAbility`, `describeItem`. Task 7 builds the whole interface on these and must not need any rule knowledge beyond them.

**Requirements:**

1. `availableActions(state)` enumerates candidate actions for the current context and asks each action's `check` whether it would be accepted. It never duplicates a condition that `check` already expresses. Listing rules, order, keys, groups and labels are in spec section 5. `detail` and `reason` are sentences with the real numbers; a reason is the sentence `check` returned.
2. `forecast`, `statusOf`, `shopItems`, `paceOptions`, `rationOptions`, `summarize`, `shareText`, `describeAbility` and `describeItem` follow spec sections 3.9 and 5. `forecast` must agree with what `travel` then does.
3. `summarize(state).heading` and `.cause` (B18). Won with five alive: "All five made it to Portland." Won with fewer: "{n} of five made it to Portland." Lost: heading "The road won this round."; cause is the last fallen traveler's death line followed by " near mile {distance}." For an unfinished journey both are ''.
4. `shareText(state)`, one line: "The Portland Trail: {profession name}, {reached Portland on day D | fell at mile M on day D}, {n} of 5 alive, ${money} ({rentDays} days of rent). {rank title}, score {score}. Seed {seed}." followed, for each fallen traveler, by " RIP {name}: “{epitaph}”".

**Tests to write** (`app/tests/selectors.test.js`):

- Agreement (A1). Drive 200 seeded journeys with a simple bot that picks a random enabled option each step. At every step, every enabled option is accepted by `transition`, and every disabled option is refused with exactly its `reason`. Also, for each of `rest`, `forage`, `meal`, `talk`, `openShop`, `leaveShop`, `ability`, `push`, `hitchhike`, `tradeLuggage` and `sellNft`: if `transition` accepts the bare action, an enabled option with that action exists.
- Content. In the starting shop the first option has key `travel`, group `primary` and label "Leave for Portland". At Mushroom Market there is no `rest` or `forage` option. On the road `rest` and `forage` are listed. The ability is listed at a stop and on the road. After talking, `talk` is listed disabled with its reason. At the motel without cash, `rest` is disabled and its reason names the cost. Last resorts appear only with a dry tank. For a pending encounter only its choices are listed; an `only` choice is absent for other backgrounds; an unmet need is disabled with a reason. After the end the list is empty.
- Details contain the numbers from data (for example the rest option's detail contains `String(heal)`), and no label, detail or reason contains `{`.
- `forecast`: `today` equals what `travel` then does; `range` equals `floor(fuel × milesPerFuel)`; from mile 0 at Steady the next stop is 100 miles away, 2 days and `ceil(80 / 20) + ceil(20 / 20)` fuel; `shortfall.fuel` is `max(0, nextShop.fuel − fuel)`.
- `statusOf`: dead, sick, and the three health bands at their boundaries.
- `shopItems`: the food carts' price, `owned`, `max`, and `canBuy = min(max − owned, floor(money / price))` floored at 0; an empty list outside the shop.
- `paceOptions` and `rationOptions`: three options each, the selected one flagged, labels containing the data numbers.
- `summarize`: the won formula and the lost formula from spec 3.9; every rank threshold; `fallen` carries the death line and the epitaph; heading and cause as in requirement 3. `shareText` contains the profession name, the day, the seed and each epitaph.
- `describeAbility` and `describeItem` contain the data numbers and no `{`.

**Steps:**

- [ ] Write `selectors.test.js`; run `cd app && npm test` and confirm it fails for the missing exports.
- [ ] Add `describe` to the action table, implement `availableActions` in `actions.js` and the rest in `selectors.js`; export from `engine.js`.
- [ ] Run `cd app && npm test` until every test passes with pristine output.
- [ ] Commit `app/src/engine/actions.js app/src/engine/selectors.js app/src/engine.js app/tests/selectors.test.js` by path with a message such as `feat: engine tells the interface what can be done and what it costs`.

---

### Task 3: Fuzz, bots and balance

**Files:**
- Create: `app/tests/fuzz.test.js`, `app/scripts/balance.mjs`, `app/tests/balance.test.js`, `docs/validation/2026-10-01-balance.md`
- Modify: `app/src/data.js` (only the numbers the spec marks (T))

**Read first:** spec sections 2, 3.2, 3.11 and 5. `docs/reviews/evidence/fuzz.mjs` and `docs/reviews/evidence/balance.mjs` are the earlier versions of these tools; they target the old engine and stay untouched.

**Interfaces:**
- Consumes: the whole engine API from Tasks 1 and 2.
- Produces: `npm test` now includes the fuzz and balance tests; `node app/scripts/balance.mjs [seeds]` prints the table; tuned numbers in `data.js`.

**Requirements:**

1. `fuzz.test.js`: 300 journeys of up to 400 random actions each from a fixed outer seed, mixing valid and malformed actions of every type in spec section 5. On a deep-frozen state `transition` never throws; a refusal returns the same object; every accepted state survives `deserializeGame(serializeGame(state))` to deep equality; distance and day never decrease; inventory is never negative or `NaN`; health stays in 0–100; the dead stay dead; `availableActions`, `forecast`, `summarize` and `recommendSupplies` never throw on any reached state. The test must finish in under 5 seconds.
2. `app/scripts/balance.mjs` exports `play(seed, profession, bot)` and `measure(seeds)` and, when run directly, prints one table per bot: wins, losses by last cause of death, mean day, mean survivors, mean score, mean cash, per background. The three bots are defined in spec section 3.11; they act only through `availableActions` and `transition`.
3. Tune the (T) numbers until the targets in spec section 3.11 hold over 2,000 seeds per background. Keep `slow.wear < normal.wear < fast.wear`, `bare.health < meager.health < filling.health`, and prices positive. Change as few numbers as you can and prefer changing damage and healing to changing prices.
4. `balance.test.js` runs 300 seeds per background and asserts wider bands so that ordinary variance does not fail it: never-shops wins at most 8%; autopilot wins 25–60%; careful wins at least 75% with at least 3.3 alive on average; backgrounds within 12 points of each other per bot. It prints the measured numbers with `t.diagnostic`. It must finish in under 20 seconds.
5. `docs/validation/2026-10-01-balance.md`: the final value of every (T) number, the 2,000-seed table, and one paragraph on what was changed from the starting values and why.

**Steps:**

- [ ] Write `fuzz.test.js`; run it; fix nothing in the engine yourself. If it finds an engine defect, stop and report it as DONE_WITH_CONCERNS with the failing seed and action.
- [ ] Write `balance.mjs` and print the table with the starting numbers.
- [ ] Tune, rerun, repeat until the targets hold. Rerun `cd app && npm test` after each change to `data.js`.
- [ ] Write `balance.test.js` and the validation note.
- [ ] Commit `app/tests/fuzz.test.js app/tests/balance.test.js app/scripts/balance.mjs app/src/data.js docs/validation/2026-10-01-balance.md` by path with a message such as `test: fuzz and balance harness; tune stakes to the stated targets`.

---

### Task 4: Portland Pixel typeface

**Files:**
- Create: `app/scripts/pixel-font.txt`, `app/scripts/pixelfont.py`, `app/assets/fonts/portland-pixel.woff2`

**Read first:** spec sections 2 and 7 (the typeface paragraph).

**Interfaces:**
- Consumes: nothing.
- Produces: the font file at `app/assets/fonts/portland-pixel.woff2`, family name "Portland Pixel", and the Python module `app/scripts/pixelfont.py` with these functions for Task 5:
  - `load_glyphs(path) -> dict[str, list[str]]`: character to eight rows of `#` and `.`.
  - `text_width(glyphs, text, scale=1) -> int`: pixels, with one blank column between glyphs.
  - `draw_text(image, xy, text, glyphs, scale, fill) -> None`: draws onto a Pillow image with square pixels of `scale` by `scale`, top-left at `xy`, no anti-aliasing.
  - `build_woff2(glyphs, out_path) -> None`.
  - Run directly (`uv run app/scripts/pixelfont.py`), it builds the font and writes specimen images to `app/test-results/font/`.

**Requirements:**

1. `pixelfont.py` starts with a PEP 723 block naming `fonttools`, `brotli` and `pillow`, so `uv run` needs no other setup. It uses only paths relative to its own location.
2. `pixel-font.txt` is the single source of truth. Format: a line `== X ==` naming the character (use `== space ==` for the space and `== U+2019 ==` style names for characters outside ASCII), then exactly eight rows of `#` and `.`, all the same width (1 to 7 columns). Rows 1–7 hold capitals and ascenders, lowercase bodies sit on rows 3–7, row 8 is for descenders.
3. Draw every printable ASCII character (32–126) and ‘ ’ “ ” – — … · ×. The face is proportional: narrow letters are narrow. It should read as one family: consistent stroke weight of one pixel, consistent x-height, round letters built the same way. Aim for a friendly handheld-console face, not a calculator display.
4. Font metrics: 100 units per pixel, 800 units per em, ascent 700, descent 100, line gap 0, advance of glyph width plus one pixel, space advance of 3 pixels. Each lit pixel is one square contour (or merge runs into rectangles); no overlaps that render with holes. Name table: family "Portland Pixel", style "Regular". Glyphs for the non-ASCII characters are mapped to their Unicode code points. The build is deterministic: the same glyph sheet gives the same bytes (fix the head table's created and modified times and save without recalculating timestamps).
5. Specimens in `app/test-results/font/`, rendered with `draw_text` on the game's ink background (`#07110a`) in paper (`#e1eacb`): the full character set at scale 2; and at scales 2, 3, 4 and 6 these lines: "The Portland Trail.", "Stock up before departure.", "Vehicle “Quirk” (Breakdown)", "DeFi Community Node (Gas Station Backroom)", "You made it to Portland.", "0123456789 $1,200 · 80 mi".
6. Look at every specimen. Fix glyphs that are ambiguous (I, l, 1; O, 0; S, 5; rn, m), uneven or ugly. Then render the built font file itself (for example with Pillow's `ImageFont.truetype` at 16, 24, 32 and 48 pixels) and confirm it matches the specimens and that pixels are square at those sizes.

**Steps:**

- [ ] Write the glyph file and the module; run `uv run app/scripts/pixelfont.py`.
- [ ] Inspect the specimens with the Read tool; revise glyphs until the lines above read cleanly at every scale.
- [ ] Confirm the font file loads, has every required character (list the cmap), and reports the metrics above.
- [ ] Commit `app/scripts/pixel-font.txt app/scripts/pixelfont.py app/assets/fonts/portland-pixel.woff2` by path with a message such as `feat: Portland Pixel display typeface built from a text glyph sheet`.

---

### Task 5: One asset pipeline, WebP scenes and sign repairs

**Files:**
- Rewrite: `app/scripts/prepare-assets.py`
- Delete: `app/scripts/prepare-generated-assets.mjs`, `app/scripts/prepare-mobile-art.mjs`, every `app/assets/*.jpg`, `app/assets/mobile/`, `app/assets/generated-manifest.json`, `app/assets/mobile-art-manifest.json`, `app/assets/mobile-images.json`, the old sprite PNGs at `app/assets/*.png`
- Create: `app/assets/scenes/*.webp`, `app/assets/sprites/*.png`, `app/assets/manifest.json` (new format); regenerate `app/assets/icons/*`

**Read first:** spec sections 2 and 7. The current `app/scripts/prepare-assets.py` holds the crop rectangles for the sprites and the first sixteen scenes.

**Interfaces:**
- Consumes: Task 4's `app/scripts/pixelfont.py` (`load_glyphs`, `text_width`, `draw_text`, `build_woff2`) and `app/scripts/pixel-font.txt`.
- Produces: `app/assets/scenes/<id>.webp` and `app/assets/scenes/<id>-960.webp` for the 27 scene ids in spec section 7; `app/assets/sprites/portrait-<profession>.png`, `app/assets/sprites/resource-<item>.png`, `app/assets/sprites/van.png`; `app/assets/icons/` with the current five file names and sizes; `app/assets/fonts/portland-pixel.woff2` (rebuilt through `build_woff2`); `app/assets/manifest.json`.

**Requirements:**

1. `prepare-assets.py` starts with a PEP 723 block (`pillow`, `fonttools`, `brotli`) and is run as `uv run app/scripts/prepare-assets.py` from the project root. It imports `pixelfont` from its own folder. It finds the project root from its own path. An optional `--only scenes|sprites|icons|font` limits the run.
2. Scenes follow the table in spec section 7: crop, then the sign repairs, then encode the full size (at most 1536 wide, never upscaled, quality 82, method 6) and the 960-wide copy (quality 78, method 6; a source narrower than 960 is not enlarged).
3. Sprites and icons use the same sources, rectangles, cell sizes and padding as the current script and `prepare-generated-assets.mjs` (icons 192, 512, 180, 32 and 16 from `docs/handoff/graphics-v2/app-icon.png`).
4. Sign repairs (spec section 7): find each sign's inner rectangle by looking at the cropped image, sample its fill colour and lettering colour from the image, paint the interior flat, and set the words with `draw_text` at a whole-number scale, centred. Keep each repair as data in the script: scene id, rectangle, fill, text lines, colour, scale. Compare before and after at full size and at 390px wide. If a repaired sign does not look native, remove that repair and report which one and why.
5. `app/assets/manifest.json`: `{ "version": 2, "tools": { "pillow": "<version>" }, "assets": [ { "file", "source", "source_sha256", "crop", "repairs", "width", "height", "bytes", "sha256" } ] }`, sorted by file, with a trailing newline.
6. Contact sheets of all scenes (before and after repairs for the three repaired ones) go to `app/test-results/assets/`. Nothing is written outside the project.
7. Running the script twice in a row produces identical files.
8. Originals under `images/` and `docs/handoff/` are read only; verify with `git status` that none changed.

**Steps:**

- [ ] Write the script; run it; inspect the contact sheets and each repaired sign with the Read tool.
- [ ] Remove the old files with `git rm`; confirm `app/assets/` holds only `scenes/`, `sprites/`, `icons/`, `fonts/` and `manifest.json`.
- [ ] Run the script again and confirm `git status` shows no further change.
- [ ] Report the total bytes of the old scene files (desktop and phone) against the new ones.
- [ ] Commit `app/scripts/prepare-assets.py app/scripts/prepare-generated-assets.mjs app/scripts/prepare-mobile-art.mjs app/assets` by path with a message such as `feat: one asset pipeline; WebP scenes, repaired signs, sprites and icons from preserved masters`.

---

### Task 6: Build stamp, offline support and repository tooling

**Files:**
- Rewrite: `app/scripts/build.mjs`, `app/scripts/serve.mjs`, `app/package.json`
- Create: `app/sw.js`, `app/src/build-info.js`, `app/scripts/checksums.mjs`, `app/scripts/test-browser.mjs`, `app/jsconfig.json`, `app/.prettierrc.json`, `app/.prettierignore`, `app/package-lock.json`, `.github/workflows/test.yml`, `app/tests/tooling.test.js`

**Read first:** spec sections 2 and 8.

**Interfaces:**
- Consumes: nothing from other tasks. `index.html` will reference exactly `./src/styles.css` and `./src/main.js`.
- Produces: `BUILD` from `app/src/build-info.js` with fields `version`, `sha`, `branch`, `date`, `dirty`, `mode`; the service worker message protocol (`{ type: 'cache-scenes', urls }` in, `{ type: 'scenes-cached', count }` out); `npm run` scripts `test`, `test:browser`, `build`, `start`, `dev`, `assets`, `balance`, `checksums`, `checksums:check`, `format`, `format:check`, `typecheck`; the environment variables `TEST_URL` and `TEST_DIST_URL` for browser suites.

**Requirements:**

1. `serve.mjs`, `build.mjs` and `sw.js` behave exactly as spec section 8 describes. `serve.mjs` keeps its localhost-only binding, its path checks, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and adds `Service-Worker-Allowed` nothing (the worker is served from the app root). With `PORT=0` it prints the URL with the port it was given.
2. `build.mjs` accepts `--out <dir>` (default `app/dist`) so tests can build into a temporary folder. The stamp's `date` is the commit date (`YYYY-MM-DD`), `dirty` is true when `git status --porcelain` is not empty, and without Git the stamp falls back to `sha: 'nogit'`.
3. Import rewriting covers static `import … from './x.js'`, bare `import './x.js'`, `export … from './x.js'` and dynamic `import('./x.js')` with relative specifiers, and leaves everything else alone.
4. `checksums.mjs` accepts `--root <dir>` (default: the project root found from its own path) and `--check`. With no Git repository at the root it walks the folder and skips `.git`, `node_modules`, `dist` and `test-results`.
5. `test-browser.mjs` runs the suites in name order, streams their output, and prints one summary line per suite. It passes through `PLAYWRIGHT_CHANNEL` (default `chrome`).
6. `package.json`: `"version": "0.2.0"`; `"assets": "uv run scripts/prepare-assets.py"`; `"balance": "node scripts/balance.mjs"`; `"format": "prettier --write ."`; `"format:check": "prettier --check ."`; `"typecheck": "tsc -p jsconfig.json"`. Install the development dependencies (`playwright`, `prettier`, `typescript`, `@types/node`) with `npm install --save-dev` so the lock file is real. `.prettierignore` excludes `dist`, `test-results`, `assets`, `node_modules` and `package-lock.json`. `jsconfig.json`: `checkJs`, `noEmit`, `target` and `module` suited to Node 22 and browsers, `strict` false, including `src` and `tests/*.test.js`.
7. `.github/workflows/test.yml` as in spec section 8, with `actions/checkout` and `actions/setup-node` at Node 22.
8. Do not run Prettier over files you do not own, and do not fix type errors in files you do not own. `npm run format:check` and `npm run typecheck` only need to run; Task 9 makes them pass.

**Tests to write** (`app/tests/tooling.test.js`, Node test runner, no installs needed, each using a temporary folder under `os.tmpdir()` that it removes):

- A build into a temporary folder contains `index.html`, `manifest.webmanifest`, `sw.js`, `src/build-info.js` and `assets/`; no `*.json` under `assets/`; `src/build-info.js` has `mode: 'build'`, the version from `package.json` and a `sha` equal to `git rev-parse --short HEAD`.
- In the built `index.html` the stylesheet and script references carry `?v=<sha>`; a fixture module with each of the four import forms is rewritten correctly and a non-relative specifier is left alone (export the rewriting function from `build.mjs` and test it directly).
- The built `sw.js` names the cache `portland-trail-<sha>-<digest>` and its precache list contains `./`, `./index.html`, `./src/main.js?v=<sha>` and no scene file.
- `serve.mjs` on `PORT=0`: `/src/build-info.js` answers with `mode: 'dev'`; `/sw.js` answers 200 with a JavaScript type; a `.webp` path answers `image/webp`; `/package.json` and `/../AGENTS.md` answer 404; POST answers 405.
- `checksums.mjs --root <fixture>` writes a sorted manifest that excludes itself; `--check` exits 0, then exits 1 after a fixture file changes, is added or is removed, naming the file.

**Steps:**

- [ ] Write `tooling.test.js`; run `cd app && node --test tests/tooling.test.js` and confirm it fails.
- [ ] Implement the scripts, the worker and the configuration files; run the test until it passes.
- [ ] Run `cd app && npm install --save-dev playwright prettier typescript` and confirm `node -e "require('playwright')"` works from `app/`.
- [ ] Run `cd app && npm run build` and `PORT=0 node scripts/serve.mjs --dist` once by hand; fetch `/` and `/sw.js`.
- [ ] Commit the files listed above by path with a message such as `feat: build stamp, versioned build, service worker, checksum and browser-test tooling, CI`.

---

### Task 7: The journey interface as a projection of the engine

**Files:**
- Rewrite: `app/index.html`, `app/src/main.js`
- Create: `app/src/ui/storage.js`, `app/src/ui/render.js`, `app/src/ui/views.js`, `app/src/ui/trip-views.js`, `app/src/ui/dialogs.js`, `app/src/ui/sound.js` (a stub, see Interfaces)
- Modify: `app/src/styles.css` (add what new components need to be usable; keep the current look; Task 9 owns the visual system), `app/manifest.webmanifest` (the 512 icon's purpose becomes `any`)
- Delete: `app/tests/browser-smoke.mjs`, `app/tests/browser-enhancements.mjs`, `app/tests/browser-iphone.mjs`, `app/tests/browser-icons.mjs`
- Create: `app/tests/support/browser.mjs`, `app/tests/browser-flow.mjs`, `app/tests/browser-encounters.mjs`, `app/tests/browser-layout.mjs`, `app/tests/browser-offline.mjs`

**Read first:** spec sections 2, 5, 6 (the interface record), 7 (asset paths), 8 (build stamp and worker) and 9. Read the current `app/src/main.js` and `app/src/styles.css` for the existing markup, class names and wording; keep both wherever the spec does not change them. The four old browser suites show how the fixtures and checks were written; carry their checks over.

**Interfaces:**
- Consumes: every engine export in spec section 5; `BUILD` from `app/src/build-info.js`; scene art at `./assets/scenes/<id>.webp` and `./assets/scenes/<id>-960.webp`; sprites at `./assets/sprites/…`; the worker protocol from spec section 8; `npm run test:browser`, `TEST_URL`, `TEST_DIST_URL`, `PLAYWRIGHT_CHANNEL`.
- Produces for Tasks 8 and 9:
  - The region structure of spec 9.1. Each region is a stable element with a `data-region` name: `topline`, `scene`, `notes`, `route`, `leg`, `supplies`, `crew`, `actions`, `settings`, `journal`.
  - Every actionable control carries `data-key` with the option's key. Health bars carry `data-band` (`good`, `worn`, `bad`, `dead`) and show the number. Toasts carry `data-tone` (`ok` or `error`). The route element carries the current mile as `data-mile`.
  - `storage.js` exports: `loadJourney() -> { game, lastLeg, problem }`, `saveJourney(game, lastLeg) -> boolean`, `readRecords()`, `writeRecords(list)`, `readSettings()`, `writeSettings(settings)`, `exportCode(game, lastLeg) -> string`, `importCode(text) -> { game, lastLeg } | null`. Task 8 uses the last four.
  - `dialogs.js` exports one function per dialog; each returns HTML for a `<dialog>` already in `index.html`. Task 8 adds the journal and transfer dialogs beside them.
  - `main.js` exposes nothing globally. It has one `dispatch(action)` path for every engine action and one `show(screen)` path for every screen change. The ending region in this task shows only the heading and cause from `summarize`, the survivors, and "Start another journey"; Task 8 replaces it.
  - `sound.js` exports `play(name)`, `setEnabled(on)` and `isEnabled()`, which do nothing yet. `main.js` calls `play` at these moments: `drive`, `arrive`, `event`, `good`, `bad`, `buy`, `death`, `win`, `lose`.

**Requirements:**

1. No rule logic in the interface. Buttons, labels, details, reasons, forecasts, shop rows, option labels, status labels and the ending text come from the engine functions. The interface never compares inventory to costs, never reads cooldowns, and never inspects `LOCATIONS[].activities` to decide what to show.
2. Drawing follows spec 9.1: a fixed shell, regions replaced only when their HTML changed, focus kept by `data-key`, one supplies list and one crew list, the route list's open state remembered.
3. Screens: the title (Start, Resume or View saved ending, the build stamp), step 1 and step 2 exactly as spec 9.2 describes (Back to the title, name drafts, select on focus, Shuffle names, the three road choices), the shop, the stop and the road with the forecast, and the footer with the build stamp.
4. After an action, follow spec 9.3 steps 1 to 6: save, drive drawn from the previous state (B7) with the next scene preloaded (E3), new journal lines in the latest-notes region, memorials (F2), the encounter with typed text (L4), and the outcome step (F1). The encounter dialog cannot be dismissed (B1).
5. Messages follow spec 9.4: the banner for storage problems, toasts for everything transient, cleared on screen change (B12, S4).
6. Storage follows spec section 6: one record under `the-portland-trail:save`, legacy migration, unreadable saves preserved, failures reported once in the banner while play continues.
7. Scene art: `<picture>` with the 960 file for `(max-width: 760px), (max-height: 500px) and (pointer: coarse)` and the full file otherwise.
8. All text that came from a save or from the player is escaped. Use one `escapeHtml`; never build HTML from unescaped state.
9. `index.html`: `viewport-fit=cover`; `<main>` keeps `tabindex="-1"` for screen changes; a banner region, a toast region, and `<dialog>` elements for the encounter, the memorial and the confirmation, plus empty ones with ids `journal-dialog` and `transfer-dialog` for Task 8.
10. Register the worker only when `BUILD.mode === 'build'`; otherwise unregister and clear caches (spec section 8). After the worker is ready, send it the scene URLs for this device's variant and show "Ready to play offline" once when it answers.
11. Keep the drive animation, the last-leg receipt, the atmosphere effects and the changed-value highlights working, driven by the new state shape.
12. Starting a new journey while one is in progress still asks for confirmation; once a journey has ended it does not (B16).

**Browser suites** (Playwright, `chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })`; each suite asserts, prints one summary line, writes a JSON report under `app/test-results/<suite>/`, and exits non-zero on failure; fixtures are states built with the engine and stored as the save record). `support/browser.mjs` holds the launch, the fixture loader, `readGame(page)` and the layout probe.

`browser-flow.mjs`, at widths 390, 414, 430, 768 and 1440:
- Title, background choice with arrow keys, Back to the title and forward again (B19).
- Names: a name containing `<img src=x onerror=alert(1)>` is stored verbatim and nothing executes; typed names survive Back and Continue (B13); focusing a field selects its text; Shuffle changes the names to five distinct pool names.
- Road: a seed of your own "kale" gives `seed === seedFromText('kale')`; Today's road gives `dailySeed()`; two journeys from the same seed and the same clicks reach the same saved state.
- Shop: the stepper never lets the quantity exceed `canBuy`; buying changes the saved inventory by the quantity; Max fills to `canBuy`; Auto-buy buys the shown plan.
- Leave for Portland drives at once; reload; Resume restores the same state.
- Storage: the record has the format in spec section 6; a version 2 save under the legacy key loads, appears under the new key and the legacy keys are gone; an unreadable save shows the banner, offers no Resume and is left untouched; with `Storage.prototype.setItem` throwing, play continues and the banner says so.
- A refusal shows an amber toast; the toast does not follow the player to another screen (B12).

`browser-encounters.mjs`:
- A pending encounter opens on Resume with focus inside it; Escape twice leaves it open or reopens it, and the encounter can still be resolved (B1); a choice with an unmet need is disabled and shows its reason; an `only` choice appears only for its background.
- After a choice the result lines are shown in the dialog with Keep going; the saved state already holds the result; Keep going closes the dialog (F1).
- A fixture where the choice kills a traveler shows the memorial; "Carve it" with custom text saves that epitaph; "Leave it" keeps the default (F2). An epitaph containing markup is shown as text.
- With motion allowed the encounter text types and a click completes it; with reduced motion the full text is there at once.
- The latest-notes region shows the new journal line after a talk and after a rest.
- A dry tank at a shop stop with cash never ends the journey: Drive is disabled with its reason, the shop is still offered, and after buying fuel Drive works. On the road with a dry tank the last resorts are offered and pushing moves the van (B2, F3).

`browser-layout.mjs`, at 320×568, 375×548, 390×664, 402×681, 414×715, 430×739, 440×763, 756×352, 844×390, 874×402, 1024×768 and 1440×900, on the road, in the shop and with an encounter open:
- No horizontal overflow; every image loaded; below 1000px wide every control is at least 43.5px in both directions and every `input` and `select` has at least 16px text.
- The primary action and the trip numbers are inside the first viewport on the road; Auto-buy is inside the first viewport in the shop at portrait phone sizes; every encounter choice is inside the viewport.
- The whole van is inside the scene. Phone sizes load the `-960.webp` scene.
- Exactly one element lists the crew and exactly one lists the supplies (B11). The route list stays open after an action (B10).
- With motion allowed, during the drive the page shows no ending region and the top line is unchanged, the distance counter animates, a second click does nothing, and the saved state is already the new one (B7). With reduced motion nothing animates and the receipt still shows the leg.
- Keyboard only: Tab reaches every control in the shop; Enter on the primary action drives; the focused element is the same control after a redraw.

`browser-offline.mjs`, against `TEST_DIST_URL`:
- The footer shows a stamp matching `^v\d+\.\d+\.\d+ · [0-9a-f]{7,}` (F6).
- The worker registers and controls the page after a reload; the scene message is answered; "Ready to play offline" is shown once.
- With the browser context offline, a reload shows the title, a new journey starts, and a drive completes with its scene art loaded (F5).
- The manifest parses in Chrome without errors, its icons decode at their declared sizes, and the game starts from a nested path (reuse the approach of the old `browser-icons.mjs`).
- Against `TEST_URL` (source): no worker is registered.

**Steps:**

- [ ] For quick looks while building, start a server for this checkout on its own port: `PORT=4174 node app/scripts/serve.mjs` in the background. Port 4173 belongs to another checkout; never use it.
- [ ] Write `support/browser.mjs` and the first cases of each suite; confirm they fail against the old interface.
- [ ] Build `storage.js`, `render.js`, the views, the dialogs and the controller; keep running the suites as each screen comes alive.
- [ ] Look at screenshots of the title, both setup steps, the shop, a stop, the road, an encounter, the outcome step and a memorial at 390×664 and 1440×900 with the Read tool, and fix what is broken or cramped.
- [ ] Run `cd app && npm test` and `cd app && npm run test:browser`; both must pass with pristine output.
- [ ] Commit the files listed above by path with a message such as `feat: journey interface projects the engine; regions, outcomes, memorials, forecast, offline`.

---

### Task 8: Endings, records, the whole journal and moving a journey

**Files:**
- Modify: `app/src/main.js`, `app/src/ui/views.js`, `app/src/ui/trip-views.js`, `app/src/ui/dialogs.js`, `app/src/styles.css` (only what the new parts need to be usable)
- Create: `app/tests/browser-journey.mjs`

**Read first:** spec sections 2, 3.9, 5 (`summarize`, `shareText`), 6 (records and the export code) and 9.2 (Title, Ending), 9.5. Read the interface as Task 7 left it.

**Interfaces:**
- Consumes: Task 7's regions, `dispatch`, `show`, `storage.js` (`readRecords`, `writeRecords`, `exportCode`, `importCode`), the empty `journal-dialog` and `transfer-dialog` elements, and the engine's `summarize`, `shareText` and `setEpitaph` action.
- Produces: the complete ending region; the journal and transfer dialogs; title extras. Task 9 styles them; keep the same hooks (`data-region`, `data-key`, `data-tone`).

**Requirements:**

1. Ending (F4, B18): heading and cause from `summarize`; miles, days and survivors; score, rank title and line; "Your ${money} covers {rentDays} days of Portland rent."; one headstone per fallen traveler with name, death line, epitaph and an Edit control that reopens the memorial dialog and saves through `setEpitaph`; Read the whole journal; Copy result, and Share where `navigator.share` exists, both using `shareText`; best journeys (top five by score: rank, score, background, day, survivors); the seed with "Replay this seed", which opens step 1 with that seed chosen in the road options; Start another journey.
2. Records: when a journey ends, store its summary once (key: seed, day, distance and score) and keep the ten best by score. Reloading an ended journey must not add it again.
3. Whole journal (E4): a dialog listing every stored line, newest first, grouped by day, opened from the journal region ("Read the whole journal") and from the ending.
4. Transfer (F13): from the title, "Move a journey between devices" opens a dialog with Copy save code and Download save file (when a journey exists), and a field to paste a code or the contents of a save file, with Load this journey. Loading replaces the current journey after a confirmation when one exists. A code that does not decode to a valid journey is refused with a toast and changes nothing.
5. Title: show the best score and its rank when records exist.
6. Multi-tab: when another tab changes the save (`storage` event), the title screen refreshes its Resume state.

**Browser suite** (`app/tests/browser-journey.mjs`, same conventions as Task 7's):

- A full winning journey through visible controls with the careful policy of spec 3.11, and a full losing journey that never shops and uses the last resorts, each from a fixed seed (choose seeds that produce the outcome with the tuned numbers and state them in the suite). The winning journey runs at 1440 wide, the losing one at 390.
- The ending shows the heading from `summarize`, the score, the rank, the days of rent and a headstone per fallen traveler; editing an epitaph on the ending changes the saved state and the headstone.
- The journal dialog lists every stored line.
- Copy result puts `shareText` on the clipboard (grant clipboard permissions to the context).
- The record is stored once, is still single after a reload and View saved ending, and the title shows the best score.
- "Replay this seed" opens step 1 with that seed selected, and the new journey's `seed` equals the old one. "Start another journey" goes to step 1 without a confirmation (B16). A new journey starts at mile 0 on day 1 with a healthy crew.
- Transfer: copy the save code, clear storage, reload, paste it, and Resume works with the same state; a truncated code is refused with a toast and nothing changes.

**Steps:**

- [ ] Write `browser-journey.mjs`; confirm it fails.
- [ ] Build the ending, the records, the journal dialog, the transfer dialog and the title extras.
- [ ] Look at screenshots of a won ending with fallen travelers, a lost ending, the journal dialog and the transfer dialog at 390×664 and 1440×900 with the Read tool, and fix what is broken or cramped.
- [ ] Run `cd app && npm test` and `cd app && npm run test:browser`; both must pass with pristine output.
- [ ] Commit the files listed above by path with a message such as `feat: scored endings with headstones and records, whole journal, journey transfer`.

---

### Task 9: Look, feel and sound

**Files:**
- Rewrite: `app/src/styles.css`
- Modify: `app/src/ui/sound.js` (implement), `app/index.html` (font preload, the sound toggle), and, only where the look needs markup, `app/src/ui/views.js`, `app/src/ui/trip-views.js`, `app/src/ui/dialogs.js`, `app/src/main.js`
- Create: `app/tests/browser-look.mjs`

**Read first:** spec sections 2, 9.5 (sound) and 10. Read `app/src/styles.css` and the views as Tasks 7 and 8 left them.

**Interfaces:**
- Consumes: the regions (`data-region`), `data-key`, `data-band`, `data-tone`, `data-mile`; `app/assets/fonts/portland-pixel.woff2` (family "Portland Pixel"); the sound hook (`play`, `setEnabled`, `isEnabled`); `readSettings` and `writeSettings` from `storage.js`.
- Produces: the finished look. The suites from Tasks 7 and 8 must still pass unchanged.

**Requirements:**

1. Tokens and scales as in spec section 10. One token block at the top; colours elsewhere come from tokens or `color-mix()`; at most 12 literal colours outside the token block. Font sizes in `rem` from the scale; nothing under 0.75rem; at most four letter-spacings.
2. `@font-face` for "Portland Pixel" with `font-display: swap`, preloaded from `index.html`. Use it for the title, scene headings, dialog titles and the score, only at whole multiples of 8px. Where a fluid size is wanted, step between multiples with media queries instead of `clamp()`. If the face reads worse than the system monospace at a given spot when you look at the screenshot, keep the system face there and say so in the report.
3. Health bars: phosphor, amber and rust by `data-band`, with the number visible; the dead are unmistakable in both colour and text.
4. Supplies: labels never truncated at any tested width; use the items' short names where space is tight.
5. Route map (L6): every stop marked; labels for at least the previous, current and next stop on phones and for every stop where they fit; shops marked with a small symbol and a text alternative; a small van at `data-mile` that travels during the drive; the full list still available.
6. Console touches (L4): scanlines over the scene at an opacity that does not muddy the art; a soft glow on the title; a blinking cursor after the latest note; styling for the typed encounter text. All of it stops under reduced motion.
7. Toasts: `data-tone="ok"` in the phosphor style, `data-tone="error"` in the amber style, above the safe area, never covering the primary action on phones.
8. Focus: the amber ring on every control, including the selected background card; none on `<main>` (B9).
9. Safe areas: masthead, page gutters, footer, toasts and dialogs respect `env(safe-area-inset-*)`.
10. Sound (L8): `sound.js` makes each named tone from Web Audio oscillators with short envelopes, quiet, created lazily after the first user gesture. A masthead toggle shows and announces its state (`aria-pressed`), starts off, and is remembered in the settings record.
11. Keep every layout guarantee of `browser-layout.mjs`. Text grows from the old 9–11px to at least 12px; make room by tightening spacing and the scene height inside the limits that suite checks, not by hiding information.
12. Endings, headstones, the journal and transfer dialogs, memorials and the outcome step get the same care as the main screens.

**Tests to write** (`app/tests/browser-look.mjs`):

- `document.fonts.check('32px "Portland Pixel"')` is true after load; the title and the scene heading compute to that family at a size divisible by 8.
- At 390×664 and 1440×900, on the road, in the shop, at the ending: no visible text node computes below 12px; supply labels have `scrollWidth <= clientWidth`.
- Health bars at 80, 50 and 20 health compute three different colours and show their numbers; a dead traveler's bar has `data-band="dead"`.
- The route van's horizontal position matches the mile within 2% of the track width, before and after a drive; the previous, current and next stop labels are visible at 390px.
- A success toast and a refusal toast compute different border colours and carry the right roles.
- The selected background card shows the amber outline when focused by keyboard; `<main>` has no outline after a screen change.
- The sound toggle starts with `aria-pressed="false"`, turns on, and stays on after a reload.
- With reduced motion there are no running animations on the road, in an encounter or after an arrival.
- The stylesheet has no `font-size` under 0.75rem or in `px` under 12, and at most 12 colour literals outside the token block (read the file in the test).
- Screenshots of the title, step 1, step 2, the shop, a stop, the road, an encounter, a memorial, a won ending and a lost ending at 390×664, 844×390 and 1440×900 are written to `app/test-results/look/` for review.

**Steps:**

- [ ] Start this checkout's server on port 4174 if it is not running.
- [ ] Write `browser-look.mjs`; confirm it fails.
- [ ] Rebuild the stylesheet on tokens and scales; add the typeface, the map, the bars, the console touches, the toasts and the sound.
- [ ] Look at every screenshot with the Read tool. Fix anything cramped, misaligned, low in contrast or out of character with a green handheld console. Repeat until the screens look deliberate.
- [ ] Run `cd app && npm test` and `cd app && npm run test:browser`; everything passes.
- [ ] Commit the files listed above by path with a message such as `feat: token-based look, Portland Pixel headings, route map, health bands, console touches and sound`.

---

### Task 10: Documentation, formatting, type check and checksums

**Files:**
- Modify: `PROJECT_SETUP.md`, `docs/handoff/README.md`, `docs/reviews/2026-10-01-code-and-architecture-review.md`, `docs/reviews/evidence/fuzz.mjs`, `docs/reviews/evidence/scenarios.mjs`, `docs/reviews/evidence/balance.mjs` (a header note only), `docs/handoff/LOCAL_IMAGE_REVIEW.md` (the integration paragraph), `.gitignore` if needed
- Create: `docs/validation/2026-10-01-review-implementation.md`, `docs/validation/review-implementation/` (screenshots)
- Format: every file under `app/` that Prettier covers
- Rewrite: `checksums.json`, `docs/handoff/checksums.json` (through the script)

**Read first:** the spec, the review, `PROJECT_SETUP.md`, `docs/handoff/README.md`, the existing validation records for their style, and `docs/validation/2026-10-01-balance.md`.

**Interfaces:**
- Consumes: everything earlier tasks produced.
- Produces: documents that describe the game as it now is, a formatted and type-checked tree, current checksum manifests.

**Requirements:**

1. `cd app && npm run format`; then `npm test` and `npm run test:browser` must still pass. Commit the formatting on its own.
2. `cd app && npm run typecheck` passes. Fix real errors in the source with JSDoc types and small code changes; do not silence with `@ts-ignore` unless a comment says why.
3. `PROJECT_SETUP.md`: current state, how to run, test (`npm test`, `npm run test:browser`), build, regenerate assets (`npm run assets`), refresh checksums, format and type-check; the development map with the new modules; offline and installed-app notes; what remains.
4. `docs/handoff/README.md`: update "Implemented behavior" and "Remaining work" to match; keep its preservation section.
5. `docs/validation/2026-10-01-review-implementation.md` in the style of the earlier records: what was delivered, the checks run with their real counts, the balance table (link to the balance note), screenshots from `app/test-results/look/` copied into `docs/validation/review-implementation/`, and limits stated honestly (no physical iPhone, no WebKit run, CI not yet run on GitHub).
6. The review document gets a "Status" section at the top: one table row per item id (B1–B19, D1–D7, A1–A7, E1–E6, S1–S6, L1–L8, F1–F13, T1–T6) with "Done" and where, or "Not done" and why (E6 and the partial L7, from the spec). The three evidence scripts get a first-line comment saying they reproduce the findings at commit `3e02b8a` and no longer run against the current engine.
7. `node app/scripts/checksums.mjs`, then `node app/scripts/checksums.mjs --check` exits 0.
8. Every relative link in the documents you touched resolves to a file that exists.

**Steps:**

- [ ] Format and commit (`style: format with Prettier`), listing the formatted paths.
- [ ] Type-check, fix, rerun the tests, commit.
- [ ] Write and update the documents; verify links with a small script.
- [ ] Refresh the checksum manifests last and commit them with the documents.
