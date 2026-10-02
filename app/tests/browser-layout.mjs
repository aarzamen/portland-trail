// Layout at twelve viewports on the road, in the shop and with an encounter open; one list each for the crew
// and the supplies (B11); the route list's open state (B10); the drive drawn from the previous state (B7);
// reduced motion; and keyboard-only use of the shop with focus kept across redraws.
import { isDeepStrictEqual } from 'node:util';
import { transition } from '../src/engine.js';
import {
  launch,
  newGame,
  onRoad,
  openJourney,
  pause,
  plain,
  probeLayout,
  readGame,
  rectOf,
  suite,
  withEncounter,
} from './support/browser.mjs';

const SIZES = [
  [320, 568],
  [375, 548],
  [390, 664],
  [402, 681],
  [414, 715],
  [430, 739],
  [440, 763],
  [756, 352],
  [844, 390],
  [874, 402],
  [1024, 768],
  [1440, 900],
];
const report = suite('browser-layout');
const { check, step } = report;
const browser = await launch();

const road = () => onRoad(newGame('dev'), 40, { fuel: 30, food: 60 });
const shop = () => newGame('dev');
const encounter = () => withEncounter(onRoad(newGame('dev'), 40, { parts: 6, money: 500 }), 'van_breakdown');
const inside = (inner, outer) =>
  inner &&
  outer &&
  inner.x >= outer.x - 1 &&
  inner.right <= outer.right + 1 &&
  inner.y >= outer.y - 1 &&
  inner.bottom <= outer.bottom + 1;

/** The checks every situation shares. */
function common(name, metrics) {
  check(metrics.scrollWidth <= metrics.width + 1, `${name}: no horizontal overflow`, metrics.scrollWidth);
  check(metrics.broken.length === 0, `${name}: every image loaded`, metrics.broken);
  if (metrics.width < 1000) {
    check(metrics.small.length === 0, `${name}: controls are at least 44px`, metrics.small);
    check(metrics.smallText.length === 0, `${name}: inputs and selects use 16px text`, metrics.smallText);
  }
}

async function atSize(width, height) {
  const size = `${width}x${height}`;
  const phone = width < 1000;
  {
    const { context, page, errors } = await openJourney(browser, road(), { width, height });
    const metrics = await probeLayout(page);
    common(`road ${size}`, metrics);
    const primary = await rectOf(page, '[data-key="travel"]');
    check(
      primary && primary.y >= 0 && primary.bottom <= height,
      `road ${size}: the primary action is in the first viewport`,
      primary,
    );
    const numbers = await rectOf(page, '[data-region="route"] .trip-numbers');
    check(numbers && numbers.bottom <= height, `road ${size}: the trip numbers are in the first viewport`, numbers);
    const van = await rectOf(page, '.van-cutout');
    const scene = await rectOf(page, '.scene-image-wrap');
    check(inside(van, scene), `road ${size}: the whole van is inside the scene`, { van, scene });
    const source = await page.locator('.road-backdrop').evaluate(image => image.currentSrc);
    check(/-960\.webp$/.test(source) === phone, `road ${size}: ${phone ? 'phone' : 'desktop'} scene art`, source);
    const lists = await page.evaluate(() => ({
      crew: document.querySelectorAll('[data-list="crew"]').length,
      supplies: document.querySelectorAll('[data-list="supplies"]').length,
      travelers: document.querySelectorAll('[data-list="crew"] [data-member]').length,
    }));
    check(
      isDeepStrictEqual(lists, { crew: 1, supplies: 1, travelers: 5 }),
      `road ${size}: one crew list and one supplies list (B11)`,
      lists,
    );
    await page.screenshot({ path: `${report.folder}/road-${size}.png` });
    check(errors.length === 0, `road ${size}: no browser errors`, errors);
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, shop(), { width, height });
    common(`shop ${size}`, await probeLayout(page));
    if (phone && height > width) {
      const autoBuy = await rectOf(page, '[data-key="autoPurchase"]');
      check(autoBuy && autoBuy.bottom <= height, `shop ${size}: Auto-buy is in the first viewport`, autoBuy);
    }
    await page.screenshot({ path: `${report.folder}/shop-${size}.png` });
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, encounter(), { width, height });
    common(`encounter ${size}`, await probeLayout(page));
    const choices = await page.locator('#event-dialog [data-key^="event:"]').evaluateAll(list =>
      list.map(element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      }),
    );
    check(
      choices.length >= 2 && choices.every(choice => choice.top >= 0 && choice.bottom <= height),
      `encounter ${size}: every choice is inside the viewport`,
      choices,
    );
    await page.screenshot({ path: `${report.folder}/encounter-${size}.png` });
    await context.close();
  }
}

async function routeStaysOpen() {
  const { context, page } = await openJourney(browser, road());
  await page.locator('[data-region="route"] summary').click();
  await page.locator('[data-key="rest"]').click();
  check(
    await page.locator('[data-region="route"] details').evaluate(details => details.open),
    'the route list stays open after an action (B10)',
  );
  await context.close();
}

async function driveWithMotion(width, height) {
  const game = road();
  const expected = transition(game, { type: 'travel' }).state;
  const { context, page, errors } = await openJourney(browser, game, { width, height, motion: 'no-preference' });
  const topline = await page.locator('[data-region="topline"]').innerText();
  await page.locator('[data-key="travel"]').click();
  const first = await page.locator('[data-drive-distance]').innerText();
  check((await page.locator('.is-driving').count()) === 1, `${width}px: the drive plays`);
  check(
    isDeepStrictEqual(await readGame(page), plain(expected)),
    `${width}px: the saved state is already the new one (B7)`,
  );
  check(
    (await page.locator('[data-region="topline"]').innerText()) === topline,
    `${width}px: the top line is unchanged during the drive`,
  );
  check((await page.locator('.ending-panel').count()) === 0, `${width}px: no ending region during the drive`);
  await page.evaluate(() =>
    document.querySelector('[data-key="travel"]').dispatchEvent(new MouseEvent('click', { bubbles: true })),
  );
  await pause(400);
  const later = await page.locator('[data-drive-distance]').innerText();
  check(first !== later, `${width}px: the distance counter animates`, { first, later });
  await page.locator('.is-driving').waitFor({ state: 'detached' });
  check(isDeepStrictEqual(await readGame(page), plain(expected)), `${width}px: a second click does nothing`);
  check(errors.length === 0, `${width}px: no browser errors while driving`, errors);
  await context.close();
}

async function driveReduced() {
  const game = road();
  const expected = transition(game, { type: 'travel' }).state;
  const { context, page } = await openJourney(browser, game);
  await page.locator('[data-key="travel"]').click();
  check((await page.locator('.is-driving').count()) === 0, 'reduced motion: no drive playback');
  const running = await page.evaluate(
    () => document.getAnimations().filter(animation => animation.playState === 'running').length,
  );
  check(running === 0, 'reduced motion: nothing animates', running);
  const leg = await page.locator('[data-region="leg"]').innerText();
  check(leg.includes(`+${expected.distance - game.distance} mi`), 'reduced motion: the receipt shows the leg', leg);
  await context.close();
}

async function keyboardShop() {
  for (const [width, height] of [
    [390, 664],
    [1440, 900],
  ]) {
    const { context, page } = await openJourney(browser, shop(), { width, height });
    // Every control in the shop is reached by Tab.
    const total = await page.evaluate(() => {
      const controls = [
        ...document.querySelectorAll('#app button, #app input, #app select, #app summary, #app a[href]'),
      ].filter(element => element.getClientRects().length > 0 && element.tabIndex >= 0);
      controls.forEach((element, index) => element.setAttribute('data-probe', String(index)));
      return controls.length;
    });
    await page.locator('#app').focus();
    const reached = new Set();
    for (let press = 0; press < total + 5; press += 1) {
      await page.keyboard.press('Tab');
      const probe = await page.evaluate(() => document.activeElement?.getAttribute('data-probe'));
      if (probe !== null && probe !== undefined) reached.add(probe);
    }
    check(reached.size === total, `${width}px: Tab reaches every control in the shop`, {
      reached: reached.size,
      total,
    });

    // Focus stays on the same control after a redraw.
    await page.locator('[data-key="more:food"]').focus();
    await page.keyboard.press('Enter');
    check(
      (await page.evaluate(() => document.activeElement?.getAttribute('data-key'))) === 'more:food',
      `${width}px: focus stays on + after the shop redraws`,
    );
    await page.locator('[data-key="buy:food"]').focus();
    await page.keyboard.press('Enter');
    check(
      (await page.evaluate(() => document.activeElement?.getAttribute('data-key'))) === 'buy:food',
      `${width}px: focus stays on Buy after a purchase`,
    );

    // Enter on the primary action drives.
    await page.locator('[data-key="travel"]').focus();
    await page.keyboard.press('Enter');
    check((await readGame(page)).distance > 0, `${width}px: Enter on the primary action drives`);
    await context.close();
  }
}

try {
  for (const [width, height] of SIZES) await step(`layout ${width}x${height}`, () => atSize(width, height));
  await step('route stays open', routeStaysOpen);
  await step('drive with motion 1440', () => driveWithMotion(1440, 900));
  await step('drive with motion 390', () => driveWithMotion(390, 664));
  await step('drive with reduced motion', driveReduced);
  await step('keyboard shop', keyboardShop);
} finally {
  await browser.close();
}
await report.finish(`${SIZES.length} viewports`);
