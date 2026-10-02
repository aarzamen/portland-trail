import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableActions,
  createGame,
  describeAbility,
  describeItem,
  forecast,
  paceOptions,
  rationOptions,
  seedFromText,
  shareText,
  shopItems,
  statusOf,
  summarize,
  transition,
} from '../src/engine.js';
import {
  ACTION_TEXT,
  DEATHS,
  EVENTS,
  ITEMS,
  LOCATIONS,
  PACES,
  PROFESSIONS,
  RANKS,
  RATIONS,
  REFUSALS,
  REGIONS,
  RULES,
} from '../src/data.js';
import { fill } from '../src/engine/state.js';

// A mile with more open road ahead than the fastest pace covers in a day.
const ROAD = 355;
const CREW = 5;
const TOKEN = 7;
const GROUPS = ['primary', 'activity', 'ability', 'item', 'lastResort', 'event'];
// Actions that take no fields: when transition accepts one bare, an enabled option must offer it.
const BARE = [
  'rest',
  'forage',
  'meal',
  'talk',
  'openShop',
  'leaveShop',
  'ability',
  'push',
  'hitchhike',
  'tradeLuggage',
  'sellNft',
];
const LAST_RESORTS = ['push', 'hitchhike', 'tradeLuggage'];

/** @typedef {import('../src/engine/state.js').State} State */
const PACE_IDS = /** @type {State['pace'][]} */ (Object.keys(PACES));
const RATION_IDS = /** @type {State['rations'][]} */ (Object.keys(RATIONS));

const start = (profession = 'dev', seed = 21) => createGame({ profession, seed });
const stop = id => LOCATIONS.find(entry => entry.id === id);
const item = id => ITEMS.find(entry => entry.id === id);
const event = id => EVENTS.find(entry => entry.id === id);
const ability = id => PROFESSIONS.find(entry => entry.id === id).ability;
const regionAt = mile => REGIONS.find(region => mile < region.to);
const fuelFor = (miles, pace) => Math.ceil(miles / pace.milesPerFuel);

const onRoad = (state, distance = ROAD) => ({ ...state, phase: 'travel', distance });
const atStop = (state, id) => ({ ...state, phase: 'location', distance: stop(id).miles });
const inShop = (state, id) => ({ ...state, phase: 'shop', distance: stop(id).miles });
const stocked = (state, inventory) => ({ ...state, inventory: { ...state.inventory, ...inventory } });
const crew = (state, change) => ({
  ...state,
  party: state.party.map((member, index) => ({ ...member, ...change(member, index) })),
});
const fallen = (state, cause = 'unknown', day = state.day, mile = state.distance) => ({
  health: 0,
  sick: false,
  death: { day, mile, cause },
  epitaph: DEATHS[cause].epitaph,
});
const facing = (state, id) => ({
  ...state,
  pendingEvent: { id, token: TOKEN },
  flags: { ...state.flags, nextToken: TOKEN },
});
const ended = (state, outcome, changes = {}) => ({ ...state, phase: 'ended', outcome, ...changes });

const option = (options, key) => options.find(entry => entry.key === key);
const keysOf = options => options.map(entry => entry.key);

function act(state, action) {
  const result = transition(state, action);
  assert.equal(result.error, null, `${action.type}: ${result.error}`);
  return result.state;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** A small deterministic generator for the bot's own choices (mulberry32). */
function botRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** No visible text holds an unfilled slot. */
function assertFilled(entry, where) {
  for (const field of ['label', 'detail', 'reason']) {
    assert.equal(typeof entry[field], 'string', `${where} ${entry.key}.${field}`);
    assert.ok(!entry[field].includes('{'), `${where} ${entry.key}.${field}: ${entry[field]}`);
  }
}

/**
 * Every option agrees with transition: enabled ones are accepted, disabled ones are refused with
 * exactly their reason, and every bare action transition accepts is offered.
 */
function assertAgreement(state, options, where) {
  const results = new Map();
  const tried = action => {
    const id = JSON.stringify(action);
    if (!results.has(id)) results.set(id, transition(state, action));
    return results.get(id);
  };
  assert.equal(new Set(keysOf(options)).size, options.length, `${where}: keys are unique`);
  for (const entry of options) {
    assertFilled(entry, where);
    assert.ok(GROUPS.includes(entry.group), `${where} ${entry.key}: group ${entry.group}`);
    assert.equal(entry.enabled, entry.reason === '', `${where} ${entry.key}: a reason exactly when disabled`);
    const { error } = tried(entry.action);
    if (entry.enabled) assert.equal(error, null, `${where} ${entry.key} is enabled but refused: ${error}`);
    else assert.equal(error, entry.reason, `${where} ${entry.key} is disabled`);
  }
  for (const type of BARE) {
    if (tried({ type }).error !== null) continue;
    const offered = options.some(entry => entry.enabled && JSON.stringify(entry.action) === JSON.stringify({ type }));
    assert.ok(offered, `${where}: transition accepts ${type}, so it is offered`);
  }
}

// --- availableActions: agreement with transition (A1) ----------------------

test('every option agrees with transition over 200 journeys of a random bot', () => {
  const professions = PROFESSIONS.map(profession => profession.id);
  let steps = 0;
  let disabledSeen = 0;
  const contexts = new Set();
  for (let journey = 0; journey < 200; journey++) {
    const seed = seedFromText(`selectors-${journey}`);
    const random = botRandom(seed ^ 0x9e3779b9);
    let state = createGame({ profession: professions[journey % professions.length], seed });
    for (let step = 0; step < 400 && !state.outcome; step++) {
      const where = `journey ${journey} step ${step}`;
      const options = availableActions(state);
      assertAgreement(state, options, where);
      steps += 1;
      disabledSeen += options.filter(entry => !entry.enabled).length;
      contexts.add(state.pendingEvent ? `event:${state.pendingEvent.id}` : state.phase);
      const enabled = options.filter(entry => entry.enabled);
      assert.ok(enabled.length > 0, `${where}: something can always be done`);
      if (state.phase === 'shop' && random() < 0.4) {
        const bought = transition(state, { type: 'autoPurchase' });
        if (!bought.error) state = bought.state;
      }
      if (!state.pendingEvent && random() < 0.05) {
        const paces = paceOptions(state);
        state = act(state, { type: 'setPace', pace: paces[Math.floor(random() * paces.length)].id });
      }
      const choices = availableActions(state).filter(entry => entry.enabled);
      state = act(state, choices[Math.floor(random() * choices.length)].action);
    }
    if (state.outcome) assert.deepEqual(availableActions(state), [], `journey ${journey}: nothing after the end`);
  }
  assert.ok(steps > 5000, `the bot took ${steps} steps`);
  assert.ok(disabledSeen > 100, `disabled options were checked ${disabledSeen} times`);
  assert.ok(contexts.has('shop') && contexts.has('location') && contexts.has('travel'), [...contexts].join());
  assert.ok([...contexts].filter(context => context.startsWith('event:')).length >= 8, [...contexts].join());
});

// --- availableActions: content ---------------------------------------------

test('in the starting shop the first option is Leave for Portland', () => {
  const options = availableActions(deepFreeze(start()));
  assert.equal(options[0].key, 'travel');
  assert.equal(options[0].group, 'primary');
  assert.equal(options[0].label, 'Leave for Portland');
  assert.deepEqual(options[0].action, { type: 'travel' });
  assert.equal(options[0].enabled, true);
  const back = option(options, 'leaveShop');
  assert.equal(back.label, `Back to ${stop('start_city').shortName}`);
  assert.equal(back.group, 'activity');
});

test('away from mile 0 the drive names the next stop and the miles and fuel it would take today', () => {
  const next = LOCATIONS.find(entry => entry.miles > ROAD);
  for (const pace of PACE_IDS) {
    for (const fuel of [1, 3, 40]) {
      const state = { ...stocked(onRoad(start()), { fuel }), pace };
      const drive = option(availableActions(state), 'travel');
      assert.equal(drive.label, `Drive toward ${next.shortName}`);
      const after = act(state, { type: 'travel' });
      const miles = after.distance - ROAD;
      const burned = fuel - after.inventory.fuel;
      assert.equal(drive.detail, fill(ACTION_TEXT.travel.detail, { miles, fuel: burned }));
    }
  }
});

test('options come in display order: drive, activities, ability, items, last resorts', () => {
  const kit = { kombucha: 1, ammo: 1, fuel: 0 };
  assert.deepEqual(keysOf(availableActions(stocked(onRoad(start()), kit))), [
    'travel',
    'rest',
    'forage',
    'ability',
    'useItem:kombucha',
    'useItem:ammo',
    'push',
    'hitchhike',
    'tradeLuggage',
  ]);
  const camp = stocked(atStop(start(), 'forest_camp'), { kombucha: 1, ammo: 1 });
  assert.deepEqual(keysOf(availableActions(camp)), [
    'travel',
    'rest',
    'forage',
    'talk',
    'ability',
    'useItem:kombucha',
    'useItem:ammo',
  ]);
  assert.deepEqual(keysOf(availableActions(atStop(start(), 'food_truck_fest'))), [
    'travel',
    'meal',
    'openShop',
    'ability',
  ]);
  const groups = Object.fromEntries(
    availableActions(stocked(camp, { fuel: 0 })).map(entry => [entry.key, entry.group]),
  );
  assert.deepEqual(groups, {
    travel: 'primary',
    rest: 'activity',
    forage: 'activity',
    talk: 'activity',
    ability: 'ability',
    'useItem:kombucha': 'item',
    'useItem:ammo': 'item',
    push: 'lastResort',
    hitchhike: 'lastResort',
    tradeLuggage: 'lastResort',
  });
  const groupOf = (state, key) => option(availableActions(state), key).group;
  assert.equal(groupOf(atStop(start(), 'food_truck_fest'), 'meal'), 'activity');
  assert.equal(groupOf(atStop(start(), 'food_truck_fest'), 'openShop'), 'activity');
  assert.equal(groupOf(start('dev'), 'leaveShop'), 'activity');
  assert.equal(groupOf(start('dev'), 'sellNft'), 'item');
});

test('at Mushroom Market nobody rests or forages; on the road both are listed', () => {
  const market = keysOf(availableActions(atStop(start(), 'mushroom_market')));
  assert.ok(!market.includes('rest') && !market.includes('forage'), market.join());
  assert.ok(market.includes('talk') && market.includes('openShop'), market.join());
  const road = keysOf(availableActions(onRoad(start())));
  assert.ok(road.includes('rest') && road.includes('forage'), road.join());
});

test('the ability is listed at a stop and on the road, and not in the shop', () => {
  for (const profession of PROFESSIONS) {
    const state = start(profession.id);
    for (const where of [onRoad(state), atStop(state, 'first_stop')]) {
      const entry = option(availableActions(where), 'ability');
      assert.equal(entry.label, profession.ability.label);
      assert.equal(entry.group, 'ability');
      assert.equal(entry.detail, describeAbility(profession.id));
    }
    assert.equal(option(availableActions(state), 'ability'), undefined);
  }
  const used = act(onRoad(start('dev')), { type: 'ability' });
  const waiting = option(availableActions(used), 'ability');
  assert.equal(waiting.enabled, false);
  assert.equal(waiting.reason, fill(REFUSALS.cooldown, { days: ability('dev').cooldown }));
});

test('after talking, talk is listed disabled with its reason', () => {
  const market = atStop(start(), 'mushroom_market');
  assert.equal(option(availableActions(market), 'talk').enabled, true);
  const talked = act(market, { type: 'talk' });
  const entry = option(availableActions(talked), 'talk');
  assert.equal(entry.enabled, false);
  assert.equal(entry.reason, REFUSALS.talked);
});

test('at the motel without cash, renting a room is disabled and the reason names the cost', () => {
  const { rest } = stop('sketchy_motel');
  const broke = stocked(atStop(start(), 'sketchy_motel'), { money: rest.cost - 1 });
  const entry = option(availableActions(broke), 'rest');
  assert.equal(entry.label, rest.label);
  assert.equal(entry.enabled, false);
  assert.equal(entry.reason, fill(REFUSALS.cost, { cost: rest.cost, money: rest.cost - 1 }));
  assert.ok(entry.reason.includes(`$${rest.cost}`), entry.reason);
  assert.ok(entry.detail.includes(`$${rest.cost}`) && entry.detail.includes(String(rest.heal)), entry.detail);
  const paid = option(availableActions(stocked(broke, { money: rest.cost })), 'rest');
  assert.equal(paid.enabled, true);
});

test('a meal is offered once at the carts, with its cost for the living crew', () => {
  const { meal } = stop('food_truck_fest');
  const state = stocked(atStop(start(), 'food_truck_fest'), { money: 500 });
  const entry = option(availableActions(state), 'meal');
  assert.equal(entry.label, meal.label);
  assert.ok(entry.detail.includes(`$${meal.costEach * CREW}`), entry.detail);
  assert.ok(entry.detail.includes(String(meal.heal)), entry.detail);
  const fewer = crew(state, (member, index) => (index === 0 ? fallen(state) : {}));
  assert.ok(option(availableActions(fewer), 'meal').detail.includes(`$${meal.costEach * (CREW - 1)}`));
  const eaten = option(availableActions(act(state, { type: 'meal' })), 'meal');
  assert.equal(eaten.enabled, false);
  assert.equal(eaten.reason, REFUSALS.mealEaten);
});

test('last resorts appear only with a dry tank, and never in the shop', () => {
  const road = onRoad(start());
  for (const fuel of [1, 5]) {
    const keys = keysOf(availableActions(stocked(road, { fuel })));
    assert.ok(
      LAST_RESORTS.every(key => !keys.includes(key)),
      keys.join(),
    );
  }
  const dry = availableActions(stocked(road, { fuel: 0 }));
  assert.ok(
    LAST_RESORTS.every(key => option(dry, key)?.enabled),
    keysOf(dry).join(),
  );
  const drive = option(dry, 'travel');
  assert.equal(drive.enabled, false);
  assert.equal(drive.reason, REFUSALS.tankDry);
  const stopped = keysOf(availableActions(stocked(atStop(start(), 'first_stop'), { fuel: 0 })));
  assert.ok(
    LAST_RESORTS.every(key => stopped.includes(key)),
    stopped.join(),
  );
  const shop = keysOf(availableActions(stocked(start(), { fuel: 0 })));
  assert.ok(
    LAST_RESORTS.every(key => !shop.includes(key)),
    shop.join(),
  );
  const traded = act(stocked(road, { fuel: 0 }), { type: 'tradeLuggage' });
  const empty = stocked(traded, { fuel: 0 });
  const luggage = option(availableActions(empty), 'tradeLuggage');
  assert.equal(luggage.enabled, false);
  assert.equal(luggage.reason, REFUSALS.luggageGone);
});

test('items are listed when owned; an NFT sells only in the shop', () => {
  const road = onRoad(start('barista'));
  assert.equal(option(availableActions(stocked(road, { kombucha: 0, ammo: 0 })), 'useItem:kombucha'), undefined);
  assert.equal(option(availableActions(stocked(road, { kombucha: 0, ammo: 0 })), 'useItem:ammo'), undefined);
  const owned = availableActions(stocked(road, { kombucha: 1, ammo: 1 }));
  assert.deepEqual(option(owned, 'useItem:kombucha').action, { type: 'useItem', itemId: 'kombucha' });
  assert.deepEqual(option(owned, 'useItem:ammo').action, { type: 'useItem', itemId: 'ammo' });
  assert.equal(option(owned, 'sellNft'), undefined);
  const shop = start('dev');
  assert.ok(shop.inventory.nft >= 1);
  const sell = option(availableActions(shop), 'sellNft');
  assert.equal(sell.group, 'item');
  assert.ok(sell.label.includes(`$${item('nft').resale}`), sell.label);
  assert.equal(option(availableActions(stocked(shop, { nft: 0 })), 'sellNft'), undefined);
  assert.equal(option(availableActions(stocked(onRoad(shop), { nft: 1 })), 'sellNft'), undefined);
});

test('details carry the numbers from the data', () => {
  const road = stocked(onRoad(start('prepper')), { kombucha: 1, ammo: 1, fuel: 0 });
  const options = availableActions(road);
  const detail = key => option(options, key).detail;
  assert.ok(detail('rest').includes(String(RULES.roadRest.heal)), detail('rest'));
  const [low, high] = regionAt(ROAD).forage;
  const bonus = RULES.forage.prepperBonus;
  for (const number of [low + bonus, high + bonus, RULES.forage.damage]) {
    assert.ok(detail('forage').includes(String(number)), detail('forage'));
  }
  assert.ok(detail('useItem:kombucha').includes(String(item('kombucha').heal)), detail('useItem:kombucha'));
  for (const number of item('ammo').yield) assert.ok(detail('useItem:ammo').includes(String(number)));
  assert.ok(detail('push').includes(String(RULES.push.miles)) && detail('push').includes(String(RULES.push.damage)));
  assert.ok(detail('hitchhike').includes(String(RULES.hitchhike.fuel)), detail('hitchhike'));
  assert.ok(detail('tradeLuggage').includes(String(RULES.luggage.fuel)), detail('tradeLuggage'));
  const camp = option(availableActions(atStop(start(), 'forest_camp')), 'rest');
  assert.ok(camp.detail.includes(String(stop('forest_camp').rest.heal)), camp.detail);
  const stopForage = option(availableActions(atStop(start(), 'forest_camp')), 'forage');
  for (const number of stop('forest_camp').forage) assert.ok(stopForage.detail.includes(String(number)));
  for (const entry of options) assertFilled(entry, 'road');
});

test('a pending encounter lists only its choices', () => {
  const road = stocked(onRoad(start('barista')), { money: 0, parts: 0, kombucha: 0, nft: 0 });
  const breakdown = availableActions(facing(road, 'van_breakdown'));
  assert.deepEqual(
    keysOf(breakdown),
    event('van_breakdown').choices.map(choice => `event:${choice.id}`),
  );
  assert.ok(breakdown.every(entry => entry.group === 'event'));
  assert.deepEqual(option(breakdown, 'event:kick').action, { type: 'resolveEvent', token: TOKEN, choiceId: 'kick' });
  const repair = option(breakdown, 'event:repair');
  assert.equal(repair.enabled, false);
  const need = event('van_breakdown').choices[0].needs.parts;
  assert.equal(repair.reason, fill(event('van_breakdown').choices[0].lacking, { need, have: 0 }));
  assert.ok(repair.detail.includes(String(need)), repair.detail);
  const tow = option(breakdown, 'event:tow');
  assert.ok(tow.detail.includes(`$${event('van_breakdown').towCost}`), tow.detail);
  assert.equal(tow.enabled, false);
});

test('a choice for one background is absent for the others', () => {
  const road = onRoad(start('dev'));
  assert.ok(keysOf(availableActions(facing(road, 'nft_auction'))).includes('event:consult'));
  for (const profession of ['influencer', 'prepper', 'barista']) {
    const keys = keysOf(availableActions(facing(onRoad(start(profession)), 'nft_auction')));
    assert.ok(!keys.includes('event:consult'), `${profession}: ${keys.join()}`);
  }
});

test('an automatic encounter offers one Continue; the donation label holds its price', () => {
  const auto = availableActions(facing(onRoad(start()), 'tiktok_distraction'));
  assert.deepEqual(auto, [
    {
      key: 'event:continue',
      action: { type: 'resolveEvent', token: TOKEN },
      group: 'event',
      label: 'Continue',
      detail: '',
      enabled: true,
      reason: '',
    },
  ]);
  const petition = event('petition_gauntlet');
  const donate = option(availableActions(facing(onRoad(start(), 900), 'petition_gauntlet')), 'event:donate');
  assert.ok(donate.label.includes(`$${petition.donation}`), donate.label);
  assert.ok(!donate.label.includes('{'), donate.label);
});

test('a choice that needs a signal is disabled on the day of the outage', () => {
  const state = facing(onRoad(start('influencer'), 900), 'brunch_line');
  assert.equal(option(availableActions(state), 'event:post').enabled, true);
  const offline = { ...state, flags: { ...state.flags, wifiDownDay: state.day } };
  const post = option(availableActions(offline), 'event:post');
  assert.equal(post.enabled, false);
  assert.equal(post.reason, event('brunch_line').choices.find(choice => choice.id === 'post').offline);
});

test('after the end the list is empty', () => {
  const state = start();
  assert.deepEqual(availableActions(ended(state, 'won', { distance: RULES.goalMiles })), []);
  assert.deepEqual(availableActions(ended(onRoad(state), 'lost')), []);
});

// --- forecast ---------------------------------------------------------------

/** States in which a drive does different things: paces, weather, short tanks, stops ahead. */
function driveCases() {
  const base = crew(start('barista'), () => ({ health: 50 }));
  const cases = [];
  for (const pace of PACE_IDS) {
    cases.push({ ...onRoad(base), pace });
    cases.push({ ...atStop(base, 'first_stop'), pace });
    cases.push({ ...stocked(onRoad(base, 465), { fuel: 3 }), pace });
    cases.push({ ...stocked(onRoad(base), { fuel: 1 }), pace });
    cases.push({ ...onRoad(base), pace, weather: { id: 'drizzle', until: base.day + 1 } });
    cases.push({ ...onRoad(base), pace, weather: { id: 'heat', until: base.day + 1 } });
    cases.push({ ...onRoad(base), pace, weather: { id: 'drizzle', until: base.day } });
    cases.push({ ...base, pace, rations: 'filling' });
    cases.push({ ...stocked(onRoad(base), { food: 0.5 }), pace, rations: 'bare' });
    // Only the last traveler is well: the forecast is still for a healthy one.
    cases.push({ ...crew(onRoad(base), (member, index) => ({ sick: index < CREW - 1 })), pace });
  }
  return cases;
}

test('forecast.today, healthPerDay and foodPerDay are what a drive then does', () => {
  for (const state of driveCases()) {
    const plan = forecast(deepFreeze(state));
    const after = act(state, { type: 'travel' });
    const where = `${state.pace} ${state.weather.id} at mile ${state.distance}`;
    assert.deepEqual(
      plan.today,
      { miles: after.distance - state.distance, fuel: state.inventory.fuel - after.inventory.fuel },
      where,
    );
    const well = state.party.findIndex(member => !member.sick);
    assert.equal(plan.healthPerDay, after.party[well].health - state.party[well].health, where);
    if (state.inventory.food >= 5) {
      const eaten = Math.round((state.inventory.food - after.inventory.food) * 100) / 100;
      assert.equal(plan.foodPerDay, eaten, where);
    }
  }
});

test('with a dry tank forecast.today is no miles and no fuel', () => {
  const plan = forecast(stocked(onRoad(start()), { fuel: 0 }));
  assert.deepEqual(plan.today, { miles: 0, fuel: 0 });
  assert.equal(plan.range, 0);
});

test('forecast.range is what the fuel covers at the current pace', () => {
  for (const pace of PACE_IDS) {
    for (const fuel of [0, 1, 7, 40]) {
      const state = { ...stocked(onRoad(start()), { fuel }), pace };
      assert.equal(forecast(state).range, Math.floor(fuel * PACES[pace].milesPerFuel));
    }
  }
});

test('from mile 0 at Steady the next stop is a leg of full days and a short last day', () => {
  const state = { ...start(), pace: /** @type {const} */ ('normal') };
  const pace = PACES.normal;
  const next = LOCATIONS.find(entry => entry.miles > 0);
  const away = next.miles;
  const { nextStop } = forecast(state);
  assert.equal(nextStop.id, next.id);
  assert.equal(nextStop.name, next.name);
  assert.equal(nextStop.shortName, next.shortName);
  assert.equal(nextStop.away, away);
  assert.equal(nextStop.days, Math.ceil(away / pace.miles));
  assert.equal(
    nextStop.fuel,
    Math.floor(away / pace.miles) * fuelFor(pace.miles, pace) + fuelFor(away % pace.miles, pace),
  );
  // With today's data: 100 miles, 2 days, ceil(80 / 20) + ceil(20 / 20) fuel.
  if (away === 100 && pace.miles === 80 && pace.milesPerFuel === 20) {
    assert.deepEqual([nextStop.away, nextStop.days, nextStop.fuel], [100, 2, 5]);
  }
});

test('the next shop adds up the legs to it, and the shortfall is what the van lacks', () => {
  const state = { ...atStop(start(), 'first_stop'), pace: 'normal' };
  const pace = PACES.normal;
  const shop = LOCATIONS.find(entry => entry.miles > state.distance && entry.activities.includes('shop'));
  let days = 0;
  let fuel = 0;
  let from = state.distance;
  for (const leg of LOCATIONS.filter(entry => entry.miles > state.distance && entry.miles <= shop.miles)) {
    const miles = leg.miles - from;
    days += Math.ceil(miles / pace.miles);
    fuel += Math.floor(miles / pace.miles) * fuelFor(pace.miles, pace) + fuelFor(miles % pace.miles, pace);
    from = leg.miles;
  }
  const food = Math.ceil(days * RATIONS[state.rations].food * CREW);
  for (const tank of [0, fuel - 1, fuel, fuel + 3]) {
    for (const pantry of [0, food - 0.5, food + 2]) {
      const plan = forecast(stocked(state, { fuel: tank, food: pantry }));
      assert.deepEqual(plan.nextShop, {
        id: shop.id,
        name: shop.name,
        shortName: shop.shortName,
        away: shop.miles - state.distance,
        days,
        fuel,
        food,
      });
      assert.equal(plan.shortfall.fuel, Math.max(0, plan.nextShop.fuel - tank));
      assert.equal(plan.shortfall.food, Math.max(0, Math.ceil(plan.nextShop.food - pantry)));
    }
  }
});

test('past the last shop there is no next shop, and the shortfall is measured to Portland', () => {
  const lastShop = LOCATIONS.findLast(entry => entry.activities.includes('shop'));
  const state = stocked(atStop(start(), lastShop.id), { fuel: 0, food: 0 });
  const plan = forecast(state);
  assert.equal(plan.nextShop, null);
  const pace = PACES[state.pace];
  const away = RULES.goalMiles - lastShop.miles;
  assert.ok(plan.shortfall.fuel >= fuelFor(away, pace), JSON.stringify(plan.shortfall));
  assert.ok(plan.shortfall.food > 0);
  const atGoal = forecast(ended(state, 'won', { distance: RULES.goalMiles }));
  assert.equal(atGoal.nextStop, null);
  assert.deepEqual(atGoal.shortfall, { fuel: 0, food: 0 });
});

// --- statusOf ---------------------------------------------------------------

test('statusOf: dead, sick, and the three health bands at their boundaries', () => {
  const { good, worn } = RULES.healthBands;
  const member = (health, sick = false) => ({ health, sick });
  assert.deepEqual(statusOf(member(0)), { id: 'dead', label: 'Deceased' });
  assert.deepEqual(statusOf(member(90, true)), { id: 'sick', label: 'Sick' });
  assert.deepEqual(statusOf(member(100)), { id: 'good', label: 'Healthy' });
  assert.deepEqual(statusOf(member(good)), { id: 'good', label: 'Healthy' });
  assert.deepEqual(statusOf(member(good - 1)), { id: 'worn', label: 'Worn down' });
  assert.deepEqual(statusOf(member(worn)), { id: 'worn', label: 'Worn down' });
  assert.deepEqual(statusOf(member(worn - 1)), { id: 'bad', label: 'Hanging on' });
  assert.deepEqual(statusOf(member(1)), { id: 'bad', label: 'Hanging on' });
});

// --- shopItems --------------------------------------------------------------

test('shopItems: price at this stop, owned, max, and what fits and can be afforded', () => {
  const carts = stop('food_truck_fest');
  for (const money of [0, 13, 100, 5000]) {
    const state = stocked(inShop(start(), 'food_truck_fest'), { money, food: 20.5, fuel: 39, parts: 6 });
    const rows = shopItems(deepFreeze(state));
    assert.deepEqual(
      rows.map(row => row.id),
      ITEMS.map(entry => entry.id),
    );
    for (const row of rows) {
      const data = item(row.id);
      const price = carts.prices?.[row.id] ?? data.price;
      const owned = state.inventory[row.id];
      assert.equal(row.name, data.name);
      assert.equal(row.unit, data.unit);
      assert.equal(row.description, describeItem(row.id));
      assert.equal(row.price, price);
      assert.equal(row.owned, owned);
      assert.equal(row.max, data.max);
      assert.equal(row.canBuy, Math.max(0, Math.min(Math.floor(data.max - owned), Math.floor(money / price))));
      if (row.canBuy > 0)
        assert.equal(transition(state, { type: 'purchase', cart: { [row.id]: row.canBuy } }).error, null);
      const more = transition(state, { type: 'purchase', cart: { [row.id]: row.canBuy + 1 } });
      assert.notEqual(more.error, null, `${row.id}: one more than canBuy is refused`);
    }
  }
  assert.equal(shopItems(inShop(start(), 'food_truck_fest')).find(row => row.id === 'food').price, carts.prices.food);
});

test('shopItems: an item already above what the van holds can buy none; outside the shop the list is empty', () => {
  const state = stocked(start(), { money: 5000, kombucha: item('kombucha').max + 2 });
  assert.equal(shopItems(state).find(row => row.id === 'kombucha').canBuy, 0);
  assert.deepEqual(shopItems(onRoad(start())), []);
  assert.deepEqual(shopItems(atStop(start(), 'mushroom_market')), []);
});

// --- paceOptions and rationOptions -----------------------------------------

test('paceOptions: three paces, the chosen one flagged, labels built from the numbers', () => {
  for (const chosen of PACE_IDS) {
    const options = paceOptions({ ...start(), pace: chosen });
    assert.deepEqual(
      options.map(entry => entry.id),
      PACE_IDS,
    );
    for (const entry of options) {
      const pace = PACES[entry.id];
      assert.equal(entry.selected, entry.id === chosen);
      assert.ok(entry.label.startsWith(pace.name), entry.label);
      for (const number of [pace.miles, fuelFor(pace.miles, pace), pace.wear]) {
        assert.match(entry.label, new RegExp(`\\b${number}\\b`), entry.label);
      }
      assert.ok(!entry.label.includes('{'), entry.label);
    }
  }
  const steady = paceOptions(start()).find(entry => entry.id === 'normal');
  const pace = PACES.normal;
  assert.equal(
    steady.label,
    `${pace.name} · ${pace.miles} mi a day · ${fuelFor(pace.miles, pace)} fuel · −${pace.wear} health`,
  );
});

test('rationOptions: three rations, the chosen one flagged, labels built from the numbers', () => {
  for (const chosen of RATION_IDS) {
    const options = rationOptions({ ...start(), rations: chosen });
    assert.deepEqual(
      options.map(entry => entry.id),
      RATION_IDS,
    );
    for (const entry of options) {
      const rations = RATIONS[entry.id];
      assert.equal(entry.selected, entry.id === chosen);
      assert.ok(entry.label.startsWith(rations.name), entry.label);
      assert.ok(entry.label.includes(`${rations.food} food each`), entry.label);
      const sign = rations.health < 0 ? '−' : '+';
      assert.ok(entry.label.includes(`${sign}${Math.abs(rations.health)} health`), entry.label);
    }
  }
});

// --- summarize and shareText -------------------------------------------------

/** A won journey with these survivors' health (the rest fallen), on this day with this cash. */
function wonJourney({ health, day, money }) {
  const state = start('barista');
  const at = { ...state, day, distance: RULES.goalMiles };
  return ended(
    stocked(
      crew(at, (member, index) => (index < health.length ? { health: health[index] } : fallen(at, 'road'))),
      { money },
    ),
    'won',
  );
}

test('summarize: a won journey scores survivors, health, cash and the day against par', () => {
  const { score, parDay } = RULES;
  const cases = [
    { health: [80, 71, 64], day: parDay - 3, money: 1234 },
    { health: [100, 100, 100, 100, 100], day: parDay, money: 0 },
    { health: [55, 40], day: parDay + 4, money: 333 },
  ];
  for (const journey of cases) {
    const { health, day, money } = journey;
    const mean = health.reduce((sum, value) => sum + value, 0) / health.length;
    const expected =
      health.length * score.survivor +
      Math.round(mean) +
      Math.floor(money / score.cashPerPoint) +
      (parDay - day) * (day <= parDay ? score.earlyDay : score.lateDay);
    const summary = summarize(deepFreeze(wonJourney(journey)));
    assert.equal(summary.score, Math.max(score.survivor, expected), JSON.stringify(journey));
    assert.equal(summary.outcome, 'won');
    assert.equal(summary.rentDays, Math.floor(money / RULES.rentPerDay));
    assert.equal(summary.money, money);
    assert.equal(summary.day, day);
    assert.equal(summary.distance, RULES.goalMiles);
    assert.deepEqual(
      summary.survivors,
      health.map((value, index) => ({ name: wonJourney(journey).party[index].name, health: value })),
    );
  }
  const late = summarize(wonJourney({ health: [1], day: parDay + 200, money: 0 }));
  assert.equal(late.score, score.survivor, 'a win never scores below one survivor');
});

/** A won journey that scores exactly `target` (at least one survivor's worth). */
function wonWithScore(target) {
  const { score, parDay } = RULES;
  if (target <= score.survivor) return wonJourney({ health: [1], day: parDay + 1000, money: 0 });
  return wonJourney({ health: [1], day: parDay, money: (target - score.survivor - 1) * score.cashPerPoint });
}

test('summarize: every won rank threshold', () => {
  const { survivor } = RULES.score;
  for (const [index, rank] of RANKS.won.entries()) {
    const at = Math.max(rank.min, survivor);
    const summary = summarize(wonWithScore(at));
    assert.equal(summary.score, at);
    const first = RANKS.won.find(entry => at >= entry.min);
    assert.deepEqual(summary.rank, { title: first.title, line: first.line });
    if (first === rank && rank.min - 1 >= survivor && index + 1 < RANKS.won.length) {
      const below = summarize(wonWithScore(rank.min - 1));
      assert.equal(below.rank.title, RANKS.won[index + 1].title);
    }
  }
});

test('summarize: a lost journey scores its miles, and every lost rank threshold', () => {
  const state = start();
  for (const distance of [0, 123, 699, 700, 999]) {
    const lost = ended(
      crew({ ...state, distance }, () => fallen({ ...state, distance })),
      'lost',
      { distance },
    );
    assert.equal(summarize(lost).score, Math.floor(distance / RULES.score.lossMilesPerPoint));
  }
  for (const [index, rank] of RANKS.lost.entries()) {
    const at = ended(
      crew(state, () => fallen(state)),
      'lost',
      { distance: rank.minMiles },
    );
    assert.deepEqual(summarize(at).rank, { title: rank.title, line: rank.line });
    if (rank.minMiles > 0) {
      const below = ended(
        crew(state, () => fallen(state)),
        'lost',
        { distance: rank.minMiles - 1 },
      );
      assert.equal(summarize(below).rank.title, RANKS.lost[index + 1].title);
    }
  }
  const unfinished = onRoad(state, 420);
  assert.equal(summarize(unfinished).score, Math.floor(420 / RULES.score.lossMilesPerPoint));
});

test('summarize: headings and causes for each ending', () => {
  const all = wonJourney({ health: [90, 90, 90, 90, 90], day: 20, money: 100 });
  assert.equal(summarize(all).heading, 'All five made it to Portland.');
  assert.equal(summarize(all).cause, '');
  const three = wonJourney({ health: [90, 90, 90], day: 20, money: 100 });
  assert.equal(summarize(three).heading, '3 of five made it to Portland.');
  assert.equal(summarize(three).cause, '');

  const state = { ...start(), day: 9, distance: 420 };
  const lost = ended(
    crew(state, (member, index) => fallen(state, index === 3 ? 'heat' : 'road', index === 3 ? 9 : 8)),
    'lost',
  );
  const summary = summarize(lost);
  assert.equal(summary.heading, 'The road won this round.');
  const line = fill(DEATHS.heat.line, { name: lost.party[3].name });
  assert.equal(summary.cause, `${line.replace(/\.$/, '')} near mile 420.`);

  const legacy = ended({ ...start(), distance: 640 }, 'lost');
  const dry = summarize(legacy);
  assert.equal(dry.heading, 'The road won this round.');
  assert.ok(dry.cause.includes('ran dry') && dry.cause.includes('640'), dry.cause);
  assert.equal(dry.fallen.length, 0);
  // An old save could also end on an empty tank after someone had already died.
  const thinned = summarize(crew(legacy, (member, index) => (index === 0 ? fallen(legacy, 'road') : {})));
  assert.equal(thinned.cause, dry.cause);
  assert.equal(thinned.fallen.length, 1);

  const unfinished = summarize(onRoad(start()));
  assert.equal(unfinished.heading, '');
  assert.equal(unfinished.cause, '');
  assert.equal(unfinished.outcome, null);
});

test('summarize: the fallen carry their death line and epitaph, in the order they fell', () => {
  const state = { ...start('prepper'), day: 12, distance: 500 };
  const lost = ended(
    crew(state, (member, index) => ({
      ...fallen(state, ['starvation', 'road', 'pandemic', 'heat', 'forage'][index], 12 - index, 500 - index * 10),
      ...(index === 2 ? { epitaph: 'Carved by hand.' } : {}),
    })),
    'lost',
  );
  const summary = summarize(lost);
  assert.deepEqual(
    summary.fallen.map(entry => entry.id),
    ['traveler_5', 'traveler_4', 'traveler_3', 'traveler_2', 'traveler_1'],
  );
  for (const entry of summary.fallen) {
    const member = lost.party.find(traveler => traveler.id === entry.id);
    assert.equal(entry.name, member.name);
    assert.equal(entry.day, member.death.day);
    assert.equal(entry.mile, member.death.mile);
    assert.equal(entry.line, fill(DEATHS[member.death.cause].line, { name: member.name }));
    assert.equal(entry.epitaph, member.epitaph);
  }
  assert.equal(summary.fallen.find(entry => entry.id === 'traveler_3').epitaph, 'Carved by hand.');
  assert.ok(summary.cause.startsWith(fill(DEATHS.starvation.line, { name: lost.party[0].name }).replace(/\.$/, '')));
  assert.equal(summary.seed, lost.seed);
  assert.equal(summary.professionName, PROFESSIONS.find(entry => entry.id === 'prepper').name);
  assert.deepEqual(summary.survivors, []);
});

test('shareText: one line with the background, the day, the seed and every epitaph', () => {
  const won = wonJourney({ health: [80, 70, 60], day: 19, money: 650 });
  const text = shareText(won);
  const summary = summarize(won);
  assert.ok(!text.includes('\n'));
  assert.ok(!text.includes('{'), text);
  assert.ok(text.startsWith(`The Portland Trail: ${summary.professionName}, reached Portland on day 19, 3 of 5 alive`));
  assert.ok(text.includes(`$650 (${Math.floor(650 / RULES.rentPerDay)} days of rent)`), text);
  assert.ok(text.includes(`${summary.rank.title}, score ${summary.score}. Seed ${won.seed}.`), text);
  for (const member of won.party.filter(traveler => traveler.health === 0)) {
    assert.ok(text.includes(` RIP ${member.name}: “${member.epitaph}”`), text);
  }

  const state = { ...start('dev'), day: 7, distance: 310 };
  const lost = ended(
    crew(state, () => fallen(state, 'toll')),
    'lost',
  );
  const sad = shareText(lost);
  assert.ok(sad.includes(PROFESSIONS.find(entry => entry.id === 'dev').name), sad);
  assert.ok(sad.includes('fell at mile 310 on day 7, 0 of 5 alive'), sad);
  assert.ok(sad.includes(`Seed ${lost.seed}.`), sad);
  assert.equal(sad.split(' RIP ').length - 1, CREW);
  assert.ok(sad.includes(DEATHS.toll.epitaph), sad);
});

// --- describeAbility and describeItem ---------------------------------------

test('describeAbility fills every number from the data', () => {
  const repair = event('van_breakdown').choices.find(choice => choice.id === 'repair');
  const standard = repair.needs.parts;
  for (const profession of PROFESSIONS) {
    const text = describeAbility(profession.id);
    assert.ok(text.length > 0 && !text.includes('{'), text);
    for (const [key, value] of Object.entries(profession.ability)) {
      if (typeof value !== 'number' || !profession.ability.text.includes(`{${key}}`)) continue;
      assert.match(text, new RegExp(`\\b${value}\\b`), `${profession.id}.${key}: ${text}`);
    }
  }
  assert.match(describeAbility('dev'), new RegExp(`instead of ${standard}\\b`));
  assert.match(describeAbility('prepper'), new RegExp(`\\b${RULES.forage.prepperBonus} extra food`));
  assert.equal(describeAbility('nobody'), '');
});

test('describeItem fills every number from the data', () => {
  for (const entry of ITEMS) {
    const text = describeItem(entry.id);
    assert.ok(text.length > 0 && !text.includes('{'), `${entry.id}: ${text}`);
  }
  assert.match(describeItem('fuel'), new RegExp(`\\b${PACES.normal.milesPerFuel} miles\\b`));
  const [low, high] = item('ammo').yield;
  assert.ok(describeItem('ammo').includes(`${low} to ${high} food`), describeItem('ammo'));
  assert.match(describeItem('kombucha'), new RegExp(`\\b${item('kombucha').heal}\\b`));
  assert.ok(describeItem('nft').includes(`$${item('nft').resale}`), describeItem('nft'));
  assert.equal(describeItem('money'), '');
});
