# Task 1 report: rules engine, version 3

**Status: DONE_WITH_CONCERNS.** Everything in the brief is implemented, tested and committed. The concerns are not doubts about correctness: they are the places where I had to interpret the brief or the spec (section 6 below), and five things later tasks need to know (section 7).

## 1. Commits

| SHA | Subject |
|---|---|
| `b97dd5b` | feat: rules engine version 3 with data-driven encounters and tolerant saves |
| `f2aed74` | test: rules tests guard the game data and hold under retuned outbreak and repair numbers |
| `f8b33b8` | test: rules, encounter, shop and save tests hold when the balance numbers are retuned |
| `d04b7c2` | fix: transition refuses a state that is not a version 3 journey instead of failing on it |

All four were committed by path and contain only files this task owns. Nothing was pushed.

## 2. What I implemented, file by file

**`app/src/data.js` (rewritten).** All content and every number. `RULES`, `PACES`, `RATIONS`, `ITEMS`, `PROFESSIONS` (each with a structured `ability`), `LOCATIONS` (with `scene`, and `rest`, `forage`, `meal`, `talk`, `prices` where a stop has them), `REGIONS`, the fourteen `EVENTS`, `DEATHS`, `RANKS`, `NAME_POOL`, `DEFAULT_NAMES` and `ACTION_TEXT` hold the spec's values verbatim. I checked this with a script that reads the spec's tables, the `RULES` code block, every quoted encounter sentence and every `{name: value}` number, and compares them with the module's exports: 405 comparisons, all equal. Five exports are additions (see 6.9): `JOURNAL` and `REFUSALS` (every sentence the engine writes or refuses with, as templates), `WEATHER` (display names), `LIMITS` (`name: 32, epitaph: 60, order: 1000`) and `MONEY` (`label: 'Cash'`).

**`app/src/engine.js` (rewritten).** The facade. It re-exports `createGame`, `transition`, `recommendSupplies`, `currentStop`, `lastStop`, `nextStop`, `regionAt`, `weatherName`, `seedFromText`, `dailySeed`, `serializeGame`, `deserializeGame` and `SAVE_VERSION`.

**`app/src/engine/random.js`.** The 32-bit LCG (`roll`), `rollBetween`, `pick`, `pickWeighted`, `seedFromText` (digits modulo 2^32, otherwise FNV-1a over the trimmed UTF-8 text) and `dailySeed` (local date).

**`app/src/engine/state.js`.** The `State` and `Traveler` typedefs, `createGame`, the journal (`log`, `say`), `fill` (the one template helper: `{slot}` and `{one|many}`), `living`, `hurt` (the single place health is lost: death record, default epitaph, journal line), `healAll`, `cure`, `gain` and `spend` (item maximums, two-decimal food), the stop and region helpers, `weatherOn`, `weatherName`, `passDay` (the eight steps of spec 3.3 in order), `finish`, `drivePlan` (miles and fuel for the next drive) and `moveVan` (one journal line by preference: win, arrival, or the road line).

**`app/src/engine/events.js`.** `rollEncounter` (one roll against the chance, one weighted pick among encounters whose `where` contains the mile reached), `choicesFor` (hides `only` choices from other backgrounds), `needsOf`, `checkResolve`, `resolve`, and `EFFECTS`: one function per automatic encounter and one per response, looked up by id.

**`app/src/engine/actions.js`.** `ACTIONS`, the table keyed by type, each entry `{ type, check, apply }` for the nineteen actions of spec section 5. `refusalFor(state, action)` runs the gates and then the action's `check`; `transition` calls it, clones with `structuredClone`, calls `apply`, checks for the end of the journey and returns `{ state, error, notes }`. `transition` is the only caller of `apply`. `restHere`, `forageHere` and `mealHere` answer "what would this do here" for both `check` and `apply`.

**`app/src/engine/selectors.js`.** `recommendSupplies` only, with two private helpers (`legCost`, `stretchAhead`) that add up days and fuel leg by leg.

**`app/src/engine/save.js`.** `serializeGame`, `deserializeGame`. One function, `rebuild`, reads a save field by field into a fresh version 3 state, rejecting or repairing as spec section 6 lists. `upgrade` puts a version 1 or 2 save into the version 3 shape first. `serializeGame` uses the same reading: a state is valid exactly when it reads back unchanged, so nothing `serializeGame` accepts can fail to load.

**Tests.** `app/tests/rules.test.js` (65 tests), `events.test.js` (24), `shop.test.js` (15), `save.test.js` (25). Every bullet in the brief's "Tests to write" has at least one test. The three old files (`engine.test.js`, `routes.test.js`, `supplies.test.js`) are deleted; each of their cases is either ported or replaced by the test of the rule that superseded it (for example "depart can close any stop" became "depart no longer exists", and "incoherent saves are rejected" became the repair tests).

## 3. TDD evidence

I wrote `data.js` and the four test files first.

Before the engine existed:

```
cd app && node --test tests/rules.test.js tests/events.test.js tests/shop.test.js tests/save.test.js

# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/app/src/engine/events.js' imported from …/app/tests/events.test.js
not ok 1 - tests/events.test.js
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/app/src/engine/actions.js' imported from …/app/tests/rules.test.js
not ok 2 - tests/rules.test.js
# SyntaxError: The requested module '../src/engine.js' does not provide an export named 'SAVE_VERSION'
not ok 3 - tests/save.test.js
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/app/src/engine/state.js' imported from …/app/tests/shop.test.js
not ok 4 - tests/shop.test.js
# tests 4
# pass 0
# fail 4
```

After the first implementation the same command gave `# tests 117, # pass 116, # fail 1`. The one failure was my own test: it waited for a bot journey to produce a sick traveler and none did. I replaced it with a state built directly.

Because 116 of 117 passing on the first run says little about whether the tests can fail, I then broke the engine on purpose, one place at a time, in a scratch copy (nothing in the project was touched), and ran the four files against each break. The first round was 194 breaks, of which 9 went unnoticed. Each pointed at a weak test or at dead code, and I fixed each:

- `createGame` could have handed out the background's own inventory object: the "share no objects" test compared two states that were both wrong. It now compares against a snapshot taken first.
- Nothing pinned the generator or the order of rolls. There is now a test that computes the LCG by hand and checks what each roll decides, for the actions and for every encounter response.
- Nothing checked that weights matter. There is now a test of the encounter shares over 9,000 drives.
- A traveler who died of the berries or of the outbreak could have been left sick; a dead traveler's `Deceased` status with health above 0 in an old save; food planned for the dead in Auto-buy. All have tests now.
- Two guards could not be reached through `transition` (`hurt` on a dead traveler, `finish` clearing a pending encounter). They are tested directly, because each protects an invariant of the state.
- `heal` for one traveler and a second `finish` in `resolve` were redundant, and I removed them.

Final round: 213 breaks, all noticed.

## 4. Final test command and summary

```
cd app && node --test tests/rules.test.js tests/events.test.js tests/shop.test.js tests/save.test.js
# tests 129
# suites 0
# pass 129
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 533.055834
```

`cd app && npm test` (which also runs the tooling lane's file): `# tests 150, # pass 150, # fail 0`. The output has no warnings and no stray lines.

Other checks I ran, none of them committed:

- **Fuzz.** 2,000 journeys of 400 random actions each (800,000 actions, valid and malformed, on deep-frozen states): no exception, every refusal returned the same object, and every one of the 132,508 accepted states survived `deserializeGame(serializeGame(state))` to deep equality. Health, inventory, day and distance stayed in range and the dead stayed dead.
- **Retuned numbers.** Task 3 may change the (T) numbers but not my tests, so I ran the four files against a harsher set, a gentler set and an absurd set of those numbers in a scratch copy. Harsher and gentler: 129 of 129. Absurd (starvation 30, wear 14 at Floor it, and so on): 128 of 129; the one failure is "a careful crew can reach Portland with every background", which is the test that should fail when the game cannot be won.
- **Formatting and types.** The tooling lane's Prettier and TypeScript were installed, so I ran them on my files only: `prettier --check` is clean, and `tsc -p jsconfig.json` reports no error in `src/data.js`, `src/engine.js`, `src/engine/**` or the four test files. Lines are at most 120 characters.
- **Scenes.** Every scene id named in `data.js` (25 of the 27) has its two files under `app/assets/scenes/`.
- **Routes.** A winning and a losing route, played through `transition` and read as a journal. The interface cannot be played yet (see 7.1).

## 5. Files changed

Rewritten: `app/src/data.js`, `app/src/engine.js`.
Created: `app/src/engine/random.js`, `state.js`, `events.js`, `actions.js`, `selectors.js`, `save.js`; `app/tests/rules.test.js`, `events.test.js`, `shop.test.js`, `save.test.js`.
Deleted: `app/tests/engine.test.js`, `routes.test.js`, `supplies.test.js`.

## 6. Where I interpreted the brief or the spec

1. **Drizzle and the day driven.** The drive happens on the day after today, so `drivePlan` uses that day's weather. On the day the drizzle ends, "The weather clears." is written and Floor it covers its full miles. Reading the weather before the day passes would have capped three drives for `days: 2` while the healing lasted two.
2. **Journal order.** An effect writes its result line before it harms anyone, so a death reads after its cause ("Kale lost 8 health to doomscrolling." then "Kale has died of doomscrolling." then the ending line). The spec says a resolution writes its line and then checks for the end; it does not say where death lines fall.
3. **Miles in sentences.** "Clear roads add {miles} miles." and the push line give the miles actually moved, so 5 miles from a stop it says 5. "It cost {fuel} fuel" and "The fine was ${money}" give what was actually taken when the party had less. Gains say the nominal amount ("The free box held 8 food") even when the van's maximum clips them.
4. **Push and arrival.** I read "the same arrival and win handling as driving" as the same single line by preference: the win line, the arrival line, or the push line. A push whose damage kills the last traveler moves nothing.
5. **`needs` may name a number.** The spec gives `needs` as `{ resource: amount }` and also names the same amounts on the encounter (`towCost`, `kombuchaCost`, `toll`, `donation`). To keep each number in one place, a need in the data may be the name of the encounter's number (`needs: { money: 'towCost' }`); `needsOf` resolves it and applies the developer's `repairCost`. Needs are checked, then spent, for every response that has them.
6. **Refusal sentences.** Each response with needs has its own `lacking` sentence, and a response or ability that needs a signal has an `offline` sentence. "The van can hold only {max} {name}." takes the item's short name ("40 Fuel", "6 Seeds"), because the full names do not all read as plurals. The brief's test bullet asks for a sentence containing "the item's short name in lower case", but its required sentence is "You have no seed bombs to use." and the short name is "Seeds". I kept the required sentence, and the test accepts the short or the full name in lower case and rejects the id.
7. **Seeds.** `createGame` throws on a seed that is not a whole number, and stores `seed >>> 0`, so a whole number outside 32 bits is wrapped, as the old engine did. A missing seed throws.
8. **Saves.** Besides the repairs the spec lists, `deserializeGame` also turns a `shop` phase at a stop without a shop into `location`, a running journey at mile 1000 into a win, and a "won" journey with nobody alive into a loss; it keeps `flags.nextToken` at least as large as a pending token; it floors fractional supplies other than food; and it makes each traveler consistent (the dead get a death, the living lose one). A fractional distance or health is rejected. `deserializeGame` takes text only: an object returns `null`.
9. **Additions to `data.js`.** `JOURNAL`, `REFUSALS`, `WEATHER`, `LIMITS` and `MONEY` are not in the brief's list of exports. I added them because the brief also says `data.js` holds all content and no sentence in the engine may repeat a number. Stops carry `talk: { gain, heal, line }` and `meal.line`; abilities carry `result`. `pandemic_death` has `quarantineDays: 2` so that the two days are data.
10. **Sentences I wrote** (not in the spec): the stop rest lines, the meal line, the `lacking` and `offline` sentences, and the refusals for last resorts, epitaphs, meals, NFT sales and "already in the shop". All are in `data.js`.
11. **Kept wording.** The brief says to keep every string the spec does not change, so the ferry and salvage lines still say "repair part" while the spec's new lines say "repair kit". The terms are mixed on purpose; unifying them is a one-word change in two templates.
12. **`apply` has no `ctx`.** The brief's shape is `apply(next, action, ctx)`. No action needed a third argument, so I did not invent one.
13. **"Never throws for any input".** `transition` refuses any action value, and any state that is not a version 3 journey object (`null`, `{}`, a version 2 object), with "Choose a valid action." It does not validate a version 3 object field by field on every call and it has no catch-all, because a catch-all would hide engine faults from the fuzz test.

## 7. For later tasks

1. **The interface is broken until Task 7**, as planned: `app/src/main.js` and the `browser-*.mjs` suites still call the old engine.
2. **Task 2.** `refusalFor(state, action)` in `actions.js` is the exact answer `transition` would give, gates included; `availableActions` can use it instead of calling `check` alone. `choicesFor`, `needsOf`, `restHere`, `forageHere`, `mealHere`, `drivePlan`, `weatherOn` and `fill` are exported for the labels and the forecast. Two traps: the seed bombs' item text uses `{max}` for the top of the yield, and the item's own `max` (what the van holds) is also 6 today, so `fill(item.text, item)` would look right and be wrong; and a version 1 or 2 ending lost to an empty tank migrates with everyone alive, so `summarize` must cope with a lost journey that has no fallen traveler.
3. **Task 3: use hashed seeds.** With this generator, neighbouring whole-number seeds give nearly the same first roll. Seeds 0 to 164 all meet an encounter on the first drive, and of seeds 1 to 2000 only 9.7% do, where `eventChance` promises 30%. `seedFromText('balance-' + n)` avoids it. My tests do this. The same holds for a player who types a small number as a seed; the daily seed and seeds made of words are hashed and are not affected.
4. **Task 3: four numbers are spelled out in sentences** the spec gives verbatim: `kombuchaCost` ("Two bottles"), `quarantineDays` ("Two days"), `donation` ("Give $20", "Twenty dollars") and the standard repair cost in the developer's ability text ("instead of 2"). `data.js` has a comment at each. Changing one of those numbers needs its sentence changed too.
5. **Task 3: health numbers must stay whole.** A fractional damage or heal would make health fractional, and `serializeGame` would then refuse the state. The fuzz test will show it at once.

## 8. Self-review

- **Completeness.** I went through the brief's requirements and test bullets, and through spec sections 3.3 to 3.8, 5 and 6, against the code once more after the last commit. I found nothing missing.
- **File sizes.** `state.js` (385 lines) holds a little more than the spec's list for it: `fill`, the supply helpers and the van's movement live there because `actions.js` and `events.js` both need them. `actions.js` is 469 lines. `rules.test.js` is 1,419 lines because the brief gives it twenty-two bullets.
- **Repeated test helpers.** `act`, `refusal`, `quiet`, `crew` and a few more are repeated in the four test files. A shared helper file was outside the paths this task owns.
- **Not verified.** I did not run the browser suites (they cannot pass until Task 7), and I did not run `npm run format:check` or `npm run typecheck` over the whole project, only over my files.

---

## Fix round 1

Commit: `da1f3af` fix: seeds are mixed, sentences take every number from a slot, actions are copied once, saves repair more. It was committed by path, contains only this task's files and was not pushed. It follows the amended spec (`da9e208`).

### What changed, item by item

1. **Numbers in sentences (Important).** In `data.js`:
   - The developer's text reads "… cost {repairCost} kit instead of {standardCost}."
   - The outbreak dose reads "It took {bottles} bottles of kombucha and a lot of confidence to hold the outbreak to {damage} health each."
   - The quarantine reads "A {days}-day quarantine cost {damage} health each and most of the snacks."
   - The donation label reads "Give ${donation} to make it stop" and its result "${donation} bought silence and a tote bag."

   The "spelled out" comments are gone. In `events.js`, the dose fills `bottles` from the kombucha it actually spent, the quarantine fills `days` from `quarantineDays` (which already set how many days pass), and the donation fills `donation` from the cash it actually spent. New test in `rules.test.js`: "no sentence spells out a number: every number in a sentence comes from a slot". It walks every string in `data.js` and fails on any number word from one to twenty, or any digit, outside a slot. A short list of phrases is exempt, each with its reason ("Five travelers", "one NFT", "like it is 1848", "Two hours later", and so on). The test also fails if an exempt phrase disappears from `data.js`, and it checks itself against the old sentences ("Give $20…", "Two bottles…", "…instead of 2."). This is stricter than the ruling (any digit, not only the record's own numbers), because it also catches a number from `RULES` written into a journal line.
2. **Seeds (Important).** `random.js` exports `mix32`, the finalizer as the spec writes it. `createGame` stores the seed unchanged (a whole number outside 32 bits is still wrapped by `>>> 0`) and starts the generator at `mix32(seed)`. A version 3 save with no valid `rng` restarts at `mix32(seed)`; version 1 and 2 saves keep their saved `rng`, which is also their seed. Tests: the new-game test expects `rng === mix32(77)`; "the generator starts at the seed mixed by the MurmurHash3 finalizer" checks `mix32` against the spec's formula and checks that the seed is kept; "neighbouring seeds meet encounters on the first drive as often as the odds say" drives the first day of games with seeds 1 to 2000 and needs a rate within 0.05 of `RULES.eventChance`. The measured rate is 629 of 2000 (0.3145); before this fix it was 9.7%. The two roll-order tests now start from the game's own `rng`.
3. **"Repair kit".** The ferry line and the salvage line now read "repair {kit|kits}". I added no test: it would only repeat the sentence.
4. **The action is copied once.** `transition` copies the action with `structuredClone` inside `try`/`catch`; a failure is refused with "Choose a valid action.". The copy is what `refusalFor` checks and what `apply` carries out. Tests:
   - "transition reads the action once…": a `setPace` whose getter returns `slow` first and `__proto__` after, and a `useItem` whose getter returns `kombucha` first and `nft` after. Each getter is read exactly once and the action takes effect with the first value.
   - "an action that cannot be read or copied is refused, never thrown": a throwing getter on a field, a throwing `type` getter, a function value and a symbol value.
5. **Save repairs.** In `save.js`:
   - A `shop` phase with a pending encounter becomes `location`.
   - A death dated after the journey's day takes the journey's day.
   - Each journal line keeps at most `LIMITS.journalLine` (300, new in `data.js`) characters, counted in code points so that an emoji is never cut in half, and is dated no later than the journey's day.

   Tests: "a shop is never open while an encounter is pending", "a journal line is cut to its limit and never dated after the journey", and a death-day case added to "a traveler is made consistent…".
6. **Control characters in names.** `cleanName` removes C0, DEL and C1 characters (newlines included), then trims and checks the length. `createGame` and save loading share it, so old saves with such names load without them. A name made only of control characters is still rejected (see the concerns below). Tests: "names lose their control characters before they are trimmed and measured" and "a save whose names hold control characters still loads, without them" (versions 1, 2 and 3).
7. **Slot names.** The seed bombs' text and the `ACTION_TEXT` details for forage and seed bombs use `{low}` and `{high}`. The fuel text reads "One canister covers {milesPerFuel} miles at a Steady pace."
8. **Stock from needs.** `events.test.js` has a `supplied(response, seed)` fixture. It stocks exactly what the response needs (through `needsOf`) and what its advertised outcomes take, and nothing else. "every response does exactly what it advertises", "every way an encounter can kill…" and "each response takes its rolls in order" use it. The outbreak, tow and repair cases stock from `kombuchaCost`, `towCost` and the repair need. A new test, "the petition donation names the price it charged", covers the donation sentences.
9. **Shared helpers.** `state.js` exports `milesBeforeNextStop(distance, miles)`, used by `drivePlan`, `moveVan` and the drizzle effect, and `roundFood(amount)`, used by `state.js` and `save.js`.

Also: Prettier had joined two string concatenations in `data.js` onto one line; each is now a single literal.

### Commands and output

```
cd app && node --test tests/rules.test.js tests/events.test.js tests/shop.test.js tests/save.test.js
# tests 139
# suites 0
# pass 139
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 634.008417

cd app && npm test
# tests 160
# suites 4
# pass 160
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

The output has no warnings. Other checks (scratch scripts, not committed):

- **Data against the spec.** The check now reads the amended spec and plan: 406 comparisons, all equal.
- **Mutation check.** 234 deliberate breaks, all caught. 25 of them target this round's changes: no mixing, the wrong shift in `mix32`, no copy of the action, an uncopyable action allowed to throw, each save repair removed, names stripped after trimming or only once, sentences filled without their new slots, and numbers written back into four `data.js` sentences.
- **Fuzz.** 2,000 journeys and 800,000 actions. Nothing threw, and every accepted state round-tripped.
- **Retuned numbers.** Harsher and gentler sets: 139 of 139. The absurd set: 138 of 139; the one failure is "a careful crew can reach Portland", which should fail when the game cannot be won. That run also showed that "every way an encounter can kill" was too small a sample at a 93% kick success, so it now draws 40 seeds instead of 12.
- **Formatting and types.** `prettier --check` and `tsc -p jsconfig.json` are clean on these files, and no line exceeds 120 characters.

### Notes and concerns

- **Task 2 must fill two more templates.** Choice labels can now hold slots ("Give ${donation} to make it stop", filled from the encounter's numbers), and the developer's ability text needs `{standardCost}`, the repair's standard `needs.parts` from `van_breakdown`. I added no engine helper for either, because `describeAbility` and the labels belong to Task 2.
- **Fixed plurals in the spec's sentences.** "{bottles} bottles" and "{repairCost} kit" keep the spec's wording. They would read "1 bottles" or "2 kit" if those numbers were retuned to 1 and 2. `{one|many}` slots would fix that if the spec allows it.
- **A name made only of control characters** (possible only in a hand-edited save) is empty after stripping, so that save is rejected, as any save with an invalid name is.
- **Not changed, by ruling:** the repeated test helpers, the size of `rules.test.js`, and `legCost`.

## Fix round 1, addendum

Commit: `22898b1` fix: every counted noun after a number slot takes its one or many form. It was committed by path and not pushed.

**What changed.** Every counted noun that follows a number slot in `data.js` now uses the `{one|many}` form:

- **Abilities:** the influencer's and prepper's "{cooldown} {day|days}"; the developer's "{parts} repair {kit|kits} once every {cooldown} {day|days}" and "{repairCost} {kit|kits} instead of {standardCost}".
- **Fuel item text:** "{milesPerFuel} {mile|miles}".
- **Drizzle and heatwave:** "Clear roads add {miles} {mile|miles}." and "will last {days} more {day|days}".
- **Outbreak dose:** "{bottles} {bottle|bottles}".
- **Action details:** the travel and push details, "{miles} {mile|miles}".
- **Journal:** the drove and pushed lines, "{miles} {mile|miles}".
- **Refusals:** the name and epitaph refusals, "{max} {character|characters}".

Mass nouns (food, fuel, health) and "{days}-day" stay as they are. Sentences that already had the form ("repair {kit|kits}", "{bottle|bottles}" in the dose refusal, "Ready in {days} {day|days}") are unchanged.

One case is left: "The van can hold only {max} {name}." takes the item's short label ("Seeds", "NFTs"), not a counted noun. It would read "1 Seeds" only if an item's `max`, which is not a tunable number, were set to 1.

**New test, in `rules.test.js`:** "a noun after a number agrees with it, whatever the number is". It fills every string in `data.js` with each slot set to 1, then to 2, and fails on "1 miles/days/bottles/kits/characters" or "2 mile/day/bottle/kit/character" (allowing "repair" in between). It also fails if one of those nouns is no longer counted anywhere. I checked that it catches a fixed plural in the drove line, a fixed plural in the dose line, and a swapped `{kits|kit}`.

```
cd app && node --test tests/rules.test.js tests/events.test.js tests/shop.test.js tests/save.test.js
# tests 140
# suites 0
# pass 140
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 640.614792

cd app && npm test
# tests 161
# suites 4
# pass 161
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`prettier --check` and `tsc` are clean on these files.
