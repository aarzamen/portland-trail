// The balance targets of spec section 3.11, measured with the three bots of scripts/balance.mjs.
// The script measures 2,000 seeds per background against the exact targets; this test measures 300
// and allows wider bands, so that ordinary variance between samples does not fail it. Careful play's
// floors are the spec's own: its measured values clear them by a wide margin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTables, measure, startingShortfalls } from '../scripts/balance.mjs';

const SEEDS = 300;
const BANDS = {
  neverShopsMost: 0.08,
  autopilot: [0.25, 0.6],
  carefulLeast: 0.8,
  carefulAlive: 3.5,
  spreadPoints: 12,
  carefulOutbreakLosses: 0.05,
};

const results = measure(SEEDS);
const rows = botId => Object.entries(results[botId]);
const percent = share => `${(share * 100).toFixed(1)}%`;

test('the measured numbers', t => {
  for (const line of formatTables(results, SEEDS).split('\n')) if (line) t.diagnostic(line.replace(/^#+ /, ''));
});

test('a crew that never shops almost never reaches Portland', () => {
  for (const [background, row] of rows('never-shops')) {
    assert.ok(row.winRate <= BANDS.neverShopsMost, `${background} won ${percent(row.winRate)}`);
  }
});

test('Auto-buy alone wins some journeys and loses others', () => {
  const [least, most] = BANDS.autopilot;
  for (const [background, row] of rows('autopilot')) {
    assert.ok(row.winRate >= least && row.winRate <= most, `${background} won ${percent(row.winRate)}`);
  }
});

test('careful play wins most journeys and keeps most of the crew alive', () => {
  for (const [background, row] of rows('careful')) {
    assert.ok(row.winRate >= BANDS.carefulLeast, `${background} won ${percent(row.winRate)}`);
    assert.ok(row.meanAlive >= BANDS.carefulAlive, `${background} kept ${row.meanAlive.toFixed(2)} alive`);
  }
});

test('careful play survives the outbreak', () => {
  const met = rows('careful').reduce((sum, [, row]) => sum + row.outbreaks, 0);
  const lost = rows('careful').reduce((sum, [, row]) => sum + row.outbreakLosses, 0);
  assert.ok(met > 0, 'no careful journey met the outbreak');
  assert.ok(lost / met <= BANDS.carefulOutbreakLosses, `${lost} of ${met} journeys with the outbreak were lost`);
});

test('no background is much easier than another', () => {
  for (const botId of Object.keys(results)) {
    const rates = rows(botId).map(([, row]) => row.winRate * 100);
    const spread = Math.max(...rates) - Math.min(...rates);
    assert.ok(spread <= BANDS.spreadPoints, `${botId}: ${spread.toFixed(1)} points between backgrounds`);
  }
});

test('Auto-buy at the start leaves every background able to reach the next shop', () => {
  for (const [background, shortfall] of Object.entries(startingShortfalls())) {
    assert.deepEqual(shortfall, { fuel: 0, food: 0 }, background);
  }
});
