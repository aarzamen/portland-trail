// Review evidence, 1 October 2026: random-action fuzz of the rules engine.
// The engine must never throw, never mutate its input, and every state it
// produces must survive a save round trip. Run from the project root:
//   node docs/reviews/evidence/fuzz.mjs
import assert from 'node:assert/strict';
import { createGame, transition, serializeGame, deserializeGame, recommendSupplies } from '../../../app/src/engine.js';
import { PROFESSIONS, ITEMS, EVENTS, PACES, RATIONS } from '../../../app/src/data.js';

let s = 12345;
const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
const pick = list => list[Math.floor(rnd() * list.length)];
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

function randomAction(state) {
  const types = ['travel', 'travel', 'travel', 'travel', 'depart', 'setPace', 'setRations', 'openShop', 'leaveShop', 'purchase', 'autoPurchase', 'rest', 'forage', 'talk', 'useItem', 'ability', 'resolveEvent', 'bogus'];
  const type = state.pendingEvent && rnd() < 0.85 ? 'resolveEvent' : pick(types);
  switch (type) {
    case 'setPace': return { type, pace: pick([...Object.keys(PACES), 'constructor', undefined]) };
    case 'setRations': return { type, rations: pick([...Object.keys(RATIONS), '__proto__']) };
    case 'purchase': return { type, cart: { [pick([...ITEMS.map(item => item.id), 'money'])]: pick([0, 1, 1, 2, 5, 10, 40, -1, 1.5, 1001]) } };
    case 'useItem': return { type, itemId: pick(['ammo', 'kombucha', 'nft', 'food', undefined]) };
    case 'resolveEvent': {
      const event = EVENTS.find(item => item.id === state.pendingEvent?.id);
      const action = { type, token: rnd() < 0.9 ? state.pendingEvent?.token : 999 };
      if (event?.type === 'choice' && rnd() < 0.95) action.choiceId = pick(event.choices).id;
      if (event?.type !== 'choice' && rnd() < 0.05) action.choiceId = 'bogus';
      return action;
    }
    default: return { type };
  }
}

const stats = { runs: 0, actions: 0, accepted: 0, rejected: 0, outcomes: {}, problems: new Map() };
const problem = (key, detail) => { if (!stats.problems.has(key)) stats.problems.set(key, { count: 0, first: detail }); stats.problems.get(key).count++; };

for (let run = 0; run < 4000; run++) {
  let state = createGame({ profession: pick(PROFESSIONS).id, seed: Math.floor(rnd() * 2 ** 32) });
  stats.runs++;
  for (let step = 0; step < 400 && !state.outcome; step++) {
    const action = randomAction(state);
    deepFreeze(state);
    let result;
    try { result = transition(state, action); } catch (error) { problem(`THROW ${action.type}: ${error.message}`, { action, phase: state.phase }); break; }
    stats.actions++;
    if (result.error) {
      stats.rejected++;
      if (result.state !== state) problem(`rejected action returned a different state (${action.type})`, action);
      continue;
    }
    stats.accepted++;
    const next = result.state;
    let roundTrip = null;
    try { roundTrip = deserializeGame(serializeGame(next)); } catch (error) { problem(`UNSAVEABLE after ${action.type}: ${error.message}`, { action, phase: next.phase, distance: next.distance }); }
    if (roundTrip) { try { assert.deepEqual(roundTrip, next); } catch { problem(`round trip differs after ${action.type}`, action); } }
    if (next.distance < state.distance) problem('distance went backwards', action);
    if (next.day < state.day) problem('day went backwards', action);
    for (const [id, value] of Object.entries(next.inventory)) if (!(value >= 0)) problem(`negative or NaN inventory: ${id}`, { action, value });
    for (const member of next.party) if (!(member.health >= 0 && member.health <= 100)) problem('health out of range', member);
    for (const [index, member] of next.party.entries()) if (state.party[index].status === 'Deceased' && member.status !== 'Deceased') problem('a dead traveler came back', action);
    if (next.phase === 'shop') { try { recommendSupplies(next); } catch (error) { problem(`recommendSupplies threw: ${error.message}`, action); } }
    state = next;
  }
  const key = state.outcome ?? `unfinished (${state.phase})`;
  stats.outcomes[key] = (stats.outcomes[key] ?? 0) + 1;
}
console.log(JSON.stringify({ ...stats, problems: Object.fromEntries(stats.problems) }, null, 2));
process.exitCode = stats.problems.size ? 1 : 0;
