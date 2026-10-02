// Everything a player can do. Each action has a `check`, which says why it is refused or returns
// null, and an `apply`, which carries it out on a copy of the state. `transition` is the only
// caller of `apply`, and it always asks `check` first, so a rule about what is allowed is written
// once and can be asked without doing anything. An action the player picks from a list also has a
// `describe`, which says how it would be offered where the van is; `availableActions` asks
// `check` about each of those offers, so the list can never disagree with `transition`.

import { ACTION_TEXT, JOURNAL, LIMITS, PACES, RATIONS, REFUSALS, RULES } from '../data.js';
import { checkResolve, choicesFor, eventById, needsOf, resolve, rollEncounter } from './events.js';
import { pick, roll, rollBetween } from './random.js';
import { describeAbility, recommendSupplies } from './selectors.js';
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
  milesBeforeNextStop,
  moveVan,
  nextStop,
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
 * @typedef {Object} Offer   an action as the player would be offered it, before anyone asks `check`
 * @property {string} key      unique and stable: 'travel', 'useItem:kombucha', 'event:repair', …
 * @property {Action} action   ready to pass to transition
 * @property {'primary'|'activity'|'ability'|'item'|'lastResort'|'event'} group
 * @property {string} label
 * @property {string} detail   what it costs and gives, with numbers; may be ''
 *
 * @typedef {Offer & { enabled: boolean, reason: string }} ActionOption
 *   `reason` is the sentence `check` refuses the action with; '' when it is enabled
 *
 * @typedef {Object} ActionEntry
 * @property {string} type    the action's type, which is also its key in ACTIONS
 * @property {(state: State, action: Action) => string | null} check
 *   why the action is refused, as a sentence for the player; null when it is accepted. No side effects.
 * @property {(next: State, action: Action) => void} apply
 *   carry the action out on `next`, a copy that may be changed. Only for an action `check` accepted.
 * @property {(state: State) => Offer[]} [describe]
 *   how the action is offered where the van is: no offer where it means nothing (no rest stop here,
 *   no kombucha in the van), whether or not `check` would accept it. Only actions picked from a list
 *   have one; the shop, the settings and epitaphs have their own controls.
 */

const onTheRoad = state => state.phase === 'travel';
const inTheShop = state => state.phase === 'shop';
const outOfTheShop = state => state.phase === 'travel' || state.phase === 'location';
/** An item's short name inside a sentence: "Food" becomes "food"; an acronym such as "NFTs" stays. */
const inSentence = name => name.replace(/^[A-Z](?=[a-z])/, letter => letter.toLowerCase());
/** True when the van carries at least one of an item. */
const owns = (state, id) => state.inventory[id] >= 1;

/** One offer. */
const offer = (key, action, group, label, detail = '') => ({ key, action, group, label, detail });

// What a response to an encounter takes, by resource: the detail shown beside it.
const NEED_TEXT = {
  money: 'Costs ${amount}.',
  food: 'Uses {amount} food.',
  fuel: 'Uses {amount} fuel.',
  ammo: 'Uses {amount} {pack|packs} of seed bombs.',
  parts: 'Uses {amount} repair {kit|kits}.',
  kombucha: 'Uses {amount} {bottle|bottles} of kombucha.',
  nft: 'Uses {amount} {NFT|NFTs}.',
};
const CONTINUE = 'Continue';

/** The detail for a response: what its needs take, one sentence per resource. */
const needsDetail = needs =>
  Object.entries(needs)
    .map(([id, amount]) => fill(NEED_TEXT[id], { amount }))
    .join(' ');

/** The items a player can use outside the shop, in the order they are offered. */
const USABLE = ['kombucha', 'ammo'];

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
    describe(state) {
      const text = ACTION_TEXT.travel;
      const label =
        state.distance === 0 ? text.startLabel : fill(text.label, { stop: nextStop(state.distance).shortName });
      return [offer('travel', { type: 'travel' }, 'primary', label, fill(text.detail, drivePlan(state)))];
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
      if (inTheShop(state)) return REFUSALS.inShop;
      return stopOffers(state, 'shop') ? null : REFUSALS.noShop;
    },
    describe(state) {
      if (!stopOffers(state, 'shop')) return [];
      const { label, detail } = ACTION_TEXT.openShop;
      return [offer('openShop', { type: 'openShop' }, 'activity', label, detail)];
    },
    apply(next) {
      next.phase = 'shop';
    },
  },

  leaveShop: {
    type: 'leaveShop',
    check(state) {
      return inTheShop(state) ? null : REFUSALS.notInShop;
    },
    describe(state) {
      if (!inTheShop(state)) return [];
      const { label, detail } = ACTION_TEXT.leaveShop;
      const back = fill(label, { stop: currentStop(state).shortName });
      return [offer('leaveShop', { type: 'leaveShop' }, 'activity', back, detail)];
    },
    apply(next) {
      next.phase = 'location';
    },
  },

  purchase: {
    type: 'purchase',
    check(state, action) {
      if (!inTheShop(state)) return REFUSALS.notInShop;
      if (!isRecord(action.cart)) return REFUSALS.order;
      const lines = orderLines(action.cart);
      if (!lines) return REFUSALS.quantities;
      for (const [id, quantity] of lines) {
        const { max, short } = itemOf(id);
        if (quantity > 0 && state.inventory[id] + quantity > max) {
          return fill(REFUSALS.overMax, { max, name: inSentence(short) });
        }
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
      if (!inTheShop(state)) return REFUSALS.autoBuyPhase;
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
      if (!inTheShop(state)) return REFUSALS.sellPhase;
      return owns(state, 'nft') ? null : REFUSALS.noNft;
    },
    describe(state) {
      if (!inTheShop(state) || !owns(state, 'nft')) return [];
      const { label, detail } = ACTION_TEXT.sellNft;
      return [offer('sellNft', { type: 'sellNft' }, 'item', fill(label, itemOf('nft')), detail)];
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
    describe(state) {
      const rest = restHere(state);
      if (!rest) return [];
      const { road, stop } = ACTION_TEXT.rest;
      const label = rest.cures ? (currentStop(state).rest?.label ?? stop.label) : road.label;
      const detail = rest.cures ? (rest.cost > 0 ? stop.paidDetail : stop.detail) : road.detail;
      return [offer('rest', { type: 'rest' }, 'activity', label, fill(detail, rest))];
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
    describe(state) {
      const range = forageHere(state);
      if (!range) return [];
      const [low, high] = range;
      const { label, detail } = ACTION_TEXT.forage;
      return [offer('forage', { type: 'forage' }, 'activity', label, fill(detail, { ...RULES.forage, low, high }))];
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
    describe(state) {
      const meal = mealHere(state);
      if (!meal) return [];
      return [offer('meal', { type: 'meal' }, 'activity', meal.label, fill(ACTION_TEXT.meal.detail, meal))];
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
    describe(state) {
      if (!stopOffers(state, 'talk')) return [];
      const { label, detail } = ACTION_TEXT.talk;
      return [offer('talk', { type: 'talk' }, 'activity', label, detail)];
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
      return owns(state, action.itemId) ? null : REFUSALS.noItem[action.itemId];
    },
    describe(state) {
      if (!outOfTheShop(state)) return [];
      return USABLE.filter(id => owns(state, id)).map(id => {
        const item = itemOf(id);
        const [low, high] = item.yield ?? [];
        const { label, detail } = ACTION_TEXT.useItem[id];
        const action = { type: 'useItem', itemId: id };
        return offer(`useItem:${id}`, action, 'item', label, fill(detail, { ...item, low, high }));
      });
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
    describe(state) {
      if (!outOfTheShop(state)) return [];
      const { label } = professionOf(state).ability;
      return [offer('ability', { type: 'ability' }, 'ability', label, describeAbility(state.profession))];
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
    describe(state) {
      const event = eventById(state.pendingEvent?.id);
      if (!event) return [];
      const { token } = state.pendingEvent;
      if (event.type === 'auto') return [offer('event:continue', { type: 'resolveEvent', token }, 'event', CONTINUE)];
      return choicesFor(state, event).map(choice =>
        offer(
          `event:${choice.id}`,
          { type: 'resolveEvent', token, choiceId: choice.id },
          'event',
          fill(choice.label, event),
          needsDetail(needsOf(state, event, choice)),
        ),
      );
    },
    apply: resolve,
  },

  push: {
    type: 'push',
    check: lastResort,
    describe(state) {
      if (lastResort(state)) return [];
      const { label, detail } = ACTION_TEXT.push;
      const miles = milesBeforeNextStop(state.distance, RULES.push.miles);
      return [offer('push', { type: 'push' }, 'lastResort', label, fill(detail, { ...RULES.push, miles }))];
    },
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
    describe(state) {
      if (lastResort(state)) return [];
      const { label, detail } = ACTION_TEXT.hitchhike;
      return [offer('hitchhike', { type: 'hitchhike' }, 'lastResort', label, fill(detail, RULES.hitchhike))];
    },
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
    describe(state) {
      if (lastResort(state)) return [];
      const { label, detail } = ACTION_TEXT.tradeLuggage;
      return [offer('tradeLuggage', { type: 'tradeLuggage' }, 'lastResort', label, fill(detail, RULES.luggage))];
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
 * The gates every action passes before its own check, in this order: the state must be a version 3
 * journey and the action one of ACTIONS; an epitaph may be carved at any time; a finished journey
 * accepts nothing else; a pending encounter accepts only its answer. The refusal, or null.
 * @param {State} state
 * @param {Action} action
 * @returns {string | null}
 */
function gateFor(state, action) {
  if (!isRecord(state) || state.version !== SAVE_VERSION) return REFUSALS.invalid;
  if (!isRecord(action) || typeof action.type !== 'string') return REFUSALS.invalid;
  if (!Object.hasOwn(ACTIONS, action.type)) return REFUSALS.invalid;
  if (action.type === 'setEpitaph') return null;
  if (state.outcome || state.phase === 'ended') return REFUSALS.ended;
  if (state.pendingEvent && action.type !== 'resolveEvent') return REFUSALS.pending;
  return null;
}

/**
 * Why `transition` would refuse this action, as a sentence for the player; null when it would
 * accept it. Nothing is changed by asking. The gates decide first, then the action's own check.
 * @param {State} state  a journey from createGame, deserializeGame or transition
 * @param {Action} action
 * @returns {string | null}
 */
export function refusalFor(state, action) {
  return gateFor(state, action) ?? ACTIONS[action.type].check(state, action);
}

// The actions offered as options, in display order (spec section 5): the drive, activities, the
// ability, items, last resorts. An encounter's answers come last; while one is pending the gates
// close every other action, so they are all there is.
const OFFERED = [
  'travel',
  'rest',
  'forage',
  'meal',
  'talk',
  'openShop',
  'leaveShop',
  'ability',
  'useItem',
  'sellNft',
  'push',
  'hitchhike',
  'tradeLuggage',
  'resolveEvent',
];

/**
 * What the player can do now, in display order. Each action whose gates are open describes how it
 * is offered here, and `refusalFor`, which is what `transition` asks, decides whether each offer
 * is enabled and why not. An enabled option is therefore always accepted and a disabled one always
 * refused with its reason (A1). After the end, and for anything that is not a journey, the list is
 * empty.
 * @param {State} state
 * @returns {ActionOption[]}
 */
export function availableActions(state) {
  const options = [];
  for (const type of OFFERED) {
    if (gateFor(state, { type })) continue;
    for (const candidate of ACTIONS[type].describe(state)) {
      const reason = refusalFor(state, candidate.action) ?? '';
      options.push({ ...candidate, enabled: reason === '', reason });
    }
  }
  return options;
}

/** The journal lines written between two states of one journey, oldest first. */
function notesSince(before, after) {
  const written = Math.min(after.logged - before.logged, after.journal.length);
  return written > 0 ? after.journal.slice(-written).map(entry => entry.text) : [];
}

/**
 * Carry out an action. The state given is never changed. A refusal returns that same state, a
 * sentence for the player and no notes; otherwise the new state and the journal lines the action wrote.
 * The action is copied once, and that copy is what is checked and carried out, so an action that
 * reads differently each time (a getter) cannot pass the check with one value and act on another.
 * An action that cannot be copied is refused. Given a state from createGame, deserializeGame or
 * transition, this never throws.
 * @param {State} state
 * @param {Action} action
 * @returns {{ state: State, error: string | null, notes: string[] }}
 */
export function transition(state, action) {
  let copy;
  try {
    copy = structuredClone(action);
  } catch {
    return { state, error: REFUSALS.invalid, notes: [] };
  }
  const error = refusalFor(state, copy);
  if (error) return { state, error, notes: [] };
  const next = structuredClone(state);
  ACTIONS[copy.type].apply(next, copy);
  // Whatever the action did, see whether it ended the journey: the last death, or the last mile.
  finish(next);
  return { state: next, error: null, notes: notesSince(state, next) };
}
