// Read-only questions about a journey. Nothing here changes the state it is given.

import { LOCATIONS, PACES, RATIONS, RULES } from '../data.js';
import { fuelFor, itemOf, living, priceOf } from './state.js';

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

/**
 * What Auto-buy would buy in this shop, without buying it. It plans for the stretch to the next
 * shop at the current pace and rations. First it buys the fuel and food that stretch needs,
 * spending the reserve if it must. Then, keeping the reserve, it tops fuel and food up to their
 * floors or to the stretch plus a buffer, and adds repair kits and kombucha. It never buys past
 * what the van holds, and never buys NFTs or seed bombs.
 * @param {import('./state.js').State} state
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
  const foodPerDay = RATIONS[state.rations].food * living(state).length;
  const needs = { fuel: stretch.fuel, food: Math.ceil(stretch.days * foodPerDay) };
  const targets = {
    fuel: Math.max(supplies.fuelFloor, stretch.fuel + supplies.bufferDays * fuelFor(pace.miles, pace)),
    food: Math.max(supplies.foodFloor, Math.ceil((stretch.days + supplies.bufferDays) * foodPerDay)),
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
