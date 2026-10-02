// The rules engine's public face. The interface imports from here and from data.js only.
// The engine has no browser globals and no I/O, and it never changes a state it is given.

export { availableActions, transition } from './engine/actions.js';
export { dailySeed, seedFromText } from './engine/random.js';
export { deserializeGame, serializeGame } from './engine/save.js';
export {
  describeAbility,
  describeItem,
  forecast,
  paceOptions,
  rationOptions,
  recommendSupplies,
  routeStops,
  shareText,
  shopItems,
  statusOf,
  summarize,
} from './engine/selectors.js';
export { SAVE_VERSION, createGame, currentStop, lastStop, nextStop, regionAt, weatherName } from './engine/state.js';
