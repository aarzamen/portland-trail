import test from 'node:test';
import assert from 'node:assert/strict';
import { availableActions, createGame, routeStops, transition } from '../src/engine.js';
import { LOCATIONS, RULES } from '../src/data.js';

const start = () => createGame({ profession: 'dev', seed: 21 });
const at = (phase, distance) => ({ ...start(), phase, distance });

test('the route lists every stop in order with its names and miles', () => {
  const stops = routeStops(start());
  assert.deepEqual(
    stops.map(({ id, name, shortName, miles }) => ({ id, name, shortName, miles })),
    LOCATIONS.map(({ id, name, shortName, miles }) => ({ id, name, shortName, miles })),
  );
});

test('a stop is a shop exactly where the engine lets the van open a shop', () => {
  for (const stop of routeStops(start())) {
    if (stop.kind === 'destination') continue;
    const there = at('location', stop.miles);
    const offered = availableActions(there).some(option => option.key === 'openShop');
    assert.equal(stop.kind === 'shop', offered, stop.id);
  }
});

test('a stop that rests and sells nothing is a rest stop; the goal is the destination', () => {
  for (const stop of routeStops(start())) {
    if (stop.miles >= RULES.goalMiles) {
      assert.equal(stop.kind, 'destination');
      continue;
    }
    const there = at('location', stop.miles);
    const keys = availableActions(there).map(option => option.key);
    const expected = keys.includes('openShop') ? 'shop' : keys.includes('rest') ? 'rest' : 'explore';
    assert.equal(stop.kind, expected, stop.id);
  }
});

test('passed and current follow the van', () => {
  const second = LOCATIONS[1];
  const stopped = routeStops(at('location', second.miles));
  assert.deepEqual(
    stopped.filter(stop => stop.current).map(stop => stop.id),
    [second.id],
  );
  assert.deepEqual(
    stopped.filter(stop => stop.passed).map(stop => stop.id),
    LOCATIONS.filter(stop => stop.miles < second.miles).map(stop => stop.id),
  );
  const road = routeStops(at('travel', second.miles + 1));
  assert.equal(road.filter(stop => stop.current).length, 0);
  assert.ok(road.find(stop => stop.id === second.id).passed);
});

test('the route does not change the state it is given', () => {
  const state = transition(start(), { type: 'travel' }).state;
  const copy = structuredClone(state);
  routeStops(state);
  assert.deepEqual(state, copy);
});
