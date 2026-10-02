// What the interface keeps in the browser (spec section 6): one save record holding the journey and the last
// leg's receipt, the best journeys, and the settings. Old saves under the legacy keys are migrated once. A save
// that cannot be read is never changed or removed. Storage that is missing or refuses to write never stops play:
// these functions report the problem and the controller shows it in the banner.

import { deserializeGame, serializeGame } from '../engine.js';

const APP = 'the-portland-trail';
const FORMAT = 2;
export const SAVE_KEY = `${APP}:save`;
export const LEGACY_SAVE_KEY = `${APP}:v1`;
export const LEGACY_LEG_KEY = `${APP}:last-leg:v1`;
const RECORDS_KEY = `${APP}:records`;
const SETTINGS_KEY = `${APP}:settings`;
const DEFAULT_SETTINGS = { sound: false };
const CODE_PREFIX = 'PT2.';
const LEG_FIELDS = ['fromDistance', 'toDistance', 'fromDay', 'toDay', 'fuelUsed', 'foodUsed'];

export const PROBLEMS = {
  unreadable:
    'This browser has a saved journey that cannot be read. It has been left as it is; a new journey will replace it.',
  unavailable: 'Browser storage is unavailable. You can still play, but this journey will not resume after you leave.',
  unsaved: 'Your browser could not save this journey. You can keep playing here, but progress may be lost.',
};

/** localStorage, or null where the browser refuses access to it. */
function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(key) {
  const storage = store();
  if (!storage) throw new Error('storage unavailable');
  return storage.getItem(key);
}

function write(key, value) {
  try {
    const storage = store();
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The last leg's receipt when it is well formed and fits the journey it belongs to; otherwise null. */
function readLeg(leg, game) {
  if (!isRecord(leg) || !game) return null;
  if (!LEG_FIELDS.every(key => Number.isFinite(leg[key]) && leg[key] >= 0)) return null;
  if (leg.toDistance < leg.fromDistance || leg.toDistance > game.distance) return null;
  if (leg.toDay < leg.fromDay || leg.toDay > game.day) return null;
  if (typeof leg.arrived !== 'string' || leg.arrived.length > 150) return null;
  return Object.fromEntries([...LEG_FIELDS, 'arrived'].map(key => [key, leg[key]]));
}

/** The journey and receipt in a save record (or in a bare state), or null when it holds no journey. */
function fromRecord(value) {
  if (isRecord(value) && value.app === APP && isRecord(value.game)) {
    const game = deserializeGame(JSON.stringify(value.game));
    return game ? { game, lastLeg: readLeg(value.ui?.lastLeg, game) } : null;
  }
  const game = isRecord(value) ? deserializeGame(JSON.stringify(value)) : null;
  return game ? { game, lastLeg: null } : null;
}

/** The save record for a journey, as text. Throws when the journey cannot be saved. */
function recordText(game, lastLeg) {
  const record = { app: APP, format: FORMAT, game: JSON.parse(serializeGame(game)), ui: { lastLeg: lastLeg ?? null } };
  return JSON.stringify(record);
}

/**
 * The saved journey. A missing record is looked for under the legacy keys, migrated, and the legacy keys are
 * removed once the new record is written. `problem` is a sentence for the banner, or null.
 * @returns {{ game: object | null, lastLeg: object | null, problem: string | null }}
 */
export function loadJourney() {
  let raw;
  try {
    raw = read(SAVE_KEY);
  } catch {
    return { game: null, lastLeg: null, problem: PROBLEMS.unavailable };
  }
  if (raw !== null) {
    const found = fromRecord(parse(raw));
    return found ? { ...found, problem: null } : { game: null, lastLeg: null, problem: PROBLEMS.unreadable };
  }

  let legacy;
  let receipt;
  try {
    legacy = read(LEGACY_SAVE_KEY);
    receipt = read(LEGACY_LEG_KEY);
  } catch {
    return { game: null, lastLeg: null, problem: PROBLEMS.unavailable };
  }
  if (legacy === null) return { game: null, lastLeg: null, problem: null };
  const game = deserializeGame(legacy);
  if (!game) return { game: null, lastLeg: null, problem: PROBLEMS.unreadable };
  // The old receipt belonged to one exact save text.
  const old = parse(receipt);
  const lastLeg = isRecord(old) && old.savedGame === legacy ? readLeg(old.leg, game) : null;
  if (!saveJourney(game, lastLeg)) return { game, lastLeg, problem: PROBLEMS.unsaved };
  try {
    store().removeItem(LEGACY_SAVE_KEY);
    store().removeItem(LEGACY_LEG_KEY);
  } catch {
    // The new record is written; stale legacy keys are ignored from now on.
  }
  return { game, lastLeg, problem: null };
}

/**
 * Save the journey and its last leg as the one save record.
 * @returns {boolean} false when the browser refused or the journey is not a valid one
 */
export function saveJourney(game, lastLeg) {
  let text;
  try {
    text = recordText(game, lastLeg);
  } catch {
    return false;
  }
  return write(SAVE_KEY, text);
}

/** The best journeys, as stored; [] when there are none or they cannot be read. */
export function readRecords() {
  try {
    const list = parse(read(RECORDS_KEY));
    return Array.isArray(list) ? list.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** @returns {boolean} */
export function writeRecords(list) {
  return write(RECORDS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

/** The settings, with defaults for anything missing. */
export function readSettings() {
  try {
    const saved = parse(read(SETTINGS_KEY));
    return {
      ...DEFAULT_SETTINGS,
      ...(isRecord(saved) && typeof saved.sound === 'boolean' ? { sound: saved.sound } : {}),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** @returns {boolean} */
export function writeSettings(settings) {
  return write(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, sound: settings?.sound === true }));
}

/** UTF-8 text as base64url, and back. */
function toBase64Url(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(
    Uint8Array.from(binary, character => character.charCodeAt(0)),
  );
}

/**
 * A code that carries the journey to another device (F13): the save record as UTF-8, base64url, prefixed PT2.
 * Throws when the journey cannot be saved.
 */
export function exportCode(game, lastLeg) {
  return CODE_PREFIX + toBase64Url(recordText(game, lastLeg));
}

/**
 * Read a code from exportCode, or the raw JSON of a save record or of a bare state.
 * @returns {{ game: object, lastLeg: object | null } | null}
 */
export function importCode(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  let json = trimmed;
  if (trimmed.startsWith(CODE_PREFIX)) {
    try {
      json = fromBase64Url(trimmed.slice(CODE_PREFIX.length));
    } catch {
      return null;
    }
  }
  return fromRecord(parse(json));
}
