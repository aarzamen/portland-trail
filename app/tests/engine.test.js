import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition, serializeGame, deserializeGame } from '../src/engine.js';
import { PROFESSIONS, EVENTS } from '../src/data.js';

const names = ['Kale', 'Juniper', 'Rowan', 'Birch', 'Echo'];
const start = (profession = 'dev', seed = 21) => createGame({ profession, names, seed });
const doAction = (state, action) => {
  const result = transition(state, action);
  assert.equal(result.error, null, result.error);
  return result.state;
};

test('new journeys are independent and preserve source starting supplies', () => {
  for (const profession of PROFESSIONS) {
    const state = start(profession.id);
    assert.equal(state.phase, 'shop');
    assert.equal(state.locationId, 'start_city');
    assert.deepEqual([state.inventory.money, state.inventory.food, state.inventory.fuel],
      [profession.inventory.money, profession.inventory.food, profession.inventory.fuel]);
    assert.equal(state.party.length, 5);
    assert.equal(state.distance, 0);
    assert.equal(state.day, 1);
  }
  const first = start();
  first.party[0].health = 0;
  first.inventory.money = 0;
  assert.equal(start().party[0].health, 100);
  assert.equal(start().inventory.money, 1200);
});

test('shop rejects invalid carts and unaffordable totals atomically', () => {
  const state = start('prepper');
  for (const cart of [{ fuel: 10000 }, { fuel: -1 }, { bogus: 1 }, { fuel: 1.5 }]) {
    const result = transition(state, { type: 'purchase', cart });
    assert.ok(result.error);
    assert.equal(result.state, state);
  }
  const bought = doAction(state, { type: 'purchase', cart: { fuel: 2, food: 1 } });
  assert.equal(bought.inventory.fuel, state.inventory.fuel + 2);
  assert.equal(bought.inventory.food, state.inventory.food + 1);
  assert.ok(bought.inventory.money < state.inventory.money);
  assert.ok(bought.inventory.money >= 0);
});

test('shop returns to the location that opened it and activities are restricted', () => {
  let state = start();
  assert.ok(transition(state, { type: 'talk' }).error);
  state = doAction(state, { type: 'depart' });
  assert.equal(state.phase, 'travel');
  assert.ok(transition(state, { type: 'openShop' }).error);
  state = { ...state, phase: 'location', locationId: 'sketchy_motel', distance: 350 };
  state = doAction(state, { type: 'openShop' });
  assert.equal(state.shopReturn, 'sketchy_motel');
  state = doAction(state, { type: 'leaveShop' });
  assert.equal(state.phase, 'location');
  assert.equal(state.locationId, 'sketchy_motel');
  assert.ok(transition(state, { type: 'talk' }).error);
});

test('pending encounter survives reload and resolves exactly once', () => {
  let state = doAction(start(), { type: 'depart' });
  for (let i = 0; i < 80 && !state.pendingEvent && !state.outcome; i++) {
    state = doAction(state, { type: 'travel' });
    if (state.phase === 'location') state = doAction(state, { type: 'travel' });
  }
  assert.ok(state.pendingEvent, 'seed must encounter an event');
  const pending = deserializeGame(serializeGame(state));
  assert.deepEqual(pending, state);
  assert.ok(transition(pending, { type: 'travel' }).error);
  const event = EVENTS.find(({ id }) => id === pending.pendingEvent.id);
  const action = { type: 'resolveEvent', token: pending.pendingEvent.token };
  if (event.type === 'choice') action.choiceId = event.choices[0].id;
  const resolved = doAction(pending, action);
  assert.equal(resolved.pendingEvent, null);
  const repeated = transition(resolved, action);
  assert.ok(repeated.error);
  assert.equal(repeated.state, resolved);
});

test('malformed, unsupported and forged saved states are rejected', () => {
  const valid = start();
  assert.equal(deserializeGame('{oops'), null);
  assert.equal(deserializeGame(JSON.stringify({ ...valid, version: 999 })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...valid, party: [] })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...valid, inventory: { ...valid.inventory, fuel: -1 } })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...valid, pendingEvent: { id: 'bogus', token: 1 } })), null);
  assert.deepEqual(deserializeGame(serializeGame(valid)), valid);
});

test('critical encounter kills permanently and freezes the terminal state', () => {
  const baseline = doAction(start(), { type: 'depart' });
  const state = { ...baseline, pendingEvent: { id: 'pandemic_death', token: 12 } };
  const lost = doAction(state, { type: 'resolveEvent', token: 12 });
  assert.equal(lost.outcome, 'lost');
  assert.equal(lost.phase, 'ended');
  assert.ok(lost.party.every(member => member.health === 0 && member.status === 'Deceased'));
  for (const type of ['travel', 'rest', 'forage', 'ability', 'depart']) {
    const result = transition(lost, { type });
    assert.ok(result.error);
    assert.equal(result.state, lost);
  }
  assert.deepEqual(deserializeGame(serializeGame(lost)), lost);
});

test('deceased members cannot heal from supplies or rest', () => {
  let state = doAction(start('barista'), { type: 'depart' });
  state = { ...state, party: [{ ...state.party[0], health: 0, status: 'Deceased' }, ...state.party.slice(1)] };
  state = doAction(state, { type: 'rest' });
  assert.equal(state.party[0].health, 0);
  state = doAction(state, { type: 'useItem', itemId: 'kombucha' });
  assert.equal(state.party[0].health, 0);
});

test('insufficient selected pace leaves state intact while a slower pace is possible', () => {
  let state = doAction(start(), { type: 'depart' });
  state = { ...state, inventory: { ...state.inventory, fuel: 2 } };
  const rejected = transition(state, { type: 'travel' });
  assert.ok(rejected.error);
  assert.equal(rejected.state, state);
  state = doAction(state, { type: 'setPace', pace: 'slow' });
  state = doAction(state, { type: 'travel' });
  assert.equal(state.distance, 50);
  assert.equal(state.inventory.fuel, 0);
});

test('an empty tank at a shop location preserves the chance to resupply', () => {
  const state = { ...doAction(start(), { type: 'depart' }), phase: 'location', locationId: 'sketchy_motel', distance: 350, inventory: { ...start().inventory, fuel: 0 } };
  const rejected = transition(state, { type: 'travel' });
  assert.ok(rejected.error);
  assert.equal(rejected.state, state);
  assert.equal(doAction(state, { type: 'openShop' }).phase, 'shop');
});

test('depart can close any stop without charging a travel day', () => {
  const state = { ...doAction(start(), { type: 'depart' }), phase: 'location', locationId: 'first_stop', distance: 200 };
  const departed = doAction(state, { type: 'depart' });
  assert.equal(departed.phase, 'travel');
  assert.equal(departed.distance, 200);
  assert.equal(departed.day, state.day);
});

test('a weather bonus that reaches Portland records one ending', () => {
  const baseline = doAction(start(), { type: 'depart' });
  const state = { ...baseline, distance: 985, locationId: 'food_truck_fest', pendingEvent: { id: 'good_weather', token: 8 } };
  const ended = doAction(state, { type: 'resolveEvent', token: 8 });
  assert.equal(ended.outcome, 'won');
  assert.equal(ended.distance, 1000);
  assert.equal(ended.journal.filter(entry => entry.text.startsWith('Portland at last')).length, 1);
});

test('good weather at an arrived shop keeps the chance to resupply', () => {
  const baseline = doAction(start('dev', 26), { type: 'depart' });
  const state = {
    ...baseline, phase: 'location', locationId: 'sketchy_motel', distance: 350,
    inventory: { ...baseline.inventory, fuel: 0 },
    flags: { ...baseline.flags, nextToken: 9 },
    pendingEvent: { id: 'good_weather', token: 9 },
  };
  const resolved = doAction(state, { type: 'resolveEvent', token: 9 });
  assert.equal(resolved.phase, 'location');
  assert.equal(resolved.distance, 350);
  assert.ok(resolved.inventory.fuel > 0);
  assert.equal(doAction(resolved, { type: 'openShop' }).phase, 'shop');
  assert.deepEqual(deserializeGame(serializeGame(resolved)), resolved);
});

test('NFT can be sold in a shop and paid out once', () => {
  const state = start('dev');
  const sold = doAction(state, { type: 'useItem', itemId: 'nft' });
  assert.equal(sold.inventory.nft, 0);
  assert.equal(sold.inventory.money, state.inventory.money + 50);
  assert.ok(transition(sold, { type: 'useItem', itemId: 'nft' }).error);
});

test('five names up to 32 characters are retained in a valid save', () => {
  const longNames = ['A'.repeat(32), ...names.slice(1)];
  const state = createGame({ profession: 'dev', names: longNames, seed: 4 });
  assert.equal(deserializeGame(serializeGame(state)).party[0].name.length, 32);
});

test('inherited pace and ration names cannot corrupt a saved journey', () => {
  const state = start();
  assert.equal(deserializeGame(JSON.stringify({ ...state, pace: 'constructor' })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, rations: 'toString' })), null);
  assert.ok(transition(state, { type: 'setPace', pace: 'constructor' }).error);
  assert.ok(transition(state, { type: 'setRations', rations: 'toString' }).error);
});

test('incoherent phase and pending-token saves are rejected', () => {
  const state = start();
  assert.equal(deserializeGame(JSON.stringify({ ...state, locationId: 'portland' })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, locationId: 'first_stop' })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, pendingEvent: { id: 'found_supplies', token: 3 } })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, phase: 'travel', distance: 400, locationId: 'start_city' })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, phase: 'travel', distance: 1000 })), null);
});

test('save schema rejects unexpected fields instead of carrying arbitrary data forward', () => {
  const state = start();
  assert.equal(deserializeGame(JSON.stringify({ ...state, injected: true })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, inventory: { ...state.inventory, injected: 1 } })), null);
  assert.equal(deserializeGame(JSON.stringify({ ...state, flags: { ...state.flags, injected: 1 } })), null);
});

test('an active or victorious save cannot have an entirely deceased party', () => {
  const baseline = doAction(start(), { type: 'depart' });
  const deadParty = baseline.party.map(member => ({ ...member, health: 0, status: 'Deceased' }));
  const pending = { ...baseline, party: deadParty, flags: { ...baseline.flags, nextToken: 1 }, pendingEvent: { id: 'food_poisoning', token: 1 } };
  assert.equal(deserializeGame(JSON.stringify(pending)), null);
  const impossibleWin = { ...baseline, party: deadParty, locationId: 'portland', distance: 1000, phase: 'ended', outcome: 'won' };
  assert.equal(deserializeGame(JSON.stringify(impossibleWin)), null);
});
