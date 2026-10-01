// Review evidence, 1 October 2026: one short reproduction per rules finding.
// Each section prints what the engine does today. Run from the project root:
//   node docs/reviews/evidence/scenarios.mjs
import { readFileSync } from 'node:fs';
import { createGame, transition } from '../../../app/src/engine.js';
import { LOCATIONS, ITEMS, PACES } from '../../../app/src/data.js';

const names = ['Kale', 'Juniper', 'Rowan', 'Birch', 'Echo'];
const act = (state, action) => { const result = transition(state, action); if (result.error) throw new Error(`${action.type}: ${result.error}`); return result.state; };
const attempt = (state, action) => transition(state, action);
const at = (id, extra = {}) => {
  const place = LOCATIONS.find(location => location.id === id);
  const base = act(createGame({ profession: 'dev', names, seed: 5 }), { type: 'depart' });
  return { ...base, phase: 'location', locationId: id, distance: place.miles, ...extra };
};
const resolve = state => {
  const { id, token } = state.pendingEvent;
  return act(state, { type: 'resolveEvent', token, ...(id === 'nft_auction' ? { choiceId: 'wait' } : id === 'van_breakdown' ? { choiceId: 'kick' } : {}) });
};
const section = title => console.log(`\n=== ${title} ===`);

section('B2. Empty tank at a shop stop: "Keep driving" (depart), then Drive');
{
  let state = at('sketchy_motel', { inventory: { money: 900, food: 40, fuel: 0, ammo: 0, parts: 0, kombucha: 0, nft: 0 } });
  console.log('travel straight from the stop ->', attempt(state, { type: 'travel' }).error);
  state = act(state, { type: 'depart' });
  console.log('after depart: phase', state.phase, '| openShop ->', attempt(state, { type: 'openShop' }).error);
  const ended = attempt(state, { type: 'travel' }).state;
  console.log(`then travel -> outcome ${ended.outcome}, cash still held $${ended.inventory.money} | ${ended.journal.at(-1).text}`);
}

section('B3. Stop activity limits vanish after a free depart; a rest stop heals no more than the shoulder');
{
  const stop = at('mushroom_market');
  console.log('at Mushroom Market: rest ->', attempt(stop, { type: 'rest' }).error, '| forage ->', attempt(stop, { type: 'forage' }).error);
  const road = act(stop, { type: 'depart' });
  console.log(`after depart (still day ${road.day}, mile ${road.distance}): rest ->`, attempt(road, { type: 'rest' }).error ?? 'allowed', '| forage ->', attempt(road, { type: 'forage' }).error ?? 'allowed');
  const tired = state => ({ ...state, party: state.party.map(member => ({ ...member, health: 50, status: 'Injured' })) });
  console.log('resting at the Rest Stop heals 50 ->', act(tired(at('first_stop')), { type: 'rest' }).party[0].health, '| resting on the road heals 50 ->', act(tired(road), { type: 'rest' }).party[0].health);
  console.log('engine allows the background ability at a stop:', attempt(at('first_stop'), { type: 'ability' }).error ?? 'yes (the interface hides the button there)');
}

section('B4. Seed bombs against kale chips');
{
  const food = ITEMS.find(item => item.id === 'food'), bombs = ITEMS.find(item => item.id === 'ammo');
  let state = act(createGame({ profession: 'influencer', names, seed: 5 }), { type: 'purchase', cart: { ammo: 10 } });
  state = act(state, { type: 'depart' });
  const before = { day: state.day, food: state.inventory.food, health: state.party.map(member => member.health).join() };
  for (let i = 0; i < 10; i++) state = act(state, { type: 'useItem', itemId: 'ammo' });
  const gained = state.inventory.food - before.food;
  console.log(`$${bombs.price * 10} of seed bombs -> +${gained} food, ${state.day - before.day} days used, health unchanged: ${state.party.map(member => member.health).join() === before.health}`);
  console.log(`the same food as kale chips costs $${gained * food.price} ($${bombs.price / 8} per food against $${food.price})`);
}

section('B5. Weather never returns to Clear');
{
  let state = act(createGame({ profession: 'dev', names, seed: 3 }), { type: 'depart' });
  state = { ...state, inventory: { ...state.inventory, food: 400 }, flags: { ...state.flags, nextToken: 1 }, pendingEvent: { id: 'bad_weather', token: 1 } };
  state = act(state, { type: 'resolveEvent', token: 1 });
  const seen = new Set([state.weather]);
  for (let i = 0; i < 12; i++) { state = act(state, { type: 'rest' }); seen.add(state.weather); }
  console.log(`weather values seen over the next 12 days: ${[...seen].join(', ')} (now day ${state.day})`);
}

section('B6. A traveler dies without a journal line');
{
  let state = act(createGame({ profession: 'dev', names, seed: 5 }), { type: 'depart' });
  state = { ...state, party: state.party.map((member, index) => index === 0 ? { ...member, health: 5, status: 'Sick' } : member) };
  const before = state.journal.length;
  state = act(state, { type: 'forage' });
  console.log(`${state.party[0].name} is now ${state.party[0].status}. Journal lines added:`, state.journal.slice(before).map(entry => entry.text));
}

section('B8. Journal order on arrival and on victory (oldest first)');
{
  let state = act(createGame({ profession: 'dev', names, seed: 1000 }), { type: 'depart' });
  state = act({ ...state, distance: 60, inventory: { ...state.inventory, fuel: 40 } }, { type: 'travel' });
  console.log('arrival:', state.journal.slice(-2).map(entry => entry.text));
  let won = act(createGame({ profession: 'dev', names, seed: 1000 }), { type: 'depart' });
  won = act({ ...won, distance: 950, locationId: 'bookshop', inventory: { ...won.inventory, fuel: 40 } }, { type: 'travel' });
  console.log('victory:', won.journal.slice(-2).map(entry => entry.text));
}

section('B14. Status is the last kind of damage, not a health band, and nothing reads it');
{
  let state = act(createGame({ profession: 'prepper', names, seed: 5 }), { type: 'depart' });
  state = act(state, { type: 'ability' });
  console.log('after scouting (-3 health):', state.party.slice(0, 2).map(member => `${member.health} ${member.status}`).join(' | '));
  state = { ...state, party: state.party.map((member, index) => index === 0 ? { ...member, health: 40, status: 'Sick' } : member) };
  state = act(state, { type: 'rest' });
  console.log('after one rest:            ', state.party.slice(0, 2).map(member => `${member.health} ${member.status}`).join(' | '));
  const source = readFileSync(new URL('../../../app/src/engine.js', import.meta.url), 'utf8');
  console.log("engine checks of status === 'Sick' or 'Injured':", source.match(/status === '(Sick|Injured)'/g)?.length ?? 0);
}

section('B15. An error message exposes an internal id');
console.log(attempt(act(createGame({ profession: 'influencer', names, seed: 5 }), { type: 'depart' }), { type: 'useItem', itemId: 'ammo' }).error);

section('D4. Fuel is charged per day, not per mile');
{
  for (const pace of Object.keys(PACES)) {
    let state = act(createGame({ profession: 'dev', names, seed: 1000 }), { type: 'purchase', cart: { fuel: 40 } });
    state = act(act(state, { type: 'setPace', pace }), { type: 'depart' });
    const fuel = state.inventory.fuel; let days = 0;
    while (state.distance < 100) { if (state.pendingEvent) { state = resolve(state); continue; } state = act(state, { type: 'travel' }); days++; }
    console.log(`${PACES[pace].name.padEnd(9)} first 100 miles: ${days} day(s), ${fuel - state.inventory.fuel} fuel`);
  }
  const legs = LOCATIONS.slice(1).map((location, index) => location.miles - LOCATIONS[index].miles);
  for (const pace of Object.values(PACES)) {
    const days = legs.reduce((sum, leg) => sum + Math.ceil(leg / pace.miles), 0);
    console.log(`${pace.name.padEnd(9)} whole route:     ${days} days, ${days * pace.fuel} fuel ($${days * pace.fuel * 12}), ${days * 2.5} food at Meager`);
  }
}

section('A3. The event table is positional');
console.log(readFileSync(new URL('../../../app/src/engine.js', import.meta.url), 'utf8').split('\n').find(line => line.includes('EVENTS[8]')).trim());
