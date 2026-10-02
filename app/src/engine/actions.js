// Everything a player can do. Each action has a `check`, which says why it is refused or returns
// null, and an `apply`, which carries it out on a copy of the state. `transition` is the only
// caller of `apply`, and it always asks `check` first, so a rule about what is allowed is written
// once and can be asked without doing anything.

import { JOURNAL, LIMITS, PACES, RATIONS, REFUSALS, RULES } from '../data.js';
import { checkResolve, resolve, rollEncounter } from './events.js';
import { pick, roll, rollBetween } from './random.js';
import { recommendSupplies } from './selectors.js';
import {
  SAVE_VERSION,
  cleanEpitaph,
  cure,
  currentStop,
  drivePlan,
  fill,
  finish,
  gain,
  healAll,
  hurt,
  hurtAll,
  isRecord,
  itemOf,
  living,
  log,
  moveVan,
  passDay,
  priceOf,
  professionOf,
  regionAt,
  say,
  spend,
  stopOffers,
  wifiDown,
} from './state.js';

/**
 * @typedef {import('./state.js').State} State
 *
 * @typedef {{ type: string, [field: string]: any }} Action
 *   what a player asks for: a type, and the fields that type needs (spec section 5)
 *
 * @typedef {Object} ActionEntry
 * @property {string} type    the action's type, which is also its key in ACTIONS
 * @property {(state: State, action: Action) => string | null} check
 *   why the action is refused, as a sentence for the player; null when it is accepted. No side effects.
 * @property {(next: State, action: Action) => void} apply
 *   carry the action out on `next`, a copy that may be changed. Only for an action `check` accepted.
 */

const onTheRoad = state => state.phase === 'travel';
const outOfTheShop = state => state.phase === 'travel' || state.phase === 'location';

/** The refusal for a price the party cannot pay, or null. */
function cannotPay(state, cost) {
  const { money } = state.inventory;
  return cost > money ? fill(REFUSALS.cost, { cost, money }) : null;
}

/**
 * What a rest does where the van is: on the road, or at a stop that offers one, where it also
 * cures sickness and may cost cash. Null where nobody can rest.
 * @returns {{ heal: number, cost: number, cures: boolean } | null}
 */
export function restHere(state) {
  if (onTheRoad(state)) return { heal: RULES.roadRest.heal, cost: 0, cures: false };
  if (!stopOffers(state, 'rest')) return null;
  const { rest } = currentStop(state);
  return { heal: rest?.heal ?? RULES.stopRest.heal, cost: rest?.cost ?? 0, cures: true };
}

/**
 * The range of food that foraging finds where the van is, with the prepper's bonus: the region's
 * range on the road, the stop's own range at a stop that offers foraging. Null anywhere else.
 * @returns {[number, number] | null}
 */
export function forageHere(state) {
  const allowed = onTheRoad(state) || stopOffers(state, 'forage');
  if (!allowed) return null;
  const [min, max] = currentStop(state)?.forage ?? regionAt(state.distance).forage;
  const bonus = state.profession === 'prepper' ? RULES.forage.prepperBonus : 0;
  return [min + bonus, max + bonus];
}

/** The meal this stop sells, with its `cost` for the living crew. Null where there is none. */
export function mealHere(state) {
  if (!stopOffers(state, 'meal')) return null;
  const { meal } = currentStop(state);
  return { ...meal, cost: meal.costEach * living(state).length };
}

/** The lines of an order as [item id, quantity] pairs, or null when it is not a well-formed order. */
function orderLines(cart) {
  const lines = Object.entries(cart);
  const wellFormed = ([id, quantity]) =>
    Boolean(itemOf(id)) && Number.isInteger(quantity) && quantity >= 0 && quantity <= LIMITS.order;
  return lines.every(wellFormed) && lines.some(([, quantity]) => quantity > 0) ? lines : null;
}

const orderCost = (state, lines) => lines.reduce((sum, [id, quantity]) => sum + priceOf(state, id) * quantity, 0);

/** Last resorts are for a van that is stopped outside a shop with a dry tank (F3). */
function lastResort(state) {
  if (!outOfTheShop(state)) return REFUSALS.lastResortPhase;
  return state.inventory.fuel >= 1 ? REFUSALS.lastResortFuel : null;
}

// What each background's ability does, once its line is in the journal.
const ABILITIES = {
  influencer(state, ability) {
    gain(state, 'money', ability.money);
    gain(state, 'food', ability.food);
  },
  dev(state, ability) {
    gain(state, 'parts', ability.parts);
  },
  prepper(state, ability) {
    gain(state, 'food', ability.food);
    hurtAll(state, ability.damage, 'scout');
  },
  barista(state, ability) {
    spend(state, 'food', ability.foodCost);
    healAll(state, ability.heal);
  },
};

// What using one of an item does. Only these two items can be used.
const USES = {
  ammo(state, item) {
    const food = rollBetween(state, item.yield);
    gain(state, 'food', food);
    say(state, JOURNAL.seedBombs, { food });
  },
  kombucha(state, item) {
    healAll(state, item.heal);
    cure(state);
    say(state, JOURNAL.kombucha, { heal: item.heal });
  },
};

/**
 * Every action, keyed by its type.
 * @type {Record<string, ActionEntry>}
 */
export const ACTIONS = {
  travel: {
    type: 'travel',
    check(state) {
      return state.inventory.fuel < 1 ? REFUSALS.tankDry : null;
    },
    apply(next) {
      const plan = drivePlan(next);
      passDay(next, { traveling: true });
      if (next.outcome) return;
      spend(next, 'fuel', plan.fuel);
      moveVan(next, plan.miles, JOURNAL.drove);
      if (next.outcome) return;
      if (next.inventory.fuel < 1) log(next, JOURNAL.tankDry);
      rollEncounter(next);
    },
  },

  openShop: {
    type: 'openShop',
    check(state) {
      if (state.phase === 'shop') return REFUSALS.inShop;
      return stopOffers(state, 'shop') ? null : REFUSALS.noShop;
    },
    apply(next) {
      next.phase = 'shop';
    },
  },

  leaveShop: {
    type: 'leaveShop',
    check(state) {
      return state.phase === 'shop' ? null : REFUSALS.notInShop;
    },
    apply(next) {
      next.phase = 'location';
    },
  },

  purchase: {
    type: 'purchase',
    check(state, action) {
      if (state.phase !== 'shop') return REFUSALS.notInShop;
      if (!isRecord(action.cart)) return REFUSALS.order;
      const lines = orderLines(action.cart);
      if (!lines) return REFUSALS.quantities;
      for (const [id, quantity] of lines) {
        const { max, short } = itemOf(id);
        if (quantity > 0 && state.inventory[id] + quantity > max) return fill(REFUSALS.overMax, { max, name: short });
      }
      const cost = orderCost(state, lines);
      const { money } = state.inventory;
      return cost > money ? fill(REFUSALS.overspend, { cost, money }) : null;
    },
    apply(next, action) {
      const lines = orderLines(action.cart);
      const cost = orderCost(next, lines);
      spend(next, 'money', cost);
      for (const [id, quantity] of lines) gain(next, id, quantity);
      say(next, JOURNAL.bought, { cost });
    },
  },

  autoPurchase: {
    type: 'autoPurchase',
    check(state) {
      if (state.phase !== 'shop') return REFUSALS.autoBuyPhase;
      const plan = recommendSupplies(state);
      if (plan.cost > 0) return null;
      return plan.complete ? REFUSALS.autoBuyDone : REFUSALS.autoBuyBroke;
    },
    apply(next) {
      const plan = recommendSupplies(next);
      spend(next, 'money', plan.cost);
      for (const [id, quantity] of Object.entries(plan.cart)) gain(next, id, quantity);
      say(next, plan.complete ? JOURNAL.autoBought : JOURNAL.autoBoughtShort, { cost: plan.cost });
    },
  },

  sellNft: {
    type: 'sellNft',
    check(state) {
      if (state.phase !== 'shop') return REFUSALS.sellPhase;
      return state.inventory.nft < 1 ? REFUSALS.noNft : null;
    },
    apply(next) {
      const { name, resale } = itemOf('nft');
      spend(next, 'nft', 1);
      gain(next, 'money', resale);
      say(next, JOURNAL.soldNft, { name, resale });
    },
  },

  rest: {
    type: 'rest',
    check(state) {
      const rest = restHere(state);
      return rest ? cannotPay(state, rest.cost) : REFUSALS.noRest;
    },
    apply(next) {
      const rest = restHere(next);
      spend(next, 'money', rest.cost);
      passDay(next, { traveling: false });
      if (next.outcome) return;
      if (rest.cures) cure(next);
      healAll(next, rest.heal);
      const paid = rest.cost > 0 ? JOURNAL.restPaid : JOURNAL.restStop;
      say(next, rest.cures ? paid : JOURNAL.restRoad, rest);
    },
  },

  forage: {
    type: 'forage',
    check(state) {
      return forageHere(state) ? null : REFUSALS.noForage;
    },
    apply(next) {
      const range = forageHere(next);
      const { damage, sickChance } = RULES.forage;
      passDay(next, { traveling: false });
      if (next.outcome) return;
      const food = rollBetween(next, range);
      gain(next, 'food', food);
      say(next, JOURNAL.foraged, { food, damage });
      hurtAll(next, damage, 'forage');
      const crew = living(next);
      if (crew.length === 0 || roll(next) >= sickChance) return;
      const unlucky = pick(next, crew);
      unlucky.sick = true;
      say(next, JOURNAL.forageSick, { name: unlucky.name });
    },
  },

  meal: {
    type: 'meal',
    check(state) {
      const meal = mealHere(state);
      if (!meal) return REFUSALS.noMeal;
      if (state.flags.meals.includes(currentStop(state).id)) return REFUSALS.mealEaten;
      return cannotPay(state, meal.cost);
    },
    apply(next) {
      const meal = mealHere(next);
      spend(next, 'money', meal.cost);
      healAll(next, meal.heal);
      next.flags.meals.push(currentStop(next).id);
      say(next, meal.line, meal);
    },
  },

  talk: {
    type: 'talk',
    check(state) {
      if (!stopOffers(state, 'talk')) return REFUSALS.noTalk;
      return state.flags.talked.includes(currentStop(state).id) ? REFUSALS.talked : null;
    },
    apply(next) {
      const stop = currentStop(next);
      const { gain: gifts = {}, heal: comfort = 0, line } = stop.talk;
      for (const [id, amount] of Object.entries(gifts)) gain(next, id, amount);
      healAll(next, comfort);
      next.flags.talked.push(stop.id);
      say(next, line, { ...gifts, heal: comfort });
    },
  },

  useItem: {
    type: 'useItem',
    check(state, action) {
      const usable = typeof action.itemId === 'string' && Object.hasOwn(USES, action.itemId);
      if (!usable || !outOfTheShop(state)) return REFUSALS.itemPhase;
      return state.inventory[action.itemId] < 1 ? REFUSALS.noItem[action.itemId] : null;
    },
    apply(next, action) {
      spend(next, action.itemId, 1);
      USES[action.itemId](next, itemOf(action.itemId));
    },
  },

  ability: {
    type: 'ability',
    check(state) {
      if (!outOfTheShop(state)) return REFUSALS.abilityPhase;
      const { ability } = professionOf(state);
      const days = ability.cooldown - (state.day - state.flags.lastAbilityDay);
      if (days > 0) return fill(REFUSALS.cooldown, { days });
      if (ability.offline && wifiDown(state)) return ability.offline;
      if (ability.foodCost > state.inventory.food) return fill(ability.lacking, ability);
      return null;
    },
    apply(next) {
      const { ability } = professionOf(next);
      say(next, ability.result, ability);
      ABILITIES[next.profession](next, ability);
      next.flags.lastAbilityDay = next.day;
    },
  },

  setPace: {
    type: 'setPace',
    check(state, action) {
      return typeof action.pace === 'string' && Object.hasOwn(PACES, action.pace) ? null : REFUSALS.pace;
    },
    apply(next, action) {
      next.pace = action.pace;
    },
  },

  setRations: {
    type: 'setRations',
    check(state, action) {
      const listed = typeof action.rations === 'string' && Object.hasOwn(RATIONS, action.rations);
      return listed ? null : REFUSALS.rations;
    },
    apply(next, action) {
      next.rations = action.rations;
    },
  },

  resolveEvent: {
    type: 'resolveEvent',
    check: checkResolve,
    apply: resolve,
  },

  push: {
    type: 'push',
    check: lastResort,
    apply(next) {
      passDay(next, { traveling: false });
      hurtAll(next, RULES.push.damage, 'push');
      finish(next);
      if (next.outcome) return;
      moveVan(next, RULES.push.miles, JOURNAL.pushed);
    },
  },

  hitchhike: {
    type: 'hitchhike',
    check: lastResort,
    apply(next) {
      const { chance, fuel, damage } = RULES.hitchhike;
      passDay(next, { traveling: false });
      if (next.outcome) return;
      const walker = pick(next, living(next));
      if (roll(next) < chance) {
        gain(next, 'fuel', fuel);
        say(next, JOURNAL.hitchhiked, { name: walker.name, fuel });
      } else {
        say(next, JOURNAL.hitchhikeFailed, { name: walker.name });
        hurt(next, walker, damage, 'hitchhike');
      }
    },
  },

  tradeLuggage: {
    type: 'tradeLuggage',
    check(state) {
      return lastResort(state) ?? (state.flags.luggageTraded ? REFUSALS.luggageGone : null);
    },
    apply(next) {
      const { fuel } = RULES.luggage;
      next.flags.luggageTraded = true;
      gain(next, 'fuel', fuel);
      say(next, JOURNAL.luggage, { fuel });
    },
  },

  setEpitaph: {
    type: 'setEpitaph',
    check(state, action) {
      const member = state.party.find(traveler => traveler.id === action.memberId);
      if (!member) return REFUSALS.epitaphWho;
      if (member.health > 0) return fill(REFUSALS.epitaphAlive, { name: member.name });
      return cleanEpitaph(action.text) === null ? fill(REFUSALS.epitaphText, { max: LIMITS.epitaph }) : null;
    },
    apply(next, action) {
      next.party.find(traveler => traveler.id === action.memberId).epitaph = cleanEpitaph(action.text);
    },
  },
};

/**
 * Why `transition` would refuse this action, as a sentence for the player; null when it would
 * accept it. Nothing is changed by asking. The gates come first, in this order: the state must be
 * a version 3 journey and the action one of ACTIONS; an epitaph may be carved at any time; a
 * finished journey accepts nothing else; a pending encounter accepts only its answer. Then the
 * action's own check decides.
 * @param {State} state  a journey from createGame, deserializeGame or transition
 * @param {Action} action
 * @returns {string | null}
 */
export function refusalFor(state, action) {
  if (!isRecord(state) || state.version !== SAVE_VERSION) return REFUSALS.invalid;
  if (!isRecord(action) || typeof action.type !== 'string') return REFUSALS.invalid;
  if (!Object.hasOwn(ACTIONS, action.type)) return REFUSALS.invalid;
  if (action.type !== 'setEpitaph') {
    if (state.outcome || state.phase === 'ended') return REFUSALS.ended;
    if (state.pendingEvent && action.type !== 'resolveEvent') return REFUSALS.pending;
  }
  return ACTIONS[action.type].check(state, action);
}

/** The journal lines written between two states of one journey, oldest first. */
function notesSince(before, after) {
  const written = Math.min(after.logged - before.logged, after.journal.length);
  return written > 0 ? after.journal.slice(-written).map(entry => entry.text) : [];
}

/**
 * Carry out an action. The state given is never changed. A refusal returns that same state, a
 * sentence for the player and no notes; otherwise the new state and the journal lines the action wrote.
 * @param {State} state
 * @param {Action} action
 * @returns {{ state: State, error: string | null, notes: string[] }}
 */
export function transition(state, action) {
  const error = refusalFor(state, action);
  if (error) return { state, error, notes: [] };
  const next = structuredClone(state);
  ACTIONS[action.type].apply(next, action);
  // Whatever the action did, see whether it ended the journey: the last death, or the last mile.
  finish(next);
  return { state: next, error: null, notes: notesSince(state, next) };
}
