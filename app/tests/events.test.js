import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  currentStop,
  deserializeGame,
  nextStop,
  seedFromText,
  serializeGame,
  transition,
  weatherName,
} from '../src/engine.js';
import { DEATHS, EVENTS, JOURNAL, LOCATIONS, PACES, PROFESSIONS, RATIONS, REFUSALS, RULES } from '../src/data.js';
import { EFFECTS, needsOf } from '../src/engine/events.js';
import { fill } from '../src/engine/state.js';

const TRAVEL = { type: 'travel' };
const TOKEN = 7;
const RESOLVE = { type: 'resolveEvent', token: TOKEN };
const PENDING = 'Resolve the current encounter first.';
// A mile with more open road ahead than the fastest pace covers in a day.
const ROAD = 355;
const CREW = 5;
const RESOURCES = ['money', 'food', 'fuel', 'ammo', 'parts', 'kombucha', 'nft'];

const event = id => EVENTS.find(entry => entry.id === id);
const stop = id => LOCATIONS.find(entry => entry.id === id);
const answer = choiceId => (choiceId === undefined ? RESOLVE : { ...RESOLVE, choiceId });
const round = value => Math.round(value * 100) / 100;
const all = delta => Array(CREW).fill(delta);
// Small whole-number seeds give nearly the same first roll, so samples use hashed seeds.
const seeds = (count, salt = 'events') => Array.from({ length: count }, (_, index) => seedFromText(`${salt}-${index}`));

const stocked = (state, inventory) => ({ ...state, inventory: { ...state.inventory, ...inventory } });
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
const facing = (state, id) => ({
  ...state,
  pendingEvent: { id, token: TOKEN },
  flags: { ...state.flags, nextToken: TOKEN },
});

/** A crew on the open road with enough of everything to pay for any response. */
function ready(profession = 'barista', seed = 21) {
  const state = createGame({ profession, seed });
  return {
    ...crew(state, () => ({ health: 90 })),
    phase: 'travel',
    distance: ROAD,
    inventory: { money: 500, food: 20, fuel: 10, ammo: 0, parts: 3, kombucha: 3, nft: 1 },
  };
}

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

/** What an action changed, in the terms an encounter advertises. */
function changes(before, after) {
  const change = {};
  for (const id of RESOURCES) {
    const delta = round(after.inventory[id] - before.inventory[id]);
    if (delta !== 0) change[id] = delta;
  }
  const health = after.party.map((member, index) => member.health - before.party[index].health);
  if (health.some(delta => delta !== 0)) change.health = health.filter(delta => delta !== 0).sort((a, b) => a - b);
  const sick = after.party.filter((member, index) => member.sick && !before.party[index].sick).length;
  if (sick > 0) change.sick = sick;
  if (after.day !== before.day) change.days = after.day - before.day;
  if (after.distance !== before.distance) change.miles = after.distance - before.distance;
  if (after.weather.id !== before.weather.id) change.weather = [after.weather.id, after.weather.until - after.day];
  if (after.flags.wifiDownDay !== before.flags.wifiDownDay) change.wifiDown = after.flags.wifiDownDay === after.day;
  return change;
}

/** Everything an encounter has no business changing. */
const untouched = state => ({
  phase: state.phase,
  pace: state.pace,
  rations: state.rations,
  outcome: state.outcome,
  seed: state.seed,
  profession: state.profession,
  crew: state.party.map(member => [member.id, member.name, member.death, member.epitaph]),
  flags: { ...state.flags, wifiDownDay: 0 },
});

/** A pattern that a filled template matches. */
const pattern = template =>
  new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^{}]+\}/g, '.+')}$`);

const eaten = RATIONS.meager.food * CREW;
const idleDay = RATIONS.meager.health;

// What each response advertises, taken from the encounter's own numbers. A response with a roll
// lists both outcomes, the lucky one first.
const ADVERTISED = {
  tiktok_distraction: e => [{ health: [-e.damage] }],
  'nft_auction:invest': e => [
    { nft: -1, money: e.win },
    { nft: -1, money: e.lose },
  ],
  'nft_auction:consult': e => [{ money: e.consultFee }],
  'nft_auction:wait': () => [{}],
  'food_poisoning:treat': e => [{ kombucha: -1, health: [-e.treatedDamage] }],
  'food_poisoning:ride': e => [{ health: [-e.damage], sick: 1 }],
  'van_breakdown:repair': (e, choice) => [{ parts: -choice.needs.parts }],
  'van_breakdown:tow': e => [{ money: -e.towCost }],
  'van_breakdown:kick': e => [{}, { days: 1, food: -eaten, health: all(idleDay - e.kickDamage) }],
  good_weather: () => [{ miles: RULES.drizzle.bonusMiles, weather: ['drizzle', RULES.drizzle.days] }],
  bad_weather: e => [{ health: all(-e.damage), weather: ['heat', RULES.heat.days] }],
  found_supplies: e => [{ food: e.food, fuel: e.fuel }],
  wifi_outage: e => [{ health: all(-e.damage), wifiDown: true }],
  'pandemic_death:kombucha': e => [{ kombucha: -e.kombuchaCost, health: all(-e.dosedDamage) }],
  'pandemic_death:quarantine': e => [
    {
      days: e.quarantineDays,
      food: -eaten * e.quarantineDays,
      health: all(idleDay * e.quarantineDays - e.quarantineDamage),
    },
  ],
  'pandemic_death:push_on': e => [{ health: [-e.worstDamage, ...Array(CREW - 1).fill(-e.damage)], sick: CREW - 1 }],
  'ebike_convoy:wait': e => [{ fuel: -e.fuel, health: all(e.heal) }],
  'ebike_convoy:honk': e => [{}, { health: all(-e.damage) }],
  'ebike_convoy:trade': (e, choice) => [{ food: -choice.needs.food, money: e.tips }],
  'sasquatch:photo': e => [{ money: e.photo }],
  'sasquatch:chase': e => [{ health: [-e.damage], nft: 1 }, { health: [-e.damage] }],
  'sasquatch:leave': e => [{ health: all(e.heal) }],
  'toll_troll:pay': e => [{ money: -e.toll }],
  'toll_troll:riddle': e => [{}, { money: -e.fine, health: all(-e.damage) }],
  'toll_troll:ford': e => [{ health: [-e.fordDamage] }],
  'brunch_line:wait': e => [{ fuel: -e.fuel, food: e.food }],
  'brunch_line:detour': e => [{ fuel: -e.detourFuel }],
  'brunch_line:post': e => [{ money: e.sponsor }],
  'petition_gauntlet:sign': e => [{ health: all(-e.damage) }],
  'petition_gauntlet:donate': e => [{ money: -e.donation }],
  'petition_gauntlet:call': () => [{}],
};

const responses = EVENTS.flatMap(entry =>
  entry.choices.length === 0
    ? [{ key: entry.id, entry, choice: undefined }]
    : entry.choices.map(choice => ({ key: `${entry.id}:${choice.id}`, entry, choice })),
);

/**
 * A crew facing the encounter with exactly the supplies the response needs (through needsOf) and
 * may take as it advertises, and nothing more. A retuned cost changes the stock, not the outcome.
 */
function supplied({ key, entry, choice }, seed = 21) {
  const base = facing(ready(choice?.only ?? 'barista', seed), entry.id);
  const stock = Object.fromEntries(RESOURCES.map(id => [id, 0]));
  if (choice) Object.assign(stock, needsOf(base, entry, choice));
  for (const outcome of ADVERTISED[key](entry, choice)) {
    for (const id of RESOURCES) stock[id] = Math.max(stock[id], -(outcome[id] ?? 0));
  }
  return { ...base, inventory: stock };
}

// --- The encounter list ----------------------------------------------------

test('every encounter is complete and every response has an effect', () => {
  const ids = EVENTS.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  assert.deepEqual(Object.keys(EFFECTS).sort(), [...ids].sort(), 'one effect for each encounter');
  const professions = PROFESSIONS.map(profession => profession.id);
  for (const entry of EVENTS) {
    assert.match(entry.scene, /^[a-z]+(-[a-z]+)*$/, entry.id);
    assert.ok(entry.weight > 0, entry.id);
    assert.ok(entry.title && entry.description, entry.id);
    assert.ok(['auto', 'choice', 'critical'].includes(entry.type), entry.id);
    if (entry.where) {
      assert.ok(entry.where.from >= 0 && entry.where.from < entry.where.to, entry.id);
      assert.ok(entry.where.to <= RULES.goalMiles, entry.id);
    }
    const choiceIds = entry.choices.map(choice => choice.id);
    assert.equal(new Set(choiceIds).size, choiceIds.length, `${entry.id} choice ids are unique`);
    if (entry.type === 'auto') {
      assert.equal(entry.choices.length, 0, entry.id);
      assert.equal(typeof EFFECTS[entry.id], 'function', entry.id);
      continue;
    }
    assert.ok(entry.choices.length >= 2, entry.id);
    assert.deepEqual(Object.keys(EFFECTS[entry.id]).sort(), [...choiceIds].sort(), entry.id);
    assert.ok(
      entry.choices.some(choice => !choice.only && !choice.needs && !choice.offline),
      `${entry.id} always has a response open to everyone`,
    );
    for (const choice of entry.choices) {
      assert.equal(typeof EFFECTS[entry.id][choice.id], 'function', `${entry.id}:${choice.id}`);
      assert.ok(choice.label && choice.result, `${entry.id}:${choice.id}`);
      if (choice.only) assert.ok(professions.includes(choice.only), `${entry.id}:${choice.id}`);
      for (const [id, amount] of Object.entries(choice.needs ?? {})) {
        assert.ok(RESOURCES.includes(id), `${entry.id}:${choice.id} needs ${id}`);
        const need = typeof amount === 'string' ? entry[amount] : amount;
        assert.ok(Number.isInteger(need) && need > 0, `${entry.id}:${choice.id} needs ${id}`);
        assert.equal(typeof choice.lacking, 'string', `${entry.id}:${choice.id} says what is missing`);
      }
    }
  }
});

test('every response does exactly what it advertises', () => {
  assert.deepEqual(Object.keys(ADVERTISED).sort(), responses.map(response => response.key).sort());
  for (const response of responses) {
    const { key, entry, choice } = response;
    const expected = ADVERTISED[key](entry, choice).map(outcome => ({
      ...outcome,
      ...(outcome.health ? { health: [...outcome.health].sort((a, b) => a - b) } : {}),
    }));
    const templates = choice
      ? [choice.result, choice.otherwise].filter(Boolean)
      : [entry.result, entry.atStop, entry.onRoad].filter(Boolean);
    const seen = new Set();
    for (const seed of seeds(120)) {
      const before = supplied(response, seed);
      const result = transition(before, answer(choice?.id));
      assert.equal(result.error, null, key);
      assert.equal(result.state.pendingEvent, null, key);
      const change = changes(before, result.state);
      const match = expected.findIndex(outcome => {
        try {
          assert.deepEqual(change, outcome);
          return true;
        } catch {
          return false;
        }
      });
      assert.notEqual(match, -1, `${key} changed ${JSON.stringify(change)}, expected ${JSON.stringify(expected)}`);
      seen.add(match);
      assert.deepEqual(untouched(result.state), untouched(before), key);
      assert.ok(
        templates.some(template => pattern(template).test(result.notes[0])),
        `${key} wrote "${result.notes[0]}"`,
      );
      for (const note of result.notes) assert.ok(!/[{}]|undefined|NaN/.test(note), `${key}: ${note}`);
    }
    assert.equal(seen.size, expected.length, `${key} shows every outcome`);
  }
});

test('the background changes what some encounters do', () => {
  const outage = event('wifi_outage');
  const influencer = facing(ready('influencer'), 'wifi_outage');
  const drained = act(influencer, RESOLVE);
  assert.deepEqual(changes(influencer, drained), { health: all(-outage.influencerDamage), wifiDown: true });
  assert.equal(refusal(drained, { type: 'ability' }), PROFESSIONS[0].ability.offline);

  const sasquatch = event('sasquatch');
  const shot = facing(ready('influencer'), 'sasquatch');
  assert.deepEqual(changes(shot, act(shot, answer('photo'))), { money: sasquatch.viralPhoto });
});

// --- Refusals --------------------------------------------------------------

test('a response reserved for one background is refused for the others', () => {
  const reserved = responses.filter(response => response.choice?.only);
  assert.ok(reserved.length >= 5);
  for (const { key, entry, choice } of reserved) {
    for (const profession of PROFESSIONS) {
      const state = facing(ready(profession.id), entry.id);
      if (profession.id === choice.only) assert.equal(transition(state, answer(choice.id)).error, null, key);
      else assert.equal(refusal(state, answer(choice.id)), 'Choose one of the available responses.', key);
    }
  }
});

test('a response whose cost cannot be met is refused with what is missing, and otherwise spends it', () => {
  const words = { money: /\$\d/, nft: /NFT/, kombucha: /kombucha/, parts: /repair/, food: /food/ };
  const costly = responses.filter(response => response.choice?.needs);
  assert.ok(costly.length >= 8);
  for (const { key, entry, choice } of costly) {
    const [[id, amount]] = Object.entries(choice.needs);
    const need = typeof amount === 'string' ? entry[amount] : amount;
    const short = stocked(facing(ready(choice.only ?? 'barista'), entry.id), { [id]: need - 1 });
    const error = refusal(short, answer(choice.id));
    assert.equal(error, fill(choice.lacking, { need, have: need - 1 }), key);
    assert.match(error, words[id], key);
    assert.ok(!/[{}]/.test(error) && !/\b(parts|ammo|nft|money)\b/.test(error), `${key}: ${error}`);

    const paid = act(stocked(short, { [id]: need }), answer(choice.id));
    assert.equal(paid.inventory[id], 0, `${key} spends what it needs`);
  }
});

test('an automatic encounter takes no response and a choice needs a listed one', () => {
  for (const entry of EVENTS) {
    const state = facing(ready(), entry.id);
    if (entry.type === 'auto') {
      assert.equal(refusal(state, answer('wait')), 'This encounter has no choices.', entry.id);
      assert.equal(transition(state, RESOLVE).error, null, entry.id);
      continue;
    }
    assert.equal(refusal(state, RESOLVE), REFUSALS.pickChoice, entry.id);
    for (const choiceId of ['bogus', 'constructor', '__proto__', 'toString', 7, null, {}]) {
      assert.equal(refusal(state, answer(choiceId)), REFUSALS.pickChoice, entry.id);
    }
  }
});

test('the post about the brunch line needs a signal that day', () => {
  const post = event('brunch_line').choices.find(choice => choice.id === 'post');
  const base = facing(ready('influencer'), 'brunch_line');
  const outage = { ...base, flags: { ...base.flags, wifiDownDay: base.day } };
  assert.equal(refusal(outage, answer('post')), post.offline);
  assert.equal(transition({ ...outage, day: base.day + 1 }, answer('post')).error, null);
  assert.equal(transition(outage, answer('wait')).error, null);
});

test('an encounter resolves exactly once, with its own token', () => {
  const state = facing(ready(), 'found_supplies');
  for (const token of [TOKEN + 1, TOKEN - 1, String(TOKEN), undefined, null, Number.NaN]) {
    assert.equal(refusal(state, { type: 'resolveEvent', token }), 'This encounter is no longer pending.');
  }
  const resolved = act(state, RESOLVE);
  assert.equal(resolved.pendingEvent, null);
  assert.equal(refusal(resolved, RESOLVE), 'There is no encounter to resolve.');
  assert.equal(resolved.inventory.food, state.inventory.food + event('found_supplies').food);
});

test('a pending encounter blocks every other action except an epitaph', () => {
  const base = ready('prepper');
  const state = facing(
    crew(stocked(base, { fuel: 0, ammo: 2 }), (member, index) => (index === 0 ? fallen(base) : {})),
    'van_breakdown',
  );
  const others = [
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
    { type: 'push' },
    { type: 'hitchhike' },
    { type: 'tradeLuggage' },
  ];
  for (const action of others) assert.equal(refusal(state, action), PENDING, action.type);
  assert.equal(PENDING, REFUSALS.pending);
  const carved = act(state, { type: 'setEpitaph', memberId: 'traveler_1', text: 'Missed the breakdown.' });
  assert.deepEqual(carved.pendingEvent, state.pendingEvent);
  assert.equal(act(carved, answer('kick')).pendingEvent, null);
});

// --- Where encounters happen -----------------------------------------------

/** The encounters met after one Scenic day's drive from `from`, over many seeds. */
function metAfterDriving(from) {
  const met = new Set();
  for (const seed of seeds(700, 'where')) {
    const state = { ...createGame({ profession: 'dev', seed }), phase: 'travel', distance: from, pace: 'slow' };
    const after = act(state, TRAVEL);
    if (after.pendingEvent) met.add(after.pendingEvent.id);
  }
  return met;
}

test('an encounter with a range is met only inside it, both ends included', () => {
  const day = PACES.slow.miles;
  const ranged = EVENTS.filter(entry => entry.where);
  assert.ok(ranged.length >= 5);
  for (const entry of ranged) {
    const { from, to } = entry.where;
    // The eligibility is judged on the mile the van reaches, not the mile it left.
    assert.ok(metAfterDriving(from - day).has(entry.id), `${entry.id} at mile ${from}`);
    assert.ok(!metAfterDriving(from - day - 1).has(entry.id), `${entry.id} at mile ${from - 1}`);
    if (to < RULES.goalMiles) {
      assert.ok(metAfterDriving(to - day).has(entry.id), `${entry.id} at mile ${to}`);
      assert.ok(!metAfterDriving(to).has(entry.id), `${entry.id} past mile ${to}`);
    }
  }
});

/** An action that answers the pending encounter with the first response the engine accepts. */
function firstAnswer(state) {
  const entry = event(state.pendingEvent.id);
  const plain = { type: 'resolveEvent', token: state.pendingEvent.token };
  const options = entry.choices.map(choice => ({ ...plain, choiceId: choice.id }));
  const action = [plain, ...options].find(option => !transition(state, option).error);
  assert.ok(action, `${entry.id} has no acceptable response`);
  return action;
}

/** Drive a journey to its end, buying supplies at every shop. Reports each encounter as it is rolled. */
function roam(start, onEncounter) {
  let state = start;
  const shopped = new Set();
  for (let step = 0; step < 900 && !state.outcome; step++) {
    if (state.pendingEvent) {
      state = act(state, firstAnswer(state));
      continue;
    }
    const here = currentStop(state);
    const action = [
      { type: 'autoPurchase' },
      ...(here && !shopped.has(here.id) ? [{ type: 'openShop' }] : []),
      TRAVEL,
      { type: 'leaveShop' },
      { type: 'tradeLuggage' },
      { type: 'hitchhike' },
    ].find(option => !transition(state, option).error);
    assert.ok(action, `stuck at mile ${state.distance} on day ${state.day}`);
    if (action.type === 'openShop') shopped.add(here.id);
    state = act(state, action);
    if (action.type === 'travel' && state.pendingEvent) onEncounter(state);
  }
  assert.ok(state.outcome, 'the journey reaches an ending');
  return state;
}

test('over 300 journeys every encounter is met where it belongs', () => {
  const met = new Map();
  for (const [index, seed] of seeds(300, 'journey').entries()) {
    const profession = PROFESSIONS[index % PROFESSIONS.length].id;
    roam(createGame({ profession, seed }), state => {
      const entry = event(state.pendingEvent.id);
      met.set(entry.id, (met.get(entry.id) ?? 0) + 1);
      assert.equal(state.journal.at(-1).text, entry.title, 'the title is the last line of the day');
      assert.equal(state.pendingEvent.token, state.flags.nextToken);
      if (entry.where) {
        const inside = entry.where.from <= state.distance && state.distance <= entry.where.to;
        assert.ok(inside, `${entry.id} met at mile ${state.distance}`);
      }
    });
  }
  for (const entry of EVENTS.filter(candidate => !candidate.where)) {
    assert.ok(met.has(entry.id), `${entry.id} was never met`);
  }
});

test('a pending encounter resolves wherever the van is', () => {
  for (const entry of EVENTS.filter(candidate => candidate.where)) {
    const outside = entry.where.from > 50 ? 40 : entry.where.to + 20;
    const state = { ...facing(ready(), entry.id), distance: outside };
    assert.equal(act(state, firstAnswer(state)).pendingEvent, null, entry.id);
  }
});

// --- Drizzle ---------------------------------------------------------------

test('drizzle on the road adds its miles, and can arrive or win with one ending line', () => {
  const bonus = RULES.drizzle.bonusMiles;
  const open = facing(ready('dev'), 'good_weather');
  const drove = transition(open, RESOLVE);
  assert.equal(drove.state.distance, ROAD + bonus);
  assert.equal(drove.state.phase, 'travel');
  assert.equal(weatherName(drove.state), 'Perfect drizzle');
  assert.deepEqual(drove.state.weather, { id: 'drizzle', until: open.day + RULES.drizzle.days });
  assert.deepEqual(drove.notes, [`Clear roads add ${bonus} miles.`]);
  assert.equal(drove.state.inventory.fuel, open.inventory.fuel, 'the bonus miles are free');
  assert.equal(drove.state.day, open.day);

  const ferry = stop('river_ferry');
  const near = { ...open, distance: ferry.miles - 5 };
  const arrived = transition(near, RESOLVE);
  assert.equal(arrived.state.distance, ferry.miles);
  assert.equal(arrived.state.phase, 'location');
  assert.equal(currentStop(arrived.state), ferry);
  assert.deepEqual(arrived.notes, ['Clear roads add 5 miles.', `Arrived at ${ferry.name}.`]);

  const last = { ...open, distance: RULES.goalMiles - 5 };
  const won = transition(last, RESOLVE);
  assert.equal(won.state.outcome, 'won');
  assert.equal(won.state.phase, 'ended');
  assert.equal(won.state.distance, RULES.goalMiles);
  assert.deepEqual(won.notes, ['Clear roads add 5 miles.', JOURNAL.won]);
  assert.equal(won.state.journal.filter(entry => entry.text === JOURNAL.won).length, 1);
});

test('drizzle at a stop saves fuel and keeps the party there', () => {
  const motel = stop('sketchy_motel');
  const base = facing(ready('dev'), 'good_weather');
  const state = stocked({ ...base, phase: 'location', distance: motel.miles }, { fuel: 0 });
  const result = transition(state, RESOLVE);
  assert.equal(result.state.phase, 'location');
  assert.equal(result.state.distance, motel.miles);
  assert.equal(result.state.inventory.fuel, RULES.drizzle.bonusFuel);
  assert.equal(weatherName(result.state), 'Perfect drizzle');
  assert.deepEqual(result.notes, [fill(event('good_weather').atStop, { fuel: RULES.drizzle.bonusFuel })]);
  assert.equal(act(result.state, { type: 'openShop' }).phase, 'shop');
  assert.deepEqual(deserializeGame(serializeGame(result.state)), result.state);
});

// --- The outbreak ----------------------------------------------------------

test('kombucha and quarantine answer the outbreak without killing anyone at full health (D2)', () => {
  const outbreak = event('pandemic_death');
  const choice = id => outbreak.choices.find(option => option.id === id);
  const stockedUp = stocked(facing(ready(), 'pandemic_death'), { kombucha: outbreak.kombuchaCost + 1 });
  const base = crew(stockedUp, (member, index) => ({ health: 100, sick: index < 2 }));

  const doseResult = transition(base, answer('kombucha'));
  const dosed = doseResult.state;
  assert.equal(dosed.inventory.kombucha, 1);
  for (const member of dosed.party) assert.equal(member.health, 100 - outbreak.dosedDamage);
  assert.equal(dosed.day, base.day);
  const doseLine = fill(choice('kombucha').result, { bottles: outbreak.kombuchaCost, damage: outbreak.dosedDamage });
  assert.deepEqual(doseResult.notes, [doseLine]);
  assert.ok(doseLine.includes(`took ${outbreak.kombuchaCost} bottles`));

  const result = transition(base, answer('quarantine'));
  const quarantined = result.state;
  assert.equal(quarantined.day, base.day + outbreak.quarantineDays);
  assert.equal(quarantined.distance, base.distance);
  assert.ok(
    quarantined.party.every(member => !member.sick),
    'quarantine cures',
  );
  const days = outbreak.quarantineDays;
  let well = 100;
  let ill = 100;
  for (let day = 0; day < days; day++) {
    well = Math.min(100, well + idleDay);
    ill = Math.min(100, ill + idleDay) - RULES.sickDamage;
  }
  for (const [index, member] of quarantined.party.entries()) {
    assert.equal(member.health, (index < 2 ? ill : well) - outbreak.quarantineDamage);
  }
  assert.equal(round(base.inventory.food - quarantined.inventory.food), round(eaten * days));
  const quarantineLine = fill(choice('quarantine').result, { days, damage: outbreak.quarantineDamage });
  assert.equal(result.notes[0], quarantineLine);
  assert.ok(quarantineLine.startsWith(`A ${days}-day quarantine cost ${outbreak.quarantineDamage} health`));

  for (const state of [dosed, quarantined]) {
    assert.ok(state.party.every(member => member.health > 0 && member.death === null));
    assert.equal(state.outcome, null);
  }
});

test('driving through the outbreak hits the weakest hardest and sickens the rest', () => {
  const outbreak = event('pandemic_death');
  const push = outbreak.choices.find(choice => choice.id === 'push_on');
  const healths = [100, 95, 90, 95, 90];
  const base = crew(facing(ready(), 'pandemic_death'), (member, index) => ({ health: healths[index] }));
  const result = transition(base, answer('push_on'));
  // Two travelers share the lowest health: the first in party order takes the worst of it.
  for (const [index, member] of result.state.party.entries()) {
    const damage = index === 2 ? outbreak.worstDamage : outbreak.damage;
    assert.equal(member.health, healths[index] - damage);
    assert.equal(member.sick, index !== 2);
  }
  assert.equal(result.notes[0], fill(push.result, { name: base.party[2].name }));

  // The dead are left alone, and nobody who dies of it is left sick: not the weakest, not the rest.
  const frail = crew(base, (member, index) => {
    if (index === 0) return fallen(base);
    return index === 1 ? { health: 5 } : index === 2 ? { health: outbreak.damage } : {};
  });
  const grim = transition(frail, answer('push_on'));
  assert.deepEqual(grim.state.party[0], frail.party[0]);
  for (const index of [1, 2]) {
    assert.equal(grim.state.party[index].health, 0);
    assert.equal(grim.state.party[index].sick, false);
    assert.deepEqual(grim.state.party[index].death, { day: frail.day, mile: frail.distance, cause: 'pandemic' });
    assert.ok(grim.notes.includes(fill(DEATHS.pandemic.line, { name: frail.party[index].name })));
  }
  assert.equal(grim.state.party[3].sick, true);
  assert.equal(grim.state.outcome, null);
  assert.deepEqual(deserializeGame(serializeGame(grim.state)), grim.state);
});

// --- The breakdown ---------------------------------------------------------

test('a failed kick costs a day, the tow charges cash, and the developer repairs with fewer kits', () => {
  const breakdown = event('van_breakdown');
  const choice = id => breakdown.choices.find(option => option.id === id);
  let failed = 0;
  let worked = 0;
  for (const seed of seeds(120)) {
    const state = facing(ready('barista', seed), 'van_breakdown');
    const result = transition(state, answer('kick'));
    if (result.state.day === state.day) {
      worked += 1;
      assert.deepEqual(result.notes, [choice('kick').result]);
      assert.deepEqual(result.state.party, state.party);
    } else {
      failed += 1;
      assert.equal(result.state.day, state.day + 1);
      assert.equal(result.state.distance, state.distance);
      assert.deepEqual(result.notes, [fill(choice('kick').otherwise, { damage: breakdown.kickDamage })]);
      for (const member of result.state.party) assert.equal(member.health, 90 + idleDay - breakdown.kickDamage);
    }
  }
  assert.ok(failed > 0 && worked > 0);

  const towed = transition(stocked(facing(ready(), 'van_breakdown'), { money: breakdown.towCost + 5 }), answer('tow'));
  assert.equal(towed.state.inventory.money, 5);
  assert.deepEqual(towed.notes, [fill(choice('tow').result, { money: breakdown.towCost })]);
  assert.ok(towed.notes[0].includes(`$${breakdown.towCost}`));

  const standard = choice('repair').needs.parts;
  const fixed = transition(stocked(facing(ready(), 'van_breakdown'), { parts: standard + 1 }), answer('repair'));
  assert.equal(fixed.state.inventory.parts, 1);
  assert.deepEqual(fixed.notes, [`The van runs again after ${standard} repair kits.`]);

  const { repairCost } = PROFESSIONS.find(profession => profession.id === 'dev').ability;
  assert.ok(repairCost < standard);
  const dev = stocked(facing(ready('dev'), 'van_breakdown'), { parts: repairCost });
  const quick = transition(dev, answer('repair'));
  assert.equal(quick.state.inventory.parts, 0);
  assert.deepEqual(quick.notes, [fill(choice('repair').result, { parts: repairCost })]);
  assert.match(quick.notes[0], repairCost === 1 ? /after 1 repair kit\.$/ : /after \d+ repair kits\.$/);
  const without = stocked(dev, { parts: repairCost - 1 });
  assert.equal(
    refusal(without, answer('repair')),
    fill(choice('repair').lacking, { need: repairCost, have: repairCost - 1 }),
  );
  // Anyone else needs the full set.
  refusal(stocked(facing(ready('prepper'), 'van_breakdown'), { parts: standard - 1 }), answer('repair'));
});

test('the petition donation names the price it charged', () => {
  const petitions = event('petition_gauntlet');
  const donate = petitions.choices.find(option => option.id === 'donate');
  const state = stocked(facing(ready(), 'petition_gauntlet'), { money: petitions.donation + 3 });
  const result = transition(state, answer('donate'));
  assert.equal(result.state.inventory.money, 3);
  assert.deepEqual(result.notes, [fill(donate.result, { donation: petitions.donation })]);
  assert.ok(result.notes[0].startsWith(`$${petitions.donation} bought silence`));
  assert.equal(fill(donate.label, petitions), `Give $${petitions.donation} to make it stop`);
});

// --- Harm and endings in encounters ----------------------------------------

test('an encounter picks its victim among the living and can end the journey', () => {
  const scroll = event('tiktok_distraction');
  for (const seed of seeds(20)) {
    const base = ready('barista', seed);
    const lone = crew(base, (member, index) => (index === 3 ? { health: 90 } : fallen(base)));
    const hurt = act(facing(lone, 'tiktok_distraction'), RESOLVE);
    assert.equal(hurt.party[3].health, 90 - scroll.damage);
  }
  const base = ready();
  const last = crew(base, (member, index) => (index === 3 ? { health: scroll.damage } : fallen(base)));
  const result = transition(facing(last, 'tiktok_distraction'), RESOLVE);
  assert.equal(result.state.outcome, 'lost');
  assert.equal(result.state.phase, 'ended');
  assert.equal(result.state.pendingEvent, null);
  assert.deepEqual(result.state.party[3].death, { day: last.day, mile: last.distance, cause: 'doomscrolling' });
  assert.deepEqual(result.notes, [
    fill(scroll.result, { name: last.party[3].name, damage: scroll.damage }),
    fill(DEATHS.doomscrolling.line, { name: last.party[3].name }),
    JOURNAL.lost,
  ]);
});

test('every way an encounter can kill has its own cause, line and epitaph', () => {
  // At 1 health any harm kills. One more than a day's rations cost survives the day a response
  // spends, so that the harm after that day is the one that kills.
  const healths = [1, 1 - RATIONS.meager.health];
  const causes = new Set();
  for (const response of responses) {
    const { key, choice } = response;
    for (const health of healths) {
      for (const seed of seeds(40)) {
        const base = supplied(response, seed);
        const result = transition(
          crew(base, () => ({ health })),
          answer(choice?.id),
        );
        assert.equal(result.error, null, key);
        const dead = result.state.party.filter(member => member.death);
        for (const member of dead) {
          const { cause } = member.death;
          assert.ok(Object.hasOwn(DEATHS, cause) && cause !== 'unknown', `${key}: ${cause}`);
          assert.equal(member.epitaph, DEATHS[cause].epitaph);
          assert.equal(member.sick, false);
          assert.ok(result.notes.includes(fill(DEATHS[cause].line, { name: member.name })), key);
          causes.add(cause);
        }
        assert.equal(result.state.outcome, dead.length === CREW ? 'lost' : null, key);
        if (dead.length === CREW) assert.equal(result.notes.at(-1), JOURNAL.lost, key);
        assert.deepEqual(deserializeGame(serializeGame(result.state)), result.state);
      }
    }
  }
  // A response that spends a day can also starve the frailest on Meager rations, when those cost health.
  const fromTheDay = RATIONS.meager.health < 0 ? ['rations'] : [];
  const fromEncounters = [
    'breakdown',
    'doomscrolling',
    'ebike',
    'food_poisoning',
    'heat',
    'pandemic',
    'petitions',
    'sasquatch',
    'toll',
    'wifi',
  ];
  assert.deepEqual([...causes].sort(), [...fromEncounters, ...fromTheDay].sort());
});

test('berries that kill leave nobody sick', () => {
  const berries = event('food_poisoning');
  const base = ready();
  const weak = crew(base, (member, index) => (index === 1 ? { health: berries.damage } : fallen(base)));
  const pair = crew(weak, (member, index) => (index === 4 ? { health: 90, death: null, epitaph: '' } : {}));
  let died = 0;
  let sickened = 0;
  for (const seed of seeds(30)) {
    const result = transition({ ...facing(pair, 'food_poisoning'), rng: seed }, answer('ride'));
    const [frail, sturdy] = [result.state.party[1], result.state.party[4]];
    if (frail.health === 0) {
      died += 1;
      assert.equal(frail.sick, false);
      assert.equal(frail.death.cause, 'food_poisoning');
      assert.equal(sturdy.health, 90);
      assert.equal(sturdy.sick, false);
    } else {
      sickened += 1;
      assert.equal(sturdy.health, 90 - berries.damage);
      assert.equal(sturdy.sick, true);
    }
    assert.equal(result.state.outcome, null);
    assert.deepEqual(deserializeGame(serializeGame(result.state)), result.state);
  }
  assert.ok(died > 0 && sickened > 0);
});

test('each response takes its rolls in order', () => {
  const lcg = value => (Math.imul(value, 1664525) + 1013904223) >>> 0;
  const unit = value => value / 4294967296;
  const ROLLS = {
    tiktok_distraction: 1,
    'nft_auction:invest': 1,
    'food_poisoning:treat': 1,
    'food_poisoning:ride': 1,
    'van_breakdown:kick': 1,
    'ebike_convoy:honk': 1,
    'sasquatch:chase': 2,
    'toll_troll:riddle': 1,
    'toll_troll:ford': 1,
  };
  for (const response of responses) {
    const { key, choice } = response;
    for (const seed of seeds(12)) {
      const before = supplied(response, seed);
      const after = act(before, answer(choice?.id));
      const expected = Array.from({ length: ROLLS[key] ?? 0 }).reduce(lcg, before.rng);
      assert.equal(after.rng, expected, `${key} rolls ${ROLLS[key] ?? 0} times`);
    }
  }

  // What each roll decides: who is picked first, then the chance.
  const sasquatch = event('sasquatch');
  const breakdown = event('van_breakdown');
  for (const seed of seeds(40)) {
    const start = ready('barista', seed);
    const [r1, r2] = [lcg(start.rng), lcg(lcg(start.rng))];
    const chased = act(facing(start, 'sasquatch'), answer('chase'));
    const victim = Math.floor(unit(r1) * CREW);
    assert.equal(chased.party[victim].health, 90 - sasquatch.damage);
    assert.equal(chased.inventory.nft, ready().inventory.nft + (unit(r2) < sasquatch.nftChance ? 1 : 0));

    const kicked = act(facing(start, 'van_breakdown'), answer('kick'));
    assert.equal(kicked.day === ready().day, unit(r1) < breakdown.kickChance);
  }
});

test('the road picks encounters in proportion to their weights', () => {
  // From here a Scenic day ends on open road, where some ranged encounters apply too.
  const mile = ROAD + PACES.slow.miles;
  const here = EVENTS.filter(entry => !entry.where || (entry.where.from <= mile && mile <= entry.where.to));
  assert.ok(here.length > EVENTS.filter(entry => !entry.where).length);
  const total = here.reduce((sum, entry) => sum + entry.weight, 0);
  const counts = new Map();
  let drives = 0;
  let met = 0;
  for (const seed of seeds(9000, 'weights')) {
    const state = { ...createGame({ profession: 'dev', seed }), phase: 'travel', distance: ROAD, pace: 'slow' };
    const after = act(state, TRAVEL);
    drives += 1;
    if (!after.pendingEvent) continue;
    met += 1;
    counts.set(after.pendingEvent.id, (counts.get(after.pendingEvent.id) ?? 0) + 1);
  }
  // Within four and a half standard deviations of the share the numbers promise.
  const near = (count, trials, share) =>
    Math.abs(count - trials * share) <= 4.5 * Math.sqrt(trials * share * (1 - share));
  assert.ok(near(met, drives, RULES.eventChance), `${met} encounters in ${drives} drives`);
  for (const entry of here) {
    const count = counts.get(entry.id) ?? 0;
    const share = entry.weight / total;
    assert.ok(near(count, met, share), `${entry.id}: ${count} of ${met}, weight ${entry.weight} of ${total}`);
  }
  assert.equal([...counts.keys()].filter(id => !here.some(entry => entry.id === id)).length, 0);
});

test('a loss that cannot be paid in full takes what is there', () => {
  const convoy = event('ebike_convoy');
  const wait = convoy.choices.find(choice => choice.id === 'wait');
  const dry = stocked(facing(ready(), 'ebike_convoy'), { fuel: convoy.fuel - 1 });
  const idled = transition(dry, answer('wait'));
  assert.equal(idled.state.inventory.fuel, 0);
  assert.equal(idled.notes[0], fill(wait.result, { fuel: convoy.fuel - 1 }));

  const troll = event('toll_troll');
  for (const seed of seeds(40)) {
    const poor = stocked(facing(ready('barista', seed), 'toll_troll'), { money: troll.fine - 10 });
    const result = transition(poor, answer('riddle'));
    assert.ok(result.state.inventory.money === poor.inventory.money || result.state.inventory.money === 0);
    assert.ok(result.state.inventory.money >= 0);
  }
});

// --- Saving ----------------------------------------------------------------

test('a pending encounter survives a save round trip and then resolves once', () => {
  let state = null;
  for (const seed of seeds(10, 'pending')) {
    roam(createGame({ profession: 'dev', seed }), met => {
      state ??= met;
    });
    if (state) break;
  }
  assert.ok(state?.pendingEvent, 'a journey meets an encounter');
  assert.ok(nextStop(state.distance));
  const loaded = deserializeGame(serializeGame(state));
  assert.deepEqual(loaded, state);
  assert.equal(refusal(loaded, TRAVEL), PENDING);
  const action = firstAnswer(loaded);
  const resolved = act(loaded, action);
  assert.equal(resolved.pendingEvent, null);
  assert.equal(refusal(resolved, action), REFUSALS.nothingPending);
  assert.deepEqual(deserializeGame(serializeGame(resolved)), resolved);
});
