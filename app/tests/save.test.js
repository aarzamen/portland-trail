import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_VERSION,
  createGame,
  currentStop,
  deserializeGame,
  seedFromText,
  serializeGame,
  transition,
  weatherName,
} from '../src/engine.js';
import { DEATHS, DEFAULT_NAMES, EVENTS, ITEMS, LIMITS, LOCATIONS, PROFESSIONS, RULES } from '../src/data.js';

const TRAVEL = { type: 'travel' };
const ENDED = 'This journey has ended. Start a new one to play again.';

const start = (profession = 'dev', seed = 21) => createGame({ profession, seed });
const stop = id => LOCATIONS.find(entry => entry.id === id);
const item = id => ITEMS.find(entry => entry.id === id);
const load = state => deserializeGame(JSON.stringify(state));
const roundTrip = state => deserializeGame(serializeGame(state));
const crew = (state, change) => ({
  ...state,
  party: state.party.map((member, index) => ({ ...member, ...change(member, index) })),
});
const fallen = (state, cause = 'unknown') => ({
  health: 0,
  sick: false,
  death: { day: state.day, mile: state.distance, cause },
  epitaph: DEATHS[cause].epitaph,
});

function act(state, action) {
  const result = transition(state, action);
  assert.equal(result.error, null, `${action.type}: ${result.error}`);
  return result.state;
}

/** An action that answers the pending encounter with the first response the engine accepts. */
function firstAnswer(state) {
  const entry = EVENTS.find(candidate => candidate.id === state.pendingEvent.id);
  const plain = { type: 'resolveEvent', token: state.pendingEvent.token };
  const options = entry.choices.map(choice => ({ ...plain, choiceId: choice.id }));
  return [plain, ...options].find(option => !transition(state, option).error);
}

/** Play on, reporting every state, until the journey ends. A crew that shops; or one that only drives. */
function play(profession, seed, shops, visit) {
  let state = createGame({ profession, seed });
  const shopped = new Set();
  visit(state);
  for (let step = 0; step < 900 && !state.outcome; step++) {
    const here = currentStop(state);
    const options = state.pendingEvent
      ? [firstAnswer(state)]
      : [
          ...(shops ? [{ type: 'autoPurchase' }, { type: 'talk' }] : []),
          ...(shops && here && !shopped.has(here.id) ? [{ type: 'openShop' }] : []),
          TRAVEL,
          { type: 'leaveShop' },
          { type: 'tradeLuggage' },
          { type: shops ? 'hitchhike' : 'push' },
        ];
    const action = options.find(option => !transition(state, option).error);
    if (action.type === 'openShop') shopped.add(here.id);
    state = act(state, action);
    visit(state);
  }
  return state;
}

// --- Round trips -----------------------------------------------------------

test('a fresh journey round-trips for every background', () => {
  for (const profession of PROFESSIONS) {
    const state = start(profession.id, seedFromText(profession.id));
    const text = serializeGame(state);
    assert.equal(typeof text, 'string');
    assert.equal(JSON.parse(text).version, SAVE_VERSION);
    assert.deepEqual(deserializeGame(text), state);
    assert.notEqual(deserializeGame(text), state);
  }
});

test('every state of a journey round-trips: on the road, in an encounter, won and lost', () => {
  const seen = { road: 0, stop: 0, shop: 0, pending: 0, dead: 0, won: 0, lost: 0 };
  const visit = state => {
    assert.deepEqual(roundTrip(state), state);
    if (state.phase === 'travel') seen.road += 1;
    if (state.phase === 'location') seen.stop += 1;
    if (state.phase === 'shop') seen.shop += 1;
    if (state.pendingEvent) seen.pending += 1;
    if (state.party.some(member => member.death)) seen.dead += 1;
    if (state.outcome) seen[state.outcome] += 1;
  };
  for (let index = 0; index < 24; index++) {
    const profession = PROFESSIONS[index % PROFESSIONS.length].id;
    const ending = play(profession, seedFromText(`save-${index}`), index % 3 !== 0, visit);
    assert.ok(ending.outcome, 'the journey ends');
  }
  for (const [kind, count] of Object.entries(seen)) assert.ok(count > 0, `no ${kind} state was saved`);
});

test('weather, sickness and a death round-trip', () => {
  const road = { ...start(), phase: 'travel', distance: 300, rations: 'bare' };
  const after = (id, choiceId) =>
    act(
      { ...road, pendingEvent: { id, token: 1 }, flags: { ...road.flags, nextToken: 1 } },
      { type: 'resolveEvent', token: 1, choiceId },
    );
  const hot = after('bad_weather');
  const wet = after('good_weather');
  const ill = after('food_poisoning', 'ride');
  const grieving = act(
    crew(road, (member, index) => (index === 0 ? { health: 1 } : {})),
    { type: 'rest' },
  );
  assert.equal(hot.weather.id, 'heat');
  assert.equal(wet.weather.id, 'drizzle');
  assert.equal(ill.party.filter(member => member.sick).length, 1);
  assert.equal(grieving.party[0].death.cause, 'rations');
  for (const state of [hot, wet, ill, grieving]) assert.deepEqual(roundTrip(state), state);
});

test('names of 32 characters, markup and emoji survive a save', () => {
  const names = ['A'.repeat(LIMITS.name), '<img src=x onerror=alert(1)>', 'Röwan', '🚐🌲', "O'Malley & Co"];
  const state = createGame({ profession: 'dev', names, seed: 4 });
  assert.deepEqual(
    roundTrip(state).party.map(member => member.name),
    names,
  );
});

test('an epitaph survives a save', () => {
  const base = start();
  const mourning = crew({ ...base, phase: 'travel', distance: 40 }, (member, index) =>
    index === 0 ? fallen(base, 'road') : {},
  );
  const state = act(mourning, {
    type: 'setEpitaph',
    memberId: 'traveler_1',
    text: 'Loved <b>kale</b> & "the road".',
  });
  assert.equal(roundTrip(state).party[0].epitaph, 'Loved <b>kale</b> & "the road".');
  assert.deepEqual(roundTrip(state), state);
});

// --- Rejected --------------------------------------------------------------

test('text that is not a journey is rejected, never thrown', () => {
  const junk = ['{oops', '', 'null', '42', '"text"', '[]', '[1, 2]', 'true', '{}', '{"version":3}'];
  for (const text of junk) assert.equal(deserializeGame(text), null, text);
  /** @type {any[]} */
  const notText = [undefined, null, 7, {}, [], start()];
  for (const raw of notText) assert.equal(deserializeGame(raw), null);
});

test('a save that cannot be a journey is rejected', () => {
  const state = start();
  const member = (change, index = 0) => crew(state, (entry, at) => (at === index ? change : {}));
  const rejected = {
    'version 999': { ...state, version: 999 },
    'version 0': { ...state, version: 0 },
    'version as text': { ...state, version: '3' },
    'no version': { ...state, version: undefined },
    'four travelers': { ...state, party: state.party.slice(0, 4) },
    'six travelers': { ...state, party: [...state.party, state.party[0]] },
    'no party': { ...state, party: undefined },
    'a traveler who is not a record': { ...state, party: [null, ...state.party.slice(1)] },
    'an empty name': member({ name: '   ' }),
    'a long name': member({ name: 'A'.repeat(LIMITS.name + 1) }),
    'a name that is not text': member({ name: 7 }),
    'health above 100': member({ health: 101 }),
    'negative health': member({ health: -1 }),
    'fractional health': member({ health: 50.5 }),
    'health that is not a number': member({ health: Number.NaN }),
    'negative fuel': { ...state, inventory: { ...state.inventory, fuel: -1 } },
    'food that is not a number': { ...state, inventory: { ...state.inventory, food: Number.NaN } },
    'cash as text': { ...state, inventory: { ...state.inventory, money: '1200' } },
    'a missing supply': { ...state, inventory: { ...state.inventory, kombucha: undefined } },
    'no inventory': { ...state, inventory: null },
    'an unknown background': { ...state, profession: 'pirate' },
    'an inherited background': { ...state, profession: 'constructor' },
    'an unknown pace': { ...state, pace: 'warp' },
    'an inherited pace': { ...state, pace: 'constructor' },
    'unknown rations': { ...state, rations: 'feast' },
    'inherited rations': { ...state, rations: 'toString' },
    'distance 1001': { ...state, distance: RULES.goalMiles + 1 },
    'a negative distance': { ...state, distance: -1 },
    'a fractional distance': { ...state, distance: 10.5 },
    'day 0': { ...state, day: 0 },
    'a fractional day': { ...state, day: 1.5 },
    'a day that is not a number': { ...state, day: Number.NaN },
  };
  for (const [what, save] of Object.entries(rejected)) {
    assert.equal(load(save), null, what);
    assert.throws(() => serializeGame(save), /invalid journey/, what);
  }
});

test('serializeGame refuses anything that is not a whole, valid journey', () => {
  const state = start();
  /** @type {any[]} */
  const notJourneys = [null, undefined, 7, 'state', [], {}, { version: 3 }];
  for (const bad of notJourneys) assert.throws(() => serializeGame(bad), /invalid journey/);
  const invalid = [
    { ...state, extra: true },
    { ...state, phase: 'location', distance: 55 },
    { ...state, phase: 'ended' },
    { ...state, outcome: 'won' },
    { ...state, pendingEvent: { id: 'bogus', token: 1 } },
    { ...state, flags: { ...state.flags, talked: ['atlantis'] } },
    { ...state, flags: { ...state.flags, meals: undefined } },
    { ...state, logged: 0 },
    { ...state, rng: -1 },
    { ...state, seed: 2 ** 32 },
    { ...state, weather: { id: 'hail', until: 3 } },
    { ...state, inventory: { ...state.inventory, fuel: 2.5 } },
    { ...state, inventory: { ...state.inventory, gold: 1 } },
    crew(state, () => ({ health: 0 })),
    crew(state, (member, index) => (index === 0 ? { epitaph: 'Still here.' } : {})),
    crew(state, (member, index) => (index === 0 ? { sick: 'yes' } : {})),
    crew(state, (member, index) => (index === 0 ? { id: 'traveler_9' } : {})),
    crew(state, (member, index) => (index === 0 ? { name: ' Kale ' } : {})),
  ];
  for (const [index, bad] of invalid.entries()) {
    assert.throws(() => serializeGame(bad), /invalid journey/, `invalid state ${index}`);
  }
  assert.equal(typeof serializeGame(state), 'string');
});

// --- Repaired --------------------------------------------------------------

test('a stop phase away from any stop becomes the road', () => {
  for (const phase of ['location', 'shop']) {
    const repaired = load({ ...start(), phase, distance: 55 });
    assert.equal(repaired.phase, 'travel');
    assert.equal(repaired.distance, 55);
    assert.equal(currentStop(repaired), null);
    assert.equal(transition(repaired, { type: 'rest' }).error, null);
  }
  // A shop phase at a stop with no shop becomes the stop itself.
  const camp = load({ ...start(), phase: 'shop', distance: stop('forest_camp').miles });
  assert.equal(camp.phase, 'location');
  assert.equal(currentStop(camp).id, 'forest_camp');
  // A real stop is left as it is.
  const motel = load({ ...start(), phase: 'shop', distance: stop('sketchy_motel').miles });
  assert.equal(motel.phase, 'shop');
});

test('a pending encounter that no longer exists is dropped', () => {
  const state = { ...start(), phase: 'travel', distance: 40 };
  const facing = (id, token, nextToken) => ({
    ...state,
    pendingEvent: { id, token },
    flags: { ...state.flags, nextToken },
  });
  const gone = load(facing('meteor_shower', 3, 3));
  assert.equal(gone.pendingEvent, null);
  assert.equal(transition(gone, TRAVEL).error, null);
  for (const pendingEvent of [{ id: 'found_supplies' }, { id: 'found_supplies', token: 0 }, 'found_supplies', 7]) {
    assert.equal(load({ ...state, pendingEvent }).pendingEvent, null);
  }
  // A real one is kept, and its token stays fresh.
  const kept = load(facing('found_supplies', 9, 2));
  assert.deepEqual(kept.pendingEvent, { id: 'found_supplies', token: 9 });
  assert.equal(kept.flags.nextToken, 9);
  assert.equal(act(kept, { type: 'resolveEvent', token: 9 }).pendingEvent, null);
});

test('unknown stops in the conversation and meal records are dropped', () => {
  const state = start();
  const flags = {
    ...state.flags,
    talked: ['bookshop', 'atlantis', 'bookshop', 7, 'river_ferry'],
    meals: ['food_truck_fest', 'nowhere', null],
  };
  const repaired = load({ ...state, flags });
  assert.deepEqual(repaired.flags.talked, ['bookshop', 'river_ferry']);
  assert.deepEqual(repaired.flags.meals, ['food_truck_fest']);
});

test('a running journey with nobody alive becomes a lost ending', () => {
  const state = { ...start(), phase: 'travel', distance: 300 };
  const wiped = crew(state, () => fallen(state));
  for (const save of [
    wiped,
    { ...wiped, pendingEvent: { id: 'food_poisoning', token: 1 }, flags: { ...wiped.flags, nextToken: 1 } },
    { ...wiped, phase: 'ended', outcome: 'won', distance: RULES.goalMiles },
  ]) {
    const repaired = load(save);
    assert.equal(repaired.phase, 'ended');
    assert.equal(repaired.outcome, 'lost');
    assert.equal(repaired.pendingEvent, null);
    assert.equal(transition(repaired, TRAVEL).error, ENDED);
    assert.deepEqual(roundTrip(repaired), repaired);
  }
});

test('an ending is made whole: it has an outcome, and a win is at mile 1000', () => {
  const state = { ...start(), phase: 'travel', distance: 300 };
  const noOutcome = load({ ...state, phase: 'ended', outcome: null });
  assert.equal(noOutcome.outcome, 'lost');
  assert.equal(noOutcome.phase, 'ended');

  const shortWin = load({ ...state, phase: 'ended', outcome: 'won', distance: 990 });
  assert.equal(shortWin.outcome, 'won');
  assert.equal(shortWin.distance, RULES.goalMiles);

  const stillDriving = load({ ...state, outcome: 'won', distance: RULES.goalMiles });
  assert.equal(stillDriving.phase, 'ended');

  const pastTheSign = load({ ...state, distance: RULES.goalMiles });
  assert.equal(pastTheSign.outcome, 'won');
  assert.equal(pastTheSign.phase, 'ended');

  const haunted = load({
    ...state,
    phase: 'ended',
    outcome: 'lost',
    pendingEvent: { id: 'found_supplies', token: 1 },
    flags: { ...state.flags, nextToken: 1 },
  });
  assert.equal(haunted.pendingEvent, null);
  for (const repaired of [noOutcome, shortWin, stillDriving, pastTheSign, haunted]) {
    assert.deepEqual(roundTrip(repaired), repaired);
  }
});

test('a journal over the limit keeps its newest lines', () => {
  const state = start();
  const journal = Array.from({ length: RULES.journalLimit + 30 }, (_, index) => ({ day: 1, text: `Line ${index}.` }));
  const repaired = load({ ...state, journal, logged: journal.length });
  assert.equal(repaired.journal.length, RULES.journalLimit);
  assert.equal(repaired.journal[0].text, 'Line 30.');
  assert.equal(repaired.journal.at(-1).text, `Line ${journal.length - 1}.`);
  assert.equal(repaired.logged, journal.length);

  // Lines that are not lines are dropped, and the count never falls below what is kept.
  const untidy = [{ day: 1, text: 'Kept.' }, null, { day: 0, text: 'No day.' }, { day: 1, text: 7 }, 'loose text'];
  const tidied = load({ ...state, journal: untidy, logged: 1 });
  assert.deepEqual(tidied.journal, [{ day: 1, text: 'Kept.' }]);
  assert.equal(tidied.logged, 1);
  assert.equal(load({ ...state, logged: -5 }).logged, state.journal.length);
});

test('a traveler is made consistent: the dead have a death, the living have none', () => {
  const state = { ...start(), phase: 'travel', distance: 300, day: 9 };
  const repaired = load(
    crew(state, (member, index) => {
      if (index === 0) return { health: 0, death: null, epitaph: '', sick: true };
      if (index === 1) return { health: 0, death: { day: 4, mile: 120, cause: 'meteor' }, epitaph: 'x'.repeat(61) };
      if (index === 2) return { death: { day: 2, mile: 80, cause: 'road' }, epitaph: 'Premature.' };
      if (index === 3) return { sick: 'very' };
      return { id: 'someone_else' };
    }),
  );
  assert.deepEqual(repaired.party[0], {
    id: 'traveler_1',
    name: DEFAULT_NAMES[0],
    health: 0,
    sick: false,
    death: { day: 9, mile: 300, cause: 'unknown' },
    epitaph: DEATHS.unknown.epitaph,
  });
  assert.deepEqual(repaired.party[1].death, { day: 4, mile: 120, cause: 'unknown' });
  assert.equal(repaired.party[1].epitaph, DEATHS.unknown.epitaph);
  assert.equal(repaired.party[2].death, null);
  assert.equal(repaired.party[2].epitaph, '');
  assert.equal(repaired.party[3].sick, false);
  assert.equal(repaired.party[4].id, 'traveler_5');
  assert.deepEqual(roundTrip(repaired), repaired);
});

test('unknown fields are dropped and missing later fields take their defaults', () => {
  const state = start();
  const { meals, luggageTraded, ...oldFlags } = state.flags;
  assert.deepEqual(meals, []);
  assert.equal(luggageTraded, false);
  const save = {
    ...state,
    cheat: true,
    locationId: 'portland',
    inventory: { ...state.inventory, gold: 99 },
    flags: { ...oldFlags, godMode: true },
    weather: { ...state.weather, forecast: 'sun' },
    party: state.party.map(member => ({ ...member, status: 'Healthy', level: 9 })),
    journal: state.journal.map(entry => ({ ...entry, mood: 'hopeful' })),
  };
  assert.deepEqual(load(save), state);

  // Everything but the essentials can be missing.
  const { profession, party, inventory, distance, day, pace, rations } = state;
  const minimal = load({ version: 3, profession, party, inventory, distance, day, pace, rations });
  assert.equal(minimal.phase, 'travel');
  assert.equal(minimal.outcome, null);
  assert.equal(minimal.pendingEvent, null);
  assert.deepEqual(minimal.journal, []);
  assert.equal(minimal.logged, 0);
  assert.equal(weatherName(minimal), 'Clear');
  assert.deepEqual(minimal.flags, { ...state.flags });
  assert.ok(Number.isInteger(minimal.rng) && minimal.rng === minimal.seed);
  assert.deepEqual(roundTrip(minimal), minimal);
  assert.equal(transition(minimal, TRAVEL).error, null);
});

test('supplies above what the van holds are kept', () => {
  const state = start();
  const heavy = {
    ...state,
    inventory: { ...state.inventory, fuel: item('fuel').max + 15, food: item('food').max + 0.5, ammo: 40, nft: 9 },
  };
  assert.deepEqual(load(heavy).inventory, heavy.inventory);
  assert.deepEqual(roundTrip(heavy), heavy);
});

// --- Versions 1 and 2 ------------------------------------------------------

const oldParty = (changes = {}) =>
  DEFAULT_NAMES.map((name, index) => ({
    id: `traveler_${index + 1}`,
    name,
    health: 100,
    status: 'Healthy',
    ...changes[index],
  }));

/** A save in the shape versions 1 and 2 wrote. */
function legacy(version, changes = {}) {
  return {
    version,
    phase: 'shop',
    profession: 'dev',
    party: oldParty(),
    inventory: { money: 1200, food: 30, fuel: 20, ammo: 0, parts: 0, kombucha: 0, nft: 1 },
    locationId: 'start_city',
    distance: 0,
    day: 1,
    weather: 'Clear',
    pace: 'normal',
    rations: 'meager',
    pendingEvent: null,
    rng: 21,
    journal: [{ day: 1, text: 'Five travelers pack the van for Portland.' }],
    outcome: null,
    shopReturn: 'start_city',
    flags: { nextToken: 0, lastAbilityDay: -99, talked: [], wifiDownDay: -1 },
    ...changes,
  };
}

const roadJournal = [
  { day: 1, text: 'Five travelers pack the van for Portland.' },
  { day: 1, text: 'The van pulls away from the artist co-op.' },
  { day: 2, text: 'Traveled to mile 80.' },
  { day: 3, text: 'Traveled to mile 160.' },
  { day: 3, text: 'Abandoned Free Box!' },
];

/** The seven saved situations, for one old version. `locations` names where that version thought the van was. */
function legacySaves(version) {
  const v1 = version === 1;
  return {
    'the starting shop': legacy(version),
    'the road with a pending encounter': legacy(version, {
      phase: 'travel',
      distance: 160,
      day: 3,
      locationId: v1 ? 'start_city' : 'mushroom_market',
      inventory: { money: 1044, food: 25, fuel: 12, ammo: 0, parts: 0, kombucha: 0, nft: 1 },
      pendingEvent: { id: 'found_supplies', token: 2 },
      rng: 3141592653,
      journal: roadJournal,
      flags: { nextToken: 2, lastAbilityDay: 2, talked: [], wifiDownDay: -1 },
    }),
    'a stop': legacy(version, {
      phase: 'location',
      distance: 200,
      day: 4,
      locationId: 'first_stop',
      inventory: { money: 900, food: 22.5, fuel: 8, ammo: 1, parts: 2, kombucha: 1, nft: 0 },
      rng: 99,
      journal: [...roadJournal.slice(0, 4), { day: 4, text: 'Arrived at Forgotten Highway Rest Stop.' }],
    }),
    'a shop mid-route': legacy(version, {
      phase: 'shop',
      distance: 350,
      day: 7,
      locationId: 'sketchy_motel',
      shopReturn: 'sketchy_motel',
      inventory: { money: 640, food: 12.25, fuel: 0, ammo: 0, parts: 1, kombucha: 0, nft: 0 },
      weather: 'Perfect drizzle',
      flags: { nextToken: 4, lastAbilityDay: 5, talked: v1 ? [] : ['mushroom_market', 'river_ferry'], wifiDownDay: 6 },
    }),
    'a won ending': legacy(version, {
      phase: 'ended',
      outcome: 'won',
      distance: 1000,
      day: 19,
      locationId: 'portland',
      shopReturn: v1 ? 'food_truck_fest' : 'bookshop',
      inventory: { money: 310, food: 4.5, fuel: 3, ammo: 0, parts: 0, kombucha: 0, nft: 0 },
      party: oldParty({ 1: { health: 61, status: 'Injured' }, 3: { health: 0, status: 'Deceased' } }),
      journal: [...roadJournal, { day: 19, text: 'Portland at last. The van and its survivors roll into town.' }],
      flags: { nextToken: 6, lastAbilityDay: 17, talked: ['viral_landmark', 'crypto_meetup'], wifiDownDay: 11 },
    }),
    'an ending lost to an empty tank': legacy(version, {
      phase: 'ended',
      outcome: 'lost',
      distance: 600,
      day: 11,
      locationId: v1 ? 'viral_landmark' : 'forest_camp',
      shopReturn: 'sketchy_motel',
      inventory: { money: 15, food: 9, fuel: 1, ammo: 0, parts: 0, kombucha: 0, nft: 0 },
      journal: [...roadJournal, { day: 11, text: 'The van ran dry with no way to reach the next stop.' }],
    }),
    'a party with the dead and the sick': legacy(version, {
      phase: 'travel',
      distance: 505,
      day: 12,
      locationId: 'viral_landmark',
      shopReturn: 'sketchy_motel',
      weather: 'Heatwave',
      party: oldParty({
        0: { health: 0, status: 'Deceased' },
        2: { health: 46, status: 'Sick' },
        4: { health: 58, status: 'Injured' },
      }),
      inventory: { money: 402, food: 17.75, fuel: 14, ammo: 0, parts: 0, kombucha: 2, nft: 0 },
      journal: roadJournal,
      flags: { nextToken: 5, lastAbilityDay: 10, talked: ['viral_landmark'], wifiDownDay: 3 },
    }),
  };
}

const expectedPhase = {
  'the starting shop': 'shop',
  'the road with a pending encounter': 'travel',
  'a stop': 'location',
  'a shop mid-route': 'shop',
  'a won ending': 'ended',
  'an ending lost to an empty tank': 'ended',
  'a party with the dead and the sick': 'travel',
};
const weatherIds = { Clear: 'clear', 'Perfect drizzle': 'drizzle', Heatwave: 'heat' };

for (const version of [2, 1]) {
  test(`version ${version} saves migrate with their progress intact`, () => {
    const saves = legacySaves(version);
    assert.deepEqual(Object.keys(saves), Object.keys(expectedPhase));
    for (const [what, old] of Object.entries(saves)) {
      const state = deserializeGame(JSON.stringify(old));
      assert.ok(state, what);
      assert.equal(state.version, 3, what);
      assert.equal(state.phase, expectedPhase[what], what);
      assert.equal(state.distance, old.distance, what);
      assert.equal(state.day, old.day, what);
      assert.deepEqual(state.inventory, old.inventory, what);
      assert.deepEqual(state.journal, old.journal, what);
      assert.equal(state.logged, old.journal.length, what);
      assert.deepEqual(state.pendingEvent, old.pendingEvent, what);
      assert.equal(state.outcome, old.outcome, what);
      assert.equal(state.profession, old.profession);
      assert.equal(state.pace, old.pace);
      assert.equal(state.rations, old.rations);
      assert.equal(state.rng, old.rng, what);
      assert.equal(state.seed, old.rng, what);
      assert.deepEqual(state.weather, { id: weatherIds[old.weather], until: old.day }, what);
      assert.deepEqual(state.flags, { ...old.flags, meals: [], luggageTraded: false }, what);
      assert.ok(!('locationId' in state) && !('shopReturn' in state), what);

      for (const [index, member] of state.party.entries()) {
        const before = old.party[index];
        const dead = before.status === 'Deceased' || before.health === 0;
        assert.deepEqual(
          member,
          {
            id: before.id,
            name: before.name,
            health: dead ? 0 : before.health,
            sick: before.status === 'Sick',
            death: dead ? { day: old.day, mile: old.distance, cause: 'unknown' } : null,
            epitaph: dead ? DEATHS.unknown.epitaph : '',
          },
          what,
        );
      }
      assert.deepEqual(roundTrip(state), state, what);
    }
  });

  test(`version ${version} saves play on after migrating`, () => {
    const saves = legacySaves(version);
    const loaded = what => deserializeGame(JSON.stringify(saves[what]));

    const shop = loaded('the starting shop');
    assert.equal(currentStop(shop).id, 'start_city');
    assert.equal(act(shop, { type: 'purchase', cart: { fuel: 1 } }).inventory.fuel, 21);
    assert.equal(act(shop, TRAVEL).day, 2);

    const pending = loaded('the road with a pending encounter');
    assert.equal(transition(pending, TRAVEL).error, 'Resolve the current encounter first.');
    const resolved = act(pending, { type: 'resolveEvent', token: 2 });
    const box = EVENTS.find(entry => entry.id === 'found_supplies');
    assert.equal(resolved.inventory.food, 25 + box.food);
    assert.equal(resolved.inventory.fuel, 12 + box.fuel);
    assert.equal(transition(resolved, { type: 'resolveEvent', token: 2 }).error, 'There is no encounter to resolve.');

    const rest = loaded('a stop');
    assert.equal(currentStop(rest).id, 'first_stop');
    assert.equal(act(rest, { type: 'rest' }).day, 5);

    const motel = loaded('a shop mid-route');
    assert.equal(currentStop(motel).id, 'sketchy_motel');
    assert.equal(weatherName(motel), 'Perfect drizzle');
    assert.equal(transition(motel, TRAVEL).error, 'The tank is dry. Buy fuel or try a last resort.');
    const fuelled = act(motel, { type: 'purchase', cart: { fuel: 10 } });
    const drove = transition(fuelled, TRAVEL);
    assert.equal(drove.error, null);
    assert.ok(drove.notes.includes('The weather clears.'));

    for (const what of ['a won ending', 'an ending lost to an empty tank']) {
      const ended = loaded(what);
      assert.equal(transition(ended, TRAVEL).error, ENDED, what);
      assert.equal(transition(ended, { type: 'rest' }).state, ended, what);
    }
    const won = loaded('a won ending');
    const carved = act(won, { type: 'setEpitaph', memberId: 'traveler_4', text: 'Almost saw the sign.' });
    assert.equal(carved.party[3].epitaph, 'Almost saw the sign.');

    const worn = loaded('a party with the dead and the sick');
    assert.equal(weatherName(worn), 'Heatwave');
    const next = act(worn, { type: 'rest' });
    assert.equal(next.party[0].health, 0);
    assert.equal(next.party[2].sick, true);
    assert.ok(next.party[2].health < 46 + RULES.roadRest.heal, 'the sick traveler pays for it each day');
    assert.equal(act(worn, { type: 'useItem', itemId: 'kombucha' }).party[2].sick, false);
  });
}

test('an old save on a mile that has since become a stop stays on the road', () => {
  const market = stop('mushroom_market');
  const state = deserializeGame(JSON.stringify(legacy(1, { phase: 'travel', distance: market.miles, day: 3 })));
  assert.equal(state.phase, 'travel', 'migration does not replay an arrival');
  assert.equal(currentStop(state), null);
  assert.equal(transition(state, { type: 'talk' }).state, state);
});

test('an old save with a stop that does not match its mile is repaired, not refused', () => {
  const adrift = load(legacy(2, { phase: 'location', distance: 400, locationId: 'start_city' }));
  assert.equal(adrift.phase, 'travel');
  assert.equal(adrift.distance, 400);
  const stale = legacy(2, { phase: 'travel', distance: 160, pendingEvent: { id: 'retired_event', token: 3 } });
  assert.equal(load(stale).pendingEvent, null);
  for (const version of [1, 2]) {
    assert.equal(load(legacy(version, { party: oldParty().slice(1) })), null);
    assert.equal(load(legacy(version, { pace: 'constructor' })), null);
    assert.equal(load(legacy(version, { inventory: null })), null);
    const dead = { health: 0, status: 'Deceased' };
    const allDead = oldParty([dead, dead, dead, dead, dead]);
    const wiped = load(legacy(version, { phase: 'travel', distance: 300, party: allDead }));
    assert.equal(wiped.outcome, 'lost');
    assert.equal(wiped.phase, 'ended');

    // Health 0 or the Deceased status alone is enough to be dead; the dead are never sick.
    const mixed = oldParty([
      { health: 40, status: 'Deceased' },
      { health: 0, status: 'Healthy' },
      { health: 0, status: 'Sick' },
    ]);
    const party = load(legacy(version, { phase: 'travel', distance: 300, day: 6, party: mixed })).party;
    for (const member of party.slice(0, 3)) {
      assert.equal(member.health, 0);
      assert.equal(member.sick, false);
      assert.deepEqual(member.death, { day: 6, mile: 300, cause: 'unknown' });
    }
    assert.equal(party[3].death, null);
  }
});

test('details a save gets wrong are put right', () => {
  const state = { ...start(), phase: 'travel', distance: 300 };
  assert.equal(load({ ...state, rng: undefined }).rng, state.seed);
  assert.equal(load({ ...state, rng: 2 ** 32 }).rng, state.seed);
  assert.equal(load({ ...state, seed: undefined, rng: 77 }).seed, 77);
  assert.equal(load({ ...state, seed: -3, rng: 77 }).seed, 77);
  for (const weather of [{ id: 'hail', until: 9 }, { id: 'heat' }, { id: 'heat', until: -1 }, 'Heatwave', null]) {
    assert.deepEqual(load({ ...state, weather }).weather, { id: 'clear', until: 0 });
  }
  assert.deepEqual(load({ ...state, weather: { id: 'heat', until: 9 } }).weather, { id: 'heat', until: 9 });
  assert.equal(load(crew(state, (member, index) => (index === 0 ? { name: '  Kale  ' } : {}))).party[0].name, 'Kale');
  const loose = load({ ...state, inventory: { ...state.inventory, fuel: 2.9, food: 1.239, money: 10.5 } });
  assert.deepEqual([loose.inventory.fuel, loose.inventory.food, loose.inventory.money], [2, 1.24, 10]);
  assert.equal(load({ ...state, phase: 'orbit' }).phase, 'travel');
  assert.equal(load({ ...state, outcome: 'draw' }).outcome, null);
  const flags = { nextToken: -1, lastAbilityDay: 'never', wifiDownDay: 2.5, talked: 'everyone', luggageTraded: 'yes' };
  assert.deepEqual(load({ ...state, flags }).flags, start().flags);
  assert.deepEqual(load({ ...state, flags: null }).flags, start().flags);
});
