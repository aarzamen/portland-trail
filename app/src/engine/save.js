// Saved journeys. A save is read field by field into a fresh version 3 state: what is unknown is
// dropped, what is missing takes its default, and what is inconsistent is repaired where the
// journey can go on. Only a save that cannot be a journey at all is rejected. Writing uses the
// same reading: a state is valid exactly when it reads back unchanged.

import { DEATHS, EVENTS, LIMITS, LOCATIONS, PACES, RATIONS, REFUSALS, RULES, WEATHER } from '../data.js';
import { mix32 } from './random.js';
import {
  MAX_HEALTH,
  PARTY_SIZE,
  RESOURCE_IDS,
  SAVE_VERSION,
  cleanEpitaph,
  cleanName,
  clearWeather,
  isRecord,
  newFlags,
  professionById,
  roundFood,
  stopAt,
} from './state.js';

/** @typedef {import('./state.js').State} State */

const PHASES = ['shop', 'location', 'travel', 'ended'];
const STOP_IDS = new Set(LOCATIONS.map(stop => stop.id));
const EVENT_IDS = new Set(EVENTS.map(event => event.id));
// The weather as versions 1 and 2 stored it: by its display text of the time.
const LEGACY_WEATHER = { 'Perfect drizzle': 'drizzle', Heatwave: 'heat' };

const whole = value => Number.isSafeInteger(value);
const wholeFrom = (value, least) => whole(value) && value >= least;
const uint32 = value => (wholeFrom(value, 0) && value <= 0xffffffff ? value : null);
const listed = (table, id) => typeof id === 'string' && Object.hasOwn(table, id);

/** Supplies, or null when any is missing, negative or not a number. Amounts above `max` are kept. */
function readInventory(saved) {
  if (!isRecord(saved)) return null;
  const inventory = {};
  for (const id of RESOURCE_IDS) {
    const amount = saved[id];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
    inventory[id] = id === 'food' ? roundFood(amount) : Math.floor(amount);
  }
  return inventory;
}

/**
 * When and where a traveler died. A missing or impossible detail takes the journey's own, and a
 * death is never later than the journey's day.
 */
function readDeath(saved, journey) {
  const death = isRecord(saved) ? saved : {};
  const onTheRoute = wholeFrom(death.mile, 0) && death.mile <= RULES.goalMiles;
  return {
    day: wholeFrom(death.day, 1) ? Math.min(death.day, journey.day) : journey.day,
    mile: onTheRoute ? death.mile : journey.distance,
    cause: listed(DEATHS, death.cause) ? death.cause : 'unknown',
  };
}

/** One traveler, or null without a valid name and health. The dead have a death; the living do not. */
function readTraveler(saved, index, journey) {
  if (!isRecord(saved)) return null;
  const name = cleanName(saved.name);
  const { health } = saved;
  if (name === null || !wholeFrom(health, 0) || health > MAX_HEALTH) return null;
  const id = `traveler_${index + 1}`;
  if (health > 0) return { id, name, health, sick: saved.sick === true, death: null, epitaph: '' };
  const death = readDeath(saved.death, journey);
  const epitaph = cleanEpitaph(saved.epitaph) ?? DEATHS[death.cause].epitaph;
  return { id, name, health, sick: false, death, epitaph };
}

function readWeather(saved) {
  const known = isRecord(saved) && listed(WEATHER, saved.id) && wholeFrom(saved.until, 0);
  return known ? { id: saved.id, until: saved.until } : clearWeather();
}

function readPending(saved) {
  const known = isRecord(saved) && EVENT_IDS.has(saved.id) && wholeFrom(saved.token, 1);
  return known ? { id: saved.id, token: saved.token } : null;
}

/**
 * Every well-formed journal line, oldest first: at most LIMITS.journalLine characters, and never
 * dated after the journey's day.
 */
function readJournal(saved, day) {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter(entry => isRecord(entry) && wholeFrom(entry.day, 1) && typeof entry.text === 'string')
    .map(entry => ({
      day: Math.min(entry.day, day),
      text: [...entry.text].slice(0, LIMITS.journalLine).join(''),
    }));
}

function readFlags(saved) {
  const flags = isRecord(saved) ? saved : {};
  const fresh = newFlags();
  const stops = list => (Array.isArray(list) ? [...new Set(list.filter(id => STOP_IDS.has(id)))] : []);
  return {
    nextToken: wholeFrom(flags.nextToken, 0) ? flags.nextToken : fresh.nextToken,
    lastAbilityDay: whole(flags.lastAbilityDay) ? flags.lastAbilityDay : fresh.lastAbilityDay,
    wifiDownDay: whole(flags.wifiDownDay) ? flags.wifiDownDay : fresh.wifiDownDay,
    talked: stops(flags.talked),
    meals: stops(flags.meals),
    luggageTraded: flags.luggageTraded === true,
  };
}

/** Make the parts of a journey agree with each other, the way the rules would have left them. */
function repair(state) {
  const alive = state.party.some(member => member.health > 0);
  if (!alive) state.outcome = 'lost';
  else if (state.phase === 'ended' && !state.outcome) state.outcome = 'lost';
  else if (!state.outcome && state.distance >= RULES.goalMiles) state.outcome = 'won';
  if (state.outcome) {
    state.phase = 'ended';
    state.pendingEvent = null;
  }
  if (state.outcome === 'won') state.distance = RULES.goalMiles;

  // A shop is only ever open at a stop that has one, and never while an encounter is pending.
  const stop = stopAt(state.distance);
  const stopped = state.phase === 'shop' || state.phase === 'location';
  if (stopped && !stop) state.phase = 'travel';
  else if (state.phase === 'shop' && (!stop.activities.includes('shop') || state.pendingEvent)) {
    state.phase = 'location';
  }

  if (state.pendingEvent) state.flags.nextToken = Math.max(state.flags.nextToken, state.pendingEvent.token);
}

/**
 * Read a version 3 save into a fresh, consistent state. Null when it cannot be a journey: no five
 * travelers with valid names and health, an unknown background, pace or rations, supplies that
 * are negative or not numbers, a distance off the route, or a day before the first.
 * @param {any} saved
 * @returns {State | null}
 */
function rebuild(saved) {
  if (!isRecord(saved) || saved.version !== SAVE_VERSION) return null;
  if (!professionById(saved.profession) || !listed(PACES, saved.pace) || !listed(RATIONS, saved.rations)) return null;
  if (!wholeFrom(saved.distance, 0) || saved.distance > RULES.goalMiles || !wholeFrom(saved.day, 1)) return null;
  const inventory = readInventory(saved.inventory);
  if (!inventory || !Array.isArray(saved.party) || saved.party.length !== PARTY_SIZE) return null;
  const party = saved.party.map((member, index) => readTraveler(member, index, saved));
  if (party.includes(null)) return null;

  const journal = readJournal(saved.journal, saved.day);
  const seed = uint32(saved.seed) ?? uint32(saved.rng) ?? 0;
  const state = /** @type {State} */ ({
    version: SAVE_VERSION,
    seed,
    rng: uint32(saved.rng) ?? mix32(seed),
    profession: saved.profession,
    party,
    inventory,
    phase: PHASES.includes(saved.phase) ? saved.phase : 'travel',
    distance: saved.distance,
    day: saved.day,
    pace: saved.pace,
    rations: saved.rations,
    weather: readWeather(saved.weather),
    pendingEvent: readPending(saved.pendingEvent),
    journal: journal.slice(-RULES.journalLimit),
    logged: Math.max(journal.length, whole(saved.logged) ? saved.logged : 0),
    outcome: saved.outcome === 'won' || saved.outcome === 'lost' ? saved.outcome : null,
    flags: readFlags(saved.flags),
  });
  repair(state);
  return state;
}

/**
 * Put a version 1 or 2 save into the version 3 shape, for `rebuild` to read. Those versions kept
 * a status text for each traveler and the weather as its display text, and they had no seed: the
 * journey's seed becomes the saved generator state. `rebuild` does the rest: it drops the stop
 * ids those versions stored, counts the journal's lines, gives the dead their deaths (at the
 * saved day and mile, of an unknown cause) and fills in the flags that did not exist yet.
 */
function upgrade(old) {
  const upgradeTraveler = member => {
    if (!isRecord(member)) return member;
    const dead = member.status === 'Deceased' || member.health === 0;
    return { ...member, health: dead ? 0 : member.health, sick: member.status === 'Sick' };
  };
  return {
    ...old,
    version: SAVE_VERSION,
    seed: old.rng,
    party: Array.isArray(old.party) ? old.party.map(upgradeTraveler) : old.party,
    weather: { id: listed(LEGACY_WEATHER, old.weather) ? LEGACY_WEATHER[old.weather] : 'clear', until: old.day },
  };
}

/** True when two pieces of plain data hold the same values, whatever the order of their keys. */
function same(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}

/**
 * Write a journey as text.
 * @param {State} state
 * @returns {string}
 * @throws {Error} when the state is not a valid journey: one that would not read back unchanged
 */
export function serializeGame(state) {
  const sound = rebuild(state);
  if (!sound || !same(sound, state)) throw new Error(REFUSALS.save);
  return JSON.stringify(sound);
}

/**
 * Read a journey saved by version 1, 2 or 3. Never throws.
 * @param {string} raw
 * @returns {State | null} null when the text is not a journey
 */
export function deserializeGame(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const saved = JSON.parse(raw);
    if (!isRecord(saved)) return null;
    if (saved.version === SAVE_VERSION) return rebuild(saved);
    return saved.version === 1 || saved.version === 2 ? rebuild(upgrade(saved)) : null;
  } catch {
    return null;
  }
}
