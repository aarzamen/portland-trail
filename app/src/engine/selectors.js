// Read-only questions about a journey. Nothing here changes the state it is given.

import { DEATHS, EVENTS, ITEMS, LIMITS, LOCATIONS, PACES, RANKS, RATIONS, RULES } from '../data.js';
import {
  MAX_HEALTH,
  PARTY_SIZE,
  drivePlan,
  fill,
  fuelFor,
  itemOf,
  living,
  nextStop,
  passDay,
  priceOf,
  professionById,
  roundFood,
} from './state.js';

/**
 * @typedef {import('./state.js').State} State
 * @typedef {import('./state.js').Traveler} Traveler
 *
 * @typedef {{ id: string, name: string, shortName: string, away: number, days: number, fuel: number }} StopAhead
 *
 * @typedef {Object} Forecast
 * @property {{ miles: number, fuel: number }} today   what Drive would do now (0 miles with a dry tank)
 * @property {number} range          miles the current fuel covers at the current pace
 * @property {number} healthPerDay   change per healthy traveler for one driving day now
 * @property {number} foodPerDay     food one driving day now eats
 * @property {null | StopAhead} nextStop
 * @property {null | (StopAhead & { food: number })} nextShop   null when no shop lies ahead
 * @property {{ fuel: number, food: number }} shortfall
 *   what is missing to reach the next shop (or Portland when no shop lies ahead); 0 when enough
 *
 * @typedef {Object} ShopItem
 * @property {string} id
 * @property {string} name
 * @property {string} description   from describeItem
 * @property {string} unit
 * @property {number} price         at this stop
 * @property {number} owned
 * @property {number} max
 * @property {number} canBuy        most that fits and can be afforded right now
 *
 * @typedef {Object} Summary
 * @property {null|'won'|'lost'} outcome
 * @property {number} score
 * @property {{ title: string, line: string }} rank
 * @property {string} heading       the ending's headline; '' for a journey still under way
 * @property {string} cause         how a lost journey ended, as a sentence; '' otherwise
 * @property {{ name: string, health: number }[]} survivors
 * @property {{ id: string, name: string, day: number, mile: number, line: string, epitaph: string }[]} fallen
 *   in the order they fell
 * @property {number} day
 * @property {number} distance
 * @property {number} money
 * @property {number} rentDays
 * @property {number} seed
 * @property {string} professionName
 */

// The sentences these functions write. The numbers in them all come from slots.
const TEXT = {
  status: { dead: 'Deceased', sick: 'Sick', good: 'Healthy', worn: 'Worn down', bad: 'Hanging on' },
  pace: '{name} · {miles} mi a day · {fuel} fuel · {health} health',
  rations: '{name} · {food} food each · {health} health',
  everyoneArrived: 'All five made it to Portland.',
  someArrived: '{survivors} of five made it to Portland.',
  lost: 'The road won this round.',
  fellNear: '{line} near mile {distance}.',
  ranDry: 'The van ran dry near mile {distance}.',
  share:
    'The Portland Trail: {profession}, {ending}, {survivors} of {crew} alive, ' +
    '${money} ({rentDays} {day|days} of rent). {rank}, score {score}. Seed {seed}.',
  reached: 'reached Portland on day {day}',
  fell: 'fell at mile {distance} on day {day}',
  underway: 'on the road at mile {distance} on day {day}',
  rip: ' RIP {name}: “{epitaph}”',
};

/** A change in health as it is shown: +2, −4 (with a true minus sign). */
const signed = amount => (amount < 0 ? `−${-amount}` : `+${amount}`);

// --- The road ahead ----------------------------------------------------------

/** The days and fuel one leg takes at a pace: full days, then a short last day (D4). */
function legCost(miles, pace) {
  const fullDays = Math.floor(miles / pace.miles);
  const lastDay = miles % pace.miles;
  return {
    days: fullDays + (lastDay > 0 ? 1 : 0),
    fuel: fullDays * fuelFor(pace.miles, pace) + fuelFor(lastDay, pace),
  };
}

/**
 * The drive from where the van is to the next shop, or to Portland when no shop is left. Every
 * drive ends at a stop, so the stretch is added up leg by leg.
 */
function stretchAhead(state) {
  const pace = PACES[state.pace];
  const stretch = { days: 0, fuel: 0, destination: null };
  let from = state.distance;
  for (const stop of LOCATIONS) {
    if (stop.miles <= from) continue;
    const leg = legCost(stop.miles - from, pace);
    stretch.days += leg.days;
    stretch.fuel += leg.fuel;
    stretch.destination = stop;
    from = stop.miles;
    if (stop.activities.includes('shop')) break;
  }
  return stretch;
}

/** The food the living crew eats in a day at the current rations, before any heat. */
const dailyFood = state => RATIONS[state.rations].food * living(state).length;

/** The whole food a number of days at the current rations needs. */
const foodFor = (state, days) => Math.ceil(days * dailyFood(state));

// --- Auto-buy ----------------------------------------------------------------

/**
 * What Auto-buy would buy in this shop, without buying it. It plans for the stretch to the next
 * shop at the current pace and rations. First it buys the fuel and food that stretch needs,
 * spending the reserve if it must. Then, keeping the reserve, it tops fuel and food up to their
 * floors or to the stretch plus a buffer, and adds repair kits and kombucha. It never buys past
 * what the van holds, and never buys NFTs or seed bombs.
 * @param {State} state
 * @returns {{ cart: Record<string, number>, cost: number, remainingCash: number, complete: boolean,
 *   nextShopName: string | null, travelDays: number, fuelNeed: number }}
 *   `complete` is true when the van will hold everything the plan aims for.
 */
export function recommendSupplies(state) {
  const money = state?.inventory?.money ?? 0;
  if (!state || state.phase !== 'shop' || state.outcome || state.pendingEvent) {
    return {
      cart: {},
      cost: 0,
      remainingCash: money,
      complete: false,
      nextShopName: null,
      travelDays: 0,
      fuelNeed: 0,
    };
  }
  const { supplies } = RULES;
  const pace = PACES[state.pace];
  const stretch = stretchAhead(state);
  const needs = { fuel: stretch.fuel, food: foodFor(state, stretch.days) };
  const targets = {
    fuel: Math.max(supplies.fuelFloor, stretch.fuel + supplies.bufferDays * fuelFor(pace.miles, pace)),
    food: Math.max(supplies.foodFloor, foodFor(state, stretch.days + supplies.bufferDays)),
    parts: supplies.parts,
    kombucha: supplies.kombucha,
  };

  const cart = {};
  let cash = money;
  const stock = id => state.inventory[id] + (cart[id] ?? 0);
  const room = id => Math.floor(itemOf(id).max - stock(id));
  const buy = (id, goal, reserve) => {
    const price = priceOf(state, id);
    const wanted = Math.min(Math.ceil(goal - stock(id)), room(id));
    const quantity = Math.min(wanted, Math.floor(Math.max(0, cash - reserve) / price));
    if (quantity <= 0) return;
    cart[id] = (cart[id] ?? 0) + quantity;
    cash -= quantity * price;
  };
  for (const id of Object.keys(needs)) buy(id, needs[id], 0);
  for (const id of Object.keys(targets)) buy(id, targets[id], supplies.reserveCash);

  return {
    cart,
    cost: money - cash,
    remainingCash: cash,
    complete: Object.keys(targets).every(id => stock(id) >= targets[id] || room(id) < 1),
    nextShopName: stretch.destination?.shortName ?? null,
    travelDays: stretch.days,
    fuelNeed: stretch.fuel,
  };
}

// --- Forecast ----------------------------------------------------------------

// A healthy traveler's health for a trial day: far enough from 0 and 100 that no change is clipped.
const TRIAL_HEALTH = MAX_HEALTH / 2;
// Food enough that a trial day eats all it needs.
const PLENTY = 1e6;

/**
 * Let one driving day pass on a copy of the journey, with `food` in the van, and measure what it
 * did to a healthy traveler and to the food. Using passDay itself keeps the forecast from ever
 * disagreeing with the day it forecasts.
 */
function trialDay(state, food) {
  const trial = {
    ...state,
    party: state.party.map(member => ({ ...member })),
    inventory: { ...state.inventory, food },
    weather: { ...state.weather },
    journal: [],
  };
  const probe = living(trial)[0];
  if (!probe) return { health: 0, food: 0 };
  probe.health = TRIAL_HEALTH;
  probe.sick = false;
  passDay(trial, { traveling: true });
  return { health: probe.health - TRIAL_HEALTH, food: roundFood(food - trial.inventory.food) };
}

/** Where a stop is from the van. */
const ahead = (state, stop) => ({
  id: stop.id,
  name: stop.name,
  shortName: stop.shortName,
  away: stop.miles - state.distance,
});

/**
 * What the next drive and the road ahead hold at the current pace and rations.
 * @param {State} state
 * @returns {Forecast}
 */
export function forecast(state) {
  const pace = PACES[state.pace];
  const next = nextStop(state.distance);
  const stretch = stretchAhead(state);
  const food = foodFor(state, stretch.days);
  const shop = stretch.destination?.activities.includes('shop') ? stretch.destination : null;
  return {
    today: drivePlan(state),
    range: Math.floor(state.inventory.fuel * pace.milesPerFuel),
    healthPerDay: trialDay(state, state.inventory.food).health,
    foodPerDay: trialDay(state, PLENTY).food,
    nextStop: next ? { ...ahead(state, next), ...legCost(next.miles - state.distance, pace) } : null,
    nextShop: shop ? { ...ahead(state, shop), days: stretch.days, fuel: stretch.fuel, food } : null,
    shortfall: {
      fuel: Math.max(0, stretch.fuel - state.inventory.fuel),
      food: Math.max(0, Math.ceil(roundFood(food - state.inventory.food))),
    },
  };
}

// --- The crew, the shop and the settings -------------------------------------

/**
 * How a traveler is doing, in one word for the crew list: Deceased; else Sick; else by health.
 * @param {Pick<Traveler, 'health' | 'sick'>} member
 * @returns {{ id: 'dead'|'sick'|'good'|'worn'|'bad', label: string }}
 */
export function statusOf(member) {
  const { good, worn } = RULES.healthBands;
  let id;
  if (member.health <= 0) id = 'dead';
  else if (member.sick) id = 'sick';
  else if (member.health >= good) id = 'good';
  else if (member.health >= worn) id = 'worn';
  else id = 'bad';
  return { id, label: TEXT.status[id] };
}

/**
 * One row per item for the shop the van is in; an empty list anywhere else. `canBuy` is the most
 * of an item that fits in the van and can be paid for now: exactly what a purchase would accept.
 * @param {State} state
 * @returns {ShopItem[]}
 */
export function shopItems(state) {
  if (state.phase !== 'shop') return [];
  const { money } = state.inventory;
  return ITEMS.map(item => {
    const price = priceOf(state, item.id);
    const owned = state.inventory[item.id];
    const fits = Math.floor(item.max - owned);
    const affordable = Math.floor(money / price);
    return {
      id: item.id,
      name: item.name,
      description: describeItem(item.id),
      unit: item.unit,
      price,
      owned,
      max: item.max,
      canBuy: Math.max(0, Math.min(fits, affordable, LIMITS.order)),
    };
  });
}

/**
 * The three paces, each labelled with its miles, fuel and wear for a day (D4).
 * @param {State} state
 * @returns {{ id: string, label: string, selected: boolean }[]}
 */
export function paceOptions(state) {
  return Object.entries(PACES).map(([id, pace]) => ({
    id,
    label: fill(TEXT.pace, {
      name: pace.name,
      miles: pace.miles,
      fuel: fuelFor(pace.miles, pace),
      health: signed(-pace.wear),
    }),
    selected: state.pace === id,
  }));
}

/**
 * The three ration sizes, each labelled with its food and health for a day.
 * @param {State} state
 * @returns {{ id: string, label: string, selected: boolean }[]}
 */
export function rationOptions(state) {
  return Object.entries(RATIONS).map(([id, rations]) => ({
    id,
    label: fill(TEXT.rations, { name: rations.name, food: rations.food, health: signed(rations.health) }),
    selected: state.rations === id,
  }));
}

// --- The ending --------------------------------------------------------------

/** The travelers who died, in the order they fell, with their death line and epitaph. */
function fallenOf(state) {
  return state.party
    .filter(member => member.health <= 0)
    .map(member => {
      const death = member.death ?? { day: state.day, mile: state.distance, cause: 'unknown' };
      const words = DEATHS[death.cause] ?? DEATHS.unknown;
      return {
        id: member.id,
        name: member.name,
        day: death.day,
        mile: death.mile,
        line: fill(words.line, { name: member.name }),
        epitaph: member.epitaph,
      };
    })
    .sort((first, second) => first.day - second.day || first.mile - second.mile);
}

/** The score of spec 3.9: a win scores its survivors, their health, cash and speed; anything else its miles. */
function scoreOf(state, survivors) {
  const { score, parDay } = RULES;
  if (state.outcome !== 'won') return Math.floor(state.distance / score.lossMilesPerPoint);
  const health = survivors.reduce((sum, member) => sum + member.health, 0);
  const mean = survivors.length > 0 ? health / survivors.length : 0;
  const pace = (parDay - state.day) * (state.day <= parDay ? score.earlyDay : score.lateDay);
  const total =
    survivors.length * score.survivor +
    Math.round(mean) +
    Math.floor(state.inventory.money / score.cashPerPoint) +
    pace;
  return Math.max(score.survivor, total);
}

/** The first rank that matches: a win by score, anything else by miles. */
function rankOf(state, score) {
  const rank =
    state.outcome === 'won'
      ? (RANKS.won.find(entry => score >= entry.min) ?? RANKS.won.at(-1))
      : (RANKS.lost.find(entry => state.distance >= entry.minMiles) ?? RANKS.lost.at(-1));
  return { title: rank.title, line: rank.line };
}

/** The ending's headline and, for a loss, how it happened (B18). */
function endingOf(state, survivors, fallen) {
  if (state.outcome === 'won') {
    const heading =
      survivors.length === PARTY_SIZE ? TEXT.everyoneArrived : fill(TEXT.someArrived, { survivors: survivors.length });
    return { heading, cause: '' };
  }
  if (state.outcome !== 'lost') return { heading: '', cause: '' };
  // A journey lost with someone still alive is an old save that ended on an empty tank.
  const last = fallen.at(-1);
  const cause =
    survivors.length > 0 || !last
      ? fill(TEXT.ranDry, { distance: state.distance })
      : fill(TEXT.fellNear, { line: last.line.replace(/\.$/, ''), distance: state.distance });
  return { heading: TEXT.lost, cause };
}

/**
 * How the journey went: score, rank, headline and the fallen (F4). A journey still under way is
 * scored as a loss would be, so every win outranks it.
 * @param {State} state
 * @returns {Summary}
 */
export function summarize(state) {
  const survivors = living(state);
  const fallen = fallenOf(state);
  const score = scoreOf(state, survivors);
  const { money } = state.inventory;
  return {
    outcome: state.outcome,
    score,
    rank: rankOf(state, score),
    ...endingOf(state, survivors, fallen),
    survivors: survivors.map(member => ({ name: member.name, health: member.health })),
    fallen,
    day: state.day,
    distance: state.distance,
    money,
    rentDays: Math.floor(money / RULES.rentPerDay),
    seed: state.seed,
    professionName: professionById(state.profession)?.name ?? '',
  };
}

/**
 * The journey in one line to copy or share, with a line of remembrance for each of the fallen.
 * @param {State} state
 * @returns {string}
 */
export function shareText(state) {
  const summary = summarize(state);
  const where = { day: summary.day, distance: summary.distance };
  const ending = { won: TEXT.reached, lost: TEXT.fell }[summary.outcome] ?? TEXT.underway;
  const line = fill(TEXT.share, {
    profession: summary.professionName,
    ending: fill(ending, where),
    survivors: summary.survivors.length,
    crew: PARTY_SIZE,
    money: summary.money,
    rentDays: summary.rentDays,
    rank: summary.rank.title,
    score: summary.score,
    seed: summary.seed,
  });
  return line + summary.fallen.map(member => fill(TEXT.rip, member)).join('');
}

// --- Descriptions ------------------------------------------------------------

/** What a breakdown repair takes from a background without a cheaper repair. */
function standardRepairCost() {
  const breakdown = EVENTS.find(event => event.id === 'van_breakdown');
  const amount = breakdown.choices.find(choice => choice.id === 'repair').needs.parts;
  return typeof amount === 'string' ? breakdown[amount] : amount;
}

/**
 * A background's ability, as a sentence built from its numbers. '' for an unknown background.
 * @param {string} professionId
 * @returns {string}
 */
export function describeAbility(professionId) {
  const ability = professionById(professionId)?.ability;
  if (!ability) return '';
  return fill(ability.text, {
    ...ability,
    standardCost: standardRepairCost(),
    forageBonus: RULES.forage.prepperBonus,
  });
}

/**
 * What an item does, as a sentence built from its numbers. '' for cash or an unknown id.
 * @param {string} itemId
 * @returns {string}
 */
export function describeItem(itemId) {
  const item = itemOf(itemId);
  if (!item) return '';
  const [low, high] = item.yield ?? [];
  // The fuel text speaks of a Steady pace.
  return fill(item.text, { ...item, low, high, milesPerFuel: PACES.normal.milesPerFuel });
}
