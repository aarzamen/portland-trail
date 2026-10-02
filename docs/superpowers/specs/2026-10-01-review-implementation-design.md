# The Portland Trail 0.2: review implementation design

Date: October 1, 2026. Source of requirements: the [code and architecture review](../../reviews/2026-10-01-code-and-architecture-review.md). The owner asked for all of its changes to be implemented. Item ids in brackets (B1, D4, A1, F3, …) refer to that review. This document is the binding authority for the [implementation plan](../plans/2026-10-01-review-implementation.md); where the plan and this document disagree, this document wins.

## 1. Scope

Implement every review item except those listed under "Not done" below. Preserve the premise, the humor, the green handheld-game identity, the resource ids (`money`, `food`, `fuel`, `ammo`, `parts`, `kombucha`, `nft`) and the profession ids (`influencer`, `dev`, `prepper`, `barista`). Existing saves (versions 1 and 2) must keep loading.

Not done, with reasons:

- **E6** (move the handoff archive out of the repository). It needs a published GitHub release and only shrinks the repository if history is rewritten; AGENTS.md forbids force-pushes and deleting original assets. Left for the owner.
- **New illustrations.** No image-generation tool is available. New encounters reuse existing art and three so far unused originals.
- **L7 in part.** The title, victory and loss signs are repaired. The motel's "VAC_NCY" reads as a broken neon sign and stays. Small background lettering in other scenes stays.
- **WebKit Playwright run.** It needs a browser runtime download that was not authorized. Safari is checked in the iOS Simulator instead.

## 2. Global constraints

- Static, dependency-free runtime. The game must run from `app/` served as plain files, with no install step. Development tools (Playwright, Prettier, TypeScript) are development dependencies only.
- Node 22 or newer. Native ES modules. No transpiler and no bundler.
- App version `0.2.0`. Save version `3`.
- The engine has no browser globals and no I/O. It never mutates the state it is given.
- One rule lives in one place. The interface contains no rule logic: every button, label, reason, cost and forecast comes from the engine's read-only functions (section 5). Every tunable number lives in `app/src/data.js`; sentences that mention numbers are built from those numbers.
- Tests assert mechanisms against the constants exported by `data.js`, not against copies of their values, because the balance task retunes them.
- Interface text stays live text. Nothing is baked into images except decorative signs.
- Every interactive control is at least 44 by 44 CSS pixels below 1000px wide. Editable controls use at least 16px text. No text is smaller than 12px. No horizontal scrolling from 320px to 1440px.
- All motion stops under `prefers-reduced-motion: reduce`, and the same information is still shown.
- Source lines are at most 120 characters. Prettier settings: single quotes, semicolons, 2 spaces, `printWidth` 120, `arrowParens` "avoid". A final formatting pass runs in the last task; do not reformat files you do not own.
- Original evidence and artwork under `docs/handoff/` and `images/` are never modified. Files under `app/assets/` are derived copies and may be regenerated or replaced.
- Paths in documents are relative. No machine-specific absolute paths in code.
- Commit only files your task owns, by path: `git add -- <paths>` then `git commit -m "<message>" -- <paths>`. Never `git add -A`, never `git commit -a`. Other tasks are committing to the same branch at the same time; if Git reports `index.lock`, wait two seconds and retry. Do not push.
- Commit messages describe state. End every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## 3. Rules

### 3.1 State (save version 3)

```js
/**
 * @typedef {Object} Traveler
 * @property {string} id         'traveler_1' … 'traveler_5'
 * @property {string} name       1–32 characters, control characters stripped, trimmed
 * @property {number} health     integer 0–100; 0 means dead
 * @property {boolean} sick
 * @property {null | { day: number, mile: number, cause: string }} death
 * @property {string} epitaph    '' while alive; at most 60 characters
 *
 * @typedef {Object} State
 * @property {3} version
 * @property {number} seed       uint32 the journey started from; never changes
 * @property {number} rng        uint32 generator state
 * @property {'influencer'|'dev'|'prepper'|'barista'} profession
 * @property {Traveler[]} party  exactly five
 * @property {{money:number, food:number, fuel:number, ammo:number, parts:number, kombucha:number, nft:number}} inventory
 * @property {'shop'|'location'|'travel'|'ended'} phase
 * @property {number} distance   integer 0–1000
 * @property {number} day        integer, starts at 1
 * @property {'slow'|'normal'|'fast'} pace
 * @property {'bare'|'meager'|'filling'} rations
 * @property {{ id: 'clear'|'drizzle'|'heat', until: number }} weather   non-clear weather lasts through day `until`
 * @property {null | { id: string, token: number }} pendingEvent
 * @property {{ day: number, text: string }[]} journal   newest last, at most RULES.journalLimit entries
 * @property {number} logged     total journal lines ever written
 * @property {null|'won'|'lost'} outcome
 * @property {{ nextToken: number, lastAbilityDay: number, wifiDownDay: number, talked: string[], meals: string[], luggageTraded: boolean }} flags
 */
```

Nothing that can be derived is stored: the current stop comes from `distance` and `phase`, "Deceased" from `health === 0`, the shop's stop from `distance`. `food` may be fractional (two decimals); every other inventory value is an integer. In phases `shop` and `location`, `distance` equals a stop's `miles`.

### 3.2 Numbers

Starting values. Task 3 retunes the ones marked (T) against the targets in 3.11 and may not change the others.

```js
export const RULES = {
  goalMiles: 1000,
  journalLimit: 200,
  eventChance: 0.3,            // (T) per driving day
  starvationDamage: 9,         // (T)
  sickDamage: 3,               // (T) per day while sick
  roadRest: { heal: 6 },       // (T)
  stopRest: { heal: 12 },      // (T) default for a stop whose `rest` gives no number
  forage: { damage: 3, sickChance: 0.15, prepperBonus: 4 },   // (T)
  push: { miles: 10, damage: 6 },                              // (T)
  hitchhike: { chance: 0.55, fuel: 4, damage: 10 },            // (T)
  luggage: { fuel: 6 },
  heat: { days: 2, foodMultiplier: 1.5, travelDamage: 2 },     // (T)
  drizzle: { days: 2, heal: 1, bonusMiles: 20, bonusFuel: 2 },
  healthBands: { good: 65, worn: 35 },
  supplies: { fuelFloor: 24, foodFloor: 40, bufferDays: 2, parts: 2, kombucha: 2, reserveCash: 100 },
  parDay: 21,
  rentPerDay: 65,
  score: { survivor: 200, cashPerPoint: 5, earlyDay: 15, lateDay: 10, lossMilesPerPoint: 5 },
};

export const PACES = {
  slow:   { name: 'Scenic',   miles: 50,  milesPerFuel: 25, wear: 1 },   // wear (T)
  normal: { name: 'Steady',   miles: 80,  milesPerFuel: 20, wear: 4 },
  fast:   { name: 'Floor it', miles: 110, milesPerFuel: 16, wear: 7 },
};

export const RATIONS = {
  bare:    { name: 'Bare',    food: 0.25, health: -3 },   // health (T)
  meager:  { name: 'Meager',  food: 0.5,  health: -1 },
  filling: { name: 'Filling', food: 1,    health: 2 },
};
```

Items (`ITEMS`, in this order; prices and yields (T), starting inventories fixed):

| id | name | short | price | max | effect numbers |
|---|---|---|---:|---:|---|
| `food` | Sustainably Sourced Kale Chips | Food | 4 | 100 | one food |
| `fuel` | Bio-Diesel Canister | Fuel | 12 | 40 | one fuel |
| `ammo` | Seed Bombs | Seeds | 18 | 6 | `yield: [2, 6]` food, at once |
| `parts` | Washi Tape & Vintage Screwdrivers | Repairs | 15 | 6 | repair uses 2 (developer: 1) |
| `kombucha` | Locally Brewed Kombucha | Kombucha | 16 | 6 | `heal: 10` each, cures sickness |
| `nft` | Pixelated Sasquatch JPEG | NFTs | 80 | 5 | `resale: 50` |

`money` has label "Cash", no price and no maximum. `max` limits purchases and gains: a gain never raises a value above `max` and never lowers a value that is already above it (old saves). A stop may override prices with `prices: { food: 6 }`.

Professions keep their names, descriptions and starting inventories from the current `data.js`. Each gets a structured ability; `describeAbility` fills `text` from the numbers:

| id | ability label | numbers | text template |
|---|---|---|---|
| `influencer` | Run a collab | `cooldown: 4, money: 45, food: 2` | Collab once every {cooldown} days for ${money} and {food} food. A Wi-Fi outage blocks it that day. |
| `dev` | Salvage parts | `cooldown: 4, parts: 2, repairCost: 1` | Salvage {parts} repair kits once every {cooldown} days. Breakdown repairs cost {repairCost} {kit|kits} instead of {standardCost}. |
| `prepper` | Scout for food | `cooldown: 4, food: 6, damage: 3` | Foraging finds {forageBonus} extra food. Scout for {food} food once every {cooldown} days, costing {damage} health per survivor. |
| `barista` | Brew coffee | `cooldown: 1, foodCost: 1, heal: 5` | Brew once a day: spend {foodCost} food to restore {heal} health to every living traveler. |

### 3.3 Days

`passDay(state, { traveling })` is the only way a day passes. In order:

1. `day += 1`.
2. If the weather is not clear and `day > weather.until`, it becomes clear and the journal notes "The weather clears."
3. Food. `need = RATIONS[rations].food × living × (heat ? RULES.heat.foodMultiplier : 1)`, rounded to two decimals. Eat `min(need, food)`.
4. If the party ate less than it needed, every living traveler loses `RULES.starvationDamage` (cause `starvation`) and the journal says so. Otherwise apply `RATIONS[rations].health` to each living traveler: a loss has cause `rations`.
5. If traveling: each living traveler loses the pace's `wear` (cause `road`), and `RULES.heat.travelDamage` more in heat (cause `heat`).
6. In drizzle each living traveler gains `RULES.drizzle.heal`.
7. Each sick living traveler loses `RULES.sickDamage` (cause `illness`).
8. If nobody is alive, the journey is lost.

Health stays within 0–100. The dead never heal and are never hurt again.

### 3.4 Dying

Every loss of health goes through one function that knows the cause. When health reaches 0 it records `death = { day, mile, cause }`, clears `sick`, sets `epitaph` to the default for that cause, and writes the cause's line to the journal (B6). `DEATHS` in `data.js`:

| cause | journal line | default epitaph |
|---|---|---|
| `starvation` | {name} has died of hunger, three miles from a farm-to-table bistro. | Would have preferred the tasting menu. |
| `rations` | {name} has died of thin rations. | Peaked at the last full meal. |
| `road` | {name} has died of the road itself. | Died as they lived: in the middle seat. |
| `heat` | {name} has died of heat, still wearing the beanie. | Refused to take off the beanie. |
| `illness` | {name} has died of a sickness nobody treated. | Said it was probably allergies. |
| `doomscrolling` | {name} has died of doomscrolling. | Scrolled to the end of the feed. |
| `food_poisoning` | {name} has died of mystery berries. | Was very confident about the berries. |
| `breakdown` | {name} has died of percussive maintenance. | Kicked the van. The van kicked back. |
| `wifi` | {name} has died offline. | Could not live without a signal. |
| `pandemic` | {name} has died in the outbreak. | Should have brought more kombucha. |
| `forage` | {name} has died foraging. | Lost a fight with a blackberry bush. |
| `scout` | {name} has died scouting ahead. | Went ahead. Stayed there. |
| `push` | {name} has died pushing the van. | Pushed the van. The van did not push back. |
| `hitchhike` | {name} has died walking for fuel. | Went for gas. Found peace instead. |
| `ebike` | {name} has died of a lecture. | Was told about their carbon footprint. |
| `sasquatch` | {name} has died chasing a blurry shape. | Got the content. Lost the plot. |
| `toll` | {name} has died of wet socks. | Forded the creek. Mostly. |
| `petitions` | {name} has died of civic exhaustion. | Signed one petition too many. |
| `unknown` | {name} has died. | The road keeps its reasons. |

The journey is lost only when nobody is alive ("The last traveler fell. The road to Portland ends here."). It is won when `distance` reaches `RULES.goalMiles` with at least one traveler alive ("Portland at last. The van and its survivors roll into town."). An empty tank no longer ends the journey (B2, F3).

### 3.5 Driving

`travel` is allowed in phases `travel`, `location` and `shop`. There is no `depart` action any more (B2, B3, B17).

- With `fuel < 1` it is refused: "The tank is dry. Buy fuel or try a last resort."
- `cap` is the pace's `miles`, or Steady's `miles` when the pace is Floor it and the weather is drizzle (F8).
- `miles = min(cap, milesToNextStop, floor(fuel × milesPerFuel))`. `fuelUsed = ceil(miles / milesPerFuel)` (D4: fuel follows miles).
- `passDay({ traveling: true })` runs first. If it ends the journey, nothing else happens.
- Then the van moves. The journal gets one line, in this order of preference (B8): the win line; "Arrived at {stop name}."; or "Drove {miles} miles to mile {distance}." Arrival sets phase `location`; otherwise the phase is `travel`.
- If the tank is now below 1 and the journey continues: "The tank is dry."
- If the journey continues, an encounter is rolled: one roll against `RULES.eventChance`, then one roll to pick by weight among encounters whose `where` range contains the new `distance`. The encounter becomes `pendingEvent` with a fresh token and its title is written to the journal.

Last resorts (F3), allowed in phases `travel` and `location` only while `fuel < 1`:

- `push`: `passDay({ traveling: false })`, then every living traveler loses `RULES.push.damage` (cause `push`), then the van moves `min(RULES.push.miles, milesToNextStop)` with the same arrival and win handling as driving. "The crew pushed the van {miles} miles to mile {distance}." No encounter is rolled.
- `hitchhike`: `passDay({ traveling: false })`; one roll picks a living walker, one roll against `RULES.hitchhike.chance`. Success adds `RULES.hitchhike.fuel` fuel: "{name} walked for fuel and came back with {fuel}." Failure costs the walker `RULES.hitchhike.damage` (cause `hitchhike`): "{name} walked all day and came back with blisters."
- `tradeLuggage`: once per journey; adds `RULES.luggage.fuel` fuel, no day passes: "A passing collector traded {fuel} fuel for the roof luggage. The van looks naked."

### 3.6 Stops and the road

`LOCATIONS` keeps its eleven stops, ids, names, short names, miles and descriptions. Each stop names a `scene` (section 6) instead of an image path. Activities and their numbers (B3, F7):

| stop | miles | activities | numbers |
|---|---:|---|---|
| `start_city` | 0 | shop | |
| `mushroom_market` | 100 | shop, talk | talk: 8 food |
| `first_stop` | 200 | rest, forage | `rest: { heal: 12 }`, `forage: [6, 10]` |
| `river_ferry` | 280 | rest, talk | `rest: { heal: 12 }`, talk: 1 repair kit |
| `sketchy_motel` | 350 | rest, shop | `rest: { heal: 30, cost: 45, label: 'Rent a room' }` |
| `viral_landmark` | 470 | talk, forage | `forage: [4, 8]`, talk: $65 |
| `forest_camp` | 570 | rest, forage, talk | `rest: { heal: 16 }`, `forage: [12, 18]`, talk: 8 health each |
| `crypto_meetup` | 670 | talk, shop | talk: 3 fuel |
| `food_truck_fest` | 750 | shop, meal | `meal: { costEach: 8, heal: 12, label: 'Eat at the carts' }`, `prices: { food: 6 }` |
| `bookshop` | 870 | shop, talk | talk: $45 |
| `portland` | 1000 | none | |

Talk lines keep their current wording. Rest stops (T): heal numbers may be retuned.

`REGIONS` describes the road between stops; it supplies the road scene, the heading and the forage range:

| id | from | to | name | scene | forage |
|---|---:|---:|---|---|---|
| `foothills` | 0 | 200 | Into the foothills | road-forest | [8, 12] |
| `river` | 200 | 350 | Along the river | road-river | [10, 14] |
| `pines` | 350 | 570 | The long way through the pines | road-forest | [8, 12] |
| `forest` | 570 | 750 | Deep in Cascadia | road-forest | [10, 16] |
| `outskirts` | 750 | 870 | The outskirts of somewhere | road-forest | [5, 9] |
| `city` | 870 | 1000 | Portland is getting closer | road-city | [3, 6] |

Activities:

- `rest`. On the road (phase `travel`): a day passes, then every living traveler gains `RULES.roadRest.heal`. At a stop with `rest`: pay `cost` if there is one (refused without the cash), a day passes, then sickness is cured and every living traveler gains the stop's `heal`.
- `forage`. On the road (the region's range) or at a stop with `forage` (the stop's range). A day passes; every living traveler loses `RULES.forage.damage` (cause `forage`); food is `min + floor(roll × (max − min + 1))`, plus `RULES.forage.prepperBonus` for the prepper. A second roll below `RULES.forage.sickChance` makes one random living traveler sick (a third roll picks them): "{name} ate something that disagreed."
- `meal`. At a stop with `meal`, once per stop per journey: pay `costEach × living`, every living traveler gains `heal`. No day passes.
- `talk`. As now: once per stop.
- `useItem` with `ammo` or `kombucha`, in phases `travel` and `location`. Seed bombs roll `yield`. Kombucha heals and cures.
- `sellNft`, in phase `shop`.
- `ability`, in phases `travel` and `location`, with the cooldowns and effects in 3.2. The scout's damage has cause `scout`.
- `openShop` at a stop with a shop; `leaveShop` returns to the stop.
- `purchase { cart }` and `autoPurchase` in phase `shop`. A purchase is refused as a whole when any quantity is not a whole number from 0 to 1000, when no quantity is above 0, when an item would exceed its `max` ("The van can hold only {max} {name}."), or when the total exceeds the cash.
- `setPace`, `setRations` in every phase except `ended`.
- `setEpitaph { memberId, text }` for a dead traveler, at any time, even after the journey has ended or while an encounter is pending. Text is trimmed and must be 1–60 characters with no control characters.

### 3.7 Weather and sickness

- Heat (from the heatwave encounter) lasts `RULES.heat.days` days: `weather = { id: 'heat', until: day + RULES.heat.days }`. Effects are in 3.3.
- Drizzle (from the drizzle encounter) lasts `RULES.drizzle.days` days, heals a little each day and caps Floor it at Steady's miles.
- Weather names for display: Clear, Perfect drizzle, Heatwave (B5: weather now ends).
- A sick traveler loses health every day until cured by kombucha or by a rest at a stop (B14, F10). Status shown to the player comes from one function: Deceased; else Sick; else by health: Healthy (at least `healthBands.good`), Worn down (at least `healthBands.worn`), Hanging on.

### 3.8 Encounters

`EVENTS` is data: `{ id, title, description, type, scene, weight, where?: { from, to }, choices: [{ id, label, only?, needs? }], …numbers, …result templates }` (A3). `type` is `auto` (one Continue button), `choice`, or `critical` (a choice list shown as a critical moment). `only` restricts a choice to one profession; other professions never see it. `needs` is `{ <resource id>: amount }`; a visible choice with unmet needs is shown disabled with the reason. Each encounter's effect is a function looked up by id; saves store only the id and token. Random picks are among living travelers.

| id | title | type | scene | weight | where |
|---|---|---|---|---:|---|
| `tiktok_distraction` | Existential Doomscrolling Spiral | auto | doomscrolling | 12 | |
| `nft_auction` | Pop-Up NFT “Art” Fair | choice | nft | 9 | |
| `food_poisoning` | Food Poisoning from Foraged Berries | choice | illness | 10 | |
| `van_breakdown` | Vehicle “Quirk” (Breakdown) | choice | breakdown | 12 | |
| `good_weather` | Perfect Portland-esque Drizzle | auto | travel | 9 | |
| `bad_weather` | Unexpected Heatwave | auto | heatwave | 10 | |
| `found_supplies` | Abandoned Free Box! | auto | free-box | 9 | |
| `wifi_outage` | Local ISP Outage! | auto | wifi | 9 | |
| `pandemic_death` | Sudden Pandemic Relapse | critical | outbreak | 2 | |
| `ebike_convoy` | E-Bike Convoy Claims the Lane | choice | bike-convoy | 7 | 100–870 |
| `sasquatch` | Blurry Shape in the Treeline | choice | road-forest | 6 | 350–750 |
| `toll_troll` | Toll Under the Bridge | choice | road-river | 6 | 200–350 |
| `brunch_line` | Brunch Line Across the Highway | choice | road-city | 6 | 870–1000 |
| `petition_gauntlet` | Sidewalk Petition Gauntlet | choice | city-street | 6 | 750–1000 |

Existing descriptions stay, except the pandemic's, which becomes "A devastating outbreak catches up with the van." New descriptions:

- `ebike_convoy`: "Forty riders, one lane, and a shared belief that the van is the problem."
- `sasquatch`: "Something tall crosses the road ahead and stops to look at the van."
- `toll_troll`: "A man in a reflective vest has installed himself beneath the overpass with a card reader."
- `brunch_line`: "The line for a new brunch spot has crossed two lanes and is still growing."
- `petition_gauntlet`: "Clipboards approach from both sides. Every cause is urgent and none of them are the same."

Effects. Numbers (T) live on the encounter's data object under the names in braces.

- `tiktok_distraction`: one random traveler loses {damage: 8} (cause `doomscrolling`). "{name} lost {damage} health to doomscrolling."
- `nft_auction`:
  - `invest` "Trade one NFT" (needs nft 1): lose 1 NFT; a roll below {winChance: 0.4} pays {win: 220}, otherwise {lose: 15}. "The JPEG sold for ${money}."
  - `consult` "Offer to audit their smart contract" (only `dev`): gain {consultFee: 60}. "You found the bug. It was the entire contract. They paid ${money} anyway."
  - `wait` "Scoff and wait it out": "You waited out the fair with performative cynicism."
- `food_poisoning` (one roll picks the victim):
  - `treat` "Open the emergency kombucha" (needs kombucha 1): lose 1 kombucha; victim loses {treatedDamage: 8} (cause `food_poisoning`). "{name} lost {damage} health and a bottle of kombucha to mystery berries."
  - `ride` "Let nature take its course": victim loses {damage: 22} and becomes sick. "{name} lost {damage} health to mystery berries and is now sick."
- `van_breakdown`:
  - `repair` "Use repair supplies" (needs parts 2; the developer needs `repairCost`): "The van runs again after {parts} repair {kit|kits}."
  - `tow` "Pay a tow truck" (needs money {towCost: 90}): "A tow truck named Destiny hauled the van to a mechanic for ${money}."
  - `kick` "Try percussive encouragement": a roll below {kickChance: 0.45} works: "A gentle kick worked. Nobody understands why." Otherwise a day passes (not traveling) and every living traveler loses {kickDamage: 5} (cause `breakdown`): "The kick cost a day and {damage} health per survivor."
- `good_weather`: weather becomes drizzle. In phase `location`: gain `RULES.drizzle.bonusFuel` fuel, "Arriving early saved {fuel} fuel before the next stretch." Otherwise the van moves `RULES.drizzle.bonusMiles` miles with normal arrival and win handling, "Clear roads add {miles} miles."
- `bad_weather`: every living traveler loses {damage: 6} (cause `heat`); weather becomes heat. "The heatwave costs every survivor {damage} health and will last {days} more days."
- `found_supplies`: gain {food: 8} food and {fuel: 2} fuel. "The free box held {food} food and {fuel} fuel."
- `wifi_outage`: every living traveler loses {damage: 3}, or {influencerDamage: 8} when the profession is `influencer` (cause `wifi`); `flags.wifiDownDay = day`. "The Wi-Fi outage drained the party’s spirit."
- `pandemic_death` (D2: answerable; nobody dies of a roll the player could not influence):
  - `kombucha` "Dose everyone with kombucha" (needs kombucha {kombuchaCost: 2}): every living traveler loses {dosedDamage: 6} (cause `pandemic`). "It took {bottles} {bottle|bottles} of kombucha and a lot of confidence to hold the outbreak to {damage} health each."
  - `quarantine` "Quarantine in the van": {quarantineDays: 2} days pass (not traveling), every living traveler loses {quarantineDamage: 8} (cause `pandemic`) and sickness is cured. "A {days}-day quarantine cost {damage} health each and most of the snacks."
  - `push_on` "Drive through it": the living traveler with the lowest health (first in party order on a tie) loses {worstDamage: 45}; every other living traveler loses {damage: 15} and becomes sick (cause `pandemic`). "You drove through it. {name} took the worst of it; everyone else is sick."
- `ebike_convoy`:
  - `wait` "Crawl along behind them": lose up to {fuel: 2} fuel; every living traveler gains {heal: 2}. "You idled behind the convoy for an hour. It cost {fuel} fuel; the fresh air was free."
  - `honk` "Honk, apologetically": a roll below {honkChance: 0.5}: "They parted like a slow, judgmental sea." Otherwise every living traveler loses {damage: 4} (cause `ebike`): "An organizer explained the van's carbon footprint for forty minutes. Everyone lost {damage} health."
  - `trade` "Offer a round of pour-overs" (only `barista`, needs food 2): lose 2 food, gain {tips: 35}. "The convoy tipped ${money} for roadside pour-overs and waved you through."
- `sasquatch`:
  - `photo` "Take the photo": gain {photo: 25}, or {viralPhoto: 120} for the `influencer`. "The photo sold for ${money}. The shape was a tall man named Greg."
  - `chase` "Chase it for the content": one random traveler loses {damage: 10} (cause `sasquatch`); a roll below {nftChance: 0.35} adds 1 NFT: "{name} lost {damage} health in the brush and came back with an authenticated Sasquatch JPEG." Otherwise: "{name} lost {damage} health in the brush. The shape declined to comment."
  - `leave` "Leave it its privacy": every living traveler gains {heal: 3}. "You left it alone. Everyone feels {heal} health better about themselves."
- `toll_troll`:
  - `pay` "Pay the toll" (needs money {toll: 30}): "You paid ${money}. He gave you a receipt printed on birch bark."
  - `riddle` "Answer his riddle instead": a roll below {riddleChance: 0.5}: "The answer was “gentrification.” He let you through." Otherwise lose up to {fine: 50} cash and every living traveler loses {damage: 3} (cause `toll`): "Wrong. The fine was ${money} and {damage} health each for the lecture."
  - `ford` "Ford the creek like it is 1848" (only `prepper`): one random traveler loses {fordDamage: 6} (cause `toll`). "The van forded the creek. {name} lost {damage} health to wet socks."
- `brunch_line`:
  - `wait` "Wait it out": lose up to {fuel: 2} fuel, gain {food: 6} food. "Two hours later the line moved. It cost {fuel} fuel; someone handed you {food} food in leftovers."
  - `detour` "Take the long way around": lose up to {detourFuel: 3} fuel. "The detour cost {fuel} fuel and passed three more brunch lines."
  - `post` "Post about the line" (only `influencer`; refused while the Wi-Fi is out today): gain {sponsor: 40}. "Your post about the line got you waved through and ${money} in sponsored hash browns."
- `petition_gauntlet`:
  - `sign` "Sign everything": every living traveler loses {damage: 3} (cause `petitions`). "Eleven signatures later, everyone is {damage} health more tired and on nine mailing lists."
  - `donate` "Give ${donation} to make it stop" (needs money {donation: 20}): "${donation} bought silence and a tote bag."
  - `call` "Take a very important call" (only `dev`): "You paced in a circle saying “let's circle back” until they left."

No sentence spells out a tunable number in words or digits; every number in a sentence comes from a slot, and a noun that follows a number takes the `{one|many}` plural form. Every resolution writes its result line to the journal, then checks for the end of the journey. An encounter resolves exactly once: the token must match.

### 3.9 Score (F4)

`summarize(state)`:

- Won: `score = survivors × score.survivor + round(mean health of survivors) + floor(money / score.cashPerPoint) + (parDay − day) × (day <= parDay ? score.earlyDay : score.lateDay)`, never below `score.survivor`.
- Lost or unfinished: `score = floor(distance / score.lossMilesPerPoint)`, so every win outranks every loss.
- `rentDays = floor(money / RULES.rentPerDay)`.

`RANKS` (first match wins; thresholds (T)):

| won, score at least | title | line |
|---:|---|---|
| 1300 | Portland Royalty | A studio apartment, a standing brunch reservation, and opinions about bridges. |
| 1050 | Certified Local | You already complain about how much the city has changed. |
| 800 | Convincing Transplant | The lease is signed. The houseplants are aspirational. |
| 550 | Couch Surfer | You made it. Your friends' sofa is less sure. |
| 0 | Technically Arrived | Portland counts it. Barely. |

Lost at 700 miles or more: "Roadside Legend", "They will tell stories about the van that almost made it." Otherwise: "Cautionary Tale", "Somewhere, a parent is saying “I told you so.”"

### 3.10 Seeds and names (F11, F12)

`createGame` takes a uint32 `seed` and stores it unchanged. The generator starts at `rng = mix32(seed)`, the MurmurHash3 32-bit finalizer (`h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; h >>> 0`), so that neighbouring seeds such as 1, 2 and 3 play differently. `seedFromText(text)`: a string of only digits is parsed as a number modulo 2^32; anything else is hashed with 32-bit FNV-1a over its trimmed UTF-8 bytes. `dailySeed(date)` is `seedFromText('portland-trail-' + YYYY-MM-DD)` in local time. `NAME_POOL` holds: Kale, Juniper, Rowan, Birch, Echo, Sage, Fern, Wren, Indigo, Moss, River, Clementine, Atlas, Zephyr, Linden, Sorrel, Aspen, Marigold, Huck, Tansy, Cedar, Opal, Finch, Bodhi.

### 3.11 Balance targets (D1–D6)

Measured by `app/scripts/balance.mjs` over 2,000 seeds for each background, with three bots:

| bot | what it does | target |
|---|---|---|
| never shops | drives; when dry trades the luggage, then pushes | wins at most 5% |
| autopilot | Auto-buy at every shop, Steady, Meager, never rests, eats, forages or uses items or the ability; takes the first enabled choice that is not `only` | wins 30–55% |
| careful | Auto-buy; Filling rations while food lasts; talks; uses the ability; rests at stops when mean health is under 70; eats at the carts; kombucha when anyone is sick or under 40; treats, repairs and pays when it can; quarantines or doses in the outbreak | wins at least 80%, with at least 3.5 of 5 alive on average (attentive play is rewarded; the risk lives in the gap between this bot and autopilot) |

No bot may lose a journey in which every death was unavoidable; in particular the careful bot loses at most 2% of journeys in which the outbreak occurred. Backgrounds stay within 10 points of each other for each bot. Auto-buy from the default settings must leave every background able to reach the next shop.

## 4. Module layout

```
app/src/data.js              content and every tunable number
app/src/engine.js            public facade; re-exports everything in section 5
app/src/engine/random.js     generator, pick helpers, seedFromText, dailySeed
app/src/engine/state.js      createGame, journal, living/stop/region helpers, hurt/heal, passDay, finish
app/src/engine/actions.js    the action table (check, apply, describe), transition, availableActions
app/src/engine/events.js     encounter selection and effects
app/src/engine/selectors.js  forecast, statusOf, shopItems, recommendSupplies, summarize, options, describe*
app/src/engine/save.js       serializeGame, deserializeGame, migrations
app/src/build-info.js        build stamp (default values; replaced by the server and the build)
app/src/main.js              controller: state, dispatch, event wiring, dialog queue, drive animation
app/src/ui/storage.js        save envelope, legacy keys, records, settings, export and import
app/src/ui/render.js         region patching and focus keeping
app/src/ui/views.js          setup, title and shared fragments
app/src/ui/trip-views.js     game screen regions
app/src/ui/dialogs.js        encounter, outcome, memorial, journal, transfer and confirm dialogs
app/src/ui/sound.js          generated sounds
app/src/styles.css           tokens, scales, components
app/sw.js                    service worker
```

## 5. Engine contract

Everything below is exported from `app/src/engine.js`.

```js
createGame({ profession, names = DEFAULT_NAMES, seed })   // -> State; throws on bad input
transition(state, action)      // -> { state, error: string|null, notes: string[] }
availableActions(state)        // -> ActionOption[]
forecast(state)                // -> Forecast
statusOf(member)               // -> { id: 'dead'|'sick'|'good'|'worn'|'bad', label: string }
shopItems(state)               // -> ShopItem[]            (phase 'shop' only; otherwise [])
recommendSupplies(state)       // -> { cart, cost, remainingCash, complete, nextShopName, travelDays, fuelNeed }
paceOptions(state)             // -> { id, label, selected }[]
rationOptions(state)           // -> { id, label, selected }[]
summarize(state)               // -> Summary
shareText(state)               // -> string
describeAbility(professionId)  // -> string
describeItem(itemId)           // -> string
weatherName(state)             // -> 'Clear' | 'Perfect drizzle' | 'Heatwave'
currentStop(state)             // -> location | null   (the stop the van is at in phases shop and location)
lastStop(distance)             // -> location          (latest stop at or before this mile)
nextStop(distance)             // -> location | undefined
regionAt(distance)             // -> region
seedFromText(text)             // -> uint32
dailySeed(date = new Date())   // -> uint32
serializeGame(state)           // -> string; throws on an invalid state
deserializeGame(raw)           // -> State | null; accepts versions 1, 2 and 3
SAVE_VERSION                   // 3
```

- `transition` never throws for any action value, given a state produced by `createGame`, `deserializeGame` or `transition`, and never mutates `state`. It copies the action once (refusing one that cannot be copied) and checks and applies that copy. On refusal it returns the same `state` object, an error sentence written for a player (no internal ids, B15) and no notes. On success `notes` holds the journal lines this action wrote, oldest first.
- Gates, in order: an invalid action object is refused ("Choose a valid action."); `setEpitaph` skips the remaining gates; a finished journey refuses everything ("This journey has ended. Start a new one to play again."); a pending encounter refuses everything but `resolveEvent` ("Resolve the current encounter first."); `resolveEvent` with nothing pending is refused.
- Actions: `travel`, `openShop`, `leaveShop`, `purchase {cart}`, `autoPurchase`, `sellNft`, `rest`, `forage`, `meal`, `talk`, `useItem {itemId: 'ammo'|'kombucha'}`, `ability`, `setPace {pace}`, `setRations {rations}`, `resolveEvent {token, choiceId?}`, `push`, `hitchhike`, `tradeLuggage`, `setEpitaph {memberId, text}`.

```js
/**
 * @typedef {Object} ActionOption
 * @property {string} key      unique and stable: 'travel', 'rest', 'useItem:kombucha', 'event:repair', …
 * @property {Object} action   ready to pass to transition
 * @property {'primary'|'activity'|'ability'|'item'|'lastResort'|'event'} group
 * @property {string} label
 * @property {string} detail   what it costs and gives, with numbers
 * @property {boolean} enabled
 * @property {string} reason   why it is disabled; '' when enabled
 */
```

`availableActions` lists what is relevant in the current context, in display order: `travel` (primary; labelled "Leave for Portland" at mile 0, otherwise "Drive toward {short name}"), then activities (`rest`, `forage`, `meal`, `talk`, `openShop`, or `leaveShop` labelled "Back to {short name}"), the ability, items (`useItem:kombucha`, `useItem:ammo` when owned; `sellNft` in the shop when owned), then last resorts while the tank is dry. A relevant action that is blocked is listed with `enabled: false` and a reason ("Ready in 2 days.", "You have already spoken to everyone here.", "Costs $45; you have $20."). While an encounter is pending the list holds only its choices (group `event`; an `auto` encounter yields one option, key `event:continue`, label "Continue"). After the journey ends it is empty. It is built from the same checks `transition` runs, so an enabled option is always accepted and a disabled one always refused (A1).

```js
/**
 * @typedef {Object} Forecast
 * @property {{ miles: number, fuel: number }} today          what Drive would do now (0 miles with a dry tank)
 * @property {number} range                                   miles the current fuel covers at the current pace
 * @property {number} healthPerDay                            change per healthy traveler for one driving day now
 * @property {number} foodPerDay
 * @property {null | { id, name, shortName, away, days, fuel }} nextStop
 * @property {null | { id, name, shortName, away, days, fuel, food }} nextShop   null when no shop lies ahead
 * @property {{ fuel: number, food: number }} shortfall       what is missing to reach the next shop; 0 when enough
 */

/**
 * @typedef {Object} ShopItem
 * @property {string} id
 * @property {string} name
 * @property {string} description   from describeItem
 * @property {string} unit
 * @property {number} price         at this stop
 * @property {number} owned
 * @property {number} max
 * @property {number} canBuy        most that fits and can be afforded right now
 */

/**
 * @typedef {Object} Summary
 * @property {null|'won'|'lost'} outcome
 * @property {number} score
 * @property {{ title: string, line: string }} rank
 * @property {string} heading       ending headline written from the outcome and the survivors (B18)
 * @property {string} cause         how a lost journey ended, as a sentence; '' otherwise
 * @property {{ name: string, health: number }[]} survivors
 * @property {{ id: string, name: string, day: number, mile: number, line: string, epitaph: string }[]} fallen
 * @property {number} day
 * @property {number} distance
 * @property {number} money
 * @property {number} rentDays
 * @property {number} seed
 * @property {string} professionName
 */
```

`paceOptions` and `rationOptions` build their labels from the numbers, for example "Steady · 80 mi a day · 4 fuel · −4 health" and "Meager · 0.5 food each · −1 health" (D4).

`recommendSupplies` plans for the stretch to the next shop (or Portland) at the current pace and rations: days and fuel leg by leg with the real per-day arithmetic; food for those days. It first buys what the stretch needs, spending the reserve if it must, then tops up to `max(floor, need + bufferDays)` for fuel and food, `supplies.parts` repair kits and `supplies.kombucha` bottles while keeping `supplies.reserveCash`. It never exceeds an item's `max` and never buys NFTs or seed bombs.

## 6. Saves (A4, A7)

`serializeGame` validates and writes version 3. `deserializeGame` reads the three versions and returns a version 3 state or `null`.

- It rebuilds the state field by field. Unknown fields are dropped. Fields added after 3.0 take defaults when missing.
- It rejects (returns `null`): text that is not JSON, an unknown version, a party that is not five travelers with valid names and health, an unknown profession, pace or rations, inventory values that are negative or not numbers, a distance outside 0–1000, a day below 1.
- It repairs instead of rejecting: a `shop` or `location` phase whose distance is not a stop becomes `travel`; a pending encounter whose id no longer exists is dropped; unknown stop ids in `talked` and `meals` are dropped; a non-`ended` phase with nobody alive becomes a lost ending; an `ended` phase without an outcome becomes `lost`; a won journey is at mile 1000; a journal longer than the limit keeps its newest lines; a `shop` phase with a pending encounter becomes `location`; a death day later than the journey's day is clamped to it; journal lines are capped at 300 characters and their day clamped to the journey's day; control characters are stripped from names.
- Versions 1 and 2: `status === 'Sick'` becomes `sick: true`; health 0 or `Deceased` becomes a death with cause `unknown` at the saved day and mile; the weather text becomes `{ id, until: day }`; `locationId` and `shopReturn` are dropped; `seed` is the saved `rng`; `logged` is the journal length; new flags take defaults. Version 1 and 2 validation of the route is not repeated: the repairs above cover it.
- Inventory above an item's `max` is kept.

The interface stores one record (A7) under `the-portland-trail:save`:

```json
{ "app": "the-portland-trail", "format": 2, "game": { "version": 3 }, "ui": { "lastLeg": null } }
```

On start it reads that key. If it is missing it reads the legacy `the-portland-trail:v1` (a bare state as text) and `the-portland-trail:last-leg:v1`, migrates, writes the new record and removes the two legacy keys only after the new write succeeded. An unreadable save in either key is left untouched and reported. Other keys: `the-portland-trail:records` (best journeys), `the-portland-trail:settings` (`{ "sound": false }`).

Export code (F13): the save record as JSON, UTF-8, base64url, prefixed `PT2.`. Import accepts that code or the raw JSON of a record or of a bare state.

## 7. Assets

One script, `app/scripts/prepare-assets.py`, run with `uv run app/scripts/prepare-assets.py` from the project root. It declares its dependencies inline (PEP 723: Pillow, fontTools, brotli). It regenerates everything below from preserved sources and writes `app/assets/manifest.json` (source path and hash, crop, repairs, size, bytes and hash for every file). Its preview sheets go to `app/test-results/` (ignored by Git).

Scenes: `app/assets/scenes/<id>.webp` (WebP quality 82, at most 1536 wide) and `app/assets/scenes/<id>-960.webp` (960 wide, quality 78).

| id | source | crop (left, top, right, bottom) |
|---|---|---|
| title | images/the_portland_trail_00017.jpg | 0, 235, 1024, 965 |
| travel | 00008 | 0, 340, 1024, 940 |
| departure | 00005 | none |
| rest-stop | 00011 | none |
| motel | 00012 | 0, 195, 1024, 1024 |
| landmark | 00018 | none |
| crypto | 00010 | none |
| food-carts | 00001 | none |
| victory | 00016 | 0, 175, 1024, 1024 |
| loss | 00004 | 0, 180, 1024, 865 |
| breakdown | 00000 | 0, 340, 1024, 1024 |
| doomscrolling | 00013 | 0, 160, 1024, 1024 |
| illness | 00003 | none |
| free-box | 00015 | 0, 125, 1024, 1024 |
| wifi | 00002 | 0, 105, 1024, 865 |
| nft | 00014 | none |
| bike-convoy | 00006 | 287, 250, 1024, 900 |
| city-street | 00007 | 0, 110, 1024, 1024 |
| outbreak | 00009 | 0, 70, 1024, 930 |
| mushroom-market, river-ferry, forest-camp, bookshop, road-forest | docs/handoff/graphics-v2/<id>.png | none |
| road-river, road-city, heatwave | docs/handoff/graphics-v3/<id>.png | none |

Sprites, unchanged in content, from the graphics-v1 masters with the rectangles in the current `prepare-assets.py`: `app/assets/sprites/portrait-<profession>.png` (128×128), `app/assets/sprites/resource-<item>.png` (64×64), `app/assets/sprites/van.png` (256×128). App icons stay at `app/assets/icons/` with their current names and sizes, regenerated from `docs/handoff/graphics-v2/app-icon.png`.

Sign repairs (L7), applied to the derived copy before encoding and recorded in the manifest: the title sign reads "GLOBAL WARMING"; the victory signs read "WHITE STAG" over "PORTLAND OREGON" with a blank plate beneath, and "POWELL'S BOOKS"; the loss sign reads "GAME OVER" over "NO SIGNAL"; the breakdown scene's roadside sign reads "THE PORTLAND TRAIL" instead of "TRAL". Each repair paints the sign's interior flat in the sign's own colour and sets the words in the pixel typeface at a whole-number scale. If a repair cannot be made to look native at 1× and on a phone, leave that sign as it is and say so in the report.

Typeface (L5): "Portland Pixel", an original proportional pixel face drawn for this project. Source of truth: `app/scripts/pixel-font.txt`, one glyph per block as rows of `#` and `.`, eight rows per glyph (rows 1–7 hold capitals, row 8 is the descender row), widths 1–7 columns. The script builds `app/assets/fonts/portland-pixel.woff2` with 100 font units per pixel, 800 units per em, ascent 700, descent 100, and an advance of glyph width plus one pixel. It covers printable ASCII 32–126 and ‘ ’ “ ” – — … · ×. Display sizes are whole multiples of 8px so pixels stay square.

Removed from `app/assets/`: every `.jpg`, the `mobile/` folder, and the old `manifest.json`, `generated-manifest.json`, `mobile-art-manifest.json` and `mobile-images.json`; the old sprite PNGs move to `sprites/`. The scripts `prepare-generated-assets.mjs` and `prepare-mobile-art.mjs` are deleted (T4).

## 8. Build, offline and tooling

`app/src/build-info.js` (checked in):

```js
export const BUILD = { version: '0.2.0', sha: 'dev', branch: '', date: '', dirty: false, mode: 'dev' };
```

- `app/scripts/serve.mjs` serves `index.html`, `manifest.webmanifest`, `sw.js`, `src/**` and `assets/**`, with types for `.webp` and `.woff2`. It answers `src/build-info.js` itself with the real version, short commit, branch, commit date and dirty flag from Git and `mode: 'dev'` (falling back to the file when Git is unavailable). `--dist` serves the built output unchanged. `PORT` selects the port; `PORT=0` picks a free one and the chosen URL is printed.
- `app/scripts/build.mjs` writes `app/dist/`: `index.html`, `manifest.webmanifest`, `sw.js`, `src/**` and `assets/**` except `*.json` (T5). It writes `dist/src/build-info.js` with the real stamp and `mode: 'build'` (F6). It adds `?v=<sha>` to the `./src/styles.css` and `./src/main.js` references in `index.html` and to every relative import specifier in `dist/src/**/*.js` (T5). It writes the list of files to precache, and the stamp, into `dist/sw.js`.
- `app/sw.js` (F5). Cache name `portland-trail-<sha>-<digest>`, where the digest is a short hash of every built file except the worker itself, so that a rebuild at the same commit with changed files still installs a new worker and a new cache. Install: precache the shell (HTML, CSS, JS, manifest, icons, sprites, fonts). Activate: delete older `portland-trail-*` caches and take control. Fetch, same-origin GET only: HTML, JS and CSS are network-first with a three-second timeout and a cache fallback; everything else is cache-first and cached on first use. Message `{ type: 'cache-scenes', urls: string[] }` caches those URLs in the background and answers every client with `{ type: 'scenes-cached', count }`. The source file must be valid without the build (an empty precache list and stamp `dev`).
- The interface registers `./sw.js` only when `BUILD.mode === 'build'`. In `dev` mode it unregisters any worker for the scope and deletes `portland-trail-*` caches, so a built copy served earlier on the same port cannot shadow the source.
- `app/scripts/checksums.mjs` (E5) rewrites `checksums.json` (every tracked or untracked-and-not-ignored file except itself: sorted keys, two-space indent, trailing newline) and `docs/handoff/checksums.json` (the same for files under `docs/handoff/`, keys relative to that folder). `--check` changes nothing and exits 1 with the list of stale, missing and extra entries.
- `app/scripts/test-browser.mjs` builds, starts one server for the source and one for `dist` on free ports, runs every `app/tests/browser-*.mjs` with `TEST_URL` and `TEST_DIST_URL`, stops the servers, and exits non-zero if any suite failed.
- `app/package.json`: version `0.2.0`; scripts `test`, `test:browser`, `build`, `start`, `dev`, `assets`, `balance`, `checksums`, `checksums:check`, `format`, `format:check`, `typecheck`; development dependencies `playwright`, `prettier`, `typescript` and `@types/node`, with a committed lock file (T3). `npm start` builds and serves the build; `npm run dev` serves the source. `npm test` stays free of installs.
- `app/jsconfig.json` type-checks `src/**/*.js` and `tests/*.test.js` with `checkJs` and `"types": ["node"]` (S2). `.prettierrc.json` and `.prettierignore` live in `app/` (S1).
- `.github/workflows/test.yml` (T1): on push and pull request, Node 22: `npm test` in `app/`, then `node app/scripts/checksums.mjs --check`, then `npm ci`, `npm run format:check` and `npm run typecheck`.
- `index.html` references exactly `./src/styles.css` and `./src/main.js`, sets `viewport-fit=cover` (T6) and preloads the typeface.

## 9. Interface

The interface is a projection of the engine. `main.js` keeps the journey state, sends actions through `transition`, saves, and asks the views to draw. Views are functions from data to HTML text; they never compute rules.

### 9.1 Drawing (A5, B10, B11)

The game screen is a fixed shell of named regions. After each change the controller computes each region's HTML and replaces a region only when its HTML changed. If the focused element is inside a replaced region, focus returns to the element with the same `data-key`, or to the primary action. Each piece of information exists once in the page: one supplies list, one crew list, placed by CSS for phone and desktop. Whether the route list is open is remembered across redraws.

Regions, in document order: top line (expedition, weather, day); scene (art or road, stamp, heading, text, primary action, forecast); latest notes; route; last leg; supplies; crew; actions (or shop, or ending); settings (pace and rations, in every phase but `ended`); journal.

### 9.2 Screens

- **Title.** Start a new journey; Resume journey or View saved ending when a save exists; "Move a journey between devices" (F13); best score when records exist; the build stamp.
- **Step 1, background.** Radio cards with keyboard arrows as now; ability text from `describeAbility`; starting kit; Back to the title (B19); Continue.
- **Step 2, crew and road.** Five name fields that keep what was typed when going back and forth (B13) and select their text on focus; "Shuffle names" (F11); a road choice (F12): Surprise me, Today's road (the daily seed), or a seed of your own (text); Back; Pack the van.
- **Shop.** Auto-buy plan with its cost and what is left; one row per item from `shopItems` with owned / max, a quantity stepper (− and +, at least 44px, and Max) and a Buy button showing the total; Sell one NFT; pace and rations; primary action Drive (or "Leave for Portland"); "Back to {stop}".
- **Stop and road.** Buttons from `availableActions`, grouped: activities, ability, supplies to use, last resorts. Each shows its label and its detail; a disabled one shows its reason. Under the primary action, the forecast (F3): today's miles, fuel and health change; the range; the next fuel stop and distance; and a warning when `shortfall.fuel > 0`.
- **Ending** (F4, B16, B18). Heading and cause from `summarize`; miles, days, survivors; score, rank and its line; days of rent; a headstone for each fallen traveler with its epitaph and an Edit control; Read the whole journal; Copy result (and Share where the browser offers it); best journeys (top five); the seed with "Replay this seed"; Start another journey, which goes straight to step 1 once a journey has ended.
- **Footer.** The tagline and the build stamp: `v0.2.0 · <sha> · <branch> · <date>`, with `+` after the sha when dirty; in the checked-in fallback, `v0.2.0 · dev` (F6).

### 9.3 After an action

1. Save.
2. Driving with motion allowed: play the drive for 950 ms. Until it ends the screen is drawn from the state before the action (B7), and the next scene's art is preloaded (E3).
3. Draw the new state. New journal lines appear in the latest-notes region (F1), which is a polite live region.
4. For each traveler who died in this action, show a memorial (F2): the name, the journal's death line, an epitaph field holding the default, "Carve it" (saves the text through `setEpitaph`) and "Leave it". Closing it any way keeps the default.
5. If an encounter is pending, show it. Its text types itself out (L4) and can be completed with a click or a key; the choices are usable at once.
6. After a choice the dialog stays open and shows the result lines with "Keep going" (F1). Then memorials, then the screen.

The encounter dialog cannot be dismissed: Escape is cancelled, and if the browser closes it anyway (second Escape, Android back) it reopens while the encounter is pending; a refused action also redraws the dialog (B1). The other dialogs close normally.

### 9.4 Messages (S4, B12)

Persistent storage problems stay in the banner at the top. Everything transient is a toast near the bottom of the viewport: confirmations in the phosphor style with `role="status"`, refusals in the amber style with `role="alert"`. A toast leaves after five seconds or on the next action. Changing screen clears transient messages.

### 9.5 Other

- Whole journal (E4): a dialog listing every stored line, grouped by day.
- Records: when a journey ends, store its summary once (key: seed, day, distance and score) and keep the ten best by score.
- Transfer (F13): a dialog with Copy save code, Download save file, and a field to paste a code and load it. Loading replaces the current journey after a confirmation when one exists.
- Sound (L8): a toggle in the masthead, off by default, remembered. Short generated tones (Web Audio oscillators, no files) for drive, arrival, encounter, good and bad results, purchase, death, win and loss.
- Offline (F5): register the worker as in section 8; after it is ready send the scene URLs for this device's variant; show "Ready to play offline" once when it answers.
- Focus (B9): every control shows the focus ring, including the selected background card; `<main>` shows none.
- Multi-tab: when another tab changes the save (`storage` event), the title screen refreshes its Resume state.

## 10. Look (S3, L1–L6)

- Tokens. Base colours: ink `#07110a`, ink-2 `#102015`, pine `#18331b`, moss `#426e35`, phosphor `#a4c96a`, paper `#e1eacb`, amber `#d9b76c`, quiet `#92a588`, line `#3a5039`, rust `#c8553d`. Surfaces, borders and tints are derived from them with `color-mix()`. Outside the token block the stylesheet uses at most 12 literal colours.
- Type. Sizes in `rem` from one scale: 0.75, 0.8125, 0.875, 1, 1.125, 1.25, 1.5, 2 and the display steps. Nothing below 0.75rem. Body text 0.875rem; controls 1rem. At most four letter-spacings.
- Display face. "Portland Pixel" for the title, scene headings, dialog titles and the score, at whole multiples of 8px (16, 24, 32, 40, 48, 64, 80, 96). Body text stays in the system monospace stack.
- Health bars change colour by band (phosphor, amber, rust) and show the number.
- Supply labels are never truncated; use the short names where space is tight.
- Route map (L6): every stop marked and labelled with its short name where there is room (at least the previous, current and next stop on phones), shops marked, a small van at the current mile that moves during the drive. The full list stays available.
- Console touches (L4): faint scanlines over the scene, a soft glow on the title, typed encounter text, a blinking cursor after the latest note.
- Safe areas: paddings use `env(safe-area-inset-*)`, now active through `viewport-fit=cover`.

## 11. Verification

- `npm test`: rules, encounters, shop, selectors, saves, a fuzz run and the balance targets.
- `npm run test:browser`: the suites listed in the plan, in installed Chrome, against the source and the built output.
- A full winning route and a full losing route through visible controls (AGENTS.md).
- Viewports 320×568, 375×548, 390×664, 402×681, 414×715, 430×739, 440×763, 756×352, 844×390, 874×402, 1024×768 and 1440×900.
- Keyboard-only play of setup, a drive, an encounter and a purchase.
- The installed app in the iOS Simulator: masthead clear of the status bar, portrait and landscape (T6).
- Offline: the built game reloads and plays with the network off.
