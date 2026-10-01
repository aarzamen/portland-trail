# The Portland Trail playable rebuild

## Intent and scope

Build a complete local browser game from the supplied handoff: five named travelers, four satirical backgrounds, scarce supplies, nine encounters, seven milestones across 1,000 miles, and distinct endings. Preserve the green handheld-game visual identity and specific humor. The user's development request and AGENTS.md authorize ordinary reversible design decisions and implementation without additional design approval gates. Publishing is a separate future step.

Use a dependency-free static frontend in `app/`, native JavaScript modules, semantic HTML, and CSS. A small build script copies deployable files to `app/dist/`. No backend, credentials, model, paid service, or remote fonts. Keep reference evidence and originals unchanged. Sites tools are discoverable but their local skills are unavailable in this session; prepare portable static output for later hosting.

## Experience

Start with an illustrated title screen and New journey / Resume actions. New journey presents four keyboard-operable backgrounds, their accurate abilities and starting supplies, then five editable names and a departure shop. Clear explanation precedes any replacement of an existing saved journey. Travel combines a landscape scene, mileage, next stop, resource counts, five health indicators, journal, and a reachable primary travel action. Locations offer only their configured activities and shops return to their origin. Event dialogs pause actions, restore after reload, and resolve exactly once. Endings show the actual result, survivors, distance, days, and replay.

Color tokens: ink #07110a, pine #18331b, moss #426e35, phosphor #a4c96a, paper #e1eacb, amber #d9b76c. Monospace system typography; large condensed-feeling title through deliberate sizing, regular readable body. Desktop uses a scene beside a compact field journal/status console. Phone prioritizes scene, resources, next action, with secondary details below. No fixed oversized HUD or forced 50vh padding. Illustration provides visual interest; border hierarchy resembles a handheld navigation console.

Use visually reviewed local scenes with semantic filenames. Do not reuse original incorrect mappings. Existing JPEG illustrations may contain decorative signs; avoid treating baked text as interface copy. First version uses static vehicle art rather than claiming unproduced animation. Resource concepts may be separated for UI use only after visual review; preserve all masters.

## Rules and saves

One pure transition function validates action costs and commits consequences, journal, arrival, and ending together. Save version 1 contains stable ids, RNG state, a pending-event token, and primitive data only. Reject malformed/unsupported saves without crashing or silently replacing them. A save-write failure leaves the session playable with a visible warning. New Game creates independent state. Terminal states ignore further game actions and remain resumable as an ending until explicitly replaced. Dead travelers never heal.

Keep original resource ids `money`, `food`, `fuel`, `ammo`, `parts`, `kombucha`, `nft`, and professions `influencer`, `dev`, `prepper`, `barista`. Preserve starting cash/food/fuel from the source. Deliberately retune prices and pace so starting budgets plus resupply support a route. Implement precise advertised profession abilities and actual seed-bomb/kombucha/NFT uses. Rest and forage must consume time and supplies or health. A lack of supplies must lead to meaningful consequences, not negative values or an endless free recovery loop.

## Integration contract

`app/src/data.js` exports PROFESSIONS and ITEMS and LOCATIONS and EVENTS as arrays; PACES and RATIONS as keyed objects; DEFAULT_NAMES as five strings. Profession fields: id, name, description, ability, inventory. Item fields: id, name, price, unit, description. Location fields: id, name, shortName, miles, description, activities, image. Event fields: id, title, description, type (auto/choice/critical), image, choices (array of id,label). Pace fields: name,miles,fuel. Ration fields: name,food (per living member).

`app/src/engine.js` exports createGame({profession,names,seed}), transition(state,action) -> {state,error}, serializeGame(state) -> string, deserializeGame(raw) -> state|null. No browser globals. Invalid actions leave the state unchanged and return a useful error. State fields: version, phase (location/travel/shop/ended), profession (id), party (id,name,health,status), inventory, locationId, distance, day, weather, pace, rations, pendingEvent (null or {id,token}), rng, journal (array of {day,text}), outcome (null/won/lost), shopReturn (the originating location id), flags. Initial state is shop at start_city on day 1; names support 1–32 characters. status values Healthy/Sick/Injured/Deceased. `distance` is capped at 1000.

Actions: {type:'travel'}, {type:'depart'}, {type:'setPace',pace}, {type:'setRations',rations}, {type:'openShop'}, {type:'leaveShop'}, {type:'purchase',cart:{itemId:integer}}, {type:'rest'}, {type:'forage'}, {type:'talk'}, {type:'useItem',itemId}, {type:'ability'}, {type:'resolveEvent',token,choiceId}. Only location actions allowed by data are accepted; travel permits rest/forage/consumable/ability as designed. `resolveEvent` requires current token. For auto/critical events choiceId is omitted. Asset paths are relative to app root.

## Acceptance

Meaningful regression tests cover audit F01-F07, every event branch, all backgrounds, unaffordable/invalid purchases, pending-event reload and double clicks, action restrictions, invalid saves, and permanent death. Preserve seeded successful and losing route evidence and check a small range of seeds. Browser verification covers setup, shop, travel, event reload, replay, keyboard controls, focus, and widths 390/414/430/768/1440. Inspect screenshots rather than inferring visual quality from successful requests. Physical-device Safari is outside available evidence until actually tested.
