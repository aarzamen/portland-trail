// The journey from the title to the road, at five widths, and what the save keeps: setup (B13, B19, F11, F12),
// escaping, the shop's stepper, Max and Auto-buy, leaving at once (B3), Resume, the save record and its legacy
// migration, unreadable saves, storage that refuses to write, and refusal toasts (B12).
import { isDeepStrictEqual } from 'node:util';
import { DEFAULT_NAMES, NAME_POOL } from '../src/data.js';
import {
  availableActions,
  dailySeed,
  deserializeGame,
  recommendSupplies,
  seedFromText,
  shopItems,
  summarize,
} from '../src/engine.js';
import {
  LEGACY_KEY,
  LEGACY_LEG_KEY,
  SAVE_KEY,
  atStop,
  launch,
  newGame,
  openJourney,
  openPage,
  plain,
  readGame,
  readRecord,
  saveRecord,
  suite,
  toasts,
} from './support/browser.mjs';

const MARKUP_NAME = '<img src=x onerror=alert(1)>';
const WIDTHS = [390, 414, 430, 768, 1440];
const report = suite('browser-flow');
const { check, step } = report;
const browser = await launch();

const field = (page, index) => page.getByLabel(`Traveler ${index + 1}`, { exact: true });
const quantity = async (page, id) => Number(await page.locator(`[data-key="qty:${id}"]`).inputValue());

/** Answers every open dialog with its first usable control until none is open. */
async function settle(page) {
  for (let round = 0; round < 20; round += 1) {
    if (await page.locator('#memorial-dialog[open]').count()) {
      await page.locator('#memorial-dialog [data-key="leave"]').click();
      continue;
    }
    if (!(await page.locator('#event-dialog[open]').count())) return;
    const done = page.locator('#event-dialog [data-key="event:done"]');
    if (await done.count()) await done.click();
    else await page.locator('#event-dialog [data-key^="event:"]:not([aria-disabled="true"])').first().click();
  }
}

/** Title → background → crew, with the given road; resolves on the game screen. */
async function packVan(page, { road = 'own', seed = 'kale' } = {}) {
  await page.locator('[data-key="start"]').click();
  await page.locator('[data-key="to-crew"]').click();
  await page.locator(`[data-key="road:${road}"]`).click();
  if (road === 'own') await page.locator('[data-key="seed"]').fill(seed);
  await page.locator('[data-key="pack"]').click();
  await page.locator('[data-region="scene"]').waitFor();
}

async function flowAt(width) {
  const height = width < 500 ? 844 : 1000;
  const at = label => `${width}px: ${label}`;
  const { context, page, errors } = await openPage(browser, { width, height });
  try {
    check((await page.locator('[data-key="resume"]').count()) === 0, at('a fresh browser offers no Resume'));
    check(/^v\d+\.\d+\.\d+ · /.test(await page.locator('#build-stamp').innerText()), at('the footer shows the stamp'));

    // Step 1: backgrounds with the arrow keys, Back to the title and forward again (B19).
    await page.locator('[data-key="start"]').click();
    const first = page.locator('[role="radiogroup"] [role="radio"]').first();
    await first.focus();
    const firstId = await first.getAttribute('data-profession');
    await page.keyboard.press('ArrowRight');
    const chosen = await page.evaluate(() => document.activeElement?.getAttribute('data-profession'));
    check(chosen && chosen !== firstId, at('ArrowRight moves to the next background'), chosen);
    check(
      (await page.locator(`[data-profession="${chosen}"]`).getAttribute('aria-checked')) === 'true',
      at('the focused background is the selected one'),
    );
    await page.locator('[data-key="back-title"]').click();
    check((await page.locator('.title-screen').count()) === 1, at('Back returns to the title (B19)'));
    await page.locator('[data-key="start"]').click();
    await page.locator('[data-key="to-crew"]').click();

    // Step 2: names that survive Back and Continue (B13), select on focus, Shuffle (F11).
    await field(page, 0).fill(MARKUP_NAME);
    await field(page, 1).fill('Juniper Two');
    await page.locator('[data-key="back-background"]').click();
    await page.locator('[data-key="to-crew"]').click();
    check(
      (await field(page, 0).inputValue()) === MARKUP_NAME && (await field(page, 1).inputValue()) === 'Juniper Two',
      at('typed names survive Back and Continue (B13)'),
    );
    for (const [index, how] of [
      [2, 'focus'],
      [3, 'click'],
    ]) {
      await (how === 'focus' ? field(page, index).focus() : field(page, index).click());
      const selection = await field(page, index).evaluate(input => [
        input.selectionStart,
        input.selectionEnd,
        input.value.length,
      ]);
      check(
        selection[0] === 0 && selection[1] === selection[2] && selection[2] > 0,
        at(`${how} on a name selects it`),
        selection,
      );
    }
    await page.locator('[data-key="shuffle"]').click();
    const shuffled = [];
    for (let index = 0; index < 5; index += 1) shuffled.push(await field(page, index).inputValue());
    check(
      new Set(shuffled).size === 5 && shuffled.every(name => NAME_POOL.includes(name)),
      at('Shuffle gives five distinct names from the pool (F11)'),
      shuffled,
    );
    await field(page, 0).fill(MARKUP_NAME);

    // The road: a seed of your own (F12).
    await page.locator('[data-key="road:own"]').click();
    await page.locator('[data-key="seed"]').fill('kale');
    await page.locator('[data-key="pack"]').click();
    await page.locator('[data-region="scene"]').waitFor();
    let game = await readGame(page);
    check(game?.seed === seedFromText('kale'), at('the journey starts from the typed seed'), game?.seed);
    check(game?.party[0].name === MARKUP_NAME, at('a name with markup is stored verbatim'));
    check((await page.locator('img[src="x"]').count()) === 0, at('a name with markup creates no element'));
    check(
      (await page.locator('[data-region="crew"]').innerText()).includes(MARKUP_NAME),
      at('a name with markup is shown as text'),
    );

    // The shop: the stepper never passes canBuy; Buy, Max and Auto-buy change the save by what they show.
    const row = id => shopItems(game).find(item => item.id === id);
    const seeds = row('ammo');
    for (let click = 0; click < seeds.canBuy + 2; click += 1) await page.locator('[data-key="more:ammo"]').click();
    check((await quantity(page, 'ammo')) === seeds.canBuy, at('+ stops at canBuy'), await quantity(page, 'ammo'));
    await page.locator('[data-key="qty:ammo"]').fill(String(seeds.canBuy + 50));
    check((await quantity(page, 'ammo')) === seeds.canBuy, at('a typed quantity is held to canBuy'));
    for (let click = 0; click < seeds.canBuy + 2; click += 1) await page.locator('[data-key="less:ammo"]').click();
    check((await quantity(page, 'ammo')) === 0, at('− stops at zero'));

    await page.locator('[data-key="more:food"]').click();
    const wanted = await quantity(page, 'food');
    await page.locator('[data-key="buy:food"]').click();
    let after = await readGame(page);
    check(after.inventory.food === game.inventory.food + wanted, at('Buy adds the quantity to the saved food'), {
      before: game.inventory.food,
      wanted,
      after: after.inventory.food,
    });
    game = after;

    // Clearing a quantity with Backspace and typing digits on the keyboard gives exactly those digits.
    const box = page.locator('[data-key="qty:food"]');
    await box.click();
    await page.keyboard.press('End');
    for (let press = 0; press < 4; press += 1) await page.keyboard.press('Backspace');
    check((await box.inputValue()) === '', at('a cleared quantity stays empty while typing'), await box.inputValue());
    await page.keyboard.type('12');
    check((await box.inputValue()) === '12', at('typed digits are the quantity'), await box.inputValue());
    check((await page.locator('[data-key="buy:food"]').innerText()).includes('Buy 12'), at('Buy follows the typing'));
    await page.locator('[data-key="buy:food"]').click();
    after = await readGame(page);
    check(after.inventory.food === game.inventory.food + 12, at('Buy after typing adds what was typed'), {
      before: game.inventory.food,
      after: after.inventory.food,
    });
    game = after;

    const fuel = row('fuel');
    await page.locator('[data-key="max:fuel"]').click();
    check((await quantity(page, 'fuel')) === fuel.canBuy, at('Max fills the quantity to canBuy'));
    await page.locator('[data-key="buy:fuel"]').click();
    after = await readGame(page);
    check(after.inventory.fuel === game.inventory.fuel + fuel.canBuy, at('buying Max adds canBuy fuel'));
    game = after;

    const plan = recommendSupplies(game);
    const shown = Number(await page.locator('[data-auto-buy-cost]').getAttribute('data-auto-buy-cost'));
    check(shown === plan.cost, at('Auto-buy shows the plan cost'), { shown, plan: plan.cost });
    if (plan.cost > 0) {
      await page.locator('[data-key="autoPurchase"]').click();
      after = await readGame(page);
      const expected = { ...game.inventory, money: game.inventory.money - plan.cost };
      for (const [id, count] of Object.entries(plan.cart)) expected[id] += count;
      check(isDeepStrictEqual(after.inventory, expected), at('Auto-buy buys the shown plan'), {
        after: after.inventory,
        expected,
      });
      game = after;
    }

    // Leave for Portland drives at once (B3); Resume restores the same journey.
    const leave = availableActions(game).find(option => option.key === 'travel');
    check(
      (await page.locator('[data-key="travel"]').innerText()).includes(leave.label),
      at('the primary action is the engine label'),
    );
    await page.locator('[data-key="travel"]').click();
    const driven = await readGame(page);
    check(driven.distance > 0 && driven.phase !== 'shop', at('Leave for Portland drives at once'), driven.distance);
    await page.reload();
    await page.locator('[data-key="resume"]').click();
    await page.locator('[data-region="scene"]').waitFor();
    check(isDeepStrictEqual(await readGame(page), driven), at('Resume restores the same journey'));
    check(
      Number(await page.locator('[data-region="route"] [data-mile]').getAttribute('data-mile')) === driven.distance,
      at('the route shows the saved mile'),
    );
    check(
      (await page.locator('#event-dialog').evaluate(dialog => dialog.open)) === Boolean(driven.pendingEvent),
      at('a pending encounter is open after Resume, and only then'),
    );
    check(errors.length === 0, at('no browser errors'), errors);
  } finally {
    await context.close();
  }
}

/** Two journeys from the same seed and the same clicks reach the same saved state. */
async function sameRoadTwice() {
  const saved = [];
  for (let run = 0; run < 2; run += 1) {
    const { context, page } = await openPage(browser);
    await packVan(page, { road: 'own', seed: 'kale' });
    await page.locator('[data-key="autoPurchase"]').click();
    for (let leg = 0; leg < 6; leg += 1) {
      await settle(page);
      const travel = page.locator('[data-key="travel"]:not([aria-disabled="true"])');
      if (!(await travel.count())) break;
      await travel.click();
    }
    await settle(page);
    saved.push(await readGame(page));
    await context.close();
  }
  check(saved[0]?.distance > 0, 'the repeated journey got somewhere', saved[0]?.distance);
  check(isDeepStrictEqual(saved[0], saved[1]), 'the same seed and clicks reach the same saved state');
}

async function todaysRoad() {
  const { context, page } = await openPage(browser);
  await packVan(page, { road: 'daily' });
  check((await readGame(page))?.seed === dailySeed(), "Today's road starts from the daily seed");
  await context.close();
}

async function storage() {
  // The record (spec 6).
  {
    const { context, page } = await openPage(browser);
    await packVan(page);
    const record = await readRecord(page);
    check(
      record?.app === 'the-portland-trail' && record.format === 2 && record.game?.version === 3,
      'the save record has the app, format 2 and a version 3 game',
      record && { app: record.app, format: record.format, version: record.game?.version },
    );
    check(record && Object.hasOwn(record, 'ui') && record.ui.lastLeg === null, 'a new journey saves no last leg');
    await context.close();
  }

  // A version 2 save under the legacy key, with its leg receipt.
  {
    const legacy = {
      version: 2,
      phase: 'travel',
      profession: 'dev',
      party: DEFAULT_NAMES.map((name, index) => ({ id: `traveler_${index + 1}`, name, health: 90, status: 'Healthy' })),
      inventory: { money: 900, food: 25, fuel: 12, ammo: 0, parts: 1, kombucha: 0, nft: 1 },
      locationId: 'start_city',
      distance: 160,
      day: 3,
      weather: 'Clear',
      pace: 'normal',
      rations: 'meager',
      pendingEvent: null,
      rng: 21,
      journal: [{ day: 1, text: 'Five travelers pack the van for Portland.' }],
      outcome: null,
      shopReturn: 'start_city',
      flags: { nextToken: 0, lastAbilityDay: -99, talked: [], wifiDownDay: -1 },
    };
    const raw = JSON.stringify(legacy);
    const leg = { fromDistance: 80, toDistance: 160, fromDay: 2, toDay: 3, fuelUsed: 4, foodUsed: 2.5, arrived: '' };
    const { context, page, errors } = await openPage(browser, {
      storage: { [LEGACY_KEY]: raw, [LEGACY_LEG_KEY]: JSON.stringify({ savedGame: raw, leg }) },
    });
    check((await page.locator('[data-key="resume"]').count()) === 1, 'a version 2 save offers Resume');
    const record = await readRecord(page);
    check(
      isDeepStrictEqual(record?.game, plain(deserializeGame(raw))),
      'the version 2 save is migrated under the new key',
    );
    check(isDeepStrictEqual(record?.ui?.lastLeg, leg), 'its leg receipt moves with it');
    const left = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [LEGACY_KEY, LEGACY_LEG_KEY]);
    check(
      left.every(value => value === null),
      'the legacy keys are gone',
      left,
    );
    await page.locator('[data-key="resume"]').click();
    check((await page.locator('[data-region="leg"]').innerText()).includes('+80 mi'), 'the migrated receipt is shown');
    check(errors.length === 0, 'no browser errors after migration', errors);
    await context.close();
  }

  // Unreadable saves are reported, offer no Resume and are left untouched.
  for (const [key, raw] of [
    [SAVE_KEY, 'not a journey'],
    [SAVE_KEY, JSON.stringify({ app: 'the-portland-trail', format: 2, game: { version: 999 }, ui: {} })],
    [LEGACY_KEY, JSON.stringify({ version: 999 })],
  ]) {
    const { context, page } = await openPage(browser, { storage: { [key]: raw } });
    check(await page.locator('#banner').isVisible(), `unreadable ${key}: the banner says so`);
    check((await page.locator('[data-key="resume"]').count()) === 0, `unreadable ${key}: no Resume`);
    check((await page.evaluate(name => localStorage.getItem(name), key)) === raw, `unreadable ${key}: left untouched`);
    await packVan(page);
    check(await page.locator('#banner').isHidden(), `unreadable ${key}: the banner goes once a new journey saves`);
    await context.close();
  }

  // Storage that throws on every write: play continues and the banner says so.
  {
    const { context, page, errors } = await openPage(browser);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('full', 'QuotaExceededError');
      };
    });
    await packVan(page);
    check(
      /could not save/i.test(await page.locator('#banner').innerText()),
      'a failing save is reported in the banner',
    );
    await page.locator('[data-key="travel"]').click();
    const mile = Number(await page.locator('[data-region="route"] [data-mile]').getAttribute('data-mile'));
    check(mile > 0, 'play continues without a save', mile);
    const said = ((await page.locator('body').innerText()).match(/could not save/gi) ?? []).length;
    check(said === 1, 'the failure is reported once, after two failed saves', said);
    check(errors.length === 0, 'no browser errors without storage', errors);
    await context.close();
  }
}

async function refusalToast() {
  const talked = atStop(newGame('influencer'), 'mushroom_market');
  talked.flags.talked = ['mushroom_market'];
  const reason = availableActions(talked).find(option => option.key === 'talk')?.reason;
  const { context, page } = await openJourney(browser, talked);
  const talk = page.locator('[data-key="talk"]');
  check((await talk.getAttribute('aria-disabled')) === 'true', 'a refused action is marked disabled');
  await talk.click({ force: true });
  const shown = await toasts(page);
  check(
    shown.length === 1 && shown[0].tone === 'error' && shown[0].text.includes(reason),
    'a refusal shows an amber toast',
    shown,
  );
  check((await page.locator('#toasts .toast[role="alert"]').count()) === 1, 'a refusal toast is an alert');
  await page.locator('.brand').click();
  await page.locator('.title-screen').waitFor();
  check((await toasts(page)).length === 0, 'the toast does not follow the player to another screen (B12)');
  await context.close();
}

/** A journey in progress asks before it is replaced; an ended one goes straight to step 1 (B16). */
async function newJourneyConfirmation() {
  {
    const { context, page } = await openJourney(browser, newGame('dev'));
    await page.locator('#new-journey-header').click();
    check(
      await page.locator('#confirm-dialog').evaluate(dialog => dialog.open),
      'a journey in progress asks before a new one',
    );
    await page.locator('#confirm-dialog [data-key="cancel"]').click();
    check((await page.locator('[data-region="scene"]').count()) === 1, 'Keep playing stays on the journey');
    await page.locator('#new-journey-header').click();
    await page.locator('#confirm-dialog [data-key="confirm"]').click();
    check((await page.locator('[data-key="to-crew"]').count()) === 1, 'confirming goes to step 1');
    await context.close();
  }
  {
    const lost = newGame('dev');
    for (const member of lost.party) member.health = 0;
    const ended = deserializeGame(JSON.stringify(lost));
    const summary = summarize(ended);
    const { context, page } = await openPage(browser, { storage: { [SAVE_KEY]: saveRecord(ended) } });
    check(
      (await page.locator('[data-key="resume"]').innerText()).includes('View saved ending'),
      'an ended save offers View saved ending',
    );
    await page.locator('[data-key="resume"]').click();
    const text = await page.locator('[data-region="actions"]').innerText();
    check(
      text.includes(summary.heading) && text.includes(summary.cause),
      'the ending shows the heading and cause',
      text,
    );
    await page.locator('[data-region="actions"] [data-key="new"]').click();
    check(
      (await page.locator('#confirm-dialog').evaluate(dialog => dialog.open)) === false &&
        (await page.locator('[data-key="to-crew"]').count()) === 1,
      'Start another journey goes straight to step 1 (B16)',
    );
    await context.close();
  }
}

try {
  await step('new journey confirmation', newJourneyConfirmation);
  for (const width of WIDTHS) await step(`flow at ${width}px`, () => flowAt(width));
  await step('same road twice', sameRoadTwice);
  await step("today's road", todaysRoad);
  await step('storage', storage);
  await step('refusal toast', refusalToast);
} finally {
  await browser.close();
}
await report.finish(`widths ${WIDTHS.join('/')}`);
