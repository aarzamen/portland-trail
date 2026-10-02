import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  currentStop,
  deserializeGame,
  recommendSupplies,
  seedFromText,
  serializeGame,
  transition,
} from '../src/engine.js';
import {
  EVENTS,
  ITEMS,
  JOURNAL,
  LIMITS,
  LOCATIONS,
  PACES,
  PROFESSIONS,
  RATIONS,
  REFUSALS,
  RULES,
} from '../src/data.js';
import { fill } from '../src/engine/state.js';

const TRAVEL = { type: 'travel' };
const AUTO = { type: 'autoPurchase' };
const CREW = 5;
const STAPLES = ['fuel', 'food', 'parts', 'kombucha'];

const start = (profession = 'dev', seed = 21) => createGame({ profession, seed });
const stop = id => LOCATIONS.find(entry => entry.id === id);
const item = id => ITEMS.find(entry => entry.id === id);
const buy = cart => ({ type: 'purchase', cart });
const seeds = count => Array.from({ length: count }, (_, index) => seedFromText(`shop-${index}`));
const stocked = (state, inventory) => ({ ...state, inventory: { ...state.inventory, ...inventory } });
const inShop = (state, id) => ({ ...state, phase: 'shop', distance: stop(id).miles });
const hasShop = state => state.phase === 'location' && currentStop(state).activities.includes('shop');
const shops = LOCATIONS.filter(entry => entry.activities.includes('shop'));

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

/** The same state with a generator value from which a drive meets no encounter. */
function quiet(state) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = { ...state, rng: seedFromText(`quiet-${attempt}`) };
    const result = transition(candidate, TRAVEL);
    if (!result.error && !result.state.pendingEvent) return candidate;
  }
  throw new Error('no quiet day found');
}

/** An action that answers the pending encounter with the first response the engine accepts. */
function firstAnswer(state) {
  const entry = EVENTS.find(candidate => candidate.id === state.pendingEvent.id);
  const plain = { type: 'resolveEvent', token: state.pendingEvent.token };
  const options = entry.choices.map(choice => ({ ...plain, choiceId: choice.id }));
  return [plain, ...options].find(option => !transition(state, option).error);
}

/** Drive on quiet days with a full tank until the next shop, or Portland, and count what it took. */
function driveStretch(state) {
  const tank = item('fuel').max;
  let current = stocked(state, { fuel: tank, food: 90 });
  let days = 0;
  do {
    current = act(quiet(current), TRAVEL);
    days += 1;
  } while (!current.outcome && !hasShop(current));
  return {
    days,
    fuel: tank - current.inventory.fuel,
    name: current.outcome ? 'Portland' : currentStop(current).shortName,
  };
}

// --- Orders ----------------------------------------------------------------

test('an invalid order is refused whole and changes nothing', () => {
  const state = start('prepper');
  const invalid = [
    {},
    { bogus: 1 },
    { money: 1 },
    { fuel: -1 },
    { fuel: 1.5 },
    { fuel: '2' },
    { fuel: Number.NaN },
    { fuel: LIMITS.order + 1 },
    { fuel: 0 },
    { fuel: 0, food: 0 },
    { fuel: 2, bogus: 1 },
    { fuel: 2, food: -1 },
    { fuel: 2, toString: 1 },
    JSON.parse('{"fuel": 2, "__proto__": 1}'),
  ];
  for (const cart of invalid) {
    assert.equal(refusal(state, buy(cart)), REFUSALS.quantities, JSON.stringify(cart));
  }
  for (const cart of [undefined, null, [], [['fuel', 2]], 'fuel', 7]) {
    assert.equal(refusal(state, buy(cart)), REFUSALS.order, JSON.stringify(cart));
  }
});

test('an order is bought whole at the listed prices', () => {
  const state = start();
  const cart = { fuel: 2, food: 3, parts: 0, kombucha: 1 };
  const cost = 2 * item('fuel').price + 3 * item('food').price + item('kombucha').price;
  const result = transition(state, buy(cart));
  assert.equal(result.error, null);
  assert.deepEqual(result.state.inventory, {
    ...state.inventory,
    money: state.inventory.money - cost,
    fuel: state.inventory.fuel + 2,
    food: state.inventory.food + 3,
    kombucha: state.inventory.kombucha + 1,
  });
  assert.deepEqual(result.notes, [fill(JOURNAL.bought, { cost })]);
  assert.equal(result.notes[0], `Bought supplies for $${cost}.`);
  assert.equal(result.state.phase, 'shop');
  assert.equal(result.state.day, state.day);
});

test('an order the party cannot pay for is refused whole', () => {
  const cart = { fuel: 2, food: 2 };
  const cost = 2 * item('fuel').price + 2 * item('food').price;
  const poor = stocked(start(), { money: cost - 1 });
  assert.equal(refusal(poor, buy(cart)), fill(REFUSALS.overspend, { cost, money: cost - 1 }));
  assert.equal(act(stocked(poor, { money: cost }), buy(cart)).inventory.money, 0);
});

test('an order the van cannot hold is refused whole, by the supply label', () => {
  for (const entry of ITEMS) {
    const nearlyFull = stocked(start(), { money: 1e6, [entry.id]: entry.max - 1 });
    const error = refusal(nearlyFull, buy({ [entry.id]: 2 }));
    // The short name reads as a word in the sentence: "100 food", but "5 NFTs".
    const noun = entry.id === 'nft' ? entry.short : entry.short.toLowerCase();
    assert.equal(error, fill(REFUSALS.overMax, { max: entry.max, name: noun }));
    assert.ok(error.includes(` ${entry.max} ${noun}.`), error);
    assert.equal(act(nearlyFull, buy({ [entry.id]: 1 })).inventory[entry.id], entry.max);
    // Nothing else in the same order is bought either.
    const other = entry.id === 'fuel' ? 'food' : 'fuel';
    refusal(stocked(nearlyFull, { [other]: 0 }), buy({ [other]: 1, [entry.id]: 2 }));
    // A van already over the limit (an old save) can still buy other things.
    const over = stocked(start(), { money: 1e6, [entry.id]: entry.max + 3, [other]: 0 });
    refusal(over, buy({ [entry.id]: 1 }));
    assert.equal(act(over, buy({ [other]: 1, [entry.id]: 0 })).inventory[entry.id], entry.max + 3);
  }
});

test('the food carts charge their own food price', () => {
  const carts = stop('food_truck_fest');
  assert.notEqual(carts.prices.food, item('food').price);
  const state = inShop(start(), carts.id);
  const bought = act(state, buy({ food: 3, fuel: 1 }));
  assert.equal(state.inventory.money - bought.inventory.money, 3 * carts.prices.food + item('fuel').price);
  const elsewhere = act(inShop(start(), 'bookshop'), buy({ food: 3, fuel: 1 }));
  assert.equal(state.inventory.money - elsewhere.inventory.money, 3 * item('food').price + item('fuel').price);

  // Auto-buy pays the same price.
  const hungry = stocked(state, { food: 0, fuel: item('fuel').max, parts: 6, kombucha: 6 });
  const plan = recommendSupplies(hungry);
  assert.deepEqual(Object.keys(plan.cart), ['food']);
  assert.equal(plan.cost, plan.cart.food * carts.prices.food);
});

// --- Auto-buy --------------------------------------------------------------

test('auto-buy at the start stocks every background for the first stretch and keeps the reserve', () => {
  const { supplies } = RULES;
  for (const profession of PROFESSIONS) {
    const before = start(profession.id);
    const snapshot = structuredClone(before);
    const plan = recommendSupplies(before);
    assert.deepEqual(before, snapshot, 'planning changes nothing');
    assert.equal(plan.nextShopName, shops[1].shortName);
    assert.equal(plan.complete, true);
    assert.ok(plan.remainingCash >= supplies.reserveCash);
    assert.deepEqual(
      Object.keys(plan.cart).filter(id => !STAPLES.includes(id)),
      [],
      'never NFTs or seed bombs',
    );

    const result = transition(before, AUTO);
    assert.equal(result.error, null, profession.id);
    const bought = result.state;
    assert.ok(bought.inventory.fuel >= plan.fuelNeed);
    assert.ok(bought.inventory.food >= plan.travelDays * RATIONS[before.rations].food * CREW);
    assert.ok(bought.inventory.fuel >= supplies.fuelFloor);
    assert.ok(bought.inventory.food >= supplies.foodFloor);
    assert.ok(bought.inventory.parts >= supplies.parts);
    assert.ok(bought.inventory.kombucha >= supplies.kombucha);
    for (const entry of ITEMS) {
      assert.ok(bought.inventory[entry.id] <= Math.max(entry.max, before.inventory[entry.id]), entry.id);
    }
    assert.equal(bought.inventory.nft, before.inventory.nft);
    assert.equal(bought.inventory.ammo, before.inventory.ammo);
    assert.equal(bought.inventory.money, plan.remainingCash);
    assert.equal(before.inventory.money - bought.inventory.money, plan.cost);
    for (const [id, quantity] of Object.entries(plan.cart)) {
      assert.ok(quantity > 0);
      assert.equal(bought.inventory[id] - before.inventory[id], quantity);
    }
    assert.deepEqual(result.notes, [fill(JOURNAL.autoBought, { cost: plan.cost })]);
    assert.deepEqual(deserializeGame(serializeGame(bought)), bought);

    // A second press has nothing to add.
    assert.deepEqual(recommendSupplies(bought).cart, {});
    assert.equal(recommendSupplies(bought).complete, true);
    assert.equal(refusal(bought, AUTO), REFUSALS.autoBuyDone);

    // Driving at the default settings then reaches the next shop without a dry tank.
    for (const seed of seeds(25)) {
      let state = { ...bought, rng: seed };
      while (!hasShop(state)) {
        state = act(state, state.pendingEvent ? firstAnswer(state) : TRAVEL);
        assert.equal(state.outcome, null);
      }
      assert.equal(currentStop(state).id, shops[1].id);
    }
  }
});

test('auto-buy plans each stretch with the days and fuel the drive really takes', () => {
  for (const shop of shops) {
    for (const pace of Object.keys(PACES)) {
      const state = { ...inShop(start(), shop.id), pace };
      const plan = recommendSupplies(state);
      const drive = driveStretch(state);
      assert.equal(plan.travelDays, drive.days, `${shop.id} at ${pace}: days`);
      assert.equal(plan.fuelNeed, drive.fuel, `${shop.id} at ${pace}: fuel`);
      assert.equal(plan.nextShopName, drive.name, `${shop.id} at ${pace}: destination`);
    }
  }
  // The stretch after the motel is three legs, each rounded up on its own.
  const motel = recommendSupplies({ ...inShop(start(), 'sketchy_motel'), pace: 'fast' });
  assert.equal(motel.nextShopName, stop('crypto_meetup').shortName);
  const legs = [470 - 350, 570 - 470, 670 - 570];
  assert.equal(
    motel.travelDays,
    legs.reduce((days, leg) => days + Math.ceil(leg / PACES.fast.miles), 0),
  );
  assert.ok(motel.travelDays > Math.ceil((670 - 350) / PACES.fast.miles));
});

test('auto-buy tops up to the floors or to the stretch plus a buffer, whichever is more', () => {
  const { supplies } = RULES;
  for (const [pace, rations] of [
    ['normal', 'meager'],
    ['fast', 'filling'],
    ['slow', 'filling'],
  ]) {
    const empty = stocked(
      { ...inShop(start(), 'sketchy_motel'), pace, rations },
      {
        money: 5000,
        food: 0,
        fuel: 0,
        parts: 0,
        kombucha: 0,
      },
    );
    const plan = recommendSupplies(empty);
    const speed = PACES[pace];
    const perDay = RATIONS[rations].food * CREW;
    const fuel = Math.max(
      supplies.fuelFloor,
      plan.fuelNeed + supplies.bufferDays * Math.ceil(speed.miles / speed.milesPerFuel),
    );
    const food = Math.max(supplies.foodFloor, Math.ceil((plan.travelDays + supplies.bufferDays) * perDay));
    assert.deepEqual(plan.cart, { fuel, food, parts: supplies.parts, kombucha: supplies.kombucha }, pace);
    assert.equal(plan.complete, true);
    assert.equal(plan.remainingCash, 5000 - plan.cost);
    const cost = STAPLES.reduce((sum, id) => sum + plan.cart[id] * item(id).price, 0);
    assert.equal(plan.cost, cost);
  }
});

test('auto-buy plans food for the living only', () => {
  const { supplies } = RULES;
  const base = { ...inShop(start(), 'sketchy_motel'), pace: 'slow', rations: 'filling' };
  const empty = stocked(base, { money: 5000, food: 0 });
  const gone = { health: 0, sick: false, death: { day: 1, mile: 0, cause: 'unknown' }, epitaph: 'Gone.' };
  for (const dead of [0, 2, 4]) {
    const party = empty.party.map((member, index) => (index < dead ? { ...member, ...gone } : member));
    const plan = recommendSupplies({ ...empty, party });
    const perDay = RATIONS.filling.food * (CREW - dead);
    const food = Math.max(supplies.foodFloor, Math.ceil((plan.travelDays + supplies.bufferDays) * perDay));
    assert.equal(plan.cart.food, food, `${dead} dead`);
  }
  // On this stretch the full crew needs more than the floor, so the count of the living shows.
  assert.ok(recommendSupplies(empty).cart.food > supplies.foodFloor);
});

test('auto-buy buys whole bags of food and leaves alone what is already over the limit', () => {
  const state = stocked(start(), { food: RULES.supplies.foodFloor - 2.5 });
  assert.equal(recommendSupplies(state).cart.food, 3);
  assert.equal(act(state, AUTO).inventory.food, RULES.supplies.foodFloor + 0.5);

  const over = stocked(start(), { fuel: item('fuel').max + 5, food: item('food').max + 0.5, money: 5000 });
  const plan = recommendSupplies(over);
  assert.equal(plan.cart.fuel, undefined);
  assert.equal(plan.cart.food, undefined);
  assert.equal(plan.complete, true);
  const bought = act(over, AUTO);
  assert.equal(bought.inventory.fuel, over.inventory.fuel);
  assert.equal(bought.inventory.food, over.inventory.food);
});

test('with little cash auto-buy buys fuel for the stretch first, then food, and never overspends', () => {
  const price = id => item(id).price;
  const bare = stocked(start(), { food: 0, fuel: 0, parts: 0, kombucha: 0 });
  const { fuelNeed, travelDays } = recommendSupplies(bare);
  const foodNeed = Math.ceil(travelDays * RATIONS.meager.food * CREW);
  const fuelCost = fuelNeed * price('fuel');
  const essentials = fuelCost + foodNeed * price('food');
  assert.ok(fuelNeed > 0 && foodNeed >= 2);
  // No purse below exceeds the essentials, so what is left after them is less than one more unit:
  // always under the reserve, and nothing beyond the essentials is bought.
  assert.ok(Math.max(price('fuel'), price('food')) <= RULES.supplies.reserveCash);

  const purses = [
    0,
    price('food') - 1,
    price('fuel'),
    fuelCost - 1,
    fuelCost,
    fuelCost + 2 * price('food'),
    essentials,
  ];
  for (const money of purses) {
    const state = stocked(bare, { money });
    const plan = recommendSupplies(state);
    const fuel = Math.min(fuelNeed, Math.floor(money / price('fuel')));
    const food = Math.min(foodNeed, Math.floor((money - fuel * price('fuel')) / price('food')));
    const cart = Object.fromEntries(Object.entries({ fuel, food }).filter(([, quantity]) => quantity > 0));
    assert.deepEqual(plan.cart, cart, `$${money}`);
    assert.equal(plan.cost, fuel * price('fuel') + food * price('food'));
    assert.equal(plan.remainingCash, money - plan.cost);
    assert.ok(plan.remainingCash >= 0);
    assert.equal(plan.complete, false);
    if (plan.cost === 0) {
      assert.equal(refusal(state, AUTO), REFUSALS.autoBuyBroke);
      continue;
    }
    const result = transition(state, AUTO);
    assert.equal(result.state.inventory.money, plan.remainingCash);
    assert.equal(result.state.inventory.fuel, fuel);
    assert.equal(result.state.inventory.food, food);
    assert.deepEqual(result.notes, [fill(JOURNAL.autoBoughtShort, { cost: plan.cost })]);
  }

  // With the essentials covered, the reserve is kept before anything else is added.
  const reserve = RULES.supplies.reserveCash;
  const careful = recommendSupplies(stocked(bare, { money: essentials + reserve + price('fuel') }));
  assert.equal(careful.remainingCash, reserve);
  assert.deepEqual(careful.cart, { fuel: fuelNeed + 1, food: foodNeed });
});

test('auto-buy belongs to the shop', () => {
  const road = { ...start(), phase: 'travel', distance: 40 };
  assert.equal(refusal(road, AUTO), REFUSALS.autoBuyPhase);
  assert.equal(refusal({ ...start(), phase: 'location' }, AUTO), REFUSALS.autoBuyPhase);
  assert.equal(refusal(road, buy({ fuel: 1 })), REFUSALS.notInShop);
  const interrupted = { ...start(), pendingEvent: { id: 'found_supplies', token: 1 } };
  /** @type {any[]} */
  const elsewhere = [road, interrupted, { ...start(), phase: 'ended', outcome: 'lost' }];
  for (const state of elsewhere) {
    assert.deepEqual(recommendSupplies(state), {
      cart: {},
      cost: 0,
      remainingCash: state.inventory.money,
      complete: false,
      nextShopName: null,
      travelDays: 0,
      fuelNeed: 0,
    });
  }
});

// --- In and out of the shop ------------------------------------------------

test('an NFT sells only in a shop, for its resale price', () => {
  const nft = item('nft');
  const state = start('dev');
  assert.equal(state.inventory.nft, 1);
  const result = transition(state, { type: 'sellNft' });
  assert.equal(result.state.inventory.nft, 0);
  assert.equal(result.state.inventory.money, state.inventory.money + nft.resale);
  assert.deepEqual(result.notes, [fill(JOURNAL.soldNft, { name: nft.name, resale: nft.resale })]);
  assert.equal(result.notes[0], `Sold a ${nft.name} for $${nft.resale}.`);
  assert.equal(refusal(result.state, { type: 'sellNft' }), 'You have no NFTs to sell.');
  assert.equal(refusal({ ...state, phase: 'travel', distance: 40 }, { type: 'sellNft' }), REFUSALS.sellPhase);
  assert.equal(refusal({ ...state, phase: 'location' }, { type: 'sellNft' }), REFUSALS.sellPhase);
  assert.equal(refusal(state, { type: 'useItem', itemId: 'nft' }), REFUSALS.itemPhase);
});

test('the shop opens from its stop and closes back to it', () => {
  const motel = stop('sketchy_motel');
  const arrived = { ...start(), phase: 'location', distance: motel.miles };
  const shop = act(arrived, { type: 'openShop' });
  assert.equal(shop.phase, 'shop');
  assert.equal(currentStop(shop), motel);
  assert.equal(shop.day, arrived.day);
  assert.equal(refusal(shop, { type: 'openShop' }), REFUSALS.inShop);
  const back = act(shop, { type: 'leaveShop' });
  assert.equal(back.phase, 'location');
  assert.equal(currentStop(back), motel);
  assert.deepEqual(back, arrived);
  assert.equal(refusal(back, { type: 'leaveShop' }), REFUSALS.notInShop);
  assert.equal(refusal({ ...arrived, phase: 'travel' }, { type: 'leaveShop' }), REFUSALS.notInShop);

  // The starting shop is a stop like any other.
  const coop = act(start(), { type: 'leaveShop' });
  assert.equal(coop.phase, 'location');
  assert.equal(currentStop(coop).id, 'start_city');
  assert.equal(act(coop, { type: 'openShop' }).phase, 'shop');
});

test('the van drives straight out of a shop', () => {
  const motel = stop('sketchy_motel');
  const shop = quiet(inShop(start(), motel.id));
  const result = transition(shop, TRAVEL);
  assert.equal(result.error, null);
  assert.equal(result.state.phase, 'travel');
  assert.equal(result.state.distance, motel.miles + PACES.normal.miles);
  assert.equal(result.state.day, shop.day + 1);

  // From a shop one short day from the next stop, the drive ends at that stop.
  const meetup = stop('crypto_meetup');
  const near = quiet({ ...inShop(start(), meetup.id), pace: 'fast' });
  const arrived = act(near, TRAVEL);
  assert.equal(arrived.phase, 'location');
  assert.equal(currentStop(arrived).id, 'food_truck_fest');
});
