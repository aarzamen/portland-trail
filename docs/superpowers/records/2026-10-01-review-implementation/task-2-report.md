# Task 2 report: what the player can do, read-only engine functions

**Status: DONE_WITH_CONCERNS.** Everything in the brief is implemented, tested and committed. The concerns are about where some new sentences live and a few readings of the spec (section 6 below). None of them is a doubt about correctness.

## 1. Commit

| SHA | Subject |
|---|---|
| `a42a4e5` | feat: engine tells the interface what can be done and what it costs |

The commit was made by path and holds only the four files this task owns: `app/src/engine/actions.js`, `app/src/engine/selectors.js`, `app/src/engine.js` and `app/tests/selectors.test.js`. Nothing was pushed. `data.js` was not touched.

## 2. What I implemented

**`app/src/engine/actions.js`**

- **`describe` on the action table.** Every action the player picks from a list now has `describe(state) -> Offer[]`. An offer is `{ key, action, group, label, detail }`. `describe` answers one question: is this action meaningful here (is there a rest stop, is there kombucha in the van)? It does not answer whether the action is allowed. It reuses the predicates `check` uses: `restHere`, `forageHere`, `mealHere`, `stopOffers`, `lastResort`, and new shared helpers `inTheShop` and `owns` that `check` now uses too. `travel`, `rest`, `forage`, `meal`, `talk`, `openShop`, `leaveShop`, `ability`, `useItem` (one offer per owned usable item: kombucha, then seed bombs), `sellNft`, `push`, `hitchhike`, `tradeLuggage` and `resolveEvent` have one. `purchase`, `autoPurchase`, `setPace`, `setRations` and `setEpitaph` do not, because the interface has its own controls for those (`shopItems`, the options lists, the memorial).
- **`gateFor` split out of `refusalFor`.** The gates (invalid state or action, `setEpitaph` passes, ended, pending) now live in one private function. `refusalFor(state, action)` is `gateFor(...) ?? check(...)`, so its behavior is unchanged.
- **`availableActions(state)`.** It walks a fixed display order: travel, rest, forage, meal, talk, openShop, leaveShop, ability, useItem, sellNft, push, hitchhike, tradeLuggage, resolveEvent. Any type its gate closes is skipped, so a pending encounter leaves only its answers and an ended or invalid journey gives `[]`. Each offer from the other types goes through `refusalFor`, the same function `transition` calls. `reason` is the sentence that comes back, and `enabled` is `reason === ''`. No condition is checked twice.
- **Event options.** An `auto` encounter gives one `event:continue` option labelled "Continue". Otherwise there is one `event:<choiceId>` option per choice from `choicesFor`, so `only` choices are hidden from other backgrounds. Each label is filled from the encounter's own numbers, so the petition reads "Give $20 to make it stop". The detail says what the choice's needs take, built from `needsOf` (so it includes the developer's cheaper repair), for example "Costs $90." or "Uses 2 repair kits."
- Labels and details come from `ACTION_TEXT`, with real numbers: the drive's detail is filled from `drivePlan`, and the push's from the miles it would really cover. Where a stop names its own label (the motel's "Rent a room", the carts' "Eat at the carts"), that label is used.

**`app/src/engine/selectors.js`**

- **`forecast`.**
  - `today` is `drivePlan(state)`.
  - `range` is `floor(fuel × milesPerFuel)`.
  - `healthPerDay` and `foodPerDay` come from a trial day: `passDay(trial, { traveling: true })` runs on a light copy of the state, with one living traveler set to 50 health and not sick. `foodPerDay` uses a second trial with plenty of food. Because `passDay` itself does the arithmetic, the forecast cannot disagree with the drive, and no rule is written twice. The copy is shallow except for the party, the inventory and the weather, and its journal is empty, so it is cheap enough for Task 3's fuzz run.
  - `nextStop` is the next stop with its leg's days and fuel.
  - `nextShop` adds the legs up to the next shop and includes `food`. It is `null` when no shop lies ahead.
  - `shortfall` is `{ fuel, food }` against that stretch.
- **`statusOf`** gives Deceased, Sick, Healthy, Worn down or Hanging on, with the bands from `RULES.healthBands`.
- **`shopItems`** gives one row per item: the price at this stop, `owned`, `max`, `describeItem` text, and `canBuy = max(0, min(floor(max − owned), floor(money / price), LIMITS.order))`. Outside the shop it returns `[]`.
- **`paceOptions` and `rationOptions`** give labels such as "Steady · 80 mi a day · 4 fuel · −4 health" and "Meager · 0.5 food each · −1 health", with a true minus sign.
- **`summarize`.**
  - Scores and ranks follow spec 3.9. A journey still under way is scored and ranked by the loss rule.
  - `fallen` is in the order the travelers fell (day, then mile, then party order) and carries the death line and the current epitaph.
  - `heading` and `cause` follow requirement 3.
  - A lost journey with someone still alive, or with nobody fallen, can only be an old save that ended on an empty tank. Its cause is "The van ran dry near mile N."
- **`shareText`** produces the line in requirement 4, with " RIP {name}: “{epitaph}”" for each of the fallen. "{rentDays} {day|days}" agrees with its number. An unfinished journey reads "on the road at mile M on day D".
- **`describeAbility`** fills the ability's text with its own numbers, plus `standardCost` (the breakdown repair's standard `needs.parts`) and `forageBonus` (`RULES.forage.prepperBonus`). **`describeItem`** fills `{low}`/`{high}` from `yield` and `{milesPerFuel}` from the Steady pace. Both return `''` for an unknown id or for cash.
- `recommendSupplies` is unchanged in behavior. Its food arithmetic now goes through the same `foodFor` helper the forecast uses.

**`app/src/engine.js`** also re-exports `availableActions`, `forecast`, `statusOf`, `shopItems`, `paceOptions`, `rationOptions`, `summarize`, `shareText`, `describeAbility` and `describeItem`.

## 3. TDD evidence

I wrote `app/tests/selectors.test.js` first.

```
cd app && npm test
# tests 162
# suites 4
# pass 161
# fail 1

cd app && node --test tests/selectors.test.js
# SyntaxError: The requested module '../src/engine.js' does not provide an export named 'availableActions'
```

That is the right failure: the file could not load because the exports did not exist yet. After the implementation, the first run of the new file gave `# tests 36, # pass 36, # fail 0`.

Because a first run that passes says little about whether the tests can fail, I broke the implementation on purpose, one place at a time, in a scratch copy (nothing in the project was touched). There were 64 breaks across `availableActions`, every `describe`, the forecast, `statusOf`, `shopItems`, the options, scores, ranks, headings, causes, `shareText` and both describe functions. The first round missed five:

- the drive's detail with fixed numbers (the test's state happened to drive 80 miles for 4 fuel);
- `openShop` in the wrong group;
- a sick probe in the trial day;
- the dry-tank cause when someone had already died;
- `<` instead of `<=` against `parDay`.

I fixed the first four by tightening the tests: the drive detail is compared with a real drive at each pace and three tank sizes, the group test covers every key, there is a forecast case where only the last traveler is well, and there is a legacy loss with one fallen traveler. The fifth is an equivalent mutant: at `day === parDay` the term is `0 × anything`. Final round: 63 of 64 caught, and the one left is that equivalent mutant.

## 4. Final test summary

```
cd app && npm test
# tests 197
# suites 4
# pass 197
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2076.679625
```

The output has no warnings or stray lines. The agreement test takes about 2 seconds of that.

What the agreement walk covers (measured with a scratch script over the same 200 hashed seeds, `seedFromText('selectors-' + n)`):

- 15,439 steps; 150 journeys won, 50 lost.
- All 14 encounters, and the phases `shop`, `location` and `travel`.
- Every option key enabled at least once.
- Disabled options checked against `transition`: cooldowns, Wi-Fi, the barista lacking food, talked, already eaten, luggage gone, dry tank, and the unmet needs of invest, kombucha, repair, treat and trade.

The bot also auto-buys in shops at random and changes pace now and then, so it reaches later stops.

Other checks:

- `prettier --check` is clean on the four files.
- `tsc -p jsconfig.json` reports no error in them.
- No line is over 120 characters.

## 5. Files changed

- Modified: `app/src/engine/actions.js`, `app/src/engine/selectors.js`, `app/src/engine.js`
- Created: `app/tests/selectors.test.js`

## 6. Interpretations and concerns

1. **New sentences live beside the code, not in `data.js`.** The brief gives the summary and share sentences verbatim, and I may not edit `data.js`. So these templates are constants:
   - in `selectors.js`: `TEXT`, holding the status labels, the pace and ration label patterns, the headings, the causes, the share line and the RIP line;
   - in `actions.js`: `NEED_TEXT` and "Continue".

   None of them contains a tunable number; every number comes from a slot. The one number word, "five" in "All five made it" and "{n} of five", is the fixed party size. Task 1's "no sentence spells out a number" test only walks `data.js`, so it does not cover these. If the owner wants all text in `data.js`, moving `TEXT`, `NEED_TEXT` and "Continue" there is mechanical. I did not treat this as NEEDS_CONTEXT because nothing was missing: the brief supplied the wording.
2. **Event details.** The spec defines `detail` as "what it costs and gives, with numbers" but `data.js` has no detail text for encounter choices. I show what a choice's needs take ("Costs $90.", "Uses 2 repair kits.", "Uses 2 bottles of kombucha.") and leave the rest `''`, as `ACTION_TEXT` does for `leaveShop` and `sellNft`. The outcome of a choice stays a surprise, as in the original.
3. **Relevance versus acceptance.** "Never duplicates a condition that check already expresses" is met: `enabled` and `reason` come only from `refusalFor`. Whether an action is listed at all is a separate rule from spec 5 (items "when owned", last resorts "while the tank is dry"). `describe` writes it with the same named predicates `check` uses (`owns`, `inTheShop`, `outOfTheShop`, `lastResort`, `restHere`, …), so neither rule has a second copy.
4. **What is listed in the shop.** In the shop there are no last resorts, no ability and no item use: `transition` refuses all three there, and listing them would only show "not in the checkout" reasons. `tradeLuggage` stays listed, disabled with "The roof luggage is already gone.", once traded on a dry tank, because the player may wonder where it went.
5. **`forecast` details.**
   - `nextShop` and `shortfall` plan at the current pace and rations, without the heat multiplier, exactly as `recommendSupplies` does, so the forecast and Auto-buy agree.
   - When no shop lies ahead, `nextShop` is `null` but `shortfall` is measured to Portland. A warning about running dry before the end is still useful there.
   - `shortfall.food` is rounded up to whole food.
   - `healthPerDay` is for a traveler who is not sick (sickness damage excluded), at today's food: if the food will run short, it shows the starvation damage.
6. **The loss cause.** "{death line} near mile {distance}." The death line's own final period is dropped so the sentence reads "Kale has died of the road itself near mile 420." `{distance}` is the journey's distance, which for a real loss equals the last death's mile.
7. **`fallen` order and "the last fallen".** Travelers are sorted by death day, then mile, then party order (a stable sort). That matches the journal order for deaths in one action, because `hurtAll` walks the party in order.
8. **`shareText` for a journey still under way** reads "on the road at mile M on day D". The spec gives only the won and lost forms.
9. **`describeAbility` and `standardCost`.** `standardCost` is resolved directly from the breakdown repair's `needs.parts`, including the "name of an encounter number" form. That repeats one line of `needsOf`'s resolution, because `needsOf` always applies the current background's `repairCost` and so cannot give the standard cost.
10. **Commit attribution.** The spec's section 2 says to end commits with a Claude Fable 5.1 line. The task instructions said to use my own model's line, so the commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 7. For later tasks

- **Task 3.** The bots should act through `availableActions` and `transition`, as planned. The agreement test's bot shows a random walk always has at least one enabled option in every non-ended state; the test asserts it. `forecast` runs `passDay` on a light copy (no journal copy), so calling it on every fuzz state is cheap. Over 15,000 states the whole agreement test, which calls `availableActions` twice per step and `transition` for every option, takes about 2 seconds.
- **Task 7.** Each option's `key` is stable (`travel`, `rest`, `useItem:kombucha`, `event:repair`, `event:continue`, …) and suits `data-key`. Options already come in display order and carry their `group`. `statusOf(member).id` gives `data-band`. `shopItems(state).canBuy` is exactly the largest accepted purchase: the test checks that `canBuy` is accepted and `canBuy + 1` refused.
- **Task 8.** `summarize(state).fallen[i].line` is the death line for a headstone. `shareText` is one line, with no newline.
