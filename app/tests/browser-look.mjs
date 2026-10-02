// The finished look (spec 10, L1–L8): the Portland Pixel face at whole multiples of 8px, text never under 12px,
// supply labels that are never cut, health bars by band, the route map and its van, toasts in two tones, the
// focus ring, the sound switch, reduced motion, the stylesheet's own budgets, and screenshots of every screen at
// three sizes in app/test-results/look/ for review.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BOTS } from '../scripts/balance.mjs';
import { DEATHS, RULES } from '../src/data.js';
import { availableActions, createGame, routeStops, transition } from '../src/engine.js';
import {
  SAVE_KEY,
  atStop,
  launch,
  newGame,
  onRoad,
  openJourney,
  openPage,
  pause,
  readGame,
  saveRecord,
  suite,
  withEncounter,
} from './support/browser.mjs';

const report = suite('look');
const { check, step } = report;
const browser = await launch();
const BOT = Object.fromEntries(BOTS.map(bot => [bot.id, bot]));
const SHOT_SIZES = [
  [390, 664],
  [844, 390],
  [1440, 900],
];

/** A journey played by a balance bot in the engine alone, to its end. */
function played(profession, seed, bot) {
  let state = createGame({ profession, seed });
  const memory = { shopped: new Set(), rests: new Map() };
  for (let count = 0; count < 1500 && !state.outcome; count += 1) {
    state = transition(state, bot.choose(state, memory)).state;
  }
  return state;
}

const road = () => onRoad(newGame('dev'), 40, { fuel: 30, food: 60 });
const shop = () => newGame('dev');
const stop = () => atStop(newGame('dev'), 'river_ferry', { fuel: 30, food: 60, money: 400 });
const encounter = () => withEncounter(onRoad(newGame('dev'), 40, { parts: 6, money: 500 }), 'van_breakdown');
// The seeds of the journey suite: a won journey with two fallen and a lost one.
const won = played('influencer', 14, BOT.autopilot);
const lost = played('prepper', 3, BOT['never-shops']);

/** A journey on the road whose crew stands at 80, 50 and 20 health, with one traveler dead. */
function banded() {
  const game = road();
  const healths = [80, 50, 20, 0, 100];
  game.party.forEach((member, index) => {
    member.health = healths[index];
    if (member.health === 0) {
      member.death = { day: 1, mile: 40, cause: 'road' };
      member.epitaph = DEATHS.road.epitaph;
    }
  });
  return game;
}

const shotPath = name => join(report.folder, `${name}.png`);
/** The face is loaded and every picture decoded, so a screenshot shows what a player sees. */
const fontsReady = page =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    return true;
  });

/** Visible text set under 12px, and supply labels whose text is cut. */
function textProbe(page) {
  return page.evaluate(() => {
    const small = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || !node.textContent.trim()) continue;
      if (element.closest('dialog:not([open]), [hidden], option, script, style')) continue;
      if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') continue;
      const box = element.getBoundingClientRect();
      if (box.width <= 1 || box.height <= 1) continue;
      const size = parseFloat(getComputedStyle(element).fontSize);
      if (size < 12) small.push({ text: node.textContent.trim().slice(0, 30), size });
    }
    const cut = [...document.querySelectorAll('.resource-name')]
      .filter(label => label.getClientRects().length)
      .filter(label => label.scrollWidth > label.clientWidth)
      .map(label => ({ text: label.textContent, scroll: label.scrollWidth, client: label.clientWidth }));
    return { small, cut };
  });
}

async function typeface() {
  const { context, page } = await openPage(browser, { width: 1440, height: 900 });
  await fontsReady(page);
  check(await page.evaluate(() => document.fonts.check('32px "Portland Pixel"')), 'the Portland Pixel face is loaded');
  const face = await page.locator('.title-screen h1').evaluate(element => {
    const style = getComputedStyle(element);
    return { family: style.fontFamily, size: parseFloat(style.fontSize), weight: style.fontWeight };
  });
  check(face.family.includes('Portland Pixel'), 'the title uses Portland Pixel', face);
  check(face.size % 8 === 0 && face.weight === '400', 'the title is a whole multiple of 8px at weight 400', face);
  const preload = await page.locator('link[rel="preload"][as="font"]').getAttribute('href');
  check(/portland-pixel\.woff2$/.test(preload ?? ''), 'the page preloads the face', preload);
  await context.close();
  for (const [width, height] of [
    [390, 664],
    [1440, 900],
  ]) {
    const opened = await openJourney(browser, road(), { width, height });
    await fontsReady(opened.page);
    const heading = await opened.page.locator('#scene-heading').evaluate(element => {
      const style = getComputedStyle(element);
      return { family: style.fontFamily, size: parseFloat(style.fontSize) };
    });
    check(
      heading.family.includes('Portland Pixel') && heading.size % 8 === 0,
      `${width}px: the scene heading is Portland Pixel at a multiple of 8px`,
      heading,
    );
    await opened.context.close();
  }
}

async function textSizes() {
  for (const [width, height] of [
    [320, 568],
    [390, 664],
    [1440, 900],
  ]) {
    for (const [name, game] of [
      ['road', road()],
      ['shop', shop()],
      ['ending', won],
    ]) {
      const { context, page } = await openJourney(browser, game, { width, height });
      await fontsReady(page);
      const { small, cut } = await textProbe(page);
      check(small.length === 0, `${name} ${width}px: no visible text under 12px`, small.slice(0, 5));
      check(cut.length === 0, `${name} ${width}px: supply labels are whole`, cut);
      await context.close();
    }
  }
}

async function healthBars() {
  const { context, page } = await openJourney(browser, banded(), { width: 390, height: 664 });
  const bars = await page.locator('[data-list="crew"] .health').evaluateAll(list =>
    list.map(health => ({
      band: health.getAttribute('data-band'),
      colour: getComputedStyle(health.querySelector('.health-track span')).backgroundColor,
      number: health.querySelector('b').textContent.trim(),
      shown: health.querySelector('b').checkVisibility(),
    })),
  );
  const [good, worn, bad, dead] = bars;
  check(
    new Set([good.colour, worn.colour, bad.colour]).size === 3,
    'health at 80, 50 and 20 shows three colours',
    bars,
  );
  check(
    good.number === '80' && worn.number === '50' && bad.number === '20' && bars.every(bar => bar.shown),
    'each bar shows its number',
    bars,
  );
  check(dead.band === 'dead', "a dead traveler's bar has data-band dead", dead);
  const deadRow = await page.locator('[data-list="crew"] .traveler-deceased').evaluate(row => ({
    text: row.innerText,
    colour: getComputedStyle(row.querySelector('.traveler-top strong')).color,
    living: getComputedStyle(row.parentElement.querySelector('.traveler:not(.traveler-deceased) strong')).color,
  }));
  check(
    /deceased/i.test(deadRow.text) && deadRow.colour !== deadRow.living,
    'the dead are marked in words and in colour',
    deadRow,
  );
  await context.close();
}

/** The van's centre and where the mile should put it, as fractions of the track. */
function vanOnTrack(page) {
  return page.evaluate(goal => {
    const track = document.querySelector('.route-track').getBoundingClientRect();
    const van = document.querySelector('[data-route-van]').getBoundingClientRect();
    const mile = Number(document.querySelector('[data-mile]').getAttribute('data-mile'));
    return { at: (van.left + van.width / 2 - track.left) / track.width, expected: mile / goal, mile };
  }, RULES.goalMiles);
}

async function routeMap() {
  {
    const { context, page } = await openJourney(browser, road(), { width: 1440, height: 900 });
    const before = await vanOnTrack(page);
    check(Math.abs(before.at - before.expected) <= 0.02, 'the route van sits at the mile before a drive', before);
    await page.locator('[data-key="travel"]').click();
    const after = await vanOnTrack(page);
    const saved = await readGame(page);
    check(
      after.mile === saved.distance && Math.abs(after.at - after.expected) <= 0.02,
      'the route van sits at the new mile after a drive',
      after,
    );
    const marks = await page.locator('.route-map [data-stop]').count();
    check(marks === routeStops(saved).length, 'every stop is marked on the map', marks);
    const shops = await page
      .locator('.route-map .route-shop')
      .evaluateAll(list => list.map(mark => mark.getAttribute('aria-label') || mark.getAttribute('title')));
    check(
      shops.length === routeStops(saved).filter(entry => entry.kind === 'shop').length && shops.every(Boolean),
      'shops carry a symbol with a text alternative',
      shops,
    );
    const labels = await page.locator('.route-map .route-label').evaluateAll(list =>
      list.map(label => {
        const box = label.getBoundingClientRect();
        return { text: label.textContent, left: box.left, right: box.right, top: box.top, width: box.width };
      }),
    );
    const overlapping = labels.filter((label, index) =>
      labels.some(
        (other, at) =>
          at !== index && other.top === label.top && other.left < label.right - 1 && label.left < other.right - 1,
      ),
    );
    check(
      labels.every(label => label.width > 1) && overlapping.length === 0,
      '1440px: every stop is labelled without overlaps',
      overlapping,
    );
    check((await page.locator('.route-details li').count()) === marks, 'the full list stays available');
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, road(), { width: 390, height: 664, motion: 'no-preference' });
    const before = await vanOnTrack(page);
    await page.locator('[data-key="travel"]').click();
    await pause(450);
    const during = await vanOnTrack(page);
    await page.locator('.is-driving').waitFor({ state: 'detached' });
    const after = await vanOnTrack(page);
    check(during.at > before.at + 0.005 && during.at < after.at - 0.005, 'the route van travels during the drive', {
      before,
      during,
      after,
    });
    check(Math.abs(after.at - after.expected) <= 0.02, '390px: the van sits at the mile after the drive', after);
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, stop(), { width: 390, height: 664 });
    const near = await page.locator('.route-near [data-near]').evaluateAll(list =>
      list.map(element => {
        const box = element.getBoundingClientRect();
        return {
          where: element.getAttribute('data-near'),
          text: element.textContent.trim(),
          shown: element.checkVisibility() && box.width > 1,
          left: box.left,
          right: box.right,
        };
      }),
    );
    const names = Object.fromEntries(near.map(entry => [entry.where, entry]));
    const expected = { prev: 'Rest Stop', current: 'River Ferry', next: 'Roadside Motel' };
    check(
      Object.entries(expected).every(([where, text]) => names[where]?.shown && names[where].text.includes(text)),
      '390px: the previous, current and next stops are labelled',
      near,
    );
    check(
      names.prev.right <= names.current.left + 1 && names.current.right <= names.next.left + 1,
      '390px: the three labels do not overlap',
      near,
    );
    await context.close();
  }
}

async function toastTones() {
  const { context, page } = await openJourney(browser, shop(), { width: 390, height: 664 });
  await page.locator('[data-key="buy:food"]').click();
  const ok = page.locator('#toasts .toast[data-tone="ok"]');
  await ok.waitFor();
  const success = await ok.evaluate(toast => ({
    role: toast.getAttribute('role'),
    border: getComputedStyle(toast).borderTopColor,
    box: toast.getBoundingClientRect().toJSON(),
  }));
  const primary = await page.locator('[data-key="travel"]').evaluate(button => button.getBoundingClientRect().toJSON());
  const covers = (first, second) =>
    first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;
  check(!covers(success.box, primary), 'a toast does not cover the primary action on a phone', { success, primary });
  await page.locator('[data-key="less:fuel"]').click();
  await page.locator('[data-key="less:fuel"]').click();
  // A Buy with nothing chosen is marked aria-disabled but still answers a click with its reason.
  await page.locator('[data-key="buy:fuel"]').click({ force: true });
  const refused = page.locator('#toasts .toast[data-tone="error"]');
  await refused.waitFor();
  const refusal = await refused.evaluate(toast => ({
    role: toast.getAttribute('role'),
    border: getComputedStyle(toast).borderTopColor,
  }));
  check(success.role === 'status' && refusal.role === 'alert', 'toasts carry status and alert roles', {
    success,
    refusal,
  });
  check(success.border !== refusal.border, 'success and refusal toasts have different borders', {
    success,
    refusal,
  });
  await page.screenshot({ path: shotPath('toast-refusal-390x664') });
  await context.close();
}

async function focusRing() {
  const { context, page } = await openPage(browser, { width: 1440, height: 900 });
  await page.locator('[data-key="start"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('.profession-card').first().waitFor();
  const main = await page.evaluate(() => ({
    focused: document.activeElement?.id,
    outline: getComputedStyle(document.querySelector('#app')).outlineStyle,
  }));
  check(main.focused === 'app' && main.outline === 'none', '<main> shows no outline after a screen change', main);
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => document.activeElement?.matches('.profession-card.is-selected'))) break;
  }
  const card = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    const amber = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim();
    return {
      selected: element.matches('.profession-card.is-selected'),
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      colour: style.outlineColor,
      amber,
    };
  });
  const amberRgb = card.amber
    .match(/[0-9a-f]{2}/gi)
    ?.map(hex => parseInt(hex, 16))
    .join(', ');
  check(
    card.selected && card.style === 'solid' && card.width >= 2 && card.colour === `rgb(${amberRgb})`,
    'the selected background card shows the amber ring when focused by keyboard',
    card,
  );
  await context.close();
}

async function soundSwitch() {
  const { context, page, errors } = await openPage(browser, { width: 390, height: 664 });
  const toggle = page.locator('#sound-toggle');
  check((await toggle.getAttribute('aria-pressed')) === 'false', 'the sound switch starts off');
  await toggle.click();
  check((await toggle.getAttribute('aria-pressed')) === 'true', 'the sound switch turns on');
  await page.reload();
  await page.locator('[data-key="start"]').waitFor();
  check((await toggle.getAttribute('aria-pressed')) === 'true', 'the sound switch stays on after a reload');
  await page.locator('[data-key="start"]').click();
  await toggle.click();
  check((await toggle.getAttribute('aria-pressed')) === 'false', 'the sound switch turns off again');
  check(errors.length === 0, 'the sound switch makes no browser errors', errors);
  await context.close();
}

const running = page =>
  page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);

async function reducedMotion() {
  {
    const { context, page } = await openJourney(browser, road());
    check((await running(page)) === 0, 'reduced motion: nothing runs on the road', await running(page));
    await context.close();
  }
  {
    const { context, page } = await openJourney(browser, encounter());
    check((await running(page)) === 0, 'reduced motion: nothing runs in an encounter', await running(page));
    await context.close();
  }
  {
    const near = onRoad(newGame('dev'), 95, { fuel: 30, food: 60 });
    const { context, page } = await openJourney(browser, near);
    await page.locator('[data-key="travel"]').click();
    const state = await readGame(page);
    check(state.phase !== 'travel', 'reduced motion: the drive arrives at the stop', state.phase);
    check((await running(page)) === 0, 'reduced motion: nothing runs after an arrival', await running(page));
    await context.close();
  }
}

async function stylesheetBudgets() {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = source.indexOf(':root {');
  let depth = 0;
  let end = start;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  const tokens = source.slice(start, end);
  const rest = source.slice(0, start) + source.slice(end);
  const defined = Object.fromEntries(
    [...tokens.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2]]),
  );
  const resolve = value => {
    let text = value.trim();
    for (let round = 0; round < 5; round += 1)
      text = text.replace(/var\((--[\w-]+)\)/g, (all, name) => defined[name] ?? all);
    return text;
  };
  const sizes = [...rest.matchAll(/font-size\s*:\s*([^;}]+)/g)].map(match => resolve(match[1]));
  const tooSmall = sizes.filter(size => {
    const rem = size.match(/^([\d.]+)rem$/);
    const px = size.match(/^([\d.]+)px$/);
    if (rem) return Number(rem[1]) < 0.75;
    if (px) return Number(px[1]) < 12;
    return !/^(inherit|1rem|[\d.]+rem)$/.test(size);
  });
  check(tooSmall.length === 0, 'no font-size under 0.75rem or 12px, and every size in rem', tooSmall);
  const literals = rest.match(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:black|white)\b(?!-)/gi) ?? [];
  check(literals.length <= 12, 'at most 12 colour literals outside the token block', literals);
  const spacings = new Set([...source.matchAll(/letter-spacing\s*:\s*([^;}]+)/g)].map(match => resolve(match[1])));
  check(spacings.size <= 4, 'at most four letter-spacings', [...spacings]);
  check(/@font-face\s*{[^}]*Portland Pixel[^}]*font-display:\s*swap/.test(source), 'the face is declared with swap');
}

/** Screenshots of every screen at three sizes, for the eye. */
async function screenshots() {
  for (const [width, height] of SHOT_SIZES) {
    const size = `${width}x${height}`;
    {
      const { context, page } = await openPage(browser, {
        width,
        height,
        storage: { [SAVE_KEY]: saveRecord(road()) },
      });
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`title-${size}`) });
      await page.locator('[data-key="start"]').click();
      // A journey is on file, so starting over asks first.
      await page.locator('#confirm-dialog[open]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`confirm-${size}`) });
      await page.locator('#confirm-dialog [data-key="confirm"]').click();
      await page.locator('[data-key="back-title"]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`step1-${size}`) });
      await page.screenshot({ path: shotPath(`step1-${size}-full`), fullPage: true });
      await page.locator('[data-key="to-crew"]').click();
      await page.locator('[data-key="pack"]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`step2-${size}`), fullPage: true });
      await context.close();
    }
    for (const [name, game] of [
      ['shop', shop()],
      ['stop', stop()],
      ['road', banded()],
      ['encounter', encounter()],
      ['won', won],
      ['lost', lost],
    ]) {
      const { context, page } = await openJourney(browser, game, { width, height });
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`${name}-${size}`) });
      if (name !== 'encounter') await page.screenshot({ path: shotPath(`${name}-${size}-full`), fullPage: true });
      await context.close();
    }
    {
      const victim = withEncounter(onRoad(newGame('dev'), 140), 'tiktok_distraction');
      for (const member of victim.party) member.health = 1;
      const { context, page } = await openJourney(browser, victim, { width, height });
      await page.locator('#event-dialog [data-key="event:continue"]').click();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`outcome-${size}`) });
      await page.locator('#event-dialog [data-key="event:done"]').click();
      await page.locator('#memorial-dialog[open]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`memorial-${size}`) });
      await context.close();
    }
    {
      const { context, page } = await openJourney(browser, won, { width, height });
      await page.locator('[data-key="ending-journal"]').click();
      await page.locator('#journal-dialog[open]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`journal-${size}`) });
      await context.close();
    }
    {
      const { context, page } = await openPage(browser, { width, height, storage: { [SAVE_KEY]: saveRecord(road()) } });
      await page.locator('[data-key="transfer"]').click();
      await page.locator('#transfer-dialog[open]').waitFor();
      await fontsReady(page);
      await page.screenshot({ path: shotPath(`transfer-${size}`) });
      await context.close();
    }
  }
  check(true, 'screenshots written to app/test-results/look/');
}

// The fixtures must be what their names say before the browser draws them.
check(won.outcome === 'won' && lost.outcome === 'lost', 'the ending fixtures are one won and one lost journey');
check(
  availableActions(encounter()).some(option => option.group === 'event'),
  'the encounter fixture has an encounter pending',
);

try {
  await step('typeface', typeface);
  await step('text sizes', textSizes);
  await step('health bars', healthBars);
  await step('route map', routeMap);
  await step('toasts', toastTones);
  await step('focus ring', focusRing);
  await step('sound switch', soundSwitch);
  await step('reduced motion', reducedMotion);
  await step('stylesheet budgets', stylesheetBudgets);
  await step('screenshots', screenshots);
} finally {
  await browser.close();
}
await report.finish('look and feel');
