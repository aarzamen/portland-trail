// Encounters and what follows an action: a pending encounter that cannot be dismissed (B1), disabled choices
// with their reasons, choices for one background only, the outcome step (F1), memorials and epitaphs (F2),
// typed encounter text (L4), the latest notes, and a dry tank that never ends the journey (B2, F3).
import { isDeepStrictEqual } from 'node:util';
import { EVENTS } from '../src/data.js';
import { availableActions, transition } from '../src/engine.js';
import {
  atStop,
  dialogOpen,
  launch,
  newGame,
  onRoad,
  openJourney,
  plain,
  readGame,
  suite,
  withEncounter,
} from './support/browser.mjs';

const report = suite('browser-encounters');
const { check, step } = report;
const browser = await launch();

const option = (game, key) => availableActions(game).find(entry => entry.key === key);
const event = id => EVENTS.find(entry => entry.id === id);
const focusInside = (page, id) => page.evaluate(dialog => Boolean(document.activeElement?.closest(`#${dialog}`)), id);

async function pendingCannotBeDismissed() {
  const game = withEncounter(onRoad(newGame('influencer'), 140, { parts: 0 }), 'van_breakdown');
  const { context, page, errors } = await openJourney(browser, game);
  check(await dialogOpen(page, 'event-dialog'), 'a pending encounter opens on Resume');
  check(await focusInside(page, 'event-dialog'), 'focus is inside the encounter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  const reopened = await page
    .waitForFunction(() => document.querySelector('#event-dialog').open, null, { timeout: 2000 })
    .then(
      () => true,
      () => false,
    );
  check(reopened, 'Escape twice leaves the encounter open or reopens it (B1)');
  await page.evaluate(() => document.querySelector('#event-dialog').close());
  const back = await page
    .waitForFunction(() => document.querySelector('#event-dialog').open, null, { timeout: 2000 })
    .then(
      () => true,
      () => false,
    );
  check(back, 'an encounter closed by script reopens while it is pending (B1)');

  const repair = option(game, 'event:repair');
  const button = page.locator('#event-dialog [data-key="event:repair"]');
  check(
    !repair.enabled && (await button.getAttribute('aria-disabled')) === 'true',
    'a choice with an unmet need is disabled',
  );
  check(
    (await page.locator('#event-dialog').innerText()).includes(repair.reason),
    'the disabled choice shows its reason',
    repair.reason,
  );
  await button.click({ force: true });
  check(await dialogOpen(page, 'event-dialog'), 'a refused choice keeps the encounter open');
  check(
    (await page.locator('#event-dialog .dialog-error').innerText()).includes(repair.reason),
    'a refused choice is explained inside the dialog',
  );

  // The outcome step (F1).
  const tow = option(game, 'event:tow');
  const result = transition(game, tow.action);
  await page.locator('#event-dialog [data-key="event:tow"]').click();
  check(await dialogOpen(page, 'event-dialog'), 'after a choice the dialog stays open');
  const results = await page.locator('#event-dialog .event-results').innerText();
  check(
    result.notes.every(note => results.includes(note)),
    'the result lines are shown',
    { results, notes: result.notes },
  );
  check(isDeepStrictEqual(await readGame(page), plain(result.state)), 'the saved state already holds the result');
  await page.locator('#event-dialog [data-key="event:done"]').click();
  check(!(await dialogOpen(page, 'event-dialog')), 'Keep going closes the dialog');
  check(errors.length === 0, 'no browser errors in the encounter', errors);
  await context.close();
}

async function onlyForOneBackground() {
  for (const profession of ['dev', 'influencer']) {
    const game = withEncounter(onRoad(newGame(profession), 140), 'nft_auction');
    const { context, page } = await openJourney(browser, game);
    const shown = (await page.locator('#event-dialog [data-key="event:consult"]').count()) === 1;
    check(
      shown === (profession === 'dev'),
      `the consult choice ${profession === 'dev' ? 'appears' : 'is absent'} for ${profession}`,
    );
    await context.close();
  }
}

async function memorial(carve) {
  const victim = withEncounter(onRoad(newGame('dev'), 140), 'tiktok_distraction');
  for (const member of victim.party) member.health = 1;
  const result = transition(victim, option(victim, 'event:continue').action);
  const fallen = result.state.party.find(member => member.health === 0);
  const { context, page, errors } = await openJourney(browser, victim);
  await page.locator('#event-dialog [data-key="event:continue"]').click();
  await page.locator('#event-dialog [data-key="event:done"]').click();
  check(await dialogOpen(page, 'memorial-dialog'), `${carve ? 'carve' : 'leave'}: a death shows a memorial (F2)`);
  const text = await page.locator('#memorial-dialog').innerText();
  check(text.includes(fallen.name), 'the memorial names the traveler');
  const field = page.locator('#memorial-dialog [data-key="epitaph"]');
  check((await field.inputValue()) === fallen.epitaph, 'the epitaph field holds the default');
  if (carve) {
    const words = '<b>Here lies</b> a "legend"';
    await field.fill('   ');
    await page.locator('#memorial-dialog [data-key="carve"]').click();
    check(await dialogOpen(page, 'memorial-dialog'), 'a refused epitaph keeps the memorial open');
    check((await field.inputValue()) === '   ', 'a refused epitaph keeps what was typed', await field.inputValue());
    check(await page.locator('#memorial-dialog .dialog-error').isVisible(), 'a refused epitaph says why');
    await field.fill(words);
    await page.locator('#memorial-dialog [data-key="carve"]').click();
    const saved = (await readGame(page)).party.find(member => member.id === fallen.id);
    check(saved.epitaph === words, 'Carve it saves the typed epitaph', saved.epitaph);
    const crew = page.locator('[data-region="crew"]');
    check((await crew.innerText()).includes(words), 'an epitaph with markup is shown as text');
    const elements = await crew.evaluate(
      region => [...region.querySelectorAll('*')].filter(element => element.textContent === 'Here lies').length,
    );
    check(elements === 0, 'an epitaph with markup creates no element', elements);
  } else {
    await page.locator('#memorial-dialog [data-key="leave"]').click();
    const saved = (await readGame(page)).party.find(member => member.id === fallen.id);
    check(saved.epitaph === fallen.epitaph, 'Leave it keeps the default epitaph');
  }
  check(!(await dialogOpen(page, 'memorial-dialog')), 'the memorial closes');
  check(errors.length === 0, 'no browser errors around the memorial', errors);
  await context.close();
}

async function typedText() {
  const game = withEncounter(onRoad(newGame('dev'), 140), 'bad_weather');
  const full = event('bad_weather').description;
  {
    const { context, page } = await openJourney(browser, game, { motion: 'no-preference' });
    // Wait until typing has begun, then read it before it ends.
    await page.waitForFunction(() => document.querySelector('#event-dialog [data-typed]')?.textContent.length > 0);
    const typed = await page.locator('#event-dialog [data-typed]').innerText();
    check(typed.length < full.length, 'with motion the encounter text types itself out', typed);
    await page.locator('#event-dialog .event-text').click();
    check((await page.locator('#event-dialog [data-typed]').innerText()) === full, 'a click completes the text');
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, game, { motion: 'reduce' });
    check(
      (await page.locator('#event-dialog [data-typed]').innerText()) === full,
      'with reduced motion the text is whole',
    );
    await context.close();
  }
}

async function latestNotes() {
  for (const [label, game] of [
    ['talk', atStop(newGame('dev'), 'mushroom_market')],
    ['rest', onRoad(newGame('dev'), 140)],
  ]) {
    const expected = transition(game, { type: label }).notes;
    const { context, page } = await openJourney(browser, game);
    await page.locator(`[data-key="${label}"]`).click();
    const notes = await page.locator('[data-region="notes"]').innerText();
    check(expected.length > 0 && expected.every(note => notes.includes(note)), `the latest notes show the ${label}`, {
      notes,
      expected,
    });
    check((await page.locator('[data-region="notes"]').getAttribute('aria-live')) === 'polite', 'the notes are polite');
    await context.close();
  }
}

async function dryTankAtShop() {
  const game = atStop(newGame('dev'), 'mushroom_market', { fuel: 0 });
  const drive = option(game, 'travel');
  const { context, page, errors } = await openJourney(browser, game);
  const travel = page.locator('[data-key="travel"]');
  check((await travel.getAttribute('aria-disabled')) === 'true', 'with a dry tank Drive is disabled');
  check(
    (await page.locator('[data-region="scene"]').innerText()).includes(drive.reason),
    'Drive shows its reason',
    drive.reason,
  );
  const shop = page.locator('[data-key="openShop"]');
  check(
    (await shop.count()) === 1 && (await shop.getAttribute('aria-disabled')) !== 'true',
    'the shop is still offered',
  );
  await shop.click();
  await page.locator('[data-key="buy:fuel"]').click();
  check((await readGame(page)).inventory.fuel >= 1, 'fuel was bought');
  check((await travel.getAttribute('aria-disabled')) !== 'true', 'after buying fuel Drive is enabled');
  await travel.click();
  const after = await readGame(page);
  check(after.distance > game.distance && after.outcome === null, 'Drive works after buying fuel', after.distance);
  check(errors.length === 0, 'no browser errors at a dry shop', errors);
  await context.close();
}

async function dryTankOnRoad() {
  const game = onRoad(newGame('dev'), 140, { fuel: 0 });
  const { context, page } = await openJourney(browser, game);
  for (const key of ['push', 'hitchhike', 'tradeLuggage']) {
    check((await page.locator(`[data-key="${key}"]`).count()) === 1, `on the road with a dry tank ${key} is offered`);
  }
  const pushed = transition(game, { type: 'push' }).state;
  await page.locator('[data-key="push"]').click();
  const after = await readGame(page);
  check(
    after.distance === pushed.distance && after.distance > game.distance,
    'pushing moves the van (F3)',
    after.distance,
  );
  await context.close();
}

try {
  await step('pending encounter', pendingCannotBeDismissed);
  await step('only choices', onlyForOneBackground);
  await step('memorial carve', () => memorial(true));
  await step('memorial leave', () => memorial(false));
  await step('typed text', typedText);
  await step('latest notes', latestNotes);
  await step('dry tank at a shop', dryTankAtShop);
  await step('dry tank on the road', dryTankOnRoad);
} finally {
  await browser.close();
}
await report.finish();
