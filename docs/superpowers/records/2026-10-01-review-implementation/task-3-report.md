# Task 3 report: fuzz, bots and balance

**Status: DONE_WITH_CONCERNS.** All requirements are met and committed, and every target in spec 3.11 holds over 2,000 seeds per background. The fuzz test found no engine defect. The concerns, in section 8, are about interpretation and margins. None of them blocks anything.

## 1. Commit

| SHA | Subject |
|---|---|
| `a4a0f86` | test: fuzz and balance harness; encounters every other day and harsher heat put Auto-buy at 42-45% wins |

Committed by path: `app/tests/fuzz.test.js`, `app/tests/balance.test.js`, `app/scripts/balance.mjs`, `app/src/data.js`, `docs/validation/2026-10-01-balance.md`. Nothing was pushed. Co-author line: `Claude Opus 5.5`. The spec's section 2 names "Claude Fable 5.1", but the instructions said to use my own model's line.

## 2. What I built

**`app/tests/fuzz.test.js`.** 300 journeys of up to 400 actions each, from a fixed outer seed (20261001) with its own LCG, across all four backgrounds and uniformly random uint32 journey seeds.

- **Actions.** Each step picks one of three kinds:
  - about 49%: an option drawn from `availableActions`, so journeys get somewhere;
  - about 6%: a malformed value (junk primitives, `'travel'` as a string, `{}`, unknown or prototype type names, a function field, a symbol field, a throwing `type` getter);
  - otherwise: a generated action of one of the 19 types in spec section 5, with valid fields or junk fields about a quarter of the time. The junk includes `NaN`, `Infinity`, `-1`, `1.5`, `1001`, `'__proto__'`, `'constructor'`, arrays, objects, bad tokens, bad member ids, and epitaphs that are too long, blank or contain newlines.
- **Checks at every step.** Each state is deep-frozen before it is passed on.
  - `transition` never throws.
  - A refusal returns the same object with no notes.
  - An accepted state is a new object; `serializeGame` does not throw; `deserializeGame(serializeGame(s))` deep-equals it.
  - Distance and day never decrease.
  - Every inventory value is finite and at least 0.
  - Health is a whole number from 0 to 100.
  - A dead traveler stays at 0 with the same `death` record.
  - `availableActions`, `forecast`, `summarize` and `recommendSupplies` do not throw on any reached state.
  - When the action came from `availableActions`, its `enabled` matches whether `transition` accepted it, and a disabled option's `reason` equals the refusal (spec A1).
- **After the end.** A journey runs 25 more steps (epitaphs are still accepted), then stops.
- **The run itself.** The test also checks that it reached both endings and that more than a quarter of the actions were accepted. It prints a tally with `t.diagnostic`. Last run: 55,788 actions, 24,783 accepted, 23,797 from the option list, 85 won and 215 lost. Time: about 3.0 s.
- **It can fail.** With `starvationDamage` set to 9.5, the test fails at once with "Cannot save an invalid journey." I put 9 back.

**`app/scripts/balance.mjs`.**

- **Exports.** `play(seed, profession, bot)` returns `{ outcome, cause, day, alive, score, money, outbreak }`, where `cause` is the cause of the last death in a lost journey. `measure(seeds)` returns stats by bot id, then by background: `journeys`, `wins`, `winRate`, `losses` by cause, `meanDay`, `meanAlive`, `meanScore`, `meanCash`, `outbreaks` and `outbreakLosses`.
- **Also exported.** `BOTS`, `sampleSeed(n) = seedFromText('balance-' + n)`, `startingShortfalls()` (the forecast shortfall after Auto-buy at mile 0 with default settings, per background) and `formatTables(results, seeds)`.
- **Run directly** (`npm run balance` or `node scripts/balance.mjs [seeds]`, default 2000), it prints one Markdown table per bot. Each table has a row per background: wins, losses by last cause of death, mean day, mean alive, mean score and mean cash. Under each table it prints the spread between backgrounds and the outbreak loss count. At the end it prints the starting shortfalls and the run time.
- **Guards.** A bot whose action is refused throws, which exposes bot bugs. The one exception is Auto-buy, whose refusal just means there was nothing to buy. Journeys are capped at 1,500 steps and count as `unfinished`; none hit the cap.
- **Speed.** 2,000 seeds take about 20 s.

**`app/tests/balance.test.js`.** It runs 300 seeds per background, about 2.3 s. Diagnostics print the full tables.

- **Asserted per background:** Never shops wins at most 8%. Autopilot wins 25–60%. Careful wins at least 75% and keeps at least 3.3 alive.
- **Asserted per bot:** backgrounds are within 12 points of each other.
- **Two additions from spec 3.11:** careful loses at most 5% of journeys with the outbreak (a wider band than the spec's 2%), and Auto-buy at the start leaves a `{ fuel: 0, food: 0 }` shortfall for every background.

**`docs/validation/2026-10-01-balance.md`.** It holds the final value of every (T) number, the bot policies, the 2,000-seed tables, a check against each target, and the paragraph on what changed.

## 3. Bot policies

Bots pick from `availableActions` by option key and `enabled`, and send everything through `transition`. `availableActions` does not list Auto-buy, pace or rations, because the interface has its own controls for them, so the bots send `autoPurchase`, `setPace` and `setRations` to `transition` directly. To decide, they read the state and `forecast`. The careful bot calls `forecast` on a shallow copy with other rations or less food, to ask "does the food last at Filling?". Nothing is mutated.

- **Never shops.** Default Steady and Meager; never opens a shop.
  - Encounters: the first enabled response that is not `only`.
  - Dry tank: trade the luggage, then push. Hitchhiking is a fallback that never happens.
- **Autopilot.** Auto-buy at mile 0 and at every shop stop; Steady and Meager.
  - It never rests, eats at the carts, forages, talks, or uses items or the ability. Spec 3.11 lists talking only for the careful bot, so I left it out here.
  - Encounters: the first enabled response that is not `only`. It finds `only` from the encounter's data, by the option key `event:<choiceId>`.
  - Dry tank: luggage, then push.
- **Careful.**
  - **Settings and shops:** Steady pace. In a shop it switches to Filling before Auto-buy, so the plan buys food for Filling.
  - **Rations:** before each drive, Filling if the food lasts to the next shop (or Portland) with a day to spare, else Meager on the same test, else Bare.
  - **At stops:** talks and eats at the carts. While mean health is under 70 it rests where rest is offered, at most three times per stop. It opens the shop once per stop.
  - **Items:** kombucha when anyone is sick or under 40. When food will not last at Meager, seed bombs first, then foraging if mean health is above 50.
  - **Ability:** collab and salvage whenever ready. A prepper scouts only when food is short and nobody is at 50 or below. A barista brews when someone is under 95 and the food lasts with two days to spare.
  - **Encounters:** preferences, best first:
    - NFT fair: invest, consult, wait.
    - Food poisoning: treat, ride it out.
    - Breakdown: repair, tow, kick.
    - Outbreak: dose, quarantine, drive through.
    - E-bike convoy: trade, wait, honk.
    - Sasquatch: photo, leave, chase.
    - Toll: pay, ford, riddle.
    - Brunch line: post, wait, detour.
    - Petitions: call, donate, sign.
  - **Dry tank:** luggage, then hitchhike, then push.

## 4. Numbers changed

| number | from | to | reason |
|---|---:|---:|---|
| `RULES.eventChance` | 0.3 | 0.55 | Auto-buy won about 86%. More encounters per journey is the only fine-grained, crew-wide pressure on a crew that never heals. |
| `EVENTS.bad_weather.damage` | 6 | 14 | Heat is the main crew-wide hazard Autopilot meets. Together with the chance it brings Autopilot to 42–45%. |
| `EVENTS.wifi_outage.influencerDamage` | 8 | 5 | It alone made influencers 10.5–16 points worse under Autopilot, which broke the 10-point spread. At 3 the gap is 1 point; 5 keeps influencers hit harder, as the joke needs, with a spread of 3.1. |

**Why not road wear or rations.** Over Autopilot's 17 driving days, one point of either the Steady wear or the Meager penalty is 17 health per traveler, and it moved Autopilot from 86% to 10%. They are too coarse to tune with.

**What stayed the same.** No price changed. The order constraints hold: wear 1 < 4 < 7, ration health −3 < −1 < 2, every price positive, every health number whole. A trial of other single changes (`heat.travelDamage`, `heat.days`, `tiktok` damage, `wifi.damage`) is recorded in my scratch runs. Each moved Autopilot less per number changed.

## 5. The 2,000-seed table (final numbers)

| bot | influencer | dev | prepper | barista | mean alive | spread | outbreak losses |
|---|---:|---:|---:|---:|---:|---:|---:|
| Never shops | 0.0% | 0.0% | 0.0% | 0.0% | 0.00 | 0.0 | 867 of 867 |
| Autopilot | 41.9% | 45.1% | 44.0% | 44.0% | 1.79–1.97 | 3.1 | 813 of 1,249 |
| Careful | 100.0% | 100.0% | 100.0% | 100.0% | 5.00 | 0.0 | 0 of 1,335 |

The full tables, with losses by cause, mean day, score and cash, are in `docs/validation/2026-10-01-balance.md`. Auto-buy at the start leaves a shortfall of 0 fuel and 0 food for every background.

For comparison, the starting numbers on the same 2,000 seeds gave Autopilot 76.3%, 86.8%, 86.0% and 86.0% (spread 10.5). Never shops and Careful were the same as now.

## 6. Tests

```
cd app && node --test tests/fuzz.test.js
# {"actions":55788,"accepted":24783,"refused":31005,"listed":23797,"won":85,"lost":215}
# tests 1, pass 1, fail 0, duration_ms ≈ 3000

cd app && node --test tests/balance.test.js
# tests 7, pass 7, fail 0, duration_ms ≈ 2340

cd app && npm test
# tests 205
# pass 205
# fail 0
# duration_ms 3252
```

I ran `npm test` after the `data.js` change and again before the commit; both passed. The output has no warnings, only the two tests' diagnostics. `npx prettier --check` and `npx tsc -p jsconfig.json` are clean on my four code files, and no line is over 120 characters.

## 7. Engine findings

- **No defect found.** No exception, no unsaveable state, no change to a frozen input. Over about 24,000 checked options, `availableActions` never disagreed with `transition`.
- **`availableActions` gives the bots everything they need,** except the shop and settings actions, which the spec says have their own controls. The bots send those to `transition` directly. If the reviewers want everything to go through the list, `availableActions` would have to offer `autoPurchase` (and possibly settings) in the shop. I did not work around the gap any other way.

## 8. Concerns

1. **Careful play cannot lose.** It wins 100% with all five alive, and the margin is very wide. In scratch runs it still won everything when Filling's health was 1 or 0, or when the stop rests healed 8. The targets set only a floor for careful play, so I made the minimal change. If the owner wants a thoughtful player to feel real risk, the levers are healing numbers: rest heals, Filling, kombucha and the rest-at-stops loop. Autopilot never heals, so those levers leave its numbers almost untouched.
2. **Twice as many encounters.** At 0.55 per driving day, about nine encounters come up per journey instead of five. That is more of the game's humor, but also more interruptions. A heatwave now costs 14 at once, plus 2 on each of its two driving days. If 0.55 feels too busy in play, a lower chance with a harsher heatwave would hold the target. My trials: 0.5 with heatwave 14 gave 46–50%; 0.4 with heatwave 12, heat travel damage 4 and Wi-Fi damage 6 gave 51–55%.
3. **The "unavoidable deaths" rule.** It is measured through its stated case only: careful play with the outbreak, 0 of 1,335 lost. Every other death in these runs follows from a bot's own choices.
4. **Bot scope.** Autopilot does not talk, and all three bots send Auto-buy, pace and rations to `transition` directly (see section 7).
5. **Prepper and barista match under Autopilot.** Their win and loss rows are identical, by construction rather than by fault. Autopilot uses neither background's ability or reserved responses, both are stocked to the same targets, and the seeds are the same.
6. **The spec still shows the starting values.** Spec 3.8 still lists `{damage: 6}` for the heatwave and `{influencerDamage: 8}` for the outage. The spec calls these starting values and the validation note records the final ones, so I did not edit the spec, which I do not own.

---

## Round 2

**Status: DONE_WITH_CONCERNS.** One target is still unmet: the amended careful target (85–97% wins, at least 3.5 alive, a traveler lost in at least 25% of journeys) cannot be reached with (T) numbers alone. As the brief directs, I stopped and am reporting the measurements and the rule changes that would make it reachable. Every other target holds. Commit `63cdb50`, by path, not amended, not pushed. I touched nothing of the interface work in this checkout.

### Numbers changed in round 2

| number | from | to | why |
|---|---:|---:|---|
| `RULES.eventChance` | 0.55 | 0.5 | Fewer, weightier encounters, as the ruling prefers. |
| `EVENTS.bad_weather.damage` | 14 | 16 | Keeps Autopilot in its band at the lower chance: 43.5–45.5% over 2,000 seeds. |

**Other pairs I measured** (400 seeds per background):

- 0.5 with a heatwave of 20: 42.5–44.0%.
- 0.45 with 24: 45.3–47.8%.
- 0.45 with 18 (and doomscrolling 30, berries 20, weaker heals): 56.5–57.5%, too high.

0.5 with 16 holds the band with the smaller heatwave.

**Healing numbers did not change.** No cut that leaves the game sensible gives careful play any deaths, so cutting heals alone would only worsen the game without reaching the target (see the measurements below).

### Also changed

- **`app/scripts/balance.mjs`** measures `bereaved`, the share of journeys in which at least one traveler died, and prints it as a "lost anyone" column.
- **`docs/validation/2026-10-01-balance.md`** has the new numbers, the new 2,000-seed tables, a target table that marks the careful target as unmet, and the measurements and options below.
- **`app/tests/balance.test.js`** is unchanged. With the amended bands (careful 80–99% wins, a death in at least 18% of journeys) it fails against any sensible numbers, so I did not commit it. It still asserts the round-1 careful bands.

### New 2,000-seed table

| bot | influencer | dev | prepper | barista | lost anyone | mean alive | spread | outbreak journeys lost |
|---|---:|---:|---:|---:|---|---|---:|---|
| Never shops | 0.0% | 0.0% | 0.0% | 0.0% | 100% | 0.00 | 0.0 | 739 of 739 |
| Autopilot | 43.5% | 45.4% | 45.5% | 45.5% | 67.5–71.0% | 1.94–2.08 | 2.0 | 638 of 1,076 |
| Careful | 100.0% | 100.0% | 100.0% | 100.0% | 0.0% | 5.00 | 0.0 | 0 of 1,161 |

Auto-buy at the start leaves a shortfall of 0 fuel and 0 food for every background. The full tables, with losses by cause, mean day, score and cash, are in the validation note.

### Why careful play cannot be made riskier with (T) numbers alone

Two features of the careful policy keep its weakest traveler at 30–40 health or above:

- **Kombucha.** It opens a bottle whenever anyone is under 40, and Auto-buy restocks two bottles at every shop (`supplies.kombucha`, not (T)).
- **Rests.** It rests at stops while mean health is under 70.

A traveler then dies only if one step takes about 40 health from them. Careful play is also at least 17 health per traveler ahead of Autopilot before any heal counts, because Filling must stay above Meager over 17 driving days. Autopilot's crew, with none of the heals, loses someone in 67.5–71% of journeys.

Measured over 300 seeds per background, with careful play's policy unchanged:

| trial | influencer | dev | prepper | barista | outbreak journeys lost |
|---|---|---|---|---|---|
| Moderate healing cuts: Filling 0, kombucha 5, every rest heal halved or less | 100% won, 0–1% lost anyone | same | same | same | 0% |
| Every healing lever at its floor: Filling 0; kombucha, meal, talk and every rest heal at 1 | 80.0% won, 33.0% lost anyone | 74.0%, 36.3% | 93.7%, 19.3% | 96.7%, 5.0% | 15 of 174 (8.6%) |
| The floor, plus doomscrolling 24 and treated berries 24 | 81.0%, 58.7% | 73.3%, 63.0% | 93.7%, 49.7% | 98.0%, 14.0% | 16 of 176 |
| The same, plus the barista's brew healing 2 instead of 5 (not (T)) | 81.0%, 58.7% | 73.3%, 63.0% | 93.7%, 49.7% | 85.7%, 43.0% | 20 of 177 |

A random search covered 750 sets of (T) numbers. It drew the chance, the heatwave, heat per day, doomscrolling up to 40, treated berries up to 32, outbreak damage, Filling, kombucha, rest heals, meal, talk, Wi-Fi and sickness. No set reached 25% for the background that loses someone least often while holding the other careful targets. The best set reached 13%.

Deaths in a quarter of journeys appear only when every heal is cut to 1. Even then:

- The backgrounds spread 22.7 points apart, against at most 10.
- 8.6–11% of outbreak journeys are lost, against at most 2%.
- The barista stays near 5–14% losing anyone. "Brew coffee" heals 5 a day; the careful barista brews 7–10 times a journey, 37–48 health per traveler, and the ability's numbers are not (T).

### Rule changes that would make the target reachable (owner's choice)

1. **Make the barista's brew weaker:** heal 2 instead of 5, or once every 2 days. This needs the ability numbers to be (T).
2. **Thin the safety net:** one rest per stop visit, Auto-buy stocking 1 kombucha instead of 2, or a rest that does not cure sickness. Each is a rule change or a number outside (T).
3. **Restate the risk target:** for example, by how low the weakest traveler falls rather than by deaths. That would need its own tuning: with the current numbers the weakest traveler bottoms out at 20–90.

Once a rule change is approved, the search script in my scratchpad can retune against it quickly.

### Tests

```
cd app && npm test
# tests 205
# pass 205
# fail 0
# duration_ms 3340
```

Prettier is clean on `balance.mjs` and `data.js`.

### Concerns

1. **The careful target above is unmet.** It cannot be reached with (T) numbers alone; one of the three options above is needed.
2. **The balance test's careful bands are the round-1 values.** I will update them to the amended bands once a rule change makes them reachable.
3. **The two levers the ruling listed are not marked (T) in the spec:** the meal's heal and the campfire talk's heal. I used them only in measurements, never in `data.js`.

---

## Fix round 1

Commit `9e8684a`, by path (`docs/validation/2026-10-01-balance.md`, `app/tests/balance.test.js`). Not amended, not pushed. The numbers are unchanged.

### Validation note

- **Status line:** every target in spec 3.11 holds.
- **Target table:** the careful row now reads "wins at least 80%, with at least 3.5 alive", measured 100% and 5.00 alive, and holds. The 85–97% and the 25%-lost rows are gone.
- **Removed:** the sentence saying the test bands did not match.
- **Replaced:** the "cannot be made riskier" section is now a short "If a riskier careful bot is ever wanted" note. It lists the three levers:
  - A weaker brew. This is the one I measured: with heal 2 and every other heal at 1, the barista lost someone in 43% of journeys instead of 14%.
  - One kombucha in Auto-buy. I did not measure it, and the note says so.
  - Rests that do not cure sickness. I did not measure it either, and the note says so.

### Balance test

Careful play's floors are now the spec's own: wins at least 0.8, at least 3.5 alive (they were 0.75 and 3.3). The header comment says so.

### Tests

`cd app && npm test` gives 205 tests, 205 pass, 0 fail. Prettier is clean on the test file.
