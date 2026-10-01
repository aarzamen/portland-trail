import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, transition, serializeGame, deserializeGame } from '../src/engine.js';
import { LOCATIONS } from '../src/data.js';

const names = ['Kale', 'Juniper', 'Rowan', 'Birch', 'Echo'];
function act(state, action) {
  const result = transition(state, action);
  assert.equal(result.error, null, result.error);
  return result.state;
}

function pending(id, profession = 'dev', seed = 17) {
  const state = act(createGame({ profession, names, seed }), { type: 'depart' });
  state.flags.nextToken = 1;
  state.pendingEvent = { id, token: 1 };
  return state;
}

test('all nine encounters apply their advertised consequence and clear the token', () => {
  const cases = [
    ['tiktok_distraction', {}, state => assert.equal(state.party.reduce((sum, member) => sum + member.health, 0), 492)],
    ['nft_auction', { choiceId: 'invest' }, state => assert.equal(state.inventory.nft, 0)],
    ['food_poisoning', {}, state => assert.equal(state.party.reduce((sum, member) => sum + member.health, 0), 474)],
    ['van_breakdown', { choiceId: 'repair' }, state => assert.equal(state.inventory.parts, 0)],
    ['good_weather', {}, state => assert.equal(state.distance, 20)],
    ['bad_weather', {}, state => assert.equal(state.party.reduce((sum, member) => sum + member.health, 0), 470)],
    ['found_supplies', {}, state => { assert.equal(state.inventory.food, 38); assert.equal(state.inventory.fuel, 22); }],
    ['wifi_outage', {}, state => assert.equal(state.flags.wifiDownDay, state.day)],
    ['pandemic_death', {}, state => assert.equal(state.outcome, 'lost')],
  ];
  for (const [id, extra, check] of cases) {
    let state = pending(id);
    if (id === 'van_breakdown') state.inventory.parts = 1;
    state = act(state, { type: 'resolveEvent', token: 1, ...extra });
    assert.equal(state.pendingEvent, null, id);
    check(state);
  }
});

test('encounter alternatives and costs cannot be bypassed', () => {
  let state = pending('van_breakdown', 'prepper');
  state.inventory.parts = 1;
  const repair = transition(state, { type: 'resolveEvent', token: 1, choiceId: 'repair' });
  assert.ok(repair.error);
  assert.equal(repair.state, state);
  state = act(state, { type: 'resolveEvent', token: 1, choiceId: 'kick' });
  assert.equal(state.pendingEvent, null);
  const fair = pending('nft_auction', 'barista');
  assert.ok(transition(fair, { type: 'resolveEvent', token: 1, choiceId: 'invest' }).error);
  assert.equal(act(fair, { type: 'resolveEvent', token: 1, choiceId: 'wait' }).inventory.nft, 0);
});

test('random branches for NFT trading and kicking the van have bounded outcomes', () => {
  const winningTrade = act(pending('nft_auction', 'dev', 17), { type: 'resolveEvent', token: 1, choiceId: 'invest' });
  const losingTrade = act(pending('nft_auction', 'dev', 1000), { type: 'resolveEvent', token: 1, choiceId: 'invest' });
  assert.equal(winningTrade.inventory.money, 1420);
  assert.equal(losingTrade.inventory.money, 1215);
  const goodKick = act(pending('van_breakdown', 'dev', 17), { type: 'resolveEvent', token: 1, choiceId: 'kick' });
  const badKick = act(pending('van_breakdown', 'dev', 1000), { type: 'resolveEvent', token: 1, choiceId: 'kick' });
  assert.equal(goodKick.day, 1);
  assert.equal(badKick.day, 2);
  assert.equal(badKick.party[0].health, 95);
});

test('four backgrounds have usable abilities with real costs or cooldowns', () => {
  for (const profession of ['influencer', 'dev', 'prepper', 'barista']) {
    let state = act(createGame({ profession, names, seed: 9 }), { type: 'depart' });
    const before = state.inventory;
    state = act(state, { type: 'ability' });
    if (profession === 'influencer') assert.equal(state.inventory.money, before.money + 45);
    if (profession === 'dev') assert.equal(state.inventory.parts, before.parts + 2);
    if (profession === 'prepper') { assert.equal(state.inventory.food, before.food + 6); assert.equal(state.party[0].health, 97); }
    if (profession === 'barista') assert.equal(state.inventory.food, before.food - 1);
    assert.ok(transition(state, { type: 'ability' }).error);
  }
});

test('seed bombs and kombucha change resources, while death remains permanent', () => {
  let state = act(createGame({ profession: 'prepper', names, seed: 4 }), { type: 'depart' });
  state.party[0] = { ...state.party[0], health: 0, status: 'Deceased' };
  state.party[1] = { ...state.party[1], health: 60, status: 'Injured' };
  state.inventory.kombucha = 1;
  const food = state.inventory.food;
  state = act(state, { type: 'useItem', itemId: 'ammo' });
  assert.equal(state.inventory.food, food + 8);
  state = act(state, { type: 'useItem', itemId: 'kombucha' });
  assert.equal(state.party[0].health, 0);
  assert.equal(state.party[1].health, 70);
});

function play(seed, profession, prudent) {
  let state = createGame({ profession, names, seed });
  const visitedShops = new Set();
  if (prudent) {
    const cart = {
      fuel: Math.max(0, 27 - state.inventory.fuel),
      food: Math.max(0, 55 - state.inventory.food),
      parts: Math.max(0, 2 - state.inventory.parts),
    };
    state = act(state, { type: 'purchase', cart });
  }
  state = act(state, { type: 'depart' });
  for (let step = 0; step < 120 && !state.outcome; step++) {
    if (state.pendingEvent) {
      const id = state.pendingEvent.id;
      const action = { type: 'resolveEvent', token: state.pendingEvent.token };
      if (id === 'nft_auction') action.choiceId = state.inventory.nft ? 'invest' : 'wait';
      if (id === 'van_breakdown') action.choiceId = state.inventory.parts >= (profession === 'dev' ? 1 : 2) ? 'repair' : 'kick';
      state = act(state, action);
      try {
        state = deserializeGame(serializeGame(state));
      } catch (error) {
        throw new Error(`seed ${seed}, event ${id}, mile ${state.distance}, phase ${state.phase}, location ${state.locationId}: ${error.message}`);
      }
      continue;
    }
    const location = LOCATIONS.find(item => item.id === state.locationId);
    if (state.phase === 'location' && location.activities.includes('talk') && !state.flags.talked.includes(location.id)) {
      state = act(state, { type: 'talk' });
      continue;
    }
    if (prudent && state.phase === 'location' && location.activities.includes('shop') && !visitedShops.has(location.id) &&
      (state.inventory.fuel < 20 || state.inventory.food < 18 || state.inventory.parts < 2)) {
      visitedShops.add(location.id);
      state = act(state, { type: 'openShop' });
      const cart = {
        fuel: Math.max(0, 35 - state.inventory.fuel),
        food: Math.max(0, Math.ceil(35 - state.inventory.food)),
        parts: Math.max(0, 2 - state.inventory.parts),
      };
      const fullCost = cart.fuel * 12 + cart.food * 4 + cart.parts * 15;
      if (fullCost > state.inventory.money) {
        cart.fuel = Math.min(cart.fuel, Math.floor(state.inventory.money / 12));
        cart.food = 0;
        cart.parts = 0;
      }
      if (Object.values(cart).some(quantity => quantity > 0)) state = act(state, { type: 'purchase', cart });
      state = act(state, { type: 'leaveShop' });
      continue;
    }
    const result = transition(state, { type: 'travel' });
    if (result.error) {
      if (state.inventory.fuel >= 2) state = act(state, { type: 'setPace', pace: 'slow' });
      else if (!prudent && state.phase === 'location' && location.activities.includes('shop')) {
        state = act(state, { type: 'depart' });
      } else {
        throw new Error(`Route stuck at mile ${state.distance}: ${result.error}`);
      }
    } else {
      state = result.state;
    }
  }
  assert.ok(state.outcome, `seed ${seed} never reached an ending`);
  return state;
}

test('a natural stocked route reaches Portland for each background', () => {
  for (const profession of ['influencer', 'dev', 'prepper', 'barista']) {
    const state = play(21, profession, true);
    assert.equal(state.outcome, 'won', `${profession}: ${state.journal.at(-1)?.text}`);
    assert.equal(state.distance, 1000);
    assert.ok(state.day > 10 && state.day < 40);
  }
});

test('a seeded unstocked route can run dry and lose', () => {
  const state = play(21, 'dev', false);
  assert.equal(state.outcome, 'lost');
  assert.ok(state.distance < 1000);
});

test('stocked travel has a high success rate across a small seed sample', t => {
  const outcomes = Array.from({ length: 30 }, (_, index) => play(index + 1, 'dev', true).outcome);
  const wins = outcomes.filter(outcome => outcome === 'won').length;
  t.diagnostic(`${wins}/30 seeded stocked developer routes reached Portland`);
  assert.ok(wins >= 24, outcomes.join(','));
});
