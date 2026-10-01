// Review evidence, 1 October 2026: play thousands of seeded journeys with
// simple bots through the real engine and count how each one ends.
// Run from the project root (optional argument: seeds per background):
//   node docs/reviews/evidence/balance.mjs 3000
import { createGame, transition } from '../../../app/src/engine.js';
import { LOCATIONS, PROFESSIONS } from '../../../app/src/data.js';

const act = (state, action) => { const result = transition(state, action); if (result.error) throw new Error(`${action.type}: ${result.error}`); return result.state; };

function play(seed, profession, policy) {
  let state = createGame({ profession, seed });
  const visited = new Set();
  let pandemic = false, otherDeaths = 0, lowest = 100, drivingDays = 0, encounters = 0;
  const dead = () => state.party.filter(member => member.status === 'Deceased').length;
  const note = (before, countDeaths = true) => {
    if (countDeaths) otherDeaths += dead() - before;
    for (const member of state.party) if (member.status !== 'Deceased') lowest = Math.min(lowest, member.health);
  };
  const shop = () => {
    if (policy.buy === 'auto') state = transition(state, { type: 'autoPurchase' }).state;
    if (policy.buy === 'seedbombs') {
      // Fuel for the rest of the route at Scenic pace, then food from seed bombs.
      const stops = LOCATIONS.filter(location => location.miles > state.distance);
      const days = stops.reduce((sum, stop, index) => sum + Math.ceil((stop.miles - (index ? stops[index - 1].miles : state.distance)) / 50), 0);
      const fuel = Math.min(Math.max(0, days * 2 + 4 - state.inventory.fuel), Math.floor(state.inventory.money / 12));
      const cart = {};
      if (fuel > 0) cart.fuel = fuel;
      const bombs = Math.min(8, Math.floor((state.inventory.money - fuel * 12) / 8));
      if (bombs > 0 && state.inventory.food + state.inventory.ammo * 8 < 60) cart.ammo = bombs;
      if (Object.keys(cart).length) state = act(state, { type: 'purchase', cart });
    }
  };
  if (policy.pace) state = act(state, { type: 'setPace', pace: policy.pace });
  shop();
  state = act(state, { type: 'depart' });
  for (let step = 0; step < 400 && !state.outcome; step++) {
    if (state.pendingEvent) {
      const id = state.pendingEvent.id;
      encounters++;
      if (id === 'pandemic_death') pandemic = true;
      const action = { type: 'resolveEvent', token: state.pendingEvent.token };
      if (id === 'nft_auction') action.choiceId = state.inventory.nft ? 'invest' : 'wait';
      if (id === 'van_breakdown') action.choiceId = state.inventory.parts >= (profession === 'dev' ? 1 : 2) ? 'repair' : 'kick';
      const before = dead();
      state = act(state, action);
      note(before, id !== 'pandemic_death');
      continue;
    }
    const location = LOCATIONS.find(item => item.id === state.locationId);
    if (state.phase === 'location') {
      if (location.activities.includes('talk') && !state.flags.talked.includes(location.id)) { state = act(state, { type: 'talk' }); continue; }
      if (policy.buy !== 'none' && location.activities.includes('shop') && !visited.has(location.id)) {
        visited.add(location.id);
        state = act(state, { type: 'openShop' }); shop(); state = act(state, { type: 'leaveShop' });
        continue;
      }
      state = act(state, { type: 'depart' });
      continue;
    }
    if (policy.buy === 'seedbombs' && state.inventory.food < 6 && state.inventory.ammo > 0) { state = act(state, { type: 'useItem', itemId: 'ammo' }); continue; }
    const before = dead();
    if (policy.useAbility) { const result = transition(state, { type: 'ability' }); if (!result.error) { state = result.state; note(before); continue; } }
    const weakest = Math.min(...state.party.filter(member => member.status !== 'Deceased').map(member => member.health));
    if (policy.restBelow && weakest < policy.restBelow && state.inventory.food >= 5) { state = act(state, { type: 'rest' }); note(before); continue; }
    const result = transition(state, { type: 'travel' });
    if (result.error) { state = act(state, { type: 'setPace', pace: 'slow' }); continue; }
    state = result.state;
    drivingDays++;
    note(before);
  }
  const last = state.journal.at(-1)?.text ?? '';
  const cause = state.outcome === 'won' ? 'won' : pandemic ? 'pandemic' : /ran dry/.test(last) ? 'fuel' : /last traveler/.test(last) ? 'died' : 'unfinished';
  return { cause, day: state.day, money: state.inventory.money, survivors: 5 - dead(), otherDeaths, lowest, drivingDays, encounters };
}

const seeds = Number(process.argv[2]) || 3000;
const policies = {
  'never shops': { buy: 'none' },
  'presses Auto-buy at every shop, never rests': { buy: 'auto' },
  'presses Auto-buy, rests under 45 health, uses the ability': { buy: 'auto', restBelow: 45, useAbility: true },
  'drives at Scenic pace, buys fuel and seed bombs, rests, uses the ability': { buy: 'seedbombs', pace: 'slow', restBelow: 45, useAbility: true },
};
for (const [label, policy] of Object.entries(policies)) {
  console.log(`\n## Bot that ${label} (${seeds} seeds per background)`);
  let otherDeaths = 0, lowest = 100, drivingDays = 0, encounters = 0;
  for (const { id } of PROFESSIONS) {
    const tally = {}; let days = 0, money = 0, survivors = 0, wins = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const run = play(seed * 7919, id, policy);
      tally[run.cause] = (tally[run.cause] ?? 0) + 1;
      otherDeaths += run.otherDeaths; lowest = Math.min(lowest, run.lowest); drivingDays += run.drivingDays; encounters += run.encounters;
      if (run.cause === 'won') { wins++; days += run.day; money += run.money; survivors += run.survivors; }
    }
    const share = key => `${((tally[key] ?? 0) / seeds * 100).toFixed(1).padStart(5)}%`;
    console.log(`${id.padEnd(10)} won ${share('won')} | pandemic ${share('pandemic')} | out of fuel ${share('fuel')} | party died ${share('died')} | winners average: day ${(days / wins || 0).toFixed(1)}, $${Math.round(money / wins || 0)} unspent, ${(survivors / wins || 0).toFixed(2)} of 5 alive`);
  }
  const journeys = seeds * PROFESSIONS.length;
  console.log(`all ${journeys} journeys: ${otherDeaths} traveler deaths from anything but the pandemic | lowest health a living traveler reached: ${lowest} | ${(drivingDays / journeys).toFixed(1)} driving days and ${(encounters / journeys).toFixed(1)} encounters per journey`);
}
