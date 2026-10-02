// Random journeys through the real engine: valid and malformed actions of every type, on frozen states.
// Whatever the action, transition must not throw or change its input, a refusal must hand back the same
// state, and every state it accepts must save, load back unchanged and stay within the rules' ranges.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableActions,
  createGame,
  deserializeGame,
  forecast,
  recommendSupplies,
  serializeGame,
  summarize,
  transition,
} from '../src/engine.js';
import { EVENTS, ITEMS, PACES, PROFESSIONS, RATIONS } from '../src/data.js';

const JOURNEYS = 300;
const STEPS = 400;
const OUTER_SEED = 20261001;
const MAX_HEALTH = 100;
const AFTER_END = 25;

/** The fuzzer's own generator, apart from the journey's, so that the run is the same every time. */
function generator(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
  const pick = list => list[Math.floor(next() * list.length)];
  return { next, pick };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

const ITEM_IDS = ITEMS.map(item => item.id);
const CHOICE_IDS = [...new Set(EVENTS.flatMap(event => event.choices.map(choice => choice.id)))];
// Values that are wrong for almost any field.
const JUNK = [
  undefined,
  null,
  '',
  'constructor',
  '__proto__',
  'toString',
  -1,
  0,
  1.5,
  NaN,
  Infinity,
  1001,
  [],
  {},
  true,
];

/** An action of every type in spec section 5, sometimes well formed and sometimes not. */
function randomAction(state, { next, pick }) {
  const odd = () => next() < 0.25;
  const token = () => (odd() ? pick([...JUNK, (state.pendingEvent?.token ?? 0) + 1]) : state.pendingEvent?.token);
  const member = () => (odd() ? pick(JUNK) : pick(state.party).id);
  const makers = {
    travel: () => ({ type: 'travel' }),
    openShop: () => ({ type: 'openShop' }),
    leaveShop: () => ({ type: 'leaveShop' }),
    purchase: () => {
      if (odd()) return { type: 'purchase', cart: pick([...JUNK, 'food', [1, 2]]) };
      const cart = {};
      const lines = 1 + Math.floor(next() * 3);
      for (let line = 0; line < lines; line++) {
        cart[pick([...ITEM_IDS, ...ITEM_IDS, 'money', '__proto__'])] = pick([0, 1, 1, 2, 3, 5, 10, 40, 1000, ...JUNK]);
      }
      return { type: 'purchase', cart };
    },
    autoPurchase: () => ({ type: 'autoPurchase' }),
    sellNft: () => ({ type: 'sellNft' }),
    rest: () => ({ type: 'rest' }),
    forage: () => ({ type: 'forage' }),
    meal: () => ({ type: 'meal' }),
    talk: () => ({ type: 'talk' }),
    useItem: () => ({
      type: 'useItem',
      itemId: odd() ? pick([...JUNK, 'nft', 'food', 'money']) : pick(['ammo', 'kombucha']),
    }),
    ability: () => ({ type: 'ability' }),
    setPace: () => ({ type: 'setPace', pace: odd() ? pick(JUNK) : pick(Object.keys(PACES)) }),
    setRations: () => ({ type: 'setRations', rations: odd() ? pick(JUNK) : pick(Object.keys(RATIONS)) }),
    resolveEvent: () => {
      const action = { type: 'resolveEvent', token: token() };
      if (next() < 0.8) action.choiceId = odd() ? pick(JUNK) : pick(CHOICE_IDS);
      return action;
    },
    push: () => ({ type: 'push' }),
    hitchhike: () => ({ type: 'hitchhike' }),
    tradeLuggage: () => ({ type: 'tradeLuggage' }),
    setEpitaph: () => ({
      type: 'setEpitaph',
      memberId: member(),
      text: odd()
        ? pick([...JUNK, ' ', 'x'.repeat(61), 'line\nbreak'])
        : pick(['Gone.', '  Kale forever  ', 'é'.repeat(60)]),
    }),
  };
  const malformed = [
    () => pick(JUNK),
    () => 'travel',
    () => ({}),
    () => ({ type: pick([...JUNK, 'depart', 'bogus', 'TRAVEL', 'hasOwnProperty']) }),
    () => ({ type: 'travel', extra: () => 1 }),
    () => ({ type: 'rest', [Symbol('odd')]: 1, symbol: Symbol('odd') }),
    () => ({
      get type() {
        throw new Error('unreadable');
      },
    }),
  ];
  const roll = next();
  if (roll < 0.06) return { action: pick(malformed)() };
  if (roll < 0.55) {
    // A listed option, so that journeys get somewhere and the list is checked against transition.
    const options = availableActions(state);
    if (options.length > 0) {
      const option = pick(options);
      return { action: option.action, option };
    }
  }
  if (state.pendingEvent && roll < 0.75) return { action: makers.resolveEvent() };
  return { action: makers[pick(Object.keys(makers))]() };
}

/** Every rule a reached state must keep; `before` is the state it came from. */
function checkState(before, after, context) {
  assert.ok(after.distance >= before.distance, `distance went back ${context}`);
  assert.ok(after.day >= before.day, `day went back ${context}`);
  for (const [id, amount] of Object.entries(after.inventory)) {
    assert.ok(Number.isFinite(amount) && amount >= 0, `${id} is ${amount} ${context}`);
  }
  after.party.forEach((member, index) => {
    assert.ok(Number.isInteger(member.health), `health ${member.health} is not whole ${context}`);
    assert.ok(member.health >= 0 && member.health <= MAX_HEALTH, `health ${member.health} ${context}`);
    const was = before.party[index];
    if (was.health === 0) {
      assert.equal(member.health, 0, `${member.name} came back ${context}`);
      assert.deepEqual(member.death, was.death, `${member.name}'s death changed ${context}`);
    }
  });
}

/** The read-only questions the interface asks of every state. */
function askEverything(state, context) {
  for (const ask of [availableActions, forecast, summarize, recommendSupplies]) {
    assert.doesNotThrow(() => ask(state), `${ask.name} threw ${context}`);
  }
}

test('random journeys of valid and malformed actions keep every rule and every state saveable', t => {
  const random = generator(OUTER_SEED);
  const tally = { actions: 0, accepted: 0, refused: 0, listed: 0, won: 0, lost: 0 };
  for (let journey = 0; journey < JOURNEYS; journey++) {
    const profession = random.pick(PROFESSIONS).id;
    const seed = Math.floor(random.next() * 4294967296);
    let state = deepFreeze(createGame({ profession, seed }));
    askEverything(state, `at the start of journey ${journey} (seed ${seed})`);
    // After the end only epitaphs are accepted; a few more steps are enough to try them.
    for (let step = 0, after = 0; step < STEPS && after < AFTER_END; step++, after += state.outcome ? 1 : 0) {
      const { action, option: listed } = randomAction(state, random);
      const context = `in journey ${journey} (${profession}, seed ${seed}) at step ${step}`;
      let result;
      assert.doesNotThrow(() => {
        result = transition(state, action);
      }, `transition threw ${context}`);
      tally.actions += 1;
      if (listed) {
        tally.listed += 1;
        assert.equal(
          result.error === null,
          listed.enabled,
          `option ${listed.key} disagrees with transition ${context}`,
        );
        if (!listed.enabled) assert.equal(result.error, listed.reason, `option ${listed.key}'s reason ${context}`);
      }
      if (result.error) {
        tally.refused += 1;
        assert.equal(result.state, state, `a refusal returned a different state ${context}`);
        assert.deepEqual(result.notes, [], `a refusal wrote notes ${context}`);
        continue;
      }
      tally.accepted += 1;
      const next = result.state;
      assert.notEqual(next, state, `an accepted action returned its input ${context}`);
      let saved;
      assert.doesNotThrow(
        () => {
          saved = serializeGame(next);
        },
        `an accepted state could not be saved ${context} after ${JSON.stringify(action)}`,
      );
      assert.deepEqual(deserializeGame(saved), next, `a saved state did not load back unchanged ${context}`);
      checkState(state, next, context);
      askEverything(next, context);
      state = deepFreeze(next);
    }
    if (state.outcome) tally[state.outcome] += 1;
  }
  t.diagnostic(JSON.stringify(tally));
  // The run must reach real play, not only refusals: endings of both kinds and plenty of accepted actions.
  assert.ok(tally.won > 0 && tally.lost > 0, `endings: ${tally.won} won, ${tally.lost} lost`);
  assert.ok(tally.accepted > tally.actions / 4, `${tally.accepted} of ${tally.actions} actions accepted`);
});
