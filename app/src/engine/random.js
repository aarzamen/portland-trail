// The journey's random numbers. The generator's state is part of the saved journey, so a reload
// can never re-roll an encounter.

const RANGE = 4294967296; // 2 ** 32

/** Advance the journey's generator and return a number from 0 up to, but not including, 1. */
export function roll(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / RANGE;
}

/** Roll a whole number from `min` to `max`, both included. */
export function rollBetween(state, [min, max]) {
  return min + Math.floor(roll(state) * (max - min + 1));
}

/** Pick one entry of a list that is not empty. */
export function pick(state, list) {
  return list[Math.floor(roll(state) * list.length)];
}

/** Pick one entry of a list that is not empty, each as likely as its `weight`. */
export function pickWeighted(state, list) {
  const total = list.reduce((sum, entry) => sum + entry.weight, 0);
  let mark = roll(state) * total;
  for (const entry of list) {
    mark -= entry.weight;
    if (mark < 0) return entry;
  }
  return list[list.length - 1];
}

/**
 * Turn what a player typed into a seed. Digits are taken as the number itself, modulo 2 ** 32;
 * anything else is hashed (32-bit FNV-1a over the trimmed text as UTF-8).
 * @param {string} text
 * @returns {number} a whole number from 0 to 2 ** 32 - 1
 */
export function seedFromText(text) {
  const trimmed = String(text ?? '').trim();
  if (/^[0-9]+$/.test(trimmed)) {
    let seed = 0;
    for (const digit of trimmed) seed = (seed * 10 + Number(digit)) % RANGE;
    return seed;
  }
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(trimmed)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * The seed everyone shares on one calendar day, in local time.
 * @param {Date} [date]
 * @returns {number}
 */
export function dailySeed(date = new Date()) {
  const two = value => String(value).padStart(2, '0');
  return seedFromText(`portland-trail-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`);
}
