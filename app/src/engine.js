import { DEFAULT_NAMES, EVENTS, ITEMS, LOCATIONS, PACES, PROFESSIONS, RATIONS } from './data.js';

const RESOURCE_IDS = ['money', 'food', 'fuel', 'ammo', 'parts', 'kombucha', 'nft'];
const STATUSES = ['Healthy', 'Sick', 'Injured', 'Deceased'];
const EVENT_BY_ID = new Map(EVENTS.map(event => [event.id, event]));
const LOCATION_BY_ID = new Map(LOCATIONS.map(location => [location.id, location]));
const ITEM_BY_ID = new Map(ITEMS.map(item => [item.id, item]));
const fail = (state, error) => ({ state, error });
const done = state => ({ state, error: null });
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = value => finite(value) && value >= 0;
const integer = value => Number.isSafeInteger(value);
const has = (record, key) => typeof key === 'string' && Object.hasOwn(record, key);
const exactKeys = (record, keys) => record && typeof record === 'object' && !Array.isArray(record) &&
  Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key));

function roll(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function log(state, text) {
  state.journal.push({ day: state.day, text });
  if (state.journal.length > 120) state.journal.shift();
}

function living(state) {
  return state.party.filter(member => member.status !== 'Deceased');
}

function hurt(member, amount, status = 'Injured') {
  if (member.status === 'Deceased') return;
  member.health = Math.max(0, member.health - amount);
  member.status = member.health === 0 ? 'Deceased' : status;
}

function heal(member, amount) {
  if (member.status === 'Deceased') return;
  member.health = Math.min(100, member.health + amount);
  if (member.health >= 65) member.status = 'Healthy';
}

function finish(state) {
  if (state.outcome) return;
  if (living(state).length === 0) {
    state.phase = 'ended';
    state.outcome = 'lost';
    state.pendingEvent = null;
    log(state, 'The last traveler fell. The road to Portland ends here.');
  } else if (state.distance >= 1000) {
    state.distance = 1000;
    state.locationId = 'portland';
    state.phase = 'ended';
    state.outcome = 'won';
    state.pendingEvent = null;
    log(state, 'Portland at last. The van and its survivors roll into town.');
  }
}

function consumeDay(state, { fuel = 0 } = {}) {
  state.day += 1;
  state.inventory.fuel -= fuel;
  const need = RATIONS[state.rations].food * living(state).length;
  const eaten = Math.min(need, state.inventory.food);
  state.inventory.food = Math.round((state.inventory.food - eaten) * 100) / 100;
  if (eaten < need) {
    state.party.forEach(member => hurt(member, 9, 'Sick'));
    log(state, 'The party ran short of food. Everyone living loses 9 health.');
  } else if (state.rations === 'bare') {
    state.party.forEach(member => hurt(member, 3, 'Sick'));
  } else if (state.rations === 'filling') {
    state.party.forEach(member => heal(member, 1));
  }
}

function nextLocation(distance) {
  return LOCATIONS.find(location => location.miles > distance);
}

function advance(state, miles) {
  const next = nextLocation(state.distance);
  state.phase = 'travel';
  state.distance = Math.min(1000, next?.miles ?? 1000, state.distance + miles);
  if (next && state.distance === next.miles) {
    state.locationId = next.id;
    if (next.id !== 'portland') {
      state.phase = 'location';
      log(state, `Arrived at ${next.name}.`);
    }
  }
  finish(state);
}

function chooseEvent(state) {
  if (state.outcome || roll(state) >= 0.25) return;
  const number = roll(state);
  const event = number < 0.018 ? EVENTS[8] : EVENTS[Math.floor((number - 0.018) / 0.982 * 8) % 8];
  state.flags.nextToken += 1;
  state.pendingEvent = { id: event.id, token: state.flags.nextToken };
  log(state, event.title);
}

export function createGame({ profession, names = DEFAULT_NAMES, seed = Date.now() } = {}) {
  const background = PROFESSIONS.find(item => item.id === profession);
  if (!background) throw new Error('Choose one of the four backgrounds.');
  if (!Array.isArray(names) || names.length !== 5 || names.some(name => typeof name !== 'string' || !name.trim() || name.trim().length > 32)) {
    throw new Error('Enter five names of 1–32 characters.');
  }
  if (!integer(seed)) throw new Error('The journey seed must be an integer.');
  const state = {
    version: 1, phase: 'shop', profession,
    party: names.map((name, index) => ({ id: `traveler_${index + 1}`, name: name.trim(), health: 100, status: 'Healthy' })),
    inventory: { ...background.inventory }, locationId: 'start_city', distance: 0, day: 1,
    weather: 'Clear', pace: 'normal', rations: 'meager', pendingEvent: null,
    rng: seed >>> 0, journal: [{ day: 1, text: 'Five travelers pack the van for Portland.' }],
    outcome: null, shopReturn: 'start_city',
    flags: { nextToken: 0, lastAbilityDay: -99, talked: [], wifiDownDay: -1 },
  };
  return state;
}

function locationAllows(state, activity) {
  return state.phase === 'location' && LOCATION_BY_ID.get(state.locationId)?.activities.includes(activity);
}

function resolveEvent(state, action) {
  const pending = state.pendingEvent;
  if (!pending || action.token !== pending.token) return 'This encounter is no longer pending.';
  const event = EVENT_BY_ID.get(pending.id);
  if (event.type === 'choice' && !event.choices.some(choice => choice.id === action.choiceId)) return 'Choose one of the available responses.';
  if (event.type !== 'choice' && action.choiceId !== undefined) return 'This encounter has no choices.';
  if (event.id === 'van_breakdown' && action.choiceId === 'repair' && state.inventory.parts < (state.profession === 'dev' ? 1 : 2)) {
    return 'You need more repair parts. Try another response.';
  }
  if (event.id === 'nft_auction' && action.choiceId === 'invest' && state.inventory.nft < 1) return 'You need an NFT to trade.';

  state.pendingEvent = null;
  let result;
  switch (event.id) {
    case 'tiktok_distraction': {
      const survivors = living(state);
      const victim = survivors[Math.floor(roll(state) * survivors.length)];
      hurt(victim, 8, 'Sick');
      result = `${victim.name} lost 8 health to doomscrolling.`;
      break;
    }
    case 'nft_auction':
      if (action.choiceId === 'invest') {
        state.inventory.nft -= 1;
        const winnings = roll(state) < 0.4 ? 220 : 15;
        state.inventory.money += winnings;
        result = `The JPEG sold for $${winnings}.`;
      } else {
        result = 'You waited out the fair with performative cynicism.';
      }
      break;
    case 'food_poisoning': {
      const survivors = living(state);
      const victim = survivors[Math.floor(roll(state) * survivors.length)];
      hurt(victim, 26, 'Sick');
      result = `${victim.name} lost 26 health to mystery berries.`;
      break;
    }
    case 'van_breakdown':
      if (action.choiceId === 'repair') {
        const used = state.profession === 'dev' ? 1 : 2;
        state.inventory.parts -= used;
        result = `The van runs again after ${used} repair ${used === 1 ? 'part' : 'parts'}.`;
      } else if (roll(state) < 0.45) {
        result = 'A gentle kick worked. Nobody understands why.';
      } else {
        consumeDay(state);
        state.party.forEach(member => hurt(member, 5));
        result = 'The kick cost a day and 5 health per survivor.';
      }
      break;
    case 'good_weather':
      state.weather = 'Perfect drizzle';
      if (state.phase === 'location') {
        state.inventory.fuel += 2;
        result = 'Arriving early saved 2 fuel before the next stretch.';
      } else {
        result = 'Clear roads add 20 miles.';
        advance(state, 20);
      }
      break;
    case 'bad_weather':
      state.weather = 'Heatwave';
      state.party.forEach(member => hurt(member, 6));
      result = 'The heatwave costs every survivor 6 health.';
      break;
    case 'found_supplies':
      state.inventory.food += 8;
      state.inventory.fuel += 2;
      result = 'The free box held 8 food and 2 fuel.';
      break;
    case 'wifi_outage':
      state.flags.wifiDownDay = state.day;
      state.party.forEach(member => hurt(member, state.profession === 'influencer' ? 8 : 3, 'Sick'));
      result = 'The Wi-Fi outage drained the party’s spirit.';
      break;
    case 'pandemic_death':
      state.party.forEach(member => { member.health = 0; member.status = 'Deceased'; });
      result = 'The entire party succumbed. The journey ends.';
      break;
  }
  log(state, result);
  finish(state);
  return null;
}

export function transition(state, action) {
  if (!state || typeof action !== 'object' || !action || typeof action.type !== 'string') return fail(state, 'Choose a valid action.');
  if (state.outcome) return fail(state, 'This journey has ended. Start a new one to play again.');
  if (state.pendingEvent && action.type !== 'resolveEvent') return fail(state, 'Resolve the current encounter first.');
  if (!state.pendingEvent && action.type === 'resolveEvent') return fail(state, 'There is no encounter to resolve.');
  const next = structuredClone(state);
  switch (action.type) {
    case 'depart':
      if (next.phase !== 'location' && !(next.phase === 'shop' && next.locationId === 'start_city')) return fail(state, 'Leave the current stop before departing.');
      next.phase = 'travel';
      log(next, next.locationId === 'start_city' ? 'The van pulls away from the artist co-op.' : 'The van rolls back onto the road.');
      break;
    case 'setPace':
      if (!has(PACES, action.pace) || !['travel', 'location', 'shop'].includes(next.phase)) return fail(state, 'Choose a listed travel pace.');
      next.pace = action.pace;
      break;
    case 'setRations':
      if (!has(RATIONS, action.rations) || !['travel', 'location', 'shop'].includes(next.phase)) return fail(state, 'Choose a listed ration size.');
      next.rations = action.rations;
      break;
    case 'travel': {
      if (!['travel', 'location'].includes(next.phase) || next.locationId === 'portland') return fail(state, 'Leave the shop or finish your stop before traveling.');
      const pace = PACES[next.pace];
      if (next.inventory.fuel < pace.fuel) {
        if (next.inventory.fuel >= PACES.slow.fuel) return fail(state, 'Not enough fuel for this pace. Choose Scenic or buy fuel.');
        if (next.phase === 'location' && LOCATION_BY_ID.get(next.locationId).activities.includes('shop')) return fail(state, 'Not enough fuel. Visit the shop before leaving.');
        next.phase = 'ended';
        next.outcome = 'lost';
        log(next, 'The van ran dry with no way to reach the next stop.');
        return done(next);
      }
      next.phase = 'travel';
      consumeDay(next, { fuel: pace.fuel });
      if (living(next).length === 0) {
        finish(next);
        return done(next);
      }
      advance(next, pace.miles);
      log(next, `Traveled to mile ${next.distance}.`);
      chooseEvent(next);
      break;
    }
    case 'openShop':
      if (!locationAllows(next, 'shop')) return fail(state, 'There is no shop at this stop.');
      next.shopReturn = next.locationId;
      next.phase = 'shop';
      break;
    case 'leaveShop':
      if (next.phase !== 'shop') return fail(state, 'You are not in a shop.');
      next.phase = 'location';
      next.locationId = next.shopReturn;
      break;
    case 'purchase': {
      if (next.phase !== 'shop' || !action.cart || typeof action.cart !== 'object' || Array.isArray(action.cart)) return fail(state, 'Enter a valid shop order.');
      const entries = Object.entries(action.cart);
      if (entries.length === 0 || entries.some(([id, quantity]) => !ITEM_BY_ID.has(id) || !integer(quantity) || quantity < 0 || quantity > 1000) || !entries.some(([, quantity]) => quantity > 0)) return fail(state, 'Use whole, nonnegative quantities for listed items.');
      const cost = entries.reduce((sum, [id, quantity]) => sum + ITEM_BY_ID.get(id).price * quantity, 0);
      if (cost > next.inventory.money) return fail(state, `You need $${cost}; you have $${next.inventory.money}.`);
      next.inventory.money -= cost;
      entries.forEach(([id, quantity]) => { next.inventory[id] += quantity; });
      log(next, `Bought supplies for $${cost}.`);
      break;
    }
    case 'rest':
      if (next.phase !== 'travel' && !locationAllows(next, 'rest')) return fail(state, 'You cannot rest here.');
      consumeDay(next);
      next.party.forEach(member => heal(member, 6));
      log(next, 'The party rested for a day. Survivors recovered 6 health.');
      finish(next);
      break;
    case 'forage': {
      if (next.phase !== 'travel' && !locationAllows(next, 'forage')) return fail(state, 'There is nowhere to forage here.');
      consumeDay(next);
      next.party.forEach(member => hurt(member, 7));
      const food = 8 + Math.floor(roll(next) * 5) + (next.profession === 'prepper' ? 4 : 0);
      next.inventory.food += food;
      log(next, `Foraged ${food} food, at a cost of 7 health per survivor.`);
      finish(next);
      break;
    }
    case 'talk':
      if (!locationAllows(next, 'talk')) return fail(state, 'No one here has a story to tell.');
      if (next.flags.talked.includes(next.locationId)) return fail(state, 'You have already spoken to everyone here.');
      next.flags.talked.push(next.locationId);
      if (next.locationId === 'viral_landmark') {
        next.inventory.money += 65;
        log(next, 'A tourist buys your authentic road photos for $65.');
      } else {
        next.inventory.fuel += 3;
        log(next, 'A crypto founder pays you 3 fuel to listen to a pitch.');
      }
      break;
    case 'useItem':
      if (!['ammo', 'kombucha', 'nft'].includes(action.itemId) || (action.itemId === 'nft' ? next.phase !== 'shop' : !['travel', 'location'].includes(next.phase))) return fail(state, 'This item cannot be used here.');
      if (next.inventory[action.itemId] < 1) return fail(state, `You have no ${action.itemId} to use.`);
      next.inventory[action.itemId] -= 1;
      if (action.itemId === 'nft') {
        next.inventory.money += 50;
        log(next, 'Sold a Pixelated Sasquatch JPEG for $50.');
      } else if (action.itemId === 'ammo') {
        next.inventory.food += 8;
        log(next, 'Seed bombs produced 8 food from a roadside patch.');
      } else {
        next.party.forEach(member => heal(member, 10));
        log(next, 'Kombucha restored 10 health to every survivor.');
      }
      break;
    case 'ability': {
      if (!['travel', 'location'].includes(next.phase)) return fail(state, 'Your ability is for the road, not the checkout.');
      const cooldown = next.profession === 'barista' ? 1 : 4;
      if (next.day - next.flags.lastAbilityDay < cooldown) return fail(state, 'Your ability is still recovering.');
      switch (next.profession) {
        case 'influencer':
          if (next.flags.wifiDownDay === next.day) return fail(state, 'The Wi-Fi outage blocks your collab today.');
          next.inventory.money += 45;
          next.inventory.food += 2;
          log(next, 'A brand collab paid $45 and 2 food.');
          break;
        case 'dev':
          next.inventory.parts += 2;
          log(next, 'Salvaged 2 repair parts from discarded gadgets.');
          break;
        case 'prepper':
          next.inventory.food += 6;
          next.party.forEach(member => hurt(member, 3));
          log(next, 'Scouted 6 food; each survivor lost 3 health.');
          break;
        case 'barista':
          if (next.inventory.food < 1) return fail(state, 'Brewing coffee needs 1 food.');
          next.inventory.food -= 1;
          next.party.forEach(member => heal(member, 5));
          log(next, 'A careful brew restored 5 health to every survivor.');
          break;
      }
      next.flags.lastAbilityDay = next.day;
      finish(next);
      break;
    }
    case 'resolveEvent': {
      const error = resolveEvent(next, action);
      if (error) return fail(state, error);
      break;
    }
    default:
      return fail(state, 'Choose a valid action.');
  }
  return done(next);
}

function validState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1) return false;
  if (!exactKeys(state, ['version', 'phase', 'profession', 'party', 'inventory', 'locationId', 'distance', 'day', 'weather', 'pace', 'rations', 'pendingEvent', 'rng', 'journal', 'outcome', 'shopReturn', 'flags'])) return false;
  if (!['shop', 'travel', 'location', 'ended'].includes(state.phase) || !PROFESSIONS.some(p => p.id === state.profession)) return false;
  if (!Array.isArray(state.party) || state.party.length !== 5 || state.party.some((member, index) => !exactKeys(member, ['id', 'name', 'health', 'status']) || member.id !== `traveler_${index + 1}` || typeof member.name !== 'string' || !member.name.trim() || member.name.length > 32 || !integer(member.health) || member.health < 0 || member.health > 100 || !STATUSES.includes(member.status) || ((member.health === 0) !== (member.status === 'Deceased')))) return false;
  if (state.outcome !== 'lost' && state.party.every(member => member.status === 'Deceased')) return false;
  if (!exactKeys(state.inventory, RESOURCE_IDS) || RESOURCE_IDS.some(id => !nonnegative(state.inventory[id]) || (id !== 'food' && !integer(state.inventory[id])))) return false;
  if (!LOCATION_BY_ID.has(state.locationId) || !integer(state.distance) || state.distance < 0 || state.distance > 1000 || !integer(state.day) || state.day < 1 || typeof state.weather !== 'string' || state.weather.length > 50) return false;
  if (!has(PACES, state.pace) || !has(RATIONS, state.rations) || !integer(state.rng) || state.rng < 0 || state.rng > 0xffffffff) return false;
  if (state.pendingEvent !== null && (!exactKeys(state.pendingEvent, ['id', 'token']) || !EVENT_BY_ID.has(state.pendingEvent.id) || !integer(state.pendingEvent.token) || state.pendingEvent.token < 1 || state.pendingEvent.token !== state.flags?.nextToken || state.phase === 'shop')) return false;
  if (!Array.isArray(state.journal) || state.journal.length > 120 || state.journal.some(entry => !exactKeys(entry, ['day', 'text']) || !integer(entry.day) || entry.day < 1 || entry.day > state.day || typeof entry.text !== 'string' || entry.text.length > 300)) return false;
  if (![null, 'won', 'lost'].includes(state.outcome) || (state.phase === 'ended') !== (state.outcome !== null) || (state.outcome === 'won' && state.distance !== 1000) || (state.outcome && state.pendingEvent)) return false;
  if (!LOCATION_BY_ID.has(state.shopReturn) || !exactKeys(state.flags, ['nextToken', 'lastAbilityDay', 'talked', 'wifiDownDay']) || !integer(state.flags.nextToken) || state.flags.nextToken < 0 || !integer(state.flags.lastAbilityDay) || !integer(state.flags.wifiDownDay) || !Array.isArray(state.flags.talked) || state.flags.talked.some(id => !LOCATION_BY_ID.has(id))) return false;
  const location = LOCATION_BY_ID.get(state.locationId);
  if (state.distance < location.miles || (state.phase === 'location' && state.distance !== location.miles)) return false;
  if (state.locationId !== [...LOCATIONS].reverse().find(stop => stop.miles <= state.distance)?.id) return false;
  if (state.phase === 'shop' && (state.locationId !== state.shopReturn || !location.activities.includes('shop') || state.distance !== location.miles)) return false;
  if (state.distance === 1000 && state.outcome !== 'won') return false;
  if (state.locationId === 'portland' && state.outcome !== 'won') return false;
  return true;
}

export function serializeGame(state) {
  if (!validState(state)) throw new Error('Cannot save an invalid journey.');
  return JSON.stringify(state);
}

export function deserializeGame(raw) {
  try {
    const state = JSON.parse(raw);
    return validState(state) ? state : null;
  } catch {
    return null;
  }
}
