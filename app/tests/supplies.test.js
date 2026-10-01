import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine.js';
import { LOCATIONS, PROFESSIONS } from '../src/data.js';

const start = (profession = 'dev') => engine.createGame({ profession, seed: 21 });
function act(state, action) {
  const result = engine.transition(state, action);
  assert.equal(result.error, null, result.error);
  return result.state;
}

test('auto-buy gives every background a useful loadout without buying duplicate stock or NFTs', () => {
  assert.equal(typeof engine.recommendSupplies, 'function');
  for (const profession of PROFESSIONS) {
    const before = start(profession.id);
    const snapshot = structuredClone(before);
    const plan = engine.recommendSupplies(before);
    assert.deepEqual(before, snapshot, 'preview must not mutate the journey');
    assert.equal(plan.complete, true);
    assert.ok(plan.remainingCash >= 100);
    assert.equal(plan.cart.nft, undefined);
    assert.equal(plan.travelDays, 2);
    const bought = act(before, { type: 'autoPurchase' });
    assert.ok(bought.inventory.food >= 40);
    assert.ok(bought.inventory.fuel >= 24);
    assert.ok(bought.inventory.parts >= 2);
    assert.ok(bought.inventory.kombucha >= 1);
    assert.equal(bought.inventory.nft, before.inventory.nft);
    assert.equal(bought.inventory.money, plan.remainingCash);
    assert.equal(before.inventory.money - bought.inventory.money, plan.cost);
    for (const [id, amount] of Object.entries(plan.cart)) assert.equal(bought.inventory[id] - before.inventory[id], amount);
    assert.deepEqual(engine.deserializeGame(engine.serializeGame(bought)), bought);
    assert.deepEqual(engine.recommendSupplies(bought).cart, {});
    assert.equal(engine.transition(bought, { type: 'autoPurchase' }).state, bought, 'repeat buy must be a no-op');
  }
});

test('auto-buy tops up fractional food and accounts for separately rounded travel legs', () => {
  const state = { ...start(), phase: 'shop', locationId: 'sketchy_motel', shopReturn: 'sketchy_motel', distance: 350, pace: 'fast' };
  state.inventory.food = 37.5;
  state.inventory.fuel = 22;
  const plan = engine.recommendSupplies(state);
  // 350→470 costs two days; 470→570 and 570→670 each cost one.
  assert.equal(plan.travelDays, 4);
  assert.equal(plan.nextShopName, 'Crypto Meetup');
  assert.equal(plan.cart.fuel, 20, 'four travel days plus a two-day fuel buffer');
  assert.equal(plan.cart.food, 3);
  assert.equal(plan.cost, 296);
  assert.equal(plan.remainingCash, 904);
});

test('low-cash auto-buy prioritizes route essentials and never overspends', () => {
  for (const cash of [0, 3, 12, 32, 100, 120, 220]) {
    const state = start();
    state.inventory = { ...state.inventory, money: cash, food: 0, fuel: 0, parts: 0, kombucha: 0 };
    const plan = engine.recommendSupplies(state);
    assert.ok(plan.cost <= cash);
    assert.equal(plan.remainingCash, cash - plan.cost);
    assert.equal(plan.complete, false);
    assert.equal(plan.cart.parts, undefined);
    assert.equal(plan.cart.kombucha, undefined);
    if (cash >= 96) assert.ok(plan.cart.fuel >= 8, 'fuel to the next shop comes before spare stock');
    if (cash === 120) {
      assert.deepEqual(plan.cart, { fuel: 8, food: 5 });
      assert.equal(plan.remainingCash, 4, 'use the reserve when required to reach the next shop');
    }
    if (plan.cost > 0) {
      const bought = act(state, { type: 'autoPurchase' });
      assert.equal(bought.inventory.money, plan.remainingCash);
      assert.ok(bought.inventory.money >= 0);
    } else {
      assert.equal(engine.transition(state, { type: 'autoPurchase' }).state, state);
    }
  }
});

test('auto-buy cannot purchase outside the shop or while an encounter is pending', () => {
  const traveling = act(start(), { type: 'depart' });
  assert.ok(engine.transition(traveling, { type: 'autoPurchase' }).error);
  const pending = { ...traveling, pendingEvent: { id: 'found_supplies', token: 1 }, flags: { ...traveling.flags, nextToken: 1 } };
  assert.equal(engine.transition(pending, { type: 'autoPurchase' }).state, pending);
  assert.ok(engine.transition(pending, { type: 'autoPurchase' }).error);
});

test('the new stops are reachable and each conversation grants its own reward once', () => {
  const cases = [
    ['mushroom_market', 100, 'food', 8],
    ['river_ferry', 280, 'parts', 1],
    ['forest_camp', 570, 'health', 8],
    ['bookshop', 870, 'money', 45],
  ];
  for (const [id, miles, reward, amount] of cases) {
    const location = LOCATIONS.find(stop => stop.id === id);
    assert.ok(location, `${id} exists`);
    const previous = LOCATIONS[LOCATIONS.indexOf(location) - 1];
    let state = { ...engine.createGame({ profession: 'dev', seed: 1000 }), phase: 'travel', locationId: previous.id, distance: miles - 1, pace: 'slow' };
    state = act(state, { type: 'travel' });
    if (state.pendingEvent) state = act(state, { type: 'resolveEvent', token: state.pendingEvent.token });
    assert.equal(state.phase, 'location');
    assert.equal(state.locationId, id);
    assert.equal(state.distance, miles);
    state.party[0].health = 50;
    const before = reward === 'health' ? state.party[0].health : state.inventory[reward];
    const talked = act(state, { type: 'talk' });
    assert.equal(reward === 'health' ? talked.party[0].health : talked.inventory[reward], before + amount);
    assert.equal(engine.transition(talked, { type: 'talk' }).state, talked);
    assert.deepEqual(engine.deserializeGame(engine.serializeGame(talked)), talked);
  }
});

test('valid legacy saves preserve progress and pending events across newly inserted stops', () => {
  for (const [distance, oldId, newId] of [[160, 'start_city', 'mushroom_market'], [300, 'first_stop', 'river_ferry'], [600, 'viral_landmark', 'forest_camp'], [900, 'food_truck_fest', 'bookshop']]) {
    const legacy = { ...start(), version: 1, phase: 'travel', distance, locationId: oldId, day: 12 };
    legacy.pendingEvent = { id: 'found_supplies', token: 2 };
    legacy.flags.nextToken = 2;
    const migrated = engine.deserializeGame(JSON.stringify(legacy));
    assert.ok(migrated);
    assert.equal(migrated.version, 2);
    assert.equal(migrated.locationId, newId);
    assert.equal(migrated.distance, distance);
    assert.equal(migrated.phase, 'travel');
    assert.deepEqual(migrated.inventory, legacy.inventory);
    assert.deepEqual(migrated.pendingEvent, legacy.pendingEvent);
    assert.equal(migrated.day, legacy.day);
    assert.deepEqual(engine.deserializeGame(engine.serializeGame(migrated)), migrated);
    const resolved = act(migrated, { type: 'resolveEvent', token: 2 });
    assert.equal(resolved.inventory.food, legacy.inventory.food + 8);
  }
});

test('legacy validation happens before migration and new saves enforce the current route', () => {
  const legacy = { ...start(), version: 1 };
  assert.equal(engine.deserializeGame(JSON.stringify({ ...legacy, phase: 'travel', distance: 400, locationId: 'start_city' })), null);
  assert.equal(engine.deserializeGame(JSON.stringify({ ...legacy, phase: 'location', distance: 100, locationId: 'mushroom_market' })), null);
  assert.equal(engine.deserializeGame(JSON.stringify({ ...legacy, injected: true })), null);
  const current = { ...start(), version: 2, phase: 'travel', distance: 900, locationId: 'food_truck_fest' };
  assert.equal(engine.deserializeGame(JSON.stringify(current)), null);
  const shop = { ...legacy, phase: 'shop', distance: 350, locationId: 'sketchy_motel', shopReturn: 'sketchy_motel' };
  assert.equal(engine.deserializeGame(JSON.stringify(shop))?.locationId, 'sketchy_motel');
});

test('legacy endings and a save exactly at an added stop retain their original phase', () => {
  const road = { ...start(), version: 1, phase: 'travel', distance: 100, locationId: 'start_city' };
  const migratedRoad = engine.deserializeGame(JSON.stringify(road));
  assert.equal(migratedRoad?.locationId, 'mushroom_market');
  assert.equal(migratedRoad?.phase, 'travel', 'migration does not replay arrival or grant its rewards');
  for (const outcome of ['won', 'lost']) {
    const legacy = { ...start(), version: 1, phase: 'ended', outcome, distance: outcome === 'won' ? 1000 : 600, locationId: outcome === 'won' ? 'portland' : 'viral_landmark' };
    const migrated = engine.deserializeGame(JSON.stringify(legacy));
    assert.equal(migrated?.outcome, outcome);
    assert.equal(migrated?.phase, 'ended');
    assert.deepEqual(migrated?.journal, legacy.journal);
    assert.deepEqual(engine.deserializeGame(engine.serializeGame(migrated)), migrated);
  }
});
