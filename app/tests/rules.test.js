import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION,
  createGame,
  currentStop,
  dailySeed,
  deserializeGame,
  lastStop,
  nextStop,
  regionAt,
  seedFromText,
  serializeGame,
  transition,
  weatherName,
} from '../src/engine.js';
import {
  DEATHS,
  DEFAULT_NAMES,
  ITEMS,
  JOURNAL,
  LIMITS,
  LOCATIONS,
  PACES,
  PROFESSIONS,
  RATIONS,
  REFUSALS,
  REGIONS,
  RULES,
} from '../src/data.js';
import * as data from '../src/data.js';
import { ACTIONS, refusalFor } from '../src/engine/actions.js';
import { mix32 } from '../src/engine/random.js';
import { fill, finish, hurt } from '../src/engine/state.js';

// The game data as it was before any test ran.
const DATA_AT_LOAD = structuredClone({ ...data });

const TRAVEL = { type: 'travel' };
const ENDED = 'This journey has ended. Start a new one to play again.';
const DRY = 'The tank is dry. Buy fuel or try a last resort.';
// A mile with more open road ahead than the fastest pace covers in a day.
const ROAD = 355;
const CREW = 5;

const start = (profession = 'dev', seed = 21) => createGame({ profession, seed });
const stop = id => LOCATIONS.find(entry => entry.id === id);
const item = id => ITEMS.find(entry => entry.id === id);
const ability = id => PROFESSIONS.find(entry => entry.id === id).ability;
// Small whole-number seeds give nearly the same first roll, so samples use hashed seeds.
const seeds = count => Array.from({ length: count }, (_, index) => seedFromText(`rules-${index}`));
const clamp = health => Math.max(0, Math.min(100, health));
const round = value => Math.round(value * 100) / 100;

const onRoad = (state, distance = ROAD) => ({ ...state, phase: 'travel', distance });
const atStop = (state, id) => ({ ...state, phase: 'location', distance: stop(id).miles });
const stocked = (state, inventory) => ({ ...state, inventory: { ...state.inventory, ...inventory } });
const crew = (state, change) => ({
  ...state,
  party: state.party.map((member, index) => ({ ...member, ...change(member, index) })),
});
const healthAt = (state, health) => crew(state, () => ({ health }));
const fallen = (state, cause = 'unknown') => ({
  health: 0,
  sick: false,
  death: { day: state.day, mile: state.distance, cause },
  epitaph: DEATHS[cause].epitaph,
});
/** Everyone but the last traveler is already dead. */
const loneSurvivor = (state, health) =>
  crew(state, (member, index) => (index === CREW - 1 ? { health } : fallen(state)));
const pendingEvent = (state, id, token = 7) => ({
  ...state,
  pendingEvent: { id, token },
  flags: { ...state.flags, nextToken: token },
});

function act(state, action) {
  const result = transition(state, action);
  assert.equal(result.error, null, `${action.type}: ${result.error}`);
  return result.state;
}

function refusal(state, action) {
  const result = transition(state, action);
  assert.equal(typeof result.error, 'string', `${action.type} should be refused`);
  assert.equal(result.state, state, 'a refusal returns the same state object');
  assert.deepEqual(result.notes, []);
  return result.error;
}

/** The same state with a generator value from which the given action meets no encounter. */
function quiet(state, action = TRAVEL) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = { ...state, rng: seedFromText(`quiet-${attempt}`) };
    const result = transition(candidate, action);
    if (!result.error && !result.state.pendingEvent) return candidate;
  }
  throw new Error('no quiet day found');
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** One example of every action the engine accepts. */
const EVERY_ACTION = [
  { type: 'travel' },
  { type: 'openShop' },
  { type: 'leaveShop' },
  { type: 'purchase', cart: { food: 1 } },
  { type: 'autoPurchase' },
  { type: 'sellNft' },
  { type: 'rest' },
  { type: 'forage' },
  { type: 'meal' },
  { type: 'talk' },
  { type: 'useItem', itemId: 'ammo' },
  { type: 'useItem', itemId: 'kombucha' },
  { type: 'ability' },
  { type: 'setPace', pace: 'slow' },
  { type: 'setRations', rations: 'filling' },
  { type: 'resolveEvent', token: 7 },
  { type: 'push' },
  { type: 'hitchhike' },
  { type: 'tradeLuggage' },
  { type: 'setEpitaph', memberId: 'traveler_1', text: 'Gone.' },
];

test('the fixtures stand on open road', () => {
  const fastest = Math.max(...Object.values(PACES).map(pace => pace.miles));
  assert.ok(nextStop(ROAD).miles - ROAD > fastest);
  assert.equal(currentStop(onRoad(start())), null);
});

test('the action table lists every action under its own type', () => {
  assert.deepEqual(Object.keys(ACTIONS).sort(), [...new Set(EVERY_ACTION.map(action => action.type))].sort());
  for (const [type, entry] of Object.entries(ACTIONS)) {
    assert.equal(entry.type, type);
    assert.equal(typeof entry.check, 'function');
    assert.equal(typeof entry.apply, 'function');
  }
});

// --- A new journey ---------------------------------------------------------

test('a new journey starts in the shop at mile 0 with the background kit', () => {
  assert.equal(SAVE_VERSION, 3);
  for (const profession of PROFESSIONS) {
    const state = createGame({ profession: profession.id, seed: 77 });
    assert.equal(state.version, 3);
    assert.equal(state.phase, 'shop');
    assert.equal(state.distance, 0);
    assert.equal(state.day, 1);
    assert.equal(state.seed, 77);
    assert.equal(state.rng, mix32(77));
    assert.equal(state.profession, profession.id);
    assert.deepEqual(state.inventory, profession.inventory);
    assert.deepEqual(
      state.party,
      DEFAULT_NAMES.map((name, index) => ({
        id: `traveler_${index + 1}`,
        name,
        health: 100,
        sick: false,
        death: null,
        epitaph: '',
      })),
    );
    assert.equal(state.pace, 'normal');
    assert.equal(state.rations, 'meager');
    assert.equal(state.pendingEvent, null);
    assert.equal(state.outcome, null);
    assert.equal(weatherName(state), 'Clear');
    assert.equal(currentStop(state).id, 'start_city');
    assert.equal(state.logged, state.journal.length);
    assert.deepEqual(state.journal, [{ day: 1, text: JOURNAL.start }]);
    assert.deepEqual(state.flags.talked, []);
    assert.deepEqual(state.flags.meals, []);
    assert.equal(state.flags.luggageTraded, false);
  }
});

test('names are trimmed and may be 32 characters long', () => {
  const names = [' Kale ', 'A'.repeat(LIMITS.name), 'Rowan <b>', 'Birch', 'Echo'];
  const state = createGame({ profession: 'dev', names, seed: 1 });
  assert.deepEqual(
    state.party.map(member => member.name),
    ['Kale', 'A'.repeat(LIMITS.name), 'Rowan <b>', 'Birch', 'Echo'],
  );
});

test('names lose their control characters before they are trimmed and measured', () => {
  const names = ['Ka\nle', '\u0000 Juniper\t', 'Ro\u0085wan\r\n', `${'B'.repeat(LIMITS.name)}\u0007`, 'Echo\u007f'];
  const state = createGame({ profession: 'dev', names, seed: 1 });
  assert.deepEqual(
    state.party.map(member => member.name),
    ['Kale', 'Juniper', 'Rowan', 'B'.repeat(LIMITS.name), 'Echo'],
  );
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
  for (const bad of ['\n\t', '\u0000\u009f', ` \u0085 `]) {
    assert.throws(() => createGame({ profession: 'dev', names: [bad, ...DEFAULT_NAMES.slice(1)], seed: 1 }), /names/);
  }
});

test('two new journeys share no objects, with each other or with the data', () => {
  const pristine = structuredClone(start());
  const kit = structuredClone(PROFESSIONS.find(entry => entry.id === 'dev').inventory);
  const first = start();
  const second = start();
  assert.deepEqual(first, pristine);
  first.party[0].health = 0;
  first.inventory.money = 0;
  first.flags.talked.push('bookshop');
  first.flags.meals.push('food_truck_fest');
  first.journal.push({ day: 1, text: 'Scribble.' });
  first.weather.id = 'heat';
  assert.deepEqual(second, pristine);
  assert.deepEqual(start(), pristine);
  assert.deepEqual(PROFESSIONS.find(entry => entry.id === 'dev').inventory, kit);
  assert.deepEqual(pristine.inventory, kit);
});

test('a bad background, bad names and bad seeds are refused at the start', () => {
  const names = DEFAULT_NAMES;
  for (const profession of ['pirate', undefined, 'constructor', '__proto__']) {
    assert.throws(() => createGame({ profession, seed: 1 }), /background/);
  }
  /** @type {any[]} */
  const badNames = [
    names.slice(0, 4),
    [...names, 'Sage'],
    ['', ...names.slice(1)],
    ['   ', ...names.slice(1)],
    ['A'.repeat(LIMITS.name + 1), ...names.slice(1)],
    [42, ...names.slice(1)],
    'Kale',
  ];
  for (const bad of badNames) assert.throws(() => createGame({ profession: 'dev', names: bad, seed: 1 }), /names/);
  /** @type {any[]} */
  const badSeeds = [1.5, Number.NaN, Infinity, '42', null, undefined];
  for (const seed of badSeeds) assert.throws(() => createGame({ profession: 'dev', seed }), /seed/);
  assert.throws(() => createGame(), /background/);
  // A whole number outside 32 bits is wrapped into them, as the first game did.
  assert.equal(createGame({ profession: 'dev', seed: 2 ** 32 + 5 }).seed, 5);
  assert.equal(createGame({ profession: 'dev', seed: -1 }).seed, 4294967295);
  assert.equal(createGame({ profession: 'dev', seed: -1 }).rng, mix32(4294967295));
});

test('the generator starts at the seed mixed by the MurmurHash3 finalizer', () => {
  // The finalizer as the spec writes it.
  const finalizer = seed => {
    let h = seed;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  };
  for (const seed of [0, 1, 2, 3, 42, 77, 2 ** 31, 0xffffffff, seedFromText('kale')]) {
    assert.equal(mix32(seed), finalizer(seed), String(seed));
    assert.equal(createGame({ profession: 'dev', seed }).rng, finalizer(seed));
    assert.equal(createGame({ profession: 'dev', seed }).seed, seed, 'the seed itself is kept unchanged');
  }
  assert.notEqual(mix32(1), mix32(2));
});

test('neighbouring seeds meet encounters on the first drive as often as the odds say', () => {
  let met = 0;
  const games = 2000;
  for (let seed = 1; seed <= games; seed++) {
    const drove = act(createGame({ profession: 'dev', seed }), TRAVEL);
    if (drove.pendingEvent) met += 1;
  }
  const rate = met / games;
  assert.ok(Math.abs(rate - RULES.eventChance) <= 0.05, `${met} of ${games} first drives met an encounter`);
});

// --- Driving ---------------------------------------------------------------

test('the van can leave the starting shop with no other action', () => {
  const state = quiet(start());
  const result = transition(state, TRAVEL);
  assert.equal(result.error, null);
  assert.equal(result.state.phase, 'travel');
  assert.equal(result.state.day, 2);
  assert.equal(result.state.distance, PACES.normal.miles);
  assert.equal(currentStop(result.state), null);
});

test('fuel follows miles: a short day burns less than a full one (D4)', () => {
  const pace = PACES.normal;
  const first = act(quiet(start()), TRAVEL);
  assert.equal(first.distance, pace.miles);
  assert.equal(start().inventory.fuel - first.inventory.fuel, Math.ceil(pace.miles / pace.milesPerFuel));
  // The next stop is closer than a full day, so the second day is short.
  const left = nextStop(first.distance).miles - first.distance;
  assert.ok(left < pace.miles);
  const second = act(quiet(first), TRAVEL);
  assert.equal(second.distance, first.distance + left);
  assert.equal(first.inventory.fuel - second.inventory.fuel, Math.ceil(left / pace.milesPerFuel));
  assert.ok(Math.ceil(left / pace.milesPerFuel) < Math.ceil(pace.miles / pace.milesPerFuel));
  assert.equal(second.day, 3);
});

test('Scenic covers the first leg in ceil(leg / miles) days', () => {
  const pace = PACES.slow;
  const leg = LOCATIONS[1].miles;
  const days = Math.ceil(leg / pace.miles);
  let state = act(start(), { type: 'setPace', pace: 'slow' });
  const fuel = state.inventory.fuel;
  for (let day = 0; day < days; day++) state = act(quiet(state), TRAVEL);
  assert.equal(state.day, 1 + days);
  assert.equal(state.distance, leg);
  assert.equal(currentStop(state).id, LOCATIONS[1].id);
  assert.equal(fuel - state.inventory.fuel, Math.ceil(leg / pace.milesPerFuel));
});

test('with fuel for part of a day the van drives what it can and reports a dry tank', () => {
  const pace = PACES.normal;
  const fuel = 2;
  assert.ok(fuel * pace.milesPerFuel < pace.miles);
  const state = quiet(stocked(onRoad(start()), { fuel }));
  const result = transition(state, TRAVEL);
  assert.equal(result.error, null);
  assert.equal(result.state.distance, state.distance + Math.floor(fuel * pace.milesPerFuel));
  assert.equal(result.state.inventory.fuel, 0);
  assert.equal(result.notes.at(-1), 'The tank is dry.');
  assert.equal(result.state.outcome, null);
  assert.equal(result.state.phase, 'travel');
});

test('a dry tank refuses the drive and never ends the journey (B2)', () => {
  const motel = stocked(atStop(start(), 'sketchy_motel'), { fuel: 0, money: 900 });
  const shoulder = stocked(onRoad(start()), { fuel: 0, money: 0 });
  const inShop = { ...motel, phase: 'shop' };
  for (const state of [motel, shoulder, inShop]) {
    assert.equal(refusal(state, TRAVEL), DRY);
    assert.equal(state.outcome, null);
  }
  assert.equal(DRY, REFUSALS.tankDry);
  // The shop is still there to fix it, and the roadside still has its last resorts.
  const shop = act(motel, { type: 'openShop' });
  const fuelled = act(shop, { type: 'purchase', cart: { fuel: 5 } });
  assert.equal(act(quiet(fuelled), TRAVEL).phase, 'travel');
  assert.equal(act(shoulder, { type: 'tradeLuggage' }).inventory.fuel, RULES.luggage.fuel);
});

test('a day on the road writes one mileage line', () => {
  const state = quiet(onRoad(start()));
  const result = transition(state, TRAVEL);
  const miles = PACES.normal.miles;
  assert.deepEqual(result.notes, [fill(JOURNAL.drove, { miles, distance: ROAD + miles })]);
  assert.equal(result.notes[0], `Drove ${miles} miles to mile ${ROAD + miles}.`);
});

test('arriving writes the arrival line and no mileage line (B8)', () => {
  const market = stop('mushroom_market');
  const state = quiet(onRoad(start(), market.miles - 10));
  const result = transition(state, TRAVEL);
  assert.equal(result.state.phase, 'location');
  assert.equal(result.state.distance, market.miles);
  assert.equal(currentStop(result.state), market);
  assert.equal(result.state.journal.at(-1).text, `Arrived at ${market.name}.`);
  assert.ok(!result.notes.some(note => note.startsWith('Drove')));
});

test('reaching mile 1000 ends on the win line (B8)', () => {
  const state = onRoad(start(), RULES.goalMiles - 10);
  const result = transition(state, TRAVEL);
  assert.equal(result.state.outcome, 'won');
  assert.equal(result.state.phase, 'ended');
  assert.equal(result.state.distance, RULES.goalMiles);
  assert.equal(result.state.pendingEvent, null);
  assert.equal(result.state.journal.at(-1).text, 'Portland at last. The van and its survivors roll into town.');
  assert.deepEqual(result.notes, [JOURNAL.won]);
});

// --- Days, food and health -------------------------------------------------

test('a driving day changes health by the rations and the pace', () => {
  for (const [rations, ration] of Object.entries(RATIONS)) {
    for (const [pace, speed] of Object.entries(PACES)) {
      const base = { ...stocked(onRoad(start()), { food: 50, fuel: 30 }), rations, pace };
      const state = quiet(healthAt(base, 50));
      const after = act(state, TRAVEL);
      for (const member of after.party) {
        assert.equal(member.health, 50 + ration.health - speed.wear, `${rations} rations at ${pace} pace`);
      }
      assert.equal(round(state.inventory.food - after.inventory.food), round(ration.food * CREW));
    }
  }
});

test('a day without driving costs no wear', () => {
  const after = act(healthAt(onRoad(start()), 50), { type: 'rest' });
  for (const member of after.party) {
    assert.equal(member.health, 50 + RATIONS.meager.health + RULES.roadRest.heal);
  }
});

test('health stays between 0 and 100', () => {
  const full = act({ ...onRoad(start()), rations: 'filling' }, { type: 'rest' });
  for (const member of full.party) assert.equal(member.health, 100);
  const frail = quiet(healthAt({ ...onRoad(start()), rations: 'bare' }, 1));
  for (const member of act(frail, TRAVEL).party) assert.equal(member.health, 0);
});

test('running short of food costs starvation damage and empties the food', () => {
  const need = RATIONS.meager.food * CREW;
  const short = quiet(stocked(onRoad(start()), { food: need / 2 }));
  const result = transition(short, TRAVEL);
  assert.equal(result.state.inventory.food, 0);
  for (const member of result.state.party) {
    assert.equal(member.health, 100 - RULES.starvationDamage - PACES.normal.wear);
  }
  const line = fill(JOURNAL.shortFood, { damage: RULES.starvationDamage });
  assert.ok(line.includes(String(RULES.starvationDamage)) && !line.includes('{'));
  assert.ok(result.notes.includes(line));

  const enough = quiet(healthAt(stocked(onRoad(start()), { food: need }), 50));
  const fed = transition(enough, TRAVEL);
  assert.equal(fed.state.inventory.food, 0);
  assert.ok(!fed.notes.includes(line));
  for (const member of fed.state.party) {
    assert.equal(member.health, 50 + RATIONS.meager.health - PACES.normal.wear);
  }
});

test('the dead eat nothing', () => {
  const state = quiet(crew(onRoad(start()), (member, index) => (index < 2 ? fallen(start()) : {})));
  const after = act(state, TRAVEL);
  assert.equal(round(state.inventory.food - after.inventory.food), round(RATIONS.meager.food * (CREW - 2)));
});

// --- Weather ---------------------------------------------------------------

test('heat lasts its days, costs extra food and health on the road, then clears (B5, F8)', () => {
  // Each day starts from the same rested, stocked crew on open road, so only the weather differs.
  const again = state => healthAt(stocked(onRoad(state), { food: 60, fuel: 40 }), 80);
  let state = act(pendingEvent(again(start()), 'bad_weather'), { type: 'resolveEvent', token: 7 });
  assert.deepEqual(state.weather, { id: 'heat', until: state.day + RULES.heat.days });
  assert.equal(weatherName(state), 'Heatwave');
  const calm = RATIONS.meager.food * CREW;
  const calmHealth = RATIONS.meager.health - PACES.normal.wear;

  for (let day = 0; day < RULES.heat.days; day++) {
    const before = quiet(again(state));
    const result = transition(before, TRAVEL);
    const eaten = round(before.inventory.food - result.state.inventory.food);
    assert.equal(eaten, round(calm * RULES.heat.foodMultiplier));
    for (const [index, member] of result.state.party.entries()) {
      assert.equal(member.health, before.party[index].health + calmHealth - RULES.heat.travelDamage);
    }
    assert.ok(!result.notes.includes('The weather clears.'));
    assert.equal(weatherName(result.state), 'Heatwave');
    state = result.state;
  }

  const before = quiet(again(state));
  const result = transition(before, TRAVEL);
  assert.equal(result.notes[0], 'The weather clears.');
  assert.equal(weatherName(result.state), 'Clear');
  assert.equal(round(before.inventory.food - result.state.inventory.food), round(calm));
  for (const [index, member] of result.state.party.entries()) {
    assert.equal(member.health, before.party[index].health + calmHealth);
  }
  // Once clear, nothing more is announced.
  const later = transition(quiet(again(result.state)), TRAVEL);
  assert.ok(!later.notes.includes('The weather clears.'));
});

test('heat makes a resting day hungrier but adds no travel damage', () => {
  const base = healthAt(stocked(onRoad(start()), { food: 60 }), 50);
  const hot = { ...base, weather: { id: 'heat', until: base.day + RULES.heat.days } };
  const after = act(hot, { type: 'rest' });
  assert.equal(
    round(hot.inventory.food - after.inventory.food),
    round(RATIONS.meager.food * CREW * RULES.heat.foodMultiplier),
  );
  for (const member of after.party) {
    assert.equal(member.health, 50 + RATIONS.meager.health + RULES.roadRest.heal);
  }
});

test('drizzle holds Floor it to Steady miles and heals a little each day (F8)', () => {
  // Each day starts from the same rested, stocked crew on open road, so only the weather differs.
  const again = state => healthAt(stocked(onRoad(state), { food: 60, fuel: 40 }), 80);
  const base = { ...again(start()), pace: 'fast' };
  let state = { ...base, weather: { id: 'drizzle', until: base.day + RULES.drizzle.days } };
  assert.equal(weatherName(state), 'Perfect drizzle');
  const daily = RATIONS.meager.health - PACES.fast.wear;

  for (let day = 0; day < RULES.drizzle.days; day++) {
    const before = quiet(again(state));
    const after = act(before, TRAVEL);
    assert.equal(after.distance - before.distance, PACES.normal.miles);
    assert.equal(before.inventory.fuel - after.inventory.fuel, Math.ceil(PACES.normal.miles / PACES.fast.milesPerFuel));
    for (const [index, member] of after.party.entries()) {
      assert.equal(member.health, clamp(before.party[index].health + daily + RULES.drizzle.heal));
    }
    state = after;
  }

  const before = quiet(again(state));
  const result = transition(before, TRAVEL);
  assert.equal(result.notes[0], 'The weather clears.');
  assert.equal(result.state.distance - before.distance, PACES.fast.miles);
  for (const [index, member] of result.state.party.entries()) {
    assert.equal(member.health, clamp(before.party[index].health + daily));
  }
});

test('drizzle does not slow Steady or Scenic', () => {
  for (const pace of ['slow', 'normal']) {
    const base = { ...stocked(onRoad(start()), { fuel: 40 }), pace };
    const wet = quiet({ ...base, weather: { id: 'drizzle', until: base.day + RULES.drizzle.days } });
    assert.equal(act(wet, TRAVEL).distance - wet.distance, PACES[pace].miles);
  }
});

// --- Sickness --------------------------------------------------------------

test('a sick traveler loses health every day; kombucha and a stop rest cure, a roadside rest does not (F10)', () => {
  const sickOne = state => crew(healthAt(state, 50), (member, index) => (index === 1 ? { sick: true } : {}));
  const base = stocked(start(), { kombucha: 1, food: 40, fuel: 30 });

  const drove = act(quiet(sickOne(onRoad(base))), TRAVEL);
  const day = RATIONS.meager.health - PACES.normal.wear;
  assert.equal(drove.party[1].health, 50 + day - RULES.sickDamage);
  assert.equal(drove.party[0].health, 50 + day);
  assert.equal(drove.party[1].sick, true);

  const shoulder = act(sickOne(onRoad(base)), { type: 'rest' });
  assert.equal(shoulder.party[1].sick, true);
  assert.equal(shoulder.party[1].health, 50 + RATIONS.meager.health - RULES.sickDamage + RULES.roadRest.heal);

  const camp = act(sickOne(atStop(base, 'forest_camp')), { type: 'rest' });
  assert.equal(camp.party[1].sick, false);
  assert.equal(camp.party[1].health, 50 + RATIONS.meager.health - RULES.sickDamage + stop('forest_camp').rest.heal);

  const dosed = act(sickOne(onRoad(base)), { type: 'useItem', itemId: 'kombucha' });
  assert.equal(dosed.party[1].sick, false);
  assert.equal(dosed.party[1].health, 50 + item('kombucha').heal);
  assert.equal(dosed.day, base.day);
});

// --- Dying -----------------------------------------------------------------

test('a death records the day, the mile and the cause, and tells the journal (B6)', () => {
  const scout = ability('prepper');
  const base = onRoad(start('prepper'), 123);
  const state = crew(base, (member, index) => (index === 2 ? { health: scout.damage, sick: true } : {}));
  const result = transition(state, { type: 'ability' });
  assert.deepEqual(result.state.party[2], {
    id: 'traveler_3',
    name: DEFAULT_NAMES[2],
    health: 0,
    sick: false,
    death: { day: state.day, mile: 123, cause: 'scout' },
    epitaph: DEATHS.scout.epitaph,
  });
  assert.ok(result.notes.includes(`${DEFAULT_NAMES[2]} has died scouting ahead.`));
  assert.equal(result.notes.filter(note => note.includes('has died')).length, 1);
  assert.equal(result.state.outcome, null);
});

test('each kind of harm names its own cause', () => {
  // On Meager rations this health leaves exactly 1 after the day's food, so the next harm kills.
  assert.ok(RATIONS.meager.health <= 0 && RATIONS.bare.health < 0);
  const brink = 1 - RATIONS.meager.health;
  const frail = (state, health) => crew(state, (member, index) => (index === 0 ? { health } : {}));
  const road = stocked(onRoad(start()), { food: 40, fuel: 30 });
  const hot = { ...road, weather: { id: 'heat', until: road.day + RULES.heat.days } };
  const cases = [
    ['starvation', quiet(frail(stocked(road, { food: 0 }), 1)), TRAVEL],
    ['rations', quiet(frail({ ...road, rations: 'bare' }, 1)), TRAVEL],
    ['road', quiet(frail(road, brink)), TRAVEL],
    ['heat', quiet(frail(hot, brink + PACES.normal.wear)), TRAVEL],
    ['illness', crew(road, (member, index) => (index === 0 ? { health: brink, sick: true } : {})), { type: 'rest' }],
    ['forage', frail(road, brink), { type: 'forage' }],
    ['push', frail(stocked(road, { fuel: 0 }), brink), { type: 'push' }],
  ];
  for (const [cause, state, action] of cases) {
    const result = transition(state, action);
    assert.equal(result.error, null, cause);
    const member = result.state.party[0];
    assert.equal(member.health, 0, cause);
    assert.deepEqual(member.death, { day: state.day + 1, mile: state.distance, cause });
    assert.equal(member.epitaph, DEATHS[cause].epitaph);
    assert.ok(result.notes.includes(fill(DEATHS[cause].line, { name: member.name })), cause);
  }
});

test('a walk for fuel that goes badly can be the last', () => {
  const brink = 1 - RATIONS.meager.health;
  const base = start();
  const lone = crew(stocked(onRoad(base), { fuel: 0 }), (member, index) =>
    index === 0 ? { health: brink } : fallen(base),
  );
  const results = seeds(120).map(rng => transition({ ...lone, rng }, { type: 'hitchhike' }));
  const failed = results.filter(result => result.state.inventory.fuel === 0);
  assert.ok(failed.length > 0 && failed.length < results.length);
  for (const result of failed) {
    assert.deepEqual(result.state.party[0].death, { day: lone.day + 1, mile: lone.distance, cause: 'hitchhike' });
    assert.equal(result.state.outcome, 'lost');
    assert.deepEqual(result.notes, [
      fill(JOURNAL.hitchhikeFailed, { name: lone.party[0].name }),
      fill(DEATHS.hitchhike.line, { name: lone.party[0].name }),
      JOURNAL.lost,
    ]);
  }
});

test('every default epitaph is one a player could have carved', () => {
  for (const [cause, record] of Object.entries(DEATHS)) {
    assert.ok(record.epitaph.length >= 1 && record.epitaph.length <= LIMITS.epitaph, cause);
    assert.ok(record.line.includes('{name}'), cause);
  }
});

test('the dead are never healed and never hurt again (B6)', () => {
  const fresh = start('barista');
  const base = crew(stocked(fresh, { kombucha: 2, money: 500, food: 40, fuel: 30 }), (member, index) =>
    index === 0 ? fallen(fresh, 'road') : { health: 50 },
  );
  const cases = [
    [onRoad(base), { type: 'rest' }],
    [atStop(base, 'first_stop'), { type: 'rest' }],
    [onRoad(base), { type: 'useItem', itemId: 'kombucha' }],
    [atStop(base, 'food_truck_fest'), { type: 'meal' }],
    [onRoad(base), { type: 'ability' }],
    [atStop(base, 'forest_camp'), { type: 'talk' }],
    [onRoad(base), { type: 'forage' }],
    [quiet(onRoad(base)), TRAVEL],
    [stocked(onRoad(base), { fuel: 0 }), { type: 'push' }],
  ];
  for (const [state, action] of cases) {
    const result = transition(state, action);
    assert.equal(result.error, null, action.type);
    assert.deepEqual(result.state.party[0], state.party[0], action.type);
    assert.ok(!result.notes.some(note => note.includes('has died')), action.type);
    assert.notEqual(result.state.party[1].health, 50, `${action.type} still touches the living`);
  }

  // Even harm aimed straight at the dead changes nothing: no second death, no second line.
  const state = structuredClone(onRoad(base));
  hurt(state, state.party[0], 50, 'heat');
  assert.deepEqual(state, onRoad(base));
});

test('an epitaph can be carved for the fallen at any time, and only for them', () => {
  const base = crew(onRoad(start()), (member, index) => (index === 0 ? fallen(start(), 'road') : {}));
  const carve = text => ({ type: 'setEpitaph', memberId: 'traveler_1', text });

  const carved = transition(base, carve('  <b>Loved & "lost"</b>  '));
  assert.equal(carved.error, null);
  assert.equal(carved.state.party[0].epitaph, '<b>Loved & "lost"</b>');
  assert.deepEqual(carved.notes, []);
  assert.equal(act(base, carve('x'.repeat(LIMITS.epitaph))).party[0].epitaph.length, LIMITS.epitaph);

  // While an encounter is pending, and after the journey has ended.
  const busy = pendingEvent(base, 'found_supplies');
  assert.equal(act(busy, carve('Missed the free box.')).party[0].epitaph, 'Missed the free box.');
  assert.deepEqual(act(busy, carve('Missed the free box.')).pendingEvent, busy.pendingEvent);
  const scout = ability('prepper');
  const over = act(loneSurvivor(onRoad(start('prepper')), scout.damage), { type: 'ability' });
  assert.equal(over.outcome, 'lost');
  const remembered = act(over, { type: 'setEpitaph', memberId: 'traveler_5', text: 'Scouted too far.' });
  assert.equal(remembered.party[4].epitaph, 'Scouted too far.');
  assert.equal(remembered.outcome, 'lost');
  assert.equal(remembered.phase, 'ended');

  const limit = fill(REFUSALS.epitaphText, { max: LIMITS.epitaph });
  assert.ok(limit.includes(String(LIMITS.epitaph)));
  for (const text of ['', '   ', 'x'.repeat(LIMITS.epitaph + 1), 'two\nlines', 'bell\u0007', 'tab\there', 42, null]) {
    assert.equal(refusal(base, carve(text)), limit, JSON.stringify(text));
  }
  assert.equal(
    refusal(base, { type: 'setEpitaph', memberId: 'traveler_2', text: 'Too soon.' }),
    fill(REFUSALS.epitaphAlive, { name: base.party[1].name }),
  );
  for (const memberId of ['traveler_9', undefined, 7, '__proto__']) {
    assert.equal(refusal(base, { type: 'setEpitaph', memberId, text: 'Who?' }), REFUSALS.epitaphWho);
  }
});

test('the journey is lost only when the last traveler dies; then nothing but an epitaph is accepted', () => {
  const scout = ability('prepper');
  const last = loneSurvivor(onRoad(start('prepper')), scout.damage + 1);
  // Four are dead and the journey goes on.
  const still = act(last, { type: 'ability' });
  assert.equal(still.outcome, null);
  assert.equal(still.party[4].health, 1);

  const lost = transition(loneSurvivor(onRoad(start('prepper')), scout.damage), { type: 'ability' });
  assert.equal(lost.state.outcome, 'lost');
  assert.equal(lost.state.phase, 'ended');
  assert.equal(lost.state.pendingEvent, null);
  assert.equal(lost.notes.at(-1), 'The last traveler fell. The road to Portland ends here.');
  assert.equal(lost.notes.filter(note => note === JOURNAL.lost).length, 1);

  for (const action of EVERY_ACTION) {
    if (action.type === 'setEpitaph') continue;
    assert.equal(refusal(lost.state, action), ENDED, action.type);
  }
  assert.equal(ENDED, REFUSALS.ended);
});

test('a day that kills the last traveler stops the drive where it stood', () => {
  const doomed = { ...loneSurvivor(onRoad(start()), 1), rations: 'bare' };
  const result = transition(doomed, TRAVEL);
  assert.equal(result.state.outcome, 'lost');
  assert.equal(result.state.distance, doomed.distance);
  assert.equal(result.state.inventory.fuel, doomed.inventory.fuel);
  assert.equal(result.state.rng, doomed.rng, 'no encounter is rolled after the end');
});

// --- Stops -----------------------------------------------------------------

test('a rest heals more at a stop than on the shoulder, and the motel charges (B3)', () => {
  const base = healthAt(stocked(start(), { money: 200, food: 40 }), 40);
  const shoulder = act(onRoad(base), { type: 'rest' });
  assert.equal(shoulder.day, base.day + 1);
  assert.equal(shoulder.party[0].health, 40 + RATIONS.meager.health + RULES.roadRest.heal);
  assert.equal(shoulder.inventory.money, 200);

  assert.deepEqual(transition(onRoad(base), { type: 'rest' }).notes, [
    fill(JOURNAL.restRoad, { heal: RULES.roadRest.heal }),
  ]);

  const resting = LOCATIONS.filter(entry => entry.activities.includes('rest'));
  assert.ok(resting.length >= 4);
  for (const place of resting) {
    const state = atStop(base, place.id);
    const result = transition(state, { type: 'rest' });
    const heal = place.rest?.heal ?? RULES.stopRest.heal;
    const cost = place.rest?.cost ?? 0;
    assert.equal(result.error, null, place.id);
    assert.equal(result.state.day, state.day + 1);
    assert.equal(result.state.phase, 'location');
    assert.equal(result.state.party[0].health, 40 + RATIONS.meager.health + heal, place.id);
    assert.equal(result.state.inventory.money, 200 - cost, place.id);
    assert.ok(heal > RULES.roadRest.heal, `${place.id} beats the shoulder`);
    const line = cost > 0 ? fill(JOURNAL.restPaid, { cost, heal }) : fill(JOURNAL.restStop, { heal });
    assert.deepEqual(result.notes, [line], place.id);
    assert.ok(line.includes(String(heal)) && !line.includes('{'));
    if (cost > 0) assert.ok(line.includes(`$${cost}`));
  }

  const motel = stop('sketchy_motel');
  const broke = stocked(atStop(base, motel.id), { money: motel.rest.cost - 1 });
  const error = refusal(broke, { type: 'rest' });
  assert.equal(error, fill(REFUSALS.cost, { cost: motel.rest.cost, money: motel.rest.cost - 1 }));
  assert.ok(error.includes(`$${motel.rest.cost}`));
});

test('a stop offers only its own activities (B3)', () => {
  const market = atStop(start(), 'mushroom_market');
  assert.equal(refusal(market, { type: 'rest' }), REFUSALS.noRest);
  assert.equal(refusal(market, { type: 'forage' }), REFUSALS.noForage);
  assert.equal(refusal(market, { type: 'meal' }), REFUSALS.noMeal);
  assert.equal(refusal(atStop(start(), 'first_stop'), { type: 'talk' }), REFUSALS.noTalk);
  assert.equal(refusal(atStop(start(), 'first_stop'), { type: 'openShop' }), REFUSALS.noShop);
  assert.equal(refusal(onRoad(start()), { type: 'talk' }), REFUSALS.noTalk);
  assert.equal(refusal(onRoad(start()), { type: 'openShop' }), REFUSALS.noShop);
  // Nothing but shopping and driving happens inside a shop.
  for (const type of ['rest', 'forage', 'talk', 'meal', 'ability', 'push', 'hitchhike', 'tradeLuggage']) {
    refusal(start(), { type });
  }
  refusal(stocked(start('barista'), { kombucha: 2 }), { type: 'useItem', itemId: 'kombucha' });
});

test('foraging finds food inside the range of the region or the stop', () => {
  const bonus = RULES.forage.prepperBonus;
  const cases = [
    { profession: 'dev', place: state => onRoad(state), range: regionAt(ROAD).forage, extra: 0 },
    { profession: 'prepper', place: state => onRoad(state, 900), range: regionAt(900).forage, extra: bonus },
    { profession: 'dev', place: state => atStop(state, 'first_stop'), range: stop('first_stop').forage, extra: 0 },
    {
      profession: 'prepper',
      place: state => atStop(state, 'forest_camp'),
      range: stop('forest_camp').forage,
      extra: bonus,
    },
  ];
  const eaten = RATIONS.meager.food * CREW;
  for (const { profession, place, range, extra } of cases) {
    const [min, max] = range;
    const found = new Set();
    let sickened = 0;
    let unharmed = 0;
    for (const seed of seeds(200)) {
      const state = healthAt(stocked(place(start(profession, seed)), { food: 20 }), 50);
      const result = transition(state, { type: 'forage' });
      assert.equal(result.error, null);
      const food = round(result.state.inventory.food - (state.inventory.food - eaten));
      assert.ok(food >= min + extra && food <= max + extra, `${food} outside ${min + extra} to ${max + extra}`);
      found.add(food);
      assert.equal(result.state.day, state.day + 1);
      assert.equal(result.state.phase, state.phase);
      assert.equal(result.state.distance, state.distance);
      for (const member of result.state.party) {
        assert.equal(member.health, 50 + RATIONS.meager.health - RULES.forage.damage);
      }
      assert.equal(result.notes[0], fill(JOURNAL.foraged, { food, damage: RULES.forage.damage }));
      const sick = result.state.party.filter(member => member.sick);
      assert.ok(sick.length <= 1);
      if (sick.length === 1) {
        sickened += 1;
        assert.equal(result.notes.at(-1), `${sick[0].name} ate something that disagreed.`);
      } else {
        unharmed += 1;
        assert.equal(result.notes.length, 1);
      }
    }
    assert.ok(sickened > 0 && unharmed > 0, 'foraging sometimes disagrees and sometimes does not');
    assert.equal(found.size, max - min + 1, 'every yield in the range turns up');
  }
});

test('the regions cover the road', () => {
  assert.equal(regionAt(0).id, REGIONS[0].id);
  assert.equal(regionAt(RULES.goalMiles).id, REGIONS.at(-1).id);
  for (const region of REGIONS) {
    assert.equal(regionAt(region.from).id, region.id);
    assert.equal(regionAt(region.to - 1).id, region.id);
  }
});

test('the stop helpers read the route', () => {
  assert.equal(lastStop(0).id, 'start_city');
  assert.equal(lastStop(199).id, 'mushroom_market');
  assert.equal(lastStop(200).id, 'first_stop');
  assert.equal(lastStop(RULES.goalMiles).id, 'portland');
  assert.equal(nextStop(0).id, 'mushroom_market');
  assert.equal(nextStop(199).id, 'first_stop');
  assert.equal(nextStop(200).id, 'river_ferry');
  assert.equal(nextStop(RULES.goalMiles), undefined);
  assert.equal(currentStop(atStop(start(), 'bookshop')).id, 'bookshop');
  assert.equal(currentStop({ ...atStop(start(), 'bookshop'), phase: 'shop' }).id, 'bookshop');
  assert.equal(currentStop(onRoad(start(), 870)), null);
});

test('the food carts sell one meal per journey', () => {
  const carts = stop('food_truck_fest');
  const fresh = start();
  const base = crew(stocked(atStop(fresh, carts.id), { money: 300 }), (member, index) =>
    index === 0 ? fallen(fresh) : { health: 50 },
  );
  const result = transition(base, { type: 'meal' });
  const cost = carts.meal.costEach * (CREW - 1);
  assert.equal(result.error, null);
  assert.equal(result.state.inventory.money, 300 - cost);
  assert.equal(result.state.day, base.day);
  assert.equal(result.state.party[0].health, 0);
  for (const member of result.state.party.slice(1)) assert.equal(member.health, 50 + carts.meal.heal);
  assert.deepEqual(result.state.flags.meals, [carts.id]);
  assert.deepEqual(result.notes, [fill(carts.meal.line, { cost, heal: carts.meal.heal })]);
  assert.ok(!result.notes[0].includes('{'));

  assert.equal(refusal(result.state, { type: 'meal' }), REFUSALS.mealEaten);
  const broke = stocked(base, { money: cost - 1 });
  assert.equal(refusal(broke, { type: 'meal' }), fill(REFUSALS.cost, { cost, money: cost - 1 }));
  const offered = LOCATIONS.filter(entry => entry.activities.includes('meal'));
  assert.deepEqual(offered, [carts]);
  for (const place of LOCATIONS.filter(entry => entry !== carts && entry.id !== 'portland')) {
    assert.equal(refusal(stocked(atStop(fresh, place.id), { money: 300 }), { type: 'meal' }), REFUSALS.noMeal);
  }
});

test('each talking stop gives its reward once', () => {
  const talking = LOCATIONS.filter(entry => entry.activities.includes('talk'));
  assert.equal(talking.length, 6);
  for (const place of talking) {
    const state = healthAt(stocked(atStop(start(), place.id), { food: 10, fuel: 10 }), 50);
    const result = transition(state, { type: 'talk' });
    assert.equal(result.error, null, place.id);
    const expected = { ...state.inventory };
    for (const [id, amount] of Object.entries(place.talk.gain ?? {})) expected[id] += amount;
    assert.deepEqual(result.state.inventory, expected, place.id);
    for (const member of result.state.party) assert.equal(member.health, 50 + (place.talk.heal ?? 0), place.id);
    assert.ok(Object.keys(place.talk.gain ?? {}).length > 0 || place.talk.heal > 0, `${place.id} gives something`);
    assert.equal(result.state.day, state.day);
    assert.deepEqual(result.state.flags.talked, [place.id]);
    assert.deepEqual(result.notes, [fill(place.talk.line, { ...place.talk.gain, heal: place.talk.heal })]);
    assert.ok(!result.notes[0].includes('{') && !result.notes[0].includes('undefined'));
    assert.equal(refusal(result.state, { type: 'talk' }), 'You have already spoken to everyone here.');
  }
});

// --- Items -----------------------------------------------------------------

test('seed bombs yield inside their range at once', () => {
  const [min, max] = item('ammo').yield;
  const found = new Set();
  for (const seed of seeds(120)) {
    const state = stocked(onRoad(start('dev', seed)), { ammo: 2, food: 10 });
    const result = transition(state, { type: 'useItem', itemId: 'ammo' });
    assert.equal(result.error, null);
    const food = result.state.inventory.food - state.inventory.food;
    assert.ok(food >= min && food <= max);
    found.add(food);
    assert.equal(result.state.inventory.ammo, 1);
    assert.equal(result.state.day, state.day);
    assert.deepEqual(result.notes, [fill(JOURNAL.seedBombs, { food })]);
  }
  assert.equal(found.size, max - min + 1);
  const atRestStop = stocked(atStop(start(), 'first_stop'), { ammo: 1 });
  assert.equal(act(atRestStop, { type: 'useItem', itemId: 'ammo' }).inventory.ammo, 0);
});

test('kombucha heals the living and cures them', () => {
  const state = crew(stocked(onRoad(start()), { kombucha: 2 }), (member, index) => ({
    health: 50,
    sick: index % 2 === 0,
  }));
  const result = transition(state, { type: 'useItem', itemId: 'kombucha' });
  assert.equal(result.state.inventory.kombucha, 1);
  for (const member of result.state.party) {
    assert.equal(member.health, 50 + item('kombucha').heal);
    assert.equal(member.sick, false);
  }
  assert.deepEqual(result.notes, [fill(JOURNAL.kombucha, { heal: item('kombucha').heal })]);
});

test('an item that is not in stock is refused by its display name (B15)', () => {
  const empty = stocked(onRoad(start()), { ammo: 0, kombucha: 0 });
  for (const id of ['ammo', 'kombucha']) {
    const error = refusal(empty, { type: 'useItem', itemId: id });
    const { name, short } = item(id);
    assert.ok(
      error.includes(short.toLowerCase()) || error.includes(name.toLowerCase()),
      `"${error}" names ${short} or ${name}`,
    );
    assert.ok(!/\bammo\b/.test(error), error);
  }
  assert.equal(refusal(empty, { type: 'useItem', itemId: 'ammo' }), 'You have no seed bombs to use.');
  for (const itemId of ['nft', 'food', 'toString', '__proto__', undefined, 7]) {
    assert.equal(refusal(empty, { type: 'useItem', itemId }), REFUSALS.itemPhase);
  }
});

test('a gain never lifts a supply above what the van holds, nor lowers one already above', () => {
  const food = item('food').max;
  const fuel = item('fuel').max;
  const market = state => atStop(state, 'mushroom_market');
  assert.equal(act(stocked(market(start()), { food: food - 1 }), { type: 'talk' }).inventory.food, food);
  assert.equal(act(stocked(market(start()), { food: food + 20 }), { type: 'talk' }).inventory.food, food + 20);
  const meetup = state => atStop(state, 'crypto_meetup');
  assert.equal(act(stocked(meetup(start()), { fuel: fuel - 1 }), { type: 'talk' }).inventory.fuel, fuel);
  assert.equal(act(stocked(meetup(start()), { fuel: fuel + 5 }), { type: 'talk' }).inventory.fuel, fuel + 5);
  const seeded = stocked(onRoad(start()), { ammo: 1, food: food - 1 });
  assert.equal(act(seeded, { type: 'useItem', itemId: 'ammo' }).inventory.food, food);
  // Cash has no ceiling.
  const rich = stocked(atStop(start(), 'bookshop'), { money: 1e6 });
  assert.equal(act(rich, { type: 'talk' }).inventory.money, 1e6 + stop('bookshop').talk.gain.money);
});

// --- Abilities -------------------------------------------------------------

test('each background has its ability, with its numbers and its cooldown', () => {
  const effects = {
    influencer: (before, after, numbers) => {
      assert.equal(after.inventory.money, before.inventory.money + numbers.money);
      assert.equal(after.inventory.food, before.inventory.food + numbers.food);
    },
    dev: (before, after, numbers) => assert.equal(after.inventory.parts, before.inventory.parts + numbers.parts),
    prepper: (before, after, numbers) => {
      assert.equal(after.inventory.food, before.inventory.food + numbers.food);
      for (const member of after.party) assert.equal(member.health, 50 - numbers.damage);
    },
    barista: (before, after, numbers) => {
      assert.equal(after.inventory.food, before.inventory.food - numbers.foodCost);
      for (const member of after.party) assert.equal(member.health, 50 + numbers.heal);
    },
  };
  assert.deepEqual(
    Object.keys(effects),
    PROFESSIONS.map(profession => profession.id),
  );
  for (const profession of PROFESSIONS) {
    const numbers = profession.ability;
    for (const place of [onRoad, state => atStop(state, 'first_stop')]) {
      const state = healthAt(stocked(place(start(profession.id)), { food: 20 }), 50);
      const result = transition(state, { type: 'ability' });
      assert.equal(result.error, null, profession.id);
      effects[profession.id](state, result.state, numbers);
      assert.equal(result.state.day, state.day);
      assert.equal(result.notes[0], fill(numbers.result, numbers));
      assert.ok(!result.notes[0].includes('{'));

      // Used today: not again until the cooldown has passed.
      const used = result.state;
      assert.equal(
        refusal(used, { type: 'ability' }),
        fill(REFUSALS.cooldown, { days: numbers.cooldown }),
        profession.id,
      );
      const nearly = { ...used, day: used.day + numbers.cooldown - 1 };
      if (numbers.cooldown > 1) {
        assert.equal(refusal(nearly, { type: 'ability' }), 'Ready in 1 day.');
      }
      const ready = { ...used, day: used.day + numbers.cooldown };
      assert.equal(transition(ready, { type: 'ability' }).error, null, profession.id);
    }
    assert.equal(refusal(start(profession.id), { type: 'ability' }), REFUSALS.abilityPhase);
  }
});

test('a Wi-Fi outage blocks the collab for that day only', () => {
  const base = onRoad(start('influencer'));
  const outage = { ...base, flags: { ...base.flags, wifiDownDay: base.day } };
  assert.equal(refusal(outage, { type: 'ability' }), ability('influencer').offline);
  assert.equal(transition({ ...outage, day: outage.day + 1 }, { type: 'ability' }).error, null);
  // Nobody else needs a signal.
  const dev = onRoad(start('dev'));
  assert.equal(transition({ ...dev, flags: { ...dev.flags, wifiDownDay: dev.day } }, { type: 'ability' }).error, null);
});

test('the barista cannot brew without the food for it', () => {
  const brew = ability('barista');
  const bare = stocked(onRoad(start('barista')), { food: brew.foodCost - 0.5 });
  const error = refusal(bare, { type: 'ability' });
  assert.equal(error, fill(brew.lacking, brew));
  assert.ok(error.includes(String(brew.foodCost)));
  assert.equal(transition(stocked(bare, { food: brew.foodCost }), { type: 'ability' }).error, null);
});

// --- Last resorts ----------------------------------------------------------

test('last resorts wait for a dry tank', () => {
  const fuelled = stocked(onRoad(start()), { fuel: 1 });
  for (const type of ['push', 'hitchhike', 'tradeLuggage']) {
    assert.equal(refusal(fuelled, { type }), REFUSALS.lastResortFuel);
    assert.equal(refusal(stocked(atStop(start(), 'first_stop'), { fuel: 1 }), { type }), REFUSALS.lastResortFuel);
    assert.equal(refusal(stocked(start(), { fuel: 0 }), { type }), REFUSALS.lastResortPhase);
  }
});

test('pushing moves the van a little for a day and some health, and rolls no encounter', () => {
  const dry = healthAt(stocked(onRoad(start()), { fuel: 0, food: 40 }), 50);
  for (const seed of seeds(40)) {
    const state = { ...dry, rng: seed };
    const result = transition(state, { type: 'push' });
    assert.equal(result.error, null);
    assert.equal(result.state.distance, state.distance + RULES.push.miles);
    assert.equal(result.state.day, state.day + 1);
    assert.equal(result.state.phase, 'travel');
    assert.equal(result.state.pendingEvent, null);
    assert.equal(result.state.rng, seed);
    for (const member of result.state.party) {
      assert.equal(member.health, 50 + RATIONS.meager.health - RULES.push.damage);
    }
    const distance = state.distance + RULES.push.miles;
    assert.deepEqual(result.notes, [fill(JOURNAL.pushed, { miles: RULES.push.miles, distance })]);
  }
  assert.equal(fill(JOURNAL.pushed, { miles: 10, distance: 365 }), 'The crew pushed the van 10 miles to mile 365.');
});

test('a push stops at the next stop, and can roll into Portland', () => {
  const ferry = stop('river_ferry');
  // Closer than one push covers.
  const short = Math.min(3, RULES.push.miles);
  const near = stocked(onRoad(start(), ferry.miles - short), { fuel: 0 });
  const arrived = transition(near, { type: 'push' });
  assert.equal(arrived.state.distance, ferry.miles);
  assert.equal(arrived.state.phase, 'location');
  assert.equal(arrived.notes.at(-1), `Arrived at ${ferry.name}.`);
  // From a stop, a push leaves it.
  const left = act(stocked(atStop(start(), ferry.id), { fuel: 0 }), { type: 'push' });
  assert.equal(left.phase, 'travel');
  assert.equal(left.distance, ferry.miles + RULES.push.miles);

  const last = stocked(onRoad(start(), RULES.goalMiles - short), { fuel: 0 });
  const won = transition(last, { type: 'push' });
  assert.equal(won.state.outcome, 'won');
  assert.equal(won.state.distance, RULES.goalMiles);
  assert.equal(won.notes.at(-1), JOURNAL.won);
});

test('a push that kills the last traveler goes nowhere', () => {
  const brink = 1 - RATIONS.meager.health;
  const doomed = stocked(loneSurvivor(onRoad(start()), brink), { fuel: 0 });
  const result = transition(doomed, { type: 'push' });
  assert.equal(result.state.outcome, 'lost');
  assert.equal(result.state.distance, doomed.distance);
  assert.equal(result.state.party[CREW - 1].death.cause, 'push');
  assert.equal(result.notes.at(-1), JOURNAL.lost);
});

test('hitchhiking for fuel sometimes works and sometimes costs the walker', () => {
  const dry = healthAt(stocked(onRoad(start()), { fuel: 0, food: 40 }), 50);
  const rested = 50 + RATIONS.meager.health;
  let worked = 0;
  let failed = 0;
  for (const seed of seeds(200)) {
    const state = { ...dry, rng: seed };
    const result = transition(state, { type: 'hitchhike' });
    assert.equal(result.error, null);
    assert.equal(result.state.day, state.day + 1);
    assert.equal(result.state.distance, state.distance);
    assert.equal(result.state.pendingEvent, null);
    const hurt = result.state.party.filter(member => member.health !== rested);
    if (result.state.inventory.fuel > 0) {
      worked += 1;
      assert.equal(result.state.inventory.fuel, RULES.hitchhike.fuel);
      assert.equal(hurt.length, 0);
      assert.match(result.notes[0], / walked for fuel and came back with \d+\.$/);
      assert.ok(result.notes[0].endsWith(`came back with ${RULES.hitchhike.fuel}.`));
    } else {
      failed += 1;
      assert.equal(hurt.length, 1);
      assert.equal(hurt[0].health, rested - RULES.hitchhike.damage);
      assert.deepEqual(result.notes, [`${hurt[0].name} walked all day and came back with blisters.`]);
    }
  }
  assert.ok(worked > 0 && failed > 0, `worked ${worked}, failed ${failed}`);
});

test('the roof luggage trades for fuel once', () => {
  const dry = stocked(onRoad(start()), { fuel: 0 });
  const result = transition(dry, { type: 'tradeLuggage' });
  assert.equal(result.state.inventory.fuel, RULES.luggage.fuel);
  assert.equal(result.state.day, dry.day);
  assert.equal(result.state.flags.luggageTraded, true);
  assert.deepEqual(result.notes, [fill(JOURNAL.luggage, { fuel: RULES.luggage.fuel })]);
  const dryAgain = stocked(result.state, { fuel: 0 });
  assert.equal(refusal(dryAgain, { type: 'tradeLuggage' }), REFUSALS.luggageGone);
  assert.equal(transition(stocked(atStop(start(), 'first_stop'), { fuel: 0 }), { type: 'tradeLuggage' }).error, null);
});

// --- Settings --------------------------------------------------------------

test('pace and rations accept only their own ids', () => {
  for (const state of [start(), onRoad(start()), atStop(start(), 'first_stop')]) {
    for (const pace of Object.keys(PACES)) assert.equal(act(state, { type: 'setPace', pace }).pace, pace);
    for (const rations of Object.keys(RATIONS)) {
      assert.equal(act(state, { type: 'setRations', rations }).rations, rations);
    }
    for (const bad of ['constructor', '__proto__', 'toString', 'warp', '', undefined, null, 7, ['slow']]) {
      assert.equal(refusal(state, { type: 'setPace', pace: bad }), REFUSALS.pace);
      assert.equal(refusal(state, { type: 'setRations', rations: bad }), REFUSALS.rations);
    }
  }
});

// --- transition ------------------------------------------------------------

test('transition never throws and never changes the state it is given', () => {
  /** @type {any[]} */
  const malformed = [
    undefined,
    null,
    'travel',
    7,
    [],
    {},
    { type: 7 },
    { type: ['travel'] },
    { type: 'constructor' },
    { type: '__proto__' },
    { type: 'purchase' },
    { type: 'purchase', cart: null },
    { type: 'purchase', cart: [] },
    { type: 'purchase', cart: { fuel: '3' } },
    { type: 'resolveEvent' },
    { type: 'resolveEvent', token: Number.NaN, choiceId: {} },
    { type: 'useItem' },
    { type: 'setEpitaph' },
  ];
  const base = stocked(start('prepper'), { kombucha: 2, nft: 1, money: 500 });
  const dead = state => crew(state, (member, index) => (index === 0 ? fallen(state) : {}));
  const states = [
    base,
    onRoad(base),
    dead(atStop(base, 'forest_camp')),
    atStop(base, 'food_truck_fest'),
    stocked(onRoad(base), { fuel: 0 }),
    pendingEvent(onRoad(base), 'van_breakdown'),
    pendingEvent(onRoad(base), 'found_supplies'),
    act(onRoad(base, RULES.goalMiles - 5), TRAVEL),
  ];
  for (const state of states) {
    const frozen = deepFreeze(structuredClone(state));
    for (const action of [...EVERY_ACTION, ...malformed]) {
      const result = transition(frozen, action);
      assert.deepEqual(frozen, state);
      // The question "would this be refused, and why?" has the same answer without doing it.
      assert.equal(refusalFor(frozen, action), result.error);
      if (result.error) {
        assert.equal(result.state, frozen);
        assert.deepEqual(result.notes, []);
      } else {
        assert.notEqual(result.state, frozen);
        const added = result.state.logged - frozen.logged;
        assert.deepEqual(
          result.notes,
          result.state.journal.slice(result.state.journal.length - added).map(entry => entry.text),
        );
      }
    }
  }
  // Anything that is not a version 3 journey is refused, not crashed on: an old save has to be
  // read with deserializeGame first.
  /** @type {any[]} */
  const notJourneys = [null, undefined, 'state', 7, [], {}, { version: 2, phase: 'travel' }];
  for (const state of notJourneys) {
    for (const action of EVERY_ACTION) {
      assert.deepEqual(transition(state, action), { state, error: 'Choose a valid action.', notes: [] });
    }
  }
});

test('transition reads the action once, so a getter cannot pass the check with one value and act on another', () => {
  // Listed when first read; an inherited name after that.
  let reads = 0;
  const shifty = {
    type: 'setPace',
    get pace() {
      reads += 1;
      return reads === 1 ? 'slow' : '__proto__';
    },
  };
  const result = transition(start(), shifty);
  assert.equal(reads, 1);
  assert.equal(result.error, null);
  assert.equal(result.state.pace, 'slow');
  assert.deepEqual(deserializeGame(serializeGame(result.state)), result.state);

  // Usable when first read; an item with no use after that.
  let looks = 0;
  const sly = {
    type: 'useItem',
    get itemId() {
      looks += 1;
      return looks === 1 ? 'kombucha' : 'nft';
    },
  };
  const dosed = transition(stocked(onRoad(start('dev')), { kombucha: 1 }), sly);
  assert.equal(looks, 1);
  assert.equal(dosed.error, null);
  assert.equal(dosed.state.inventory.kombucha, 0);
  assert.equal(dosed.state.inventory.nft, start('dev').inventory.nft);
});

test('an action that cannot be read or copied is refused, never thrown', () => {
  const state = start();
  /** @type {any[]} */
  const broken = [
    {
      type: 'travel',
      get extra() {
        throw new Error('boom');
      },
    },
    {
      get type() {
        throw new Error('boom');
      },
    },
    { type: 'travel', later: () => {} },
    { type: 'travel', tag: Symbol('tag') },
  ];
  for (const action of broken) {
    assert.deepEqual(transition(state, action), { state, error: REFUSALS.invalid, notes: [] });
  }
});

test('an unknown action is refused as invalid, and depart no longer exists', () => {
  for (const state of [start(), onRoad(start()), atStop(start(), 'first_stop')]) {
    assert.equal(refusal(state, { type: 'depart' }), 'Choose a valid action.');
    assert.equal(refusal(state, { type: 'explode' }), REFUSALS.invalid);
  }
});

test('notes are the journal lines an action wrote, even when the journal is full', () => {
  const full = {
    ...onRoad(start()),
    journal: Array.from({ length: RULES.journalLimit }, (_, index) => ({ day: 1, text: `Line ${index}.` })),
    logged: 900,
  };
  const result = transition(quiet(full), TRAVEL);
  assert.equal(result.state.journal.length, RULES.journalLimit);
  assert.equal(result.state.logged, 900 + result.notes.length);
  assert.ok(result.notes.length >= 1);
  assert.deepEqual(
    result.state.journal.slice(-result.notes.length).map(entry => entry.text),
    result.notes,
  );
  assert.equal(result.state.journal[0].text, `Line ${result.notes.length}.`);
  assert.equal(result.state.journal.at(-1).day, full.day + 1);
});

// --- Seeds -----------------------------------------------------------------

test('a seed can be a number or any words', () => {
  assert.equal(seedFromText(''), 2166136261);
  assert.equal(seedFromText('a'), 3826002220);
  assert.equal(seedFromText('42'), 42);
  assert.equal(seedFromText(' 42 '), 42);
  assert.equal(seedFromText('4294967297'), 1);
  assert.equal(seedFromText('4294967295'), 4294967295);
  assert.equal(seedFromText('9'.repeat(400)) >>> 0, seedFromText('9'.repeat(400)));
  assert.equal(seedFromText(' kale '), seedFromText('kale'));
  assert.notEqual(seedFromText('kale'), seedFromText('Kale'));
  for (const text of ['kale', 'Portland or bust', '🚐', '4 2', '-1', '1e3']) {
    const seed = seedFromText(text);
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, text);
    assert.equal(createGame({ profession: 'dev', seed }).seed, seed);
  }
});

test('the daily seed is the same all day and changes at midnight', () => {
  const morning = new Date(2026, 9, 1, 0, 0, 1);
  const night = new Date(2026, 9, 1, 23, 59, 59);
  const tomorrow = new Date(2026, 9, 2, 0, 0, 1);
  assert.equal(dailySeed(morning), dailySeed(night));
  assert.notEqual(dailySeed(morning), dailySeed(tomorrow));
  assert.equal(dailySeed(morning), seedFromText('portland-trail-2026-10-01'));
  assert.equal(dailySeed(new Date(2027, 0, 5, 12)), seedFromText('portland-trail-2027-01-05'));
  assert.equal(typeof dailySeed(), 'number');
});

test('the generator is the 32-bit LCG, and each action takes its rolls in order', () => {
  const lcg = value => (Math.imul(value, 1664525) + 1013904223) >>> 0;
  const unit = value => value / 4294967296;
  const eaten = RATIONS.meager.food * CREW;
  let encounters = 0;
  let sicknesses = 0;
  for (const seed of seeds(200)) {
    const fresh = start('dev', seed);
    const [r1, r2, r3] = [lcg(fresh.rng), lcg(lcg(fresh.rng)), lcg(lcg(lcg(fresh.rng)))];

    // Seed bombs: one roll, for the yield.
    const [min, max] = item('ammo').yield;
    const scattered = act(stocked(onRoad(fresh), { ammo: 1, food: 10 }), { type: 'useItem', itemId: 'ammo' });
    assert.equal(scattered.rng, r1);
    assert.equal(scattered.inventory.food, 10 + min + Math.floor(unit(r1) * (max - min + 1)));

    // A drive: one roll against the chance of an encounter, then one to pick it.
    const drove = act(onRoad(fresh), TRAVEL);
    const met = unit(r1) < RULES.eventChance;
    assert.equal(Boolean(drove.pendingEvent), met);
    assert.equal(drove.rng, met ? r2 : r1);
    encounters += met ? 1 : 0;

    // Foraging: the yield, then the chance of sickness, then who it is.
    const [low, high] = regionAt(ROAD).forage;
    const foraged = act(healthAt(stocked(onRoad(fresh), { food: 20 }), 50), { type: 'forage' });
    assert.equal(round(foraged.inventory.food - (20 - eaten)), low + Math.floor(unit(r1) * (high - low + 1)));
    const sickened = unit(r2) < RULES.forage.sickChance;
    assert.equal(foraged.rng, sickened ? r3 : r2);
    assert.deepEqual(
      foraged.party.map(member => member.sick),
      foraged.party.map((member, index) => sickened && index === Math.floor(unit(r3) * CREW)),
    );
    sicknesses += sickened ? 1 : 0;

    // Hitchhiking: who walks, then whether it works.
    const dry = healthAt(stocked(onRoad(fresh), { fuel: 0 }), 50);
    const walked = transition(dry, { type: 'hitchhike' });
    const walker = dry.party[Math.floor(unit(r1) * CREW)].name;
    assert.equal(walked.state.rng, r2);
    assert.equal(walked.state.inventory.fuel, unit(r2) < RULES.hitchhike.chance ? RULES.hitchhike.fuel : 0);
    assert.ok(walked.notes[0].startsWith(`${walker} walked`));
  }
  assert.ok(encounters > 0 && encounters < 200 && sicknesses > 0 && sicknesses < 200);

  // Nothing else rolls.
  const base = healthAt(stocked(start('barista', 5), { kombucha: 1, money: 500, nft: 1 }), 50);
  const fallenOne = crew(base, (member, index) => (index === 0 ? fallen(base) : {}));
  const still = [
    [onRoad(base), { type: 'rest' }],
    [atStop(base, 'sketchy_motel'), { type: 'rest' }],
    [atStop(base, 'forest_camp'), { type: 'talk' }],
    [atStop(base, 'food_truck_fest'), { type: 'meal' }],
    [onRoad(base), { type: 'ability' }],
    [onRoad(start('prepper', 5)), { type: 'ability' }],
    [onRoad(base), { type: 'useItem', itemId: 'kombucha' }],
    [stocked(onRoad(base), { fuel: 0 }), { type: 'push' }],
    [stocked(onRoad(base), { fuel: 0 }), { type: 'tradeLuggage' }],
    [base, { type: 'purchase', cart: { fuel: 1 } }],
    [base, { type: 'autoPurchase' }],
    [base, { type: 'sellNft' }],
    [base, { type: 'leaveShop' }],
    [atStop(base, 'sketchy_motel'), { type: 'openShop' }],
    [base, { type: 'setPace', pace: 'fast' }],
    [base, { type: 'setRations', rations: 'bare' }],
    [onRoad(fallenOne), { type: 'setEpitaph', memberId: 'traveler_1', text: 'Rolled no dice.' }],
  ];
  for (const [state, action] of still) assert.equal(act(state, action).rng, state.rng, action.type);
});

test('templates fill their slots and choose their plurals', () => {
  assert.equal(fill('Paid ${money} for {count} {bag|bags}.', { money: 12, count: 1 }), 'Paid $12 for 1 bag.');
  assert.equal(fill('Paid ${money} for {count} {bag|bags}.', { money: 1, count: 3 }), 'Paid $1 for 3 bags.');
  assert.equal(fill('{name} rests.', { name: '{count} <b>$&</b>', count: 9 }), '{count} <b>$&</b> rests.');
  assert.equal(fill('{missing} stays, {zero} shows.', { zero: 0 }), '{missing} stays, 0 shows.');
  assert.equal(fill('{toString} is not a value.', {}), '{toString} is not a value.');
  assert.equal(fill('No slots.'), 'No slots.');
});

test('an ending leaves no encounter pending', () => {
  const base = onRoad(start());
  const wiped = pendingEvent(
    crew(base, () => fallen(base)),
    'found_supplies',
  );
  const state = structuredClone(wiped);
  finish(state);
  assert.equal(state.outcome, 'lost');
  assert.equal(state.phase, 'ended');
  assert.equal(state.pendingEvent, null);
  assert.equal(state.journal.at(-1).text, JOURNAL.lost);
  finish(state);
  assert.equal(state.logged, wiped.logged + 1, 'an ending is written once');
});

// --- Sentences -------------------------------------------------------------

const NUMBER_WORDS = [
  ...['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  ...['eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'],
];
const NUMBER = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\b|[0-9]+`, 'gi');

// Words and digits in sentences that no number in data.js stands behind. Anything else that reads
// as a number must come from a slot, so that retuning a number can never leave a sentence behind.
const NOT_A_NUMBER = [
  // The rules fix these: the crew is five, there are four backgrounds, one conversation a stop,
  // one NFT a sale or a trade, and a unit of an item is one bag or one canister.
  'Five travelers',
  'Enter five names',
  'four backgrounds',
  'One conversation per stop',
  'one NFT',
  'One unit of food',
  'One canister covers',
  // The shortest name or epitaph is one character, on one line.
  'of 1–{max} characters',
  'of 1 to {max} characters',
  'on one line',
  // "One" as a pronoun.
  'Start a new one',
  'Choose one of the',
  'No one here',
  // Scenery and jokes.
  'three miles from a farm-to-table bistro',
  'one petition too many',
  'The one coffee shop',
  'one lane',
  'like it is 1848',
  'two lanes',
  'Two hours later',
  'three more brunch lines',
  'Eleven signatures',
  'nine mailing lists',
  'one extremely credentialed raccoon',
  'the 90s',
];

/** Every string in data.js, with where it lives. */
function sentences() {
  const found = [];
  const walk = (value, path) => {
    if (typeof value === 'string') found.push({ path, text: value });
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) walk(inner, `${path}.${key}`);
    }
  };
  for (const [name, value] of Object.entries(data)) walk(value, name);
  return found;
}

/** The numbers a sentence spells out, in words or digits, outside its slots and the phrases above. */
function spelledNumbers(text) {
  const bare = NOT_A_NUMBER.reduce((rest, phrase) => rest.split(phrase).join(' '), text).replace(/\{[^{}]*\}/g, ' ');
  return bare.match(NUMBER) ?? [];
}

test('no sentence spells out a number: every number in a sentence comes from a slot', () => {
  // The check itself catches what it is for.
  assert.deepEqual(spelledNumbers('Give $20 to make it stop'), ['20']);
  assert.deepEqual(spelledNumbers('Two bottles of kombucha'), ['Two']);
  assert.deepEqual(spelledNumbers('Breakdown repairs cost {repairCost} kit instead of 2.'), ['2']);
  assert.deepEqual(spelledNumbers('Twenty dollars bought silence.'), ['Twenty']);
  assert.deepEqual(spelledNumbers('Someone gave {money} to everyone at once.'), []);

  const all = sentences();
  const offenders = all.filter(({ text }) => spelledNumbers(text).length > 0);
  assert.deepEqual(
    offenders.map(({ path, text }) => `${path}: ${text}`),
    [],
  );
  for (const phrase of NOT_A_NUMBER) {
    assert.ok(
      all.some(({ text }) => text.includes(phrase)),
      `"${phrase}" is no longer in data.js`,
    );
  }
});

test('the same seed plays the same journey', () => {
  const play = () => {
    let state = start('dev', 20261001);
    for (let day = 0; day < 4; day++) {
      const result = transition(state, state.pendingEvent ? resolveFirst(state) : TRAVEL);
      state = result.state;
    }
    return state;
  };
  assert.deepEqual(play(), play());
});

// --- Whole journeys --------------------------------------------------------

/** An action that answers the pending encounter with the first response the engine accepts. */
function resolveFirst(state) {
  const plain = { type: 'resolveEvent', token: state.pendingEvent.token };
  const answers = [
    ...['repair', 'treat', 'kombucha', 'consult', 'trade', 'post', 'call', 'pay', 'donate', 'photo'],
    ...['wait', 'ride', 'kick', 'quarantine', 'riddle', 'sign'],
  ];
  for (const action of [plain, ...answers.map(choiceId => ({ ...plain, choiceId }))]) {
    if (!transition(state, action).error) return action;
  }
  throw new Error(`no answer to ${state.pendingEvent.id}`);
}

/** Play to an ending. A careful crew shops, talks, eats and rests at stops; a careless one only drives. */
function play(profession, seed, careful) {
  let state = createGame({ profession, seed });
  const shopped = new Set();
  const first = actions => actions.find(action => !transition(state, action).error);
  for (let step = 0; step < 900 && !state.outcome; step++) {
    const here = currentStop(state);
    const weak = state.party.some(member => member.health > 0 && (member.health < 55 || member.sick));
    let action;
    if (state.pendingEvent) action = resolveFirst(state);
    else if (careful) {
      action = first([
        { type: 'autoPurchase' },
        { type: 'talk' },
        { type: 'meal' },
        ...(weak ? [{ type: 'useItem', itemId: 'kombucha' }] : []),
        ...(weak && here ? [{ type: 'rest' }] : []),
        ...(here && !shopped.has(here.id) ? [{ type: 'openShop' }] : []),
        TRAVEL,
        { type: 'leaveShop' },
        { type: 'tradeLuggage' },
        { type: 'hitchhike' },
      ]);
      if (action?.type === 'openShop') shopped.add(here.id);
    } else {
      action = first([TRAVEL, { type: 'tradeLuggage' }, { type: 'push' }]);
    }
    assert.ok(action, `stuck on day ${state.day} at mile ${state.distance} in phase ${state.phase}`);
    const before = state;
    state = act(state, action);
    assert.ok(state.distance >= before.distance && state.day >= before.day);
    assert.deepEqual(deserializeGame(serializeGame(state)), state);
  }
  assert.ok(state.outcome, `${profession} seed ${seed} never reached an ending`);
  return state;
}

test('a careful crew can reach Portland with every background', () => {
  for (const profession of PROFESSIONS) {
    const endings = seeds(12).map(seed => play(profession.id, seed, true));
    const won = endings.filter(state => state.outcome === 'won');
    assert.ok(won.length > 0, `${profession.id} never arrived`);
    for (const state of won) {
      assert.equal(state.distance, RULES.goalMiles);
      assert.equal(state.phase, 'ended');
      assert.ok(state.party.some(member => member.health > 0));
      assert.equal(state.journal.at(-1).text, JOURNAL.won);
    }
  }
});

test('a crew that never shops runs dry, pushes, and is lost on the road', () => {
  const endings = seeds(12).map(seed => play('dev', seed, false));
  const lost = endings.filter(state => state.outcome === 'lost');
  assert.ok(lost.length > 0);
  for (const state of lost) {
    assert.ok(state.distance < RULES.goalMiles);
    assert.equal(state.phase, 'ended');
    assert.ok(state.party.every(member => member.health === 0 && member.death));
    assert.equal(state.journal.at(-1).text, JOURNAL.lost);
  }
  assert.ok(lost.some(state => state.journal.some(entry => entry.text === 'The tank is dry.')));
  assert.ok(lost.some(state => state.flags.luggageTraded));
});

test('playing never changes the game data', () => {
  assert.deepEqual({ ...data }, DATA_AT_LOAD);
});
