import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createGame, transition, serializeGame } from '../src/engine.js';
import { LOCATIONS } from '../src/data.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.TEST_URL || 'http://127.0.0.1:4173';
const output = fileURLToPath(new URL('../test-results/enhancements/', import.meta.url));
const key = 'the-portland-trail:v1';
const checks = [];
const errors = [];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
async function open(saved, { width = 390, motion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 1000 }, reducedMotion: motion });
  await ctx.addInitScript(({ saved, key }) => {
    if (!sessionStorage.getItem('fixture-loaded')) {
      localStorage.setItem(key, saved);
      sessionStorage.setItem('fixture-loaded', 'yes');
    }
  }, { saved: serializeGame(saved), key });
  const page = await ctx.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
  return { page, ctx };
}
async function read(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)), key); }
async function inspect(page, name) {
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    broken: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
  }));
  assert.equal(metrics.overflow, false, `${name}: horizontal overflow`);
  assert.deepEqual(metrics.broken, [], `${name}: broken images`);
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
  checks.push(name);
}
try {
  for (const width of [390, 414, 430, 1440]) {
    const { page, ctx } = await open(createGame({ profession: 'dev', seed: 21 }), { width });
    await page.locator('.auto-buy-preview').waitFor();
    await inspect(page, `auto-buy-preview-${width}`);
    assert.equal(await page.locator('[data-action="autoPurchase"]').count(), 1);
    const autoBuy = await page.locator('[data-action="autoPurchase"]').boundingBox();
    assert.ok(autoBuy.y + autoBuy.height <= (width < 500 ? 844 : 1000), `Auto-buy control fits ${width}`);
    const before = await read(page);
    const previewCost = Number(await page.locator('[data-auto-buy-cost]').getAttribute('data-auto-buy-cost'));
    await page.getByRole('button', { name: 'Auto-buy essentials', exact: true }).click();
    const bought = await read(page);
    assert.equal(before.inventory.money - bought.inventory.money, previewCost);
    assert.equal(bought.inventory.nft, before.inventory.nft);
    assert.ok(bought.inventory.parts > before.inventory.parts);
    assert.match(await page.locator('#notice').innerText(), /Packed|Bought/i);
    assert.ok(await page.getByRole('button', { name: 'Essentials packed', exact: true }).isDisabled());
    await inspect(page, `auto-buy-${width}`);
    await page.locator('.primary-action button').click();
    const primary = await page.locator('.primary-action button').boundingBox();
    assert.ok(primary.y + primary.height <= (width < 500 ? 844 : 1000), `Drive button fits ${width}`);
    await inspect(page, `road-${width}`);
    await page.locator('.primary-action button').click();
    assert.equal(await page.locator('.is-driving').count(), 0, 'Reduced motion skips playback');
    assert.ok(await page.locator('#event-dialog').evaluate(dialog => dialog.open));
    await page.locator('[data-event-choice="wait"]').click();
    assert.match(await page.locator('.last-leg').innerText(), /80 mi/);
    assert.equal((await read(page)).distance, 80);
    await inspect(page, `last-leg-${width}`);
    await page.reload(); await page.getByRole('button', { name: 'Resume journey', exact: true }).click();
    assert.match(await page.locator('.last-leg').innerText(), /80 mi/);
    await page.locator('.primary-action button').click();
    if (await page.locator('#event-dialog').evaluate(dialog => dialog.open)) await page.locator('[data-event-choice]').first().click();
    assert.equal((await read(page)).locationId, 'mushroom_market');
    assert.match(await page.locator('.last-leg').innerText(), /Arrived/);
    await inspect(page, `mushroom-market-${width}`);
    if (width === 390) {
      await page.locator('#new-journey-header').click();
      await page.locator('[data-confirm="replace"]').click();
      await page.getByRole('button', { name: 'Continue to the crew' }).click();
      await page.getByRole('button', { name: 'Pack the van', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('the-portland-trail:last-leg:v1')), null);
      await page.locator('.primary-action button').click();
      assert.equal(await page.locator('.last-leg').count(), 0);
      checks.push('new-journey-clears-last-leg');
    }
    await ctx.close();
  }

  const low = createGame({ profession: 'dev', seed: 21 });
  low.inventory.money = 5; low.inventory.food = 0; low.inventory.fuel = 0;
  const { page: lp, ctx: lc } = await open(low);
  assert.match(await lp.locator('.auto-buy-preview').innerText(), /cash|budget|afford/i);
  const lowButton = lp.locator('[data-action="autoPurchase"]');
  if (!await lowButton.isDisabled()) await lowButton.click();
  assert.ok((await read(lp)).inventory.money >= 0);
  await inspect(lp, 'low-cash'); await lc.close();

  const { page: bp, ctx: bc } = await open(createGame({ profession: 'dev', seed: 21 }));
  await bp.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
  await bp.getByRole('button', { name: 'Auto-buy essentials', exact: true }).click();
  assert.match(await bp.locator('#notice').innerText(), /Packed.*could not save/);
  assert.match(await bp.locator('#save-status').innerText(), /without a save/);
  checks.push('auto-buy-keeps-save-failure-visible');
  await bc.close();

  const travel = transition(createGame({ profession: 'dev', seed: 21 }), { type: 'depart' }).state;
  const { page: ap, ctx: ac } = await open(travel, { width: 1440, motion: 'no-preference' });
  await ap.locator('.primary-action button').click();
  const committed = await read(ap);
  assert.equal(committed.distance, 80, 'State saves before playback ends');
  assert.ok(committed.pendingEvent, 'Pending encounter already saved');
  assert.equal(await ap.locator('.is-driving').count(), 1);
  assert.equal(await ap.locator('#event-dialog').evaluate(dialog => dialog.open), false);
  assert.equal(await ap.locator('#app').evaluate(app => app.inert), true);
  assert.ok(await ap.locator('.road-backdrop').evaluate(image => image.getAnimations().length > 0), 'Scenery is animated');
  assert.ok(await ap.locator('#new-journey-header').isDisabled());
  await ap.evaluate(() => {
    document.querySelector('[data-action="travel"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('#new-journey-header').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  assert.equal((await read(ap)).distance, 80, 'Duplicate click cannot advance twice');
  assert.equal(await ap.locator('#replace-dialog').evaluate(dialog => dialog.open), false);
  await ap.screenshot({ path: join(output, 'driving-1440.png'), fullPage: true });
  await ap.waitForFunction(() => document.querySelector('#event-dialog').open);
  assert.equal(await ap.locator('.is-driving').count(), 0);
  assert.ok(await ap.evaluate(() => document.activeElement.closest('#event-dialog') !== null));
  checks.push('animated-drive-saved-once-and-deferred-event');
  await ac.close();

  const { page: rp, ctx: rc } = await open(travel, { motion: 'no-preference' });
  await rp.locator('.primary-action button').click();
  await rp.reload(); await rp.getByRole('button', { name: 'Resume journey', exact: true }).click();
  assert.equal((await read(rp)).distance, 80);
  assert.ok(await rp.locator('#event-dialog').evaluate(dialog => dialog.open));
  await rp.locator('[data-event-choice="wait"]').click();
  assert.equal((await read(rp)).distance, 80);
  await rp.evaluate(({ key, saved }) => localStorage.setItem(key, saved), { key, saved: serializeGame(travel) });
  await rp.reload(); await rp.getByRole('button', { name: 'Resume journey', exact: true }).click();
  assert.equal(await rp.locator('.last-leg').count(), 0, 'A receipt from another saved state is ignored');
  checks.push('reload-during-animation-keeps-pending-event');
  checks.push('mismatched-leg-receipt-ignored');
  await rc.close();

  for (const id of ['river_ferry', 'forest_camp', 'bookshop']) {
    const place = LOCATIONS.find(location => location.id === id);
    assert.ok(place, `${id}: place exists`);
    const fixture = createGame({ profession: 'dev', seed: 21 });
    Object.assign(fixture, { distance: place.miles, locationId: id, phase: 'location' });
    const { page, ctx } = await open(fixture, { width: 430 });
    assert.ok(await page.locator(`.scene-image[src="./${place.image}"]`).count());
    await page.locator('.route-details summary').click();
    assert.equal(await page.locator('.route-stop').count(), LOCATIONS.length);
    await inspect(page, id);
    await ctx.close();
  }
  assert.deepEqual(errors, [], 'No browser errors');
  await writeFile(join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
  console.log(`Enhancement browser checks passed: ${checks.length}`);
} finally { await browser.close(); }
