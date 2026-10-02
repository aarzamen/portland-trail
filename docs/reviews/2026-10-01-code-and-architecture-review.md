# Code and architecture review

Reviewed October 1, 2026 at commit `3e02b8a` on `main`. Scope: everything under [app/](../../app/): rules, interface, styles, scripts and tests. The handoff evidence folders were read for context and were not reviewed. Return to [project setup](../../PROJECT_SETUP.md).

Line numbers refer to that commit. Function names are given as well, because line numbers move.

## Status

Updated October 2, 2026. Version 0.2.0 implements this review, following the [design spec](../superpowers/specs/2026-10-01-review-implementation-design.md); the [validation record](../validation/2026-10-01-review-implementation.md) lists the checks. Where a row says the change differs from the suggestion below, the spec's ruling applies. Everything after this section is the review as written at `3e02b8a`; its line links point at files that have since been rewritten, and the [evidence scripts](evidence/) run only against that commit.

| Id | Status | Where |
|---|---|---|
| B1 | Done | The encounter dialog reopens on `close` while an encounter is pending, and a refusal redraws it: [main.js](../../app/src/main.js). Escape twice is tested in `browser-encounters.mjs` |
| B2 | Done, differently | `depart` is gone and Drive sends `travel`, which refuses a dry tank. A dry tank never ends the journey: last resorts (push, walk for fuel, trade the luggage) replace the stranding, and the only loss is the death of the whole party (spec 3.4–3.5) |
| B3 | Done | Stop activities are enforced by the engine; stop rests heal more than the roadside (motel 30 for $45, camp 16): [data.js](../../app/src/data.js) `LOCATIONS`, [actions.js](../../app/src/engine/actions.js). The ability shows wherever the engine allows it |
| B4 | Done | Seed bombs cost $18 and yield 2–6 food at random |
| B5 | Done | Weather has an end day and clears in `passDay`: [state.js](../../app/src/engine/state.js) |
| B6 | Done | `hurt` records day, mile and cause, writes the death line and the default epitaph; a memorial dialog announces it |
| B7 | Done | The drive is drawn from the previous state until the 950 ms animation ends: [main.js](../../app/src/main.js) |
| B8 | Done | One journal line per drive: the win line, the arrival line or the mileage line, in that order of preference |
| B9 | Done | Selection is a border and shadow; the focus ring shows on every control; `#app` has no outline: [styles.css](../../app/src/styles.css) |
| B10 | Done | The route list's open state survives redraws (regions are patched, not rebuilt) |
| B11 | Done | One crew list and one supplies list, placed by CSS; the dead are crossed out with "Deceased" |
| B12 | Done | Toasts clear on every screen change |
| B13 | Done | Typed names survive Back and Continue; focus selects the text |
| B14 | Done | `statusOf` derives Deceased, Sick, Healthy, Worn down or Hanging on from health bands and the sick flag: [selectors.js](../../app/src/engine/selectors.js) |
| B15 | Done | Refusals use display names ("You have no seed bombs to use.") |
| B16 | Done | Start another journey skips the confirmation once a journey has ended |
| B17 | Done | Drive is offered in the shop; the other button reads "Back to {stop}" |
| B18 | Done, one residue | Heading and cause come from `summarize`; a loss reads "Journey over" with its cause; the trip numbers say where the journey ended. The won ending's line under the heading still reads "at least some of its passengers" when all five arrive ([trip-views.js](../../app/src/ui/trip-views.js) `sceneText`) |
| B19 | Done | Step 1 has Back to the title, and the brand returns to the title |
| D1 | Done | Health now matters: harsher heat, encounters every other day on average, sickness, rations. Autopilot wins 43.5–45.5% and loses a traveler in about 70% of journeys. Careful play wins every journey with all five alive; the ruling keeps that and puts the risk in the gap between careful and careless play ([balance](../validation/2026-10-01-balance.md)) |
| D2 | Done, as suggested | The outbreak is a critical choice: dose with kombucha, quarantine, or drive through it. No branch kills the whole party; its description changed only to "catches up with the van". The owner can restore the old tone in one entry of `data.js` |
| D3 | Done | Cash counts toward the score and days of Portland rent; four encounters have a response only one background can take. Backgrounds stay within 2 points of each other per bot |
| D4 | Done | Fuel follows miles (`ceil(miles / milesPerFuel)`), and the pace labels show miles, fuel and health per day |
| D5 | Done | The score rewards arriving before day 21 and penalises arriving after it |
| D6 | Done | Foraging costs 3 health each, and its yield depends on the region or stop; the prepper finds 4 more |
| D7 | Done, as a per-item limit | Each item has a maximum (food 100, fuel 40, others 5–6); purchases and gains respect it |
| A1 | Done | `availableActions(state)` lists every option with label, detail, enabled and reason, built from the same checks `transition` runs; an agreement test drives 200 journeys: [actions.js](../../app/src/engine/actions.js), [selectors.test.js](../../app/tests/selectors.test.js) |
| A2 | Done, one exception | Every tunable number is in [data.js](../../app/src/data.js), and sentences take numbers from slots; a test refuses spelled-out numbers. Number-free interface sentences stay as constants in `selectors.js` (`TEXT`) and `actions.js` (`NEED_TEXT`, `CONTINUE`), by ruling |
| A3 | Done | Encounters have weights and optional mile ranges; effects are functions looked up by id: [events.js](../../app/src/engine/events.js) |
| A4 | Done | Saves are rebuilt field by field with repairs instead of rejections; versions 1, 2 and 3 load: [save.js](../../app/src/engine/save.js) |
| A5 | Done | The game screen is a fixed set of regions replaced only when their HTML changed: [render.js](../../app/src/ui/render.js) |
| A6 | Done | Storage, rendering, views, dialogs and sound are separate modules in [app/src/ui/](../../app/src/ui/). `main.js` remains the controller (about 1,200 lines) |
| A7 | Done | One record `the-portland-trail:save` holds the game and the last leg; legacy keys migrate: [storage.js](../../app/src/ui/storage.js) |
| E1 | Done | Scenes are WebP: 54 files, 5.66 MB, from 13.9 MB of JPEG |
| E2 | Done | The 640px set is gone; phones get the 960px file, desktops the full one |
| E3 | Done | The next scene, and a pending encounter's art, are preloaded during the drive |
| E4 | Done | "Read the whole journal" opens every stored line grouped by day |
| E5 | Done | [checksums.mjs](../../app/scripts/checksums.mjs) writes both manifests and has `--check`; CI runs the check |
| E6 | Not done | Moving the archive needs a published GitHub release and a history rewrite to shrink the repository; both are outside what AGENTS.md allows. The owner decides |
| S1 | Done | Prettier at 120 columns over `app/`; `npm run format:check` passes |
| S2 | Done | `npm run typecheck` (TypeScript over JSDoc, `checkJs`) passes; the state and actions have JSDoc types |
| S3 | Done | Ten base colours in one token block, everything else derived with `color-mix()`; a rem type scale from 0.75rem; three letter-spacings |
| S4 | Done | Storage problems stay in the banner; everything else is a toast, phosphor for success and amber for refusals |
| S5 | Done | The save key is `the-portland-trail:save`; the old key is migrated and removed |
| S6 | Done, one small new case | The weather-alert fallback, the unused `sceneAlt` branch, the old route tooltips and the dead CSS are gone. The new route map's shop mark carries `title="Supplies"` inside a list with `pointer-events: none`, so that tooltip never shows; its `aria-label` carries the meaning ([trip-views.js](../../app/src/ui/trip-views.js) `SHOP_MARK`) |
| L1 | Done | Nothing below 12px; body 14px, controls 16px, all in rem |
| L2 | Done | Health bars are phosphor, amber or rust by band and show the number |
| L3 | Done | Supplies use short names and are never truncated (tested at 320, 390 and 1440) |
| L4 | Done | Scanlines, a glow on the title, typed encounter text and a blinking cursor; all stop under reduced motion |
| L5 | Done, differently | Portland Pixel, an original face drawn for this project ([pixel-font.txt](../../app/scripts/pixel-font.txt)), instead of downloading VT323 or Silkscreen |
| L6 | Done | A labelled route map with shop marks and a van that moves during the drive; the full list stays |
| L7 | Partly done | The title ("GLOBAL WARMING"), victory ("WHITE STAG", "POWELL'S BOOKS"), loss and breakdown signs are repaired. Garbled decorative lettering remains in the wifi, motel, nft, food-carts, free-box and rest-stop scenes; the motel's "VAC_NCY" was kept as a broken neon sign |
| L8 | Done | Generated tones for drive, arrival, encounter, results, purchase, death, win and loss, off by default, with a remembered toggle: [sound.js](../../app/src/ui/sound.js). Not yet heard on a device |
| F1 | Done | After a choice the dialog shows what happened with "Keep going"; new lines appear under the scene |
| F2 | Done | A memorial for each death with an editable epitaph; headstones on the ending |
| F3 | Done | The forecast shows today's miles, fuel and health, the range and the next fuel stop, with a warning when fuel falls short; last resorts replace the stranding |
| F4 | Done | Score, rank, days of rent, headstones, the whole journal, Copy result and Share, best journeys |
| F5 | Done | The built copy registers a service worker and plays offline: [sw.js](../../app/sw.js) |
| F6 | Done | The footer shows `v0.2.0 · <sha> · <branch> · <date>`, stamped by [build.mjs](../../app/scripts/build.mjs) and by the dev server |
| F7 | Done | A paid motel night, a free rest at the camp, a meal at the food carts, forage yields by region |
| F8 | Done | Heat lasts two days and raises food use and wear; drizzle lasts two days, heals a little and caps Floor it at Steady |
| F9 | Done | Five new encounters defined as data, with weights, mile ranges and background-only responses |
| F10 | Done | Sick travelers lose health daily until cured by kombucha or a rest at a stop |
| F11 | Done | Shuffle names from a pool of 24 |
| F12 | Done | Surprise me, Today's road (a daily seed) or a typed seed; the ending shows the seed with Replay this seed |
| F13 | Done | Move a journey between devices with a `PT2.` code or a save file |
| T1 | Done, not yet green on GitHub | [test.yml](../../.github/workflows/test.yml) runs the tests, the checksum check, Prettier and the type check. Its one run so far, on an intermediate `main`, stopped at the format check, since fixed; the final branch has not run there |
| T2 | Done | [fuzz.test.js](../../app/tests/fuzz.test.js) runs random journeys in every `npm test` |
| T3 | Done | Playwright is a development dependency with a lock file; the suites use installed Chrome |
| T4 | Done | One script, [prepare-assets.py](../../app/scripts/prepare-assets.py), with pinned dependencies through uv; no `sips`, no fixed temporary path |
| T5 | Done | The build adds `?v=<sha>` to every module and stylesheet URL and leaves the `*.json` manifests out of `dist` |
| T6 | Done in markup | `viewport-fit=cover` is set and safe-area paddings are active. The installed app has not been tried on a device |

## Summary

The rebuild stands on a sound base. The rules engine is a pure function with seeded randomness and strict, versioned saves, and it held up under stress: 410,364 random actions across 4,000 journeys produced no crash, no negative inventory, no revived traveler and no state that failed to save. Every existing test suite passes at this commit.

The problems are elsewhere:

1. Two defects can freeze a run or end it unfairly (B1, B2).
2. The game has almost no challenge. A bot that presses Auto-buy at every shop and Drive otherwise wins 94% of journeys with all five travelers alive, for every background. Every one of its losses is the pandemic encounter, which the player can neither avoid nor answer.
3. Much of the writing never reaches the player. Encounter results, conversations and deaths are recorded only in the journal, which on a phone sits about two and a half screens below the action.
4. The interface re-implements rules the engine already owns and repaints the whole page after every action. Both are manageable today; both make each new feature more expensive.

A recommended order of work closes this document.

## What was checked

| Check | Result |
|---|---|
| Rules tests, `npm test` | 35 of 35 pass |
| Browser suites in Chrome: smoke, enhancements, icons, iPhone viewports | 32 checks, 29 checks, pass, 388 of 388 |
| Random-action fuzz, [fuzz.mjs](evidence/fuzz.mjs) | 4,000 journeys, 410,364 actions, no problems |
| One reproduction per rules finding, [scenarios.mjs](evidence/scenarios.mjs) | every rules finding below reproduced |
| Balance simulation, [balance.mjs](evidence/balance.mjs) | 3,000 seeds for each of 4 backgrounds and 4 play styles |
| Live play in Chrome 152 at 1024×768 and 375×812 | every interface finding below reproduced |

Not checked: Safari on a physical iPhone, the installed home-screen app, the WebKit run of the iPhone suite (its temporary runtime was not present), and screen-reader output.

## Bugs

High means the defect can end or freeze a run unfairly. Medium means wrong or misleading game behavior. Low is polish.

### B1 (high). Pressing Escape twice dismisses an encounter and freezes the game

Where: the `cancel` listener at [main.js line 626](../../app/src/main.js#L626), and the error path of `stateAction` at [lines 126–130](../../app/src/main.js#L126-L130).

The dialog blocks Escape by cancelling the `cancel` event. Chrome honors that once. A second Escape with no click in between sends a `cancel` event that cannot be cancelled, and the dialog closes. The encounter is still pending, so every action answers “Resolve the current encounter first.” Nothing reopens the dialog, because a rejected action does not repaint. Reloading and choosing Resume recovers the run. Android's back gesture is routed through the same close mechanism; that path was not tested here. The existing browser test presses Escape once, which is why it passes.

Fix: listen for the dialog's `close` event and reopen it while `state.pendingEvent` exists. Also call `renderEventDialog()` from the error path of `stateAction`, so a dismissed encounter always returns. Add a test that presses Escape twice.

### B2 (high). An empty tank at a shop stop ends the run in two clicks

Where: `depart` at [engine.js lines 267–271](../../app/src/engine.js#L267-L271), the fuel check in `travel` at [lines 283–290](../../app/src/engine.js#L283-L290), and the stop's primary button at [main.js line 359](../../app/src/main.js#L359).

The engine protects a player who tries to drive away from a shop stop on an empty tank: “Not enough fuel. Visit the shop before leaving.” The interface never sends that action from a stop. Its primary button, “Keep driving”, sends `depart`, which checks nothing, costs nothing and removes the shop button. The next press of the primary button ends the game: “The van ran dry with no way to reach the next stop.” Reproduced in the live game at the motel with $900 in hand and a full-health crew. No warning appears at any point; the only sign is the fuel count reading 0.

Fix: have the stop's primary button send `travel`, which removes a click from every stop and puts the existing guard to work. Give `depart` the same fuel check so the rule lives in one place. Decide what happens when the player has no fuel and cannot afford any: that is a real stranding and should end the run at the stop with a message that says why.

### B3 (medium). Stop activity limits are bypassed, and rest stops do nothing special

Where: `rest` and `forage` at [engine.js lines 333 and 340](../../app/src/engine.js#L333-L340), and `can()` at [main.js line 420](../../app/src/main.js#L420).

Mushroom Market forbids resting and foraging. One press of “Keep driving” leaves the van at the same mile on the same day, where both are allowed. A rest at the Rest Stop heals exactly what a rest on the shoulder heals (6). The stop activity lists therefore change which buttons appear and nothing else. The reverse also happens: the engine allows the background ability at a stop, but the interface hides its button there because `can('ability')` looks for `ability` in the stop's activity list.

Fix: remove the free `depart` step (see B2), and make a stop's rest worth more than a roadside rest. Show the ability wherever the engine allows it.

### B4 (medium). Seed bombs are food at a quarter of the price

Where: [data.js lines 11 and 13](../../app/src/data.js#L11-L13), `useItem` at [engine.js lines 387–389](../../app/src/engine.js#L387-L389).

A $8 pack of seed bombs gives 8 food instantly, with no day spent and no health lost: $1 per food. Kale chips cost $4 per food. Auto-buy purchases the expensive one.

Fix: decide which is the premium food. Make seed bombs a gamble (for example 3 to 9 food), have them take time, or price them above kale chips per unit.

### B5 (medium). Weather never returns to Clear

Where: `resolveEvent` at [engine.js lines 226 and 236](../../app/src/engine.js#L226-L236).

A heatwave or drizzle encounter sets `state.weather` and nothing resets it. A heatwave on day 1 is still shown in the header, on the road sign and as a screen tint on day 13. The effect on health happens once.

Fix: reset the weather to Clear when the next day begins. That needs no change to the save format.

### B6 (medium). Travelers die without a word

Where: `hurt` at [engine.js lines 36–40](../../app/src/engine.js#L36-L40).

When a traveler's health reaches zero the journal records the cause of the damage and nothing about the death. “Foraged 9 food, at a cost of 7 health per survivor” is the only line when Kale dies foraging. There is no dialog either. The player finds a crossed-out name.

Fix: write a journal line at the moment of death and show it to the player. This is also the game's best opening for a joke (see F2).

### B7 (medium). The drive animation gives away its own ending

Where: `stateAction` at [main.js lines 158–162](../../app/src/main.js#L158-L162), `renderTrip` at [line 444](../../app/src/main.js#L444), the scene stamp at [line 346](../../app/src/main.js#L346).

The new state is painted when the 950 ms drive begins. A quarter of a second into the last leg the header already reads “Final record”, the panel below already says “The city is yours.”, and the scene stamp shows mile 1000 while the distance counter below it is still at 972. Arriving at a stop shows that stop's actions the same way.

Fix: keep the previous state in `playback` and paint from it until the animation ends. The save is already committed, so nothing is at risk.

### Low-severity defects

| Id | Defect | Where | Fix |
|---|---|---|---|
| B8 | Journal lines are out of order. “Traveled to mile 100.” is logged after “Arrived at Mosswood Mushroom Market.”, and “Traveled to mile 1000.” after “Portland at last.” The victory screen's top note is the mileage line. | `travel`, [engine.js 297–298](../../app/src/engine.js#L297-L298); the same happens in `good_weather` | Log the miles before the arrival, and skip the mileage line when a stop is reached |
| B9 | Keyboard focus cannot be seen on the selected background card: `.profession-card.is-selected` outranks `:focus-visible`. After each screen change a keyboard user gets a 3px amber outline around the whole page, because `<main>` is focused. | [styles.css 29 and 79](../../app/src/styles.css#L29), `focusScreen`, [main.js 509](../../app/src/main.js#L509) | Draw selection with a border or shadow, and add `main:focus { outline: none; }` |
| B10 | The “9 places along the way” list closes after every action. | `render`, [main.js 487](../../app/src/main.js#L487) | Remember the open state; see A5 |
| B11 | On phones the crew is shown twice, once under the supplies and again in the field journal (headings at 803px and 1,887px on a 375×812 screen). The compact copy does not cross out a dead traveler; the journal copy does. | [main.js 444–445](../../app/src/main.js#L444-L445), [styles.css 235 and 342](../../app/src/styles.css#L235) | Hide one copy on phones; share the deceased style |
| B12 | An error from an abandoned journey stays on the new journey's setup screens. | replace handler, [main.js 627–641](../../app/src/main.js#L627-L641), which never clears `flash` | Clear `flash` on every screen change |
| B13 | Names typed on step 2 are lost after Back and Continue. The first field takes focus but its text is not selected, so each default name must be deleted by hand. | `renderNamesSetup`, [main.js 279–285](../../app/src/main.js#L279-L285) | Keep a draft of the names; select the text on focus |
| B14 | Status labels contradict health. A traveler at 97 reads “Injured” after scouting, and one at 46 reads “Sick” while the rest read “Healthy”. Nothing in the rules reads Sick or Injured. | `hurt` and `heal`, [engine.js 36–46](../../app/src/engine.js#L36-L46) | Derive the label from health bands, or give status an effect (F10) |
| B15 | An error shows an internal id: “You have no ammo to use.” | [engine.js 382](../../app/src/engine.js#L382) | Use the item's display name |
| B16 | “Start another journey” on a finished game asks “Start over?” and offers “Keep playing”. | `startNewJourney`, [main.js 512–516](../../app/src/main.js#L512-L516) | Skip the confirmation once a journey has ended |
| B17 | “Return to the road” in a stop's shop returns to the stop. Three presses are needed to drive again. | [main.js 357](../../app/src/main.js#L357) | Rename it, or go straight to the road |
| B18 | Ending copy: the victory screen still lists “Next stop: Portland” and says “at least some of its passengers” when all five arrive. A loss is headed “Journey complete”, and its cause appears only in the journal. | `renderScene` and `renderTripStrip`, [main.js 331–334 and 368](../../app/src/main.js#L331-L334) | Write the ending from the outcome, the cause and the survivor count |
| B19 | The setup screens have no way back to the title or the saved journey. The brand link is labelled “home” but only scrolls up. | [index.html 23](../../app/index.html#L23) | Add Back on step 1 |

## Balance and game design

Measured with [balance.mjs](evidence/balance.mjs). The figures are the same to within 0.1 point for all four backgrounds.

| Play style | Won | Lost to the pandemic | Ran out of fuel | Party died | Alive at the finish |
|---|---:|---:|---:|---:|---:|
| Never shops | 0% | 2% | 98% | 0% | none |
| Presses Auto-buy at every shop, never rests | 93.7% | 6.3% | 0% | 0% | 5.00 of 5 |
| Auto-buy, rests when weak, uses the ability | 93.7% | 6.3% | 0% | 0% | 5.00 of 5 |
| Scenic pace, seed-bomb food, rests | 91.2% | 8.8% | 0% | 0% | 5.00 of 5 |

- **D1. Fuel is the only resource that matters.** Once fuel is bought, nothing threatens the crew. In 36,000 supplied journeys no traveler died of anything but the pandemic. Even the bot that never rests never saw a living traveler fall below 14 health. A Steady journey has about 16 driving days and four encounters, which is too little damage to matter. Kombucha, resting, rations and the barista's ability have nothing to do.
- **D2. The only way a supplied party loses is a roll the player cannot answer.** The pandemic is 1.8% of encounters, 0.45% per driving day, and ends 6.3% of Steady journeys. Scenic drivers spend more days on the road and lose 8.8%, so the careful pace is the dangerous one. The handoff asks that the pandemic joke be reviewed with you before its tone changes, so this is your decision. The suggestion is to keep the joke and make it answerable: kombucha in stock saves the crew, or it takes one traveler instead of five.
- **D3. The four backgrounds change the leftover cash and nothing else in the results.** Winners finish with $240 to $1,352 unspent, and cash has no use at the end.
- **D4. Fuel is charged per day, not per mile.** The first 100 miles cost 4 fuel at Scenic, 8 at Steady and 7 at Floor it, taking 2, 2 and 1 days. The default pace is the worst of the three on every 100-mile leg, and the pace menu gives no hint of it.
- **D5. Days cost nothing.** There is no deadline and no score. A rest day restores 30 health across the crew for 2.5 food.
- **D6. Foraging is a trap.** It costs a day and 7 health each for 8 to 12 food, which is one or two packs of seed bombs.
- **D7. “Buy what the van can carry”, yet the van has no capacity.**

A balance pass should set targets first. For example: careless play wins about 40%, careful play about 80%, and no journey ends on a roll the player could not influence. `balance.mjs` can then serve as the yardstick after each change.

## Architecture

What to keep:

- `transition(state, action)` returns a new state or an error and touches nothing else. The interface never edits state.
- The random-number state is saved, so reloading cannot re-roll an encounter.
- Saves are validated field by field. Unreadable saves are kept, not overwritten silently.
- Ids are stable. There are no runtime dependencies, and the source runs in the browser exactly as written.
- Text is escaped consistently. Every interpolation in `main.js` was read; none inserts unescaped save data.

What to change:

- **A1. Rules live in two places.** The engine can say whether an action is legal only by being asked to perform it. So `main.js` works out for itself which buttons to show and why: ability cooldowns and blockers ([lines 424–427](../../app/src/main.js#L424-L427)), repair cost and NFT requirements ([466–470](../../app/src/main.js#L466-L470)), stop activities ([420](../../app/src/main.js#L420)) and affordability. B2 and B3 both come from the two copies disagreeing. Add read-only questions to the engine, such as `availableActions(state)` returning each action with a label, whether it is enabled, the reason if not, and its cost. The interface then draws that list, and the list can be tested in Node without a browser.
- **A2. The same number is written in several places.** The repair cost `dev ? 1 : 2` appears three times, the cooldown `barista ? 1 : 4` twice, the resource id list three times, and the $50 NFT price in the rules, a button label and an item description. Ability descriptions in `data.js` are prose that repeats numbers hard-coded in `engine.js`. This is how the original app's descriptions drifted from its behavior ([findings](../handoff/findings.json) F12 and F18). Put every tunable number in `data.js` and build the sentences from the numbers.
- **A3. The event table is positional.** `EVENTS[8]` and `% 8` at [engine.js line 102](../../app/src/engine.js#L102) assume nine events in a fixed order. A tenth event would never fire, and reordering the list would silently change which event is the fatal one. Give each event a `weight` and select by weight. Move each event's effect out of the long `switch` in `resolveEvent` into a function looked up by id; the save still stores only the id.
- **A4. Saves are welded to today's content.** `validState` demands exact keys and checks the stop against the current route, so adding a stop, a flag or a field makes every existing save unreadable until a version bump and a hand-written migration are added. That has already happened once. Derive what can be derived (the current stop from the distance, Deceased from zero health) and keep versions for real format changes.
- **A5. The whole page is rebuilt after every action.** Speed is not the issue: an action takes 2.1 ms from click to rebuilt page (309 elements, 16 images). The cost is the side effects, each patched separately: `returnFocus` to restore focus, a 2.4-second timer to stop highlights replaying, B7 and B10. Split the screen into fixed regions (scene, trip, supplies, crew, actions, journal) and replace a region only when its HTML changed. That is roughly 30 lines and needs no library.
- **A6. `main.js` is one 646-line file** holding storage, 21 templates, animation and event wiring around 11 changeable module-level variables. Split it into storage, views and wiring when A1 is done.
- **A7. The save is written twice.** The leg receipt stores a full copy of the save beside it to prove they match: 9.1 KB plus 10.1 KB per action on a long journey ([main.js line 112](../../app/src/main.js#L112)). Store one record with the game and the receipt inside it.

## Inefficiencies

- **E1. Images are nearly all of the download.** The 24 desktop scenes total 7.54 MB as JPEG and the 24 phone scenes 4.24 MB. Re-encoded as WebP at quality 80 they measure 2.96 MB and 1.75 MB, about 60% smaller. The code is 117 KB, or 31 KB compressed.
- **E2. The 640px phone variants are rarely used.** A 390px-wide iPhone at 2× or 3× asks for 732 to 1,098 pixels and receives the 960px file. The 640px set is 2.11 MB.
- **E3. Scenes are fetched when first shown.** The art appeared after the text on a first visit even from the local server. Preload the next stop's scene during the drive.
- **E4. The journal keeps 120 entries and shows 6.** There is no way to read the rest.
- **E5. `checksums.json` lists 282 files and is maintained by hand.** No script writes it and no test checks it. Add a script with a check mode, or retire it: Git already records a hash for every file.
- **E6. The repository carries the 14 MB handoff archive beside its unpacked contents.** `.git` is 74 MB. A GitHub release is a better home for the archive.

## Code style

- **S1. Line length.** `main.js` has 67 lines over 160 characters, the longest 563. `engine.js` has 16, `styles.css` 37. Changes to such lines are hard to read in a diff. A formatter such as Prettier fixes this in one commit.
- **S2. No linter and no type checking.** `// @ts-check` with JSDoc types for the state and the actions would catch misspelled fields between the engine and the interface without adding a build step.
- **S3. The stylesheet has 9 color tokens and 159 distinct color values,** 143 of them used once. It has 20 font sizes, all in pixels, and 13 letter-spacings. Define a short scale for each and derive tints from the tokens.
- **S4. One box announces everything.** “Packed 4 fuel…” and “Not enough fuel” share the amber `role="alert"` box at the top of the page. Give success its own quieter style and place messages beside the control that caused them.
- **S5. Names that mislead.** The storage key `the-portland-trail:v1` holds version 2 saves.
- **S6. Dead code.** The “Weather alert” fallback art ([main.js line 474](../../app/src/main.js#L474) and its styles), a branch of `sceneAlt` whose result is never used, and tooltips on route markers that cannot receive the pointer.

## Look and feel

What works: the title screen, the palette, the pixel illustrations, the road stage with its sign and van, and the encounter dialog. The identity asked for in the brief is there.

- **L1. Type is too small.** 83 of 143 font-size declarations are 11px or less. Raise the floor to 12 or 13px and use `rem` so the reader's browser setting is respected.
- **L2. Health bars are one green at every level.** Shift to amber and then rust as health falls, and show the number.
- **L3. Supply labels are cut off** in the sidebar at 1024px (“Seed bom…”, “Repair s…”). Shorten the labels or use one column.
- **L4. Lean into the handheld-console idea.** Faint scanlines over the scene, a soft glow on the title, encounter text that types itself out, a blinking cursor after the latest note. Each must switch off under reduced motion.
- **L5. A display face for headings.** A self-hosted pixel typeface under an open licence (VT323, Silkscreen and Departure Mono are candidates) for the title and scene headings, with the system monospace kept for body text. Self-hosting keeps the no-remote-fonts rule.
- **L6. Make the route a map.** Label the stops, mark shops, and move a small van along the track.
- **L7. Baked lettering.** “GLOBL WARMING”, “POWELLL'S BOOKS”, “VAC_NCY” and the loss sign are generator artifacts. The handoff already lists this. The title sign is the most visible.
- **L8. Sound.** A few generated chiptune blips for drive, encounter, purchase and death would add a great deal for no download. Off by default, with a toggle.

## Features worth adding

Ordered by value for effort.

1. **F1. Show what happened.** After a choice, keep the dialog open and show the result line with a “Keep going” button. Show the latest note under the scene on phones. This single change delivers the jokes that are already written.
2. **F2. Deaths with epitaphs.** Announce each death, let the player write or accept an epitaph, and list the headstones on the ending screen.
3. **F3. A fuel range gauge.** “Range 120 miles at this pace. Next fuel in 250.” Add funny last resorts before a stranding ends the run: push the van, hitchhike for a canister, sell the roof luggage.
4. **F4. An ending worth reaching.** A score (for instance, months of Portland rent the leftover cash covers), the full journal, best runs, and a result that can be copied and shared.
5. **F5. Offline play.** A small service worker would let the installed game run with no signal, which suits a road-trip game. Today it needs the server.
6. **F6. A visible build stamp.** Your standing rule for app projects asks for version, commit, branch and build date on screen. The footer is the natural place and `scripts/build.mjs` the natural stamper. Nothing shows a version today.
7. **F7. Stops that matter.** A paid motel night that heals far more than the shoulder, a free rest at the camp, a meal at the food carts, forage yields that differ by region.
8. **F8. Weather that lasts and has effects.** A few days of heat that raise food use, drizzle that slows Floor it.
9. **F9. More encounters, defined as data** with weights, regions and requirements, including options only one background can take.
10. **F10. Conditions with consequences.** Sick travelers lose health daily until rested or given kombucha.
11. **F11. Name shuffle** from a pool of Portland-flavored names.
12. **F12. Seeds.** Show the seed, replay it, and offer a daily seed so friends can compare.
13. **F13. Save export and import,** to move a journey between phones.

## Tooling and repository

- **T1.** Run `npm test` on every push with GitHub Actions. The rules tests need no install.
- **T2.** Add `fuzz.mjs` to the test run. The full 4,000 journeys take about six seconds; a few hundred are enough for every push.
- **T3.** The browser suites load Playwright from another tool's cache folder. Make it a development dependency of the project.
- **T4.** The asset pipeline is three scripts in two languages. One needs Pillow and writes a preview to a fixed temporary path; two need macOS `sips`. Fold them into one script.
- **T5.** `build.mjs` copies files under fixed names. Once hosted, a returning browser can mix a new `main.js` with a cached `engine.js`. Add a version to the file names or query strings, and leave the four provenance manifests out of `dist`.
- **T6.** The installed home-screen app has not been tested. The stylesheet pads for the notch with `env(safe-area-inset-…)` on six lines, but the viewport tag in `index.html` never sets `viewport-fit=cover`, which is what gives those values meaning in Safari. One of the two is wrong, and the installed app with its translucent status bar is where it would show.

## Suggested order of work

1. Fix B1 and B2 and add a test for each. Both are small.
2. Build F1 and F2. They change how the game feels more than anything else here.
3. Clear the low-severity table in one pass.
4. Do A1 to A3 before adding content, so new stops and encounters are data and one rule lives in one place.
5. Run a balance pass against stated targets, using `balance.mjs`.
6. Add the build stamp, offline play and WebP images before hosting.

## Reproduce

Run from the project root of a checkout at commit `3e02b8a` (for example `git worktree add ../portland-trail-3e02b8a 3e02b8a`); the scripts no longer run against the 0.2 engine. Node 22 is enough; nothing needs installing. The balance run takes about 40 seconds.

```bash
cd "/Users/ama/The Portland Trail"
node docs/reviews/evidence/fuzz.mjs
node docs/reviews/evidence/scenarios.mjs
node docs/reviews/evidence/balance.mjs 3000
```

Interface findings were reproduced by hand in the local game. B1: resume a journey with an encounter open and press Escape twice. B2: arrive at a shop stop with no fuel and press the primary button twice.
