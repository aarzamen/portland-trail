// The journey's state and the few functions that are allowed to change it: the journal, health,
// supplies, the passing of a day and the movement of the van. Every rule that costs health or a
// day goes through here, so each is written once.

import {
  DEATHS,
  DEFAULT_NAMES,
  ITEMS,
  JOURNAL,
  LIMITS,
  LOCATIONS,
  PACES,
  PROFESSIONS,
  RATIONS,
  REFUSALS,
  REGIONS,
  RULES,
  WEATHER,
} from '../data.js';

/**
 * @typedef {Object} Traveler
 * @property {string} id         'traveler_1' … 'traveler_5'
 * @property {string} name       1–32 characters, trimmed
 * @property {number} health     integer 0–100; 0 means dead
 * @property {boolean} sick
 * @property {null | { day: number, mile: number, cause: string }} death
 * @property {string} epitaph    '' while alive; at most 60 characters
 *
 * @typedef {Object} State
 * @property {3} version
 * @property {number} seed       uint32 the journey started from; never changes
 * @property {number} rng        uint32 generator state
 * @property {'influencer'|'dev'|'prepper'|'barista'} profession
 * @property {Traveler[]} party  exactly five
 * @property {{money: number, food: number, fuel: number, ammo: number, parts: number, kombucha: number,
 *   nft: number}} inventory     food may have two decimals; the rest are whole numbers
 * @property {'shop'|'location'|'travel'|'ended'} phase
 * @property {number} distance   integer 0–1000; a stop's mile in phases shop and location
 * @property {number} day        integer, starts at 1
 * @property {'slow'|'normal'|'fast'} pace
 * @property {'bare'|'meager'|'filling'} rations
 * @property {{ id: 'clear'|'drizzle'|'heat', until: number }} weather   lasts through day `until`
 * @property {null | { id: string, token: number }} pendingEvent
 * @property {{ day: number, text: string }[]} journal   newest last, at most RULES.journalLimit
 * @property {number} logged     total journal lines ever written
 * @property {null|'won'|'lost'} outcome
 * @property {{ nextToken: number, lastAbilityDay: number, wifiDownDay: number, talked: string[],
 *   meals: string[], luggageTraded: boolean }} flags
 */

export const SAVE_VERSION = 3;
export const PARTY_SIZE = 5;
export const MAX_HEALTH = 100;
export const RESOURCE_IDS = ['money', 'food', 'fuel', 'ammo', 'parts', 'kombucha', 'nft'];

const ITEM_BY_ID = new Map(ITEMS.map(item => [item.id, item]));
const PROFESSION_BY_ID = new Map(PROFESSIONS.map(profession => [profession.id, profession]));
// Unprintable characters: they would break a name plate or a headstone.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** The item with this id, or undefined: cash and unknown ids are not items. */
export const itemOf = id => ITEM_BY_ID.get(id);

/** The background with this id, or undefined. */
export const professionById = id => PROFESSION_BY_ID.get(id);

/** The journey's background. */
export const professionOf = state => PROFESSION_BY_ID.get(state.profession);

/** True for a plain object: what a state, an action or a cart has to be. */
export const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// --- Text ------------------------------------------------------------------

/**
 * Fill a template's {slots} from `values`. A slot written {one|many} takes its word from the
 * number filled just before it. A slot that has no value is left as written.
 * @param {string} template
 * @param {Record<string, unknown>} [values]
 * @returns {string}
 */
export function fill(template, values = {}) {
  let count;
  return template.replace(/\{([^{}]+)\}/g, (slot, key) => {
    if (key.includes('|')) {
      const [one, many] = key.split('|');
      return count === 1 ? one : many;
    }
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    if (value === undefined) return slot;
    if (typeof value === 'number') count = value;
    return String(value);
  });
}

/** A traveler's name as it is stored, or null when the text cannot be a name. */
export function cleanName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= LIMITS.name ? trimmed : null;
}

/** An epitaph as it is stored, or null when the text cannot be one. */
export function cleanEpitaph(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  const fits = trimmed.length >= 1 && trimmed.length <= LIMITS.epitaph;
  return fits && !CONTROL_CHARACTERS.test(trimmed) ? trimmed : null;
}

// --- A new journey ---------------------------------------------------------

/** The flags a journey starts with; also the defaults for flags a save does not have. */
export const newFlags = () => ({
  nextToken: 0,
  lastAbilityDay: -99,
  wifiDownDay: -1,
  talked: [],
  meals: [],
  luggageTraded: false,
});

/**
 * Clear skies. `until` only means something while the weather is not clear.
 * @returns {State['weather']}
 */
export const clearWeather = () => ({ id: 'clear', until: 0 });

/**
 * Start a journey in the shop at mile 0.
 * @param {{ profession: string, names?: string[], seed: number }} options
 *   `seed` is a whole number; it is stored as a uint32.
 * @returns {State}
 * @throws {Error} with a sentence for the player, on an unknown background, bad names or a bad seed
 */
export function createGame({ profession, names = DEFAULT_NAMES, seed } = /** @type {any} */ ({})) {
  const background = PROFESSION_BY_ID.get(profession);
  if (!background) throw new Error(REFUSALS.background);
  const cleaned = Array.isArray(names) ? names.map(cleanName) : [];
  if (cleaned.length !== PARTY_SIZE || cleaned.includes(null)) {
    throw new Error(fill(REFUSALS.names, { max: LIMITS.name }));
  }
  if (!Number.isSafeInteger(seed)) throw new Error(REFUSALS.seed);
  const start = seed >>> 0;
  return {
    version: SAVE_VERSION,
    seed: start,
    rng: start,
    profession: /** @type {State['profession']} */ (profession),
    party: cleaned.map((name, index) => ({
      id: `traveler_${index + 1}`,
      name,
      health: MAX_HEALTH,
      sick: false,
      death: null,
      epitaph: '',
    })),
    inventory: { ...background.inventory },
    phase: 'shop',
    distance: 0,
    day: 1,
    pace: 'normal',
    rations: 'meager',
    weather: clearWeather(),
    pendingEvent: null,
    journal: [{ day: 1, text: JOURNAL.start }],
    logged: 1,
    outcome: null,
    flags: newFlags(),
  };
}

// --- The journal -----------------------------------------------------------

/** Write a line in the journal, dropping the oldest line once the journal is full. */
export function log(state, text) {
  state.journal.push({ day: state.day, text });
  state.logged += 1;
  const extra = state.journal.length - RULES.journalLimit;
  if (extra > 0) state.journal.splice(0, extra);
}

/** Write a filled template in the journal. */
export function say(state, template, values) {
  log(state, fill(template, values));
}

// --- The crew --------------------------------------------------------------

/** The travelers who are still alive. */
export const living = state => state.party.filter(member => member.health > 0);

/**
 * Take health from a living traveler, for a cause listed in DEATHS. At 0 the traveler dies: the
 * death is recorded, the sickness ends, the default epitaph is set and the journal says so (B6).
 */
export function hurt(state, member, amount, cause) {
  if (member.health === 0 || amount <= 0) return;
  member.health = Math.max(0, member.health - amount);
  if (member.health > 0) return;
  member.sick = false;
  member.death = { day: state.day, mile: state.distance, cause };
  member.epitaph = DEATHS[cause].epitaph;
  say(state, DEATHS[cause].line, { name: member.name });
}

/** Take health from every living traveler. */
export function hurtAll(state, amount, cause) {
  for (const member of living(state)) hurt(state, member, amount, cause);
}

/** Give health to every living traveler. The dead are never healed. */
export function healAll(state, amount) {
  for (const member of living(state)) member.health = Math.min(MAX_HEALTH, member.health + amount);
}

/** End every traveler's sickness. */
export function cure(state) {
  for (const member of state.party) member.sick = false;
}

// --- Supplies --------------------------------------------------------------

// Food is kept to two decimals so that a saved journey reads back exactly.
const tidy = (id, amount) => (id === 'food' ? Math.round(amount * 100) / 100 : amount);

/**
 * Add to a supply. A gain never lifts an item above what the van holds, and never lowers a stock
 * that is already above it (old saves). Cash has no limit.
 */
export function gain(state, id, amount) {
  const have = state.inventory[id];
  const ceiling = Math.max(have, itemOf(id)?.max ?? Infinity);
  state.inventory[id] = tidy(id, Math.min(ceiling, have + amount));
}

/** Take up to `amount` of a supply and return what was actually taken. */
export function spend(state, id, amount) {
  const taken = Math.min(amount, state.inventory[id]);
  state.inventory[id] = tidy(id, state.inventory[id] - taken);
  return taken;
}

// --- Stops and regions -----------------------------------------------------

/** The stop at exactly this mile, or null. */
export const stopAt = distance => LOCATIONS.find(stop => stop.miles === distance) ?? null;

/** The stop the van is at in phases `shop` and `location`; null on the road and after the end. */
export function currentStop(state) {
  return state.phase === 'shop' || state.phase === 'location' ? stopAt(state.distance) : null;
}

/** The latest stop at or before this mile. */
export function lastStop(distance) {
  return LOCATIONS.findLast(stop => stop.miles <= distance);
}

/** The first stop after this mile; undefined at the end of the road. */
export function nextStop(distance) {
  return LOCATIONS.find(stop => stop.miles > distance);
}

/** The stretch of road this mile belongs to. */
export function regionAt(distance) {
  return REGIONS.find(region => distance < region.to) ?? REGIONS[REGIONS.length - 1];
}

/** True when the van is stopped (not in the shop) at a stop that offers this activity. */
export function stopOffers(state, activity) {
  return state.phase === 'location' && Boolean(currentStop(state)?.activities.includes(activity));
}

/** What one of an item costs where the van is: a stop may have its own prices. */
export function priceOf(state, id) {
  return currentStop(state)?.prices?.[id] ?? itemOf(id).price;
}

// --- Weather ---------------------------------------------------------------

/** The weather a given day has: weather other than clear lasts through day `until`. */
export function weatherOn(state, day) {
  return day > state.weather.until ? 'clear' : state.weather.id;
}

/** The weather's name for display. */
export function weatherName(state) {
  return WEATHER[state.weather.id];
}

/** True on the day of a Wi-Fi outage: whatever needs a signal has to wait until tomorrow. */
export const wifiDown = state => state.flags.wifiDownDay === state.day;

// --- Days ------------------------------------------------------------------

/** End the journey if it is over: lost when nobody is alive, won at the goal with a survivor. */
export function finish(state) {
  if (state.outcome) return;
  const lost = living(state).length === 0;
  if (!lost && state.distance < RULES.goalMiles) return;
  if (!lost) state.distance = RULES.goalMiles;
  state.phase = 'ended';
  state.outcome = lost ? 'lost' : 'won';
  state.pendingEvent = null;
  log(state, lost ? JOURNAL.lost : JOURNAL.won);
}

/**
 * Let one day pass. This is the only way a day passes. In order: the weather may clear, the crew
 * eats (or starves), the road wears on a driving day, drizzle soothes, sickness bites, and the
 * journey is lost if nobody is left.
 * @param {State} state
 * @param {{ traveling: boolean }} options
 */
export function passDay(state, { traveling }) {
  state.day += 1;
  if (state.weather.id !== 'clear' && weatherOn(state, state.day) === 'clear') {
    state.weather = clearWeather();
    log(state, JOURNAL.weatherClears);
  }
  const heat = state.weather.id === 'heat';
  const ration = RATIONS[state.rations];
  const need = tidy('food', ration.food * living(state).length * (heat ? RULES.heat.foodMultiplier : 1));
  if (spend(state, 'food', need) < need) {
    say(state, JOURNAL.shortFood, { damage: RULES.starvationDamage });
    hurtAll(state, RULES.starvationDamage, 'starvation');
  } else if (ration.health < 0) {
    hurtAll(state, -ration.health, 'rations');
  } else {
    healAll(state, ration.health);
  }
  if (traveling) {
    hurtAll(state, PACES[state.pace].wear, 'road');
    if (heat) hurtAll(state, RULES.heat.travelDamage, 'heat');
  }
  if (state.weather.id === 'drizzle') healAll(state, RULES.drizzle.heal);
  for (const member of living(state)) {
    if (member.sick) hurt(state, member, RULES.sickDamage, 'illness');
  }
  finish(state);
}

// --- Driving ---------------------------------------------------------------

/** The fuel that driving this many miles burns at a pace: fuel follows miles (D4). */
export const fuelFor = (miles, pace) => Math.ceil(miles / pace.milesPerFuel);

/**
 * What a drive would do right now: the miles the van would cover and the fuel it would burn.
 * The drive happens on the day after today, so that day's weather sets the limit: drizzle holds
 * the van to Steady's miles, which only slows Floor it (F8). A dry tank covers 0 miles.
 * @param {State} state
 * @returns {{ miles: number, fuel: number }}
 */
export function drivePlan(state) {
  const pace = PACES[state.pace];
  const next = nextStop(state.distance);
  const drizzle = weatherOn(state, state.day + 1) === 'drizzle';
  const cap = drizzle ? Math.min(pace.miles, PACES.normal.miles) : pace.miles;
  const away = next ? next.miles - state.distance : 0;
  const reach = Math.floor(state.inventory.fuel * pace.milesPerFuel);
  const miles = Math.min(cap, away, reach);
  return { miles, fuel: fuelFor(miles, pace) };
}

/**
 * Move the van toward the next stop, never past it, and write one line for it, in this order of
 * preference (B8): the win line, the arrival line, or the road line given. Arriving sets the
 * phase to `location`; otherwise the van is on the road.
 * @param {State} state
 * @param {number} miles
 * @param {string} [roadLine] a template with {miles} and {distance}
 */
export function moveVan(state, miles, roadLine) {
  const next = nextStop(state.distance);
  const moved = next ? Math.min(miles, next.miles - state.distance) : 0;
  state.distance += moved;
  const arrived = Boolean(next) && state.distance === next.miles;
  state.phase = arrived ? 'location' : 'travel';
  finish(state);
  if (state.outcome) return;
  if (arrived) say(state, JOURNAL.arrived, { stop: next.name });
  else if (roadLine) say(state, roadLine, { miles: moved, distance: state.distance });
}
