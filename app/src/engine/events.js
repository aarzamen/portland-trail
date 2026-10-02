// Encounters: which one the road rolls, who may answer it and how, and what each answer does.
// The content and the numbers are EVENTS in data.js; a saved journey stores only the id and a token.

import { EVENTS, REFUSALS, RULES } from '../data.js';
import { pick, pickWeighted, roll } from './random.js';
import {
  cure,
  fill,
  gain,
  healAll,
  hurt,
  hurtAll,
  living,
  log,
  moveVan,
  nextStop,
  passDay,
  professionOf,
  say,
  spend,
  wifiDown,
} from './state.js';

const EVENT_BY_ID = new Map(EVENTS.map(event => [event.id, event]));

/** The encounter with this id, or undefined. */
export const eventById = id => EVENT_BY_ID.get(id);

/**
 * After a day's driving, maybe meet an encounter: one roll against the chance, then one roll to
 * pick by weight among the encounters that can happen at the mile the van has reached.
 */
export function rollEncounter(state) {
  if (roll(state) >= RULES.eventChance) return;
  const mile = state.distance;
  const here = EVENTS.filter(event => !event.where || (event.where.from <= mile && mile <= event.where.to));
  const event = pickWeighted(state, here);
  state.flags.nextToken += 1;
  state.pendingEvent = { id: event.id, token: state.flags.nextToken };
  log(state, event.title);
}

/** The responses this party is offered: a response reserved for another background is not shown. */
export function choicesFor(state, event) {
  return event.choices.filter(choice => !choice.only || choice.only === state.profession);
}

/**
 * What a response costs this party, as { resource id: amount }. An amount in the data may name
 * one of the encounter's own numbers, and a developer repairs a breakdown with fewer kits.
 */
export function needsOf(state, event, choice) {
  const needs = {};
  for (const [id, amount] of Object.entries(choice.needs ?? {})) {
    needs[id] = typeof amount === 'string' ? event[amount] : amount;
  }
  const { repairCost } = professionOf(state).ability;
  if (event.id === 'van_breakdown' && choice.id === 'repair' && repairCost !== undefined) needs.parts = repairCost;
  return needs;
}

/** Why this answer to the pending encounter is refused, or null when it is accepted. */
export function checkResolve(state, action) {
  const pending = state.pendingEvent;
  if (!pending) return REFUSALS.nothingPending;
  const event = eventById(pending.id);
  if (!event || action.token !== pending.token) return REFUSALS.stale;
  if (event.type === 'auto') return action.choiceId == null ? null : REFUSALS.noChoices;
  const choice = choicesFor(state, event).find(option => option.id === action.choiceId);
  if (!choice) return REFUSALS.pickChoice;
  if (choice.offline && wifiDown(state)) return choice.offline;
  for (const [id, need] of Object.entries(needsOf(state, event, choice))) {
    const have = state.inventory[id];
    if (have < need) return fill(choice.lacking, { need, have });
  }
  return null;
}

/**
 * Resolve the pending encounter with an answer that `checkResolve` accepted: clear it, spend
 * what the response needs and run its effect. An encounter is cleared before anything else
 * happens, so it can never resolve twice.
 */
export function resolve(state, action) {
  const event = eventById(state.pendingEvent.id);
  const choice = event.choices.find(option => option.id === action.choiceId);
  state.pendingEvent = null;
  const paid = choice ? needsOf(state, event, choice) : {};
  for (const [id, amount] of Object.entries(paid)) spend(state, id, amount);
  const effect = choice ? EFFECTS[event.id][choice.id] : EFFECTS[event.id];
  effect(state, event, choice, paid);
}

/** One random living traveler loses health; the line names them. */
function hurtOne(state, template, damage, cause) {
  const victim = pick(state, living(state));
  say(state, template, { name: victim.name, damage });
  hurt(state, victim, damage, cause);
  return victim;
}

/**
 * What each encounter does, by id: a function for an automatic encounter, and one function for
 * each response otherwise. Each gets (state, event, choice, paid), where `paid` is what the
 * response's needs came to. Each writes its result line before it harms anyone, so that a death
 * reads after its cause.
 */
export const EFFECTS = {
  tiktok_distraction(state, event) {
    hurtOne(state, event.result, event.damage, 'doomscrolling');
  },

  nft_auction: {
    invest(state, event, choice) {
      const money = roll(state) < event.winChance ? event.win : event.lose;
      gain(state, 'money', money);
      say(state, choice.result, { money });
    },
    consult(state, event, choice) {
      gain(state, 'money', event.consultFee);
      say(state, choice.result, { money: event.consultFee });
    },
    wait(state, event, choice) {
      say(state, choice.result);
    },
  },

  food_poisoning: {
    treat(state, event, choice) {
      hurtOne(state, choice.result, event.treatedDamage, 'food_poisoning');
    },
    ride(state, event, choice) {
      const victim = hurtOne(state, choice.result, event.damage, 'food_poisoning');
      victim.sick = victim.health > 0;
    },
  },

  van_breakdown: {
    repair(state, event, choice, paid) {
      say(state, choice.result, { parts: paid.parts });
    },
    tow(state, event, choice, paid) {
      say(state, choice.result, { money: paid.money });
    },
    kick(state, event, choice) {
      if (roll(state) < event.kickChance) {
        say(state, choice.result);
        return;
      }
      say(state, choice.otherwise, { damage: event.kickDamage });
      passDay(state, { traveling: false });
      hurtAll(state, event.kickDamage, 'breakdown');
    },
  },

  good_weather(state, event) {
    const { days, bonusFuel, bonusMiles } = RULES.drizzle;
    state.weather = { id: 'drizzle', until: state.day + days };
    if (state.phase === 'location') {
      gain(state, 'fuel', bonusFuel);
      say(state, event.atStop, { fuel: bonusFuel });
      return;
    }
    const next = nextStop(state.distance);
    const miles = next ? Math.min(bonusMiles, next.miles - state.distance) : 0;
    say(state, event.onRoad, { miles });
    moveVan(state, miles);
  },

  bad_weather(state, event) {
    state.weather = { id: 'heat', until: state.day + RULES.heat.days };
    say(state, event.result, { damage: event.damage, days: RULES.heat.days });
    hurtAll(state, event.damage, 'heat');
  },

  found_supplies(state, event) {
    gain(state, 'food', event.food);
    gain(state, 'fuel', event.fuel);
    say(state, event.result, { food: event.food, fuel: event.fuel });
  },

  wifi_outage(state, event) {
    state.flags.wifiDownDay = state.day;
    say(state, event.result);
    hurtAll(state, state.profession === 'influencer' ? event.influencerDamage : event.damage, 'wifi');
  },

  pandemic_death: {
    kombucha(state, event, choice) {
      say(state, choice.result, { damage: event.dosedDamage });
      hurtAll(state, event.dosedDamage, 'pandemic');
    },
    quarantine(state, event, choice) {
      say(state, choice.result, { damage: event.quarantineDamage });
      for (let day = 0; day < event.quarantineDays && !state.outcome; day++) passDay(state, { traveling: false });
      hurtAll(state, event.quarantineDamage, 'pandemic');
      cure(state);
    },
    push_on(state, event, choice) {
      const crew = living(state);
      // The weakest takes the worst of it; on a tie, the first in party order.
      const worst = crew.reduce((weakest, member) => (member.health < weakest.health ? member : weakest));
      say(state, choice.result, { name: worst.name });
      for (const member of crew) {
        hurt(state, member, member === worst ? event.worstDamage : event.damage, 'pandemic');
        if (member !== worst && member.health > 0) member.sick = true;
      }
    },
  },

  ebike_convoy: {
    wait(state, event, choice) {
      const fuel = spend(state, 'fuel', event.fuel);
      healAll(state, event.heal);
      say(state, choice.result, { fuel });
    },
    honk(state, event, choice) {
      if (roll(state) < event.honkChance) {
        say(state, choice.result);
        return;
      }
      say(state, choice.otherwise, { damage: event.damage });
      hurtAll(state, event.damage, 'ebike');
    },
    trade(state, event, choice) {
      gain(state, 'money', event.tips);
      say(state, choice.result, { money: event.tips });
    },
  },

  sasquatch: {
    photo(state, event, choice) {
      const money = state.profession === 'influencer' ? event.viralPhoto : event.photo;
      gain(state, 'money', money);
      say(state, choice.result, { money });
    },
    chase(state, event, choice) {
      const victim = pick(state, living(state));
      const authenticated = roll(state) < event.nftChance;
      if (authenticated) gain(state, 'nft', 1);
      say(state, authenticated ? choice.result : choice.otherwise, { name: victim.name, damage: event.damage });
      hurt(state, victim, event.damage, 'sasquatch');
    },
    leave(state, event, choice) {
      healAll(state, event.heal);
      say(state, choice.result, { heal: event.heal });
    },
  },

  toll_troll: {
    pay(state, event, choice, paid) {
      say(state, choice.result, { money: paid.money });
    },
    riddle(state, event, choice) {
      if (roll(state) < event.riddleChance) {
        say(state, choice.result);
        return;
      }
      const money = spend(state, 'money', event.fine);
      say(state, choice.otherwise, { money, damage: event.damage });
      hurtAll(state, event.damage, 'toll');
    },
    ford(state, event, choice) {
      hurtOne(state, choice.result, event.fordDamage, 'toll');
    },
  },

  brunch_line: {
    wait(state, event, choice) {
      const fuel = spend(state, 'fuel', event.fuel);
      gain(state, 'food', event.food);
      say(state, choice.result, { fuel, food: event.food });
    },
    detour(state, event, choice) {
      say(state, choice.result, { fuel: spend(state, 'fuel', event.detourFuel) });
    },
    post(state, event, choice) {
      gain(state, 'money', event.sponsor);
      say(state, choice.result, { money: event.sponsor });
    },
  },

  petition_gauntlet: {
    sign(state, event, choice) {
      say(state, choice.result, { damage: event.damage });
      hurtAll(state, event.damage, 'petitions');
    },
    donate(state, event, choice) {
      say(state, choice.result);
    },
    call(state, event, choice) {
      say(state, choice.result);
    },
  },
};
