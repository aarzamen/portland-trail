// Whole journeys through the visible controls, and what follows the end: the scored ending with its headstones
// (F4, B18), best-journey records, the whole journal (E4), Copy result and Share, Replay this seed, Start another
// journey (B16), moving a journey between devices (F13), the title's best score and the multi-tab title.
//
// The seeds were chosen by playing the real engine with the balance bots of spec 3.11 (app/scripts/balance.mjs)
// and are checked again below before the browser plays them, so a retune that changes an outcome fails loudly:
//   - WIN: the Influencer on seed 5 with the careful policy wins on day 20 with all five alive, through two
//     outbreaks, eight other encounters, a rest, talks, a meal and the ability. Played at 1440×900.
//   - LOSS: the Prepper on seed 3 never shops: drives, trades the luggage, then pushes; everyone falls near mile
//     750 ("Roadside Legend"). Played at 390×664.
//   - FALLEN_WIN: the Influencer on seed 14 with the autopilot policy wins with two travelers fallen; it is played
//     by the engine and loaded as a fixture, for the headstones on a won ending.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { BOTS } from '../scripts/balance.mjs';
import {
  availableActions,
  createGame,
  deserializeGame,
  serializeGame,
  shareText,
  statusOf,
  summarize,
  transition,
} from '../src/engine.js';
import {
  RECORDS_KEY,
  SAVE_KEY,
  dialogOpen,
  launch,
  newGame,
  openPage,
  pause,
  plain,
  probeLayout,
  readGame,
  readRecord,
  readRecords,
  saveRecord,
  suite,
  toasts,
} from './support/browser.mjs';

const BOT = Object.fromEntries(BOTS.map(bot => [bot.id, bot]));
const WIN = { profession: 'influencer', seed: 5, bot: BOT.careful, width: 1440, height: 900 };
const LOSS = { profession: 'prepper', seed: 3, bot: BOT['never-shops'], width: 390, height: 664 };
const FALLEN_WIN = { profession: 'influencer', seed: 14, bot: BOT.autopilot };
const CLIPBOARD = ['clipboard-read', 'clipboard-write'];
const MAX_ACTIONS = 400;

const report = suite('browser-journey');
const { check, step } = report;
const browser = await launch();

const money = value => `$${Number(value).toLocaleString('en-US')}`;
const rentLine = summary =>
  `Your ${money(summary.money)} covers ${summary.rentDays} ${summary.rentDays === 1 ? 'day' : 'days'} of ` +
  'Portland rent.';
const shot = (page, name) => page.screenshot({ path: join(report.folder, `${name}.png`), fullPage: true });
const viewShot = (page, name) => page.screenshot({ path: join(report.folder, `${name}.png`) });
const clipboard = page => page.evaluate(() => navigator.clipboard.readText());
const recordsOf = (list, summary) =>
  list.filter(
    entry =>
      entry.seed === summary.seed &&
      entry.day === summary.day &&
      entry.distance === summary.distance &&
      entry.score === summary.score,
  );

/** Plays a journey with a bot in the engine alone: the end state and the action types it used. */
function playInEngine({ profession, seed, bot }) {
  let state = createGame({ profession, seed });
  const memory = { shopped: new Set(), rests: new Map() };
  const used = new Set();
  for (let count = 0; count < 1500 && !state.outcome; count += 1) {
    const action = bot.choose(state, memory);
    used.add(action.type);
    state = transition(state, action).state;
  }
  return { state, used };
}

/** One turn of the page's task queue: a dialog's close event, and the dialog it opens next, have run. */
const nextTask = page => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));

/** Answers memorials with Leave it and encounter results with Keep going, until neither is open. */
async function settle(page) {
  for (let round = 0; round < 20; round += 1) {
    await nextTask(page);
    if (await dialogOpen(page, 'memorial-dialog')) {
      await page.locator('#memorial-dialog [data-key="leave"]').click();
      continue;
    }
    const done = page.locator('#event-dialog[open] [data-key="event:done"]');
    if (!(await done.count())) return;
    await done.click();
  }
}

/** The visible control that sends this action, used the way a player would. */
async function perform(page, state, action) {
  if (action.type === 'setPace' || action.type === 'setRations') {
    await page
      .locator(`[data-key="${action.type}"]`)
      .selectOption(action[action.type === 'setPace' ? 'pace' : 'rations']);
    return;
  }
  if (action.type === 'resolveEvent') {
    const key = action.choiceId ? `event:${action.choiceId}` : 'event:continue';
    await page.locator(`#event-dialog [data-key="${key}"]`).click();
    return;
  }
  const option = availableActions(state).find(entry => isDeepStrictEqual(entry.action, action));
  const key = option?.key ?? action.type;
  await page.locator(`#app [data-key="${key}"]`).click();
}

/**
 * Title → background → crew with a seed of its own → the whole journey, each decision made by the bot from the
 * saved state and sent through the visible controls. The engine plays the same actions alongside; after every
 * action the saved journey must equal the engine's.
 */
async function playThrough(page, { profession, seed, bot }) {
  await page.locator('[data-key="start"]').click();
  await page.locator(`[data-key="profession:${profession}"]`).click();
  await page.locator('[data-key="to-crew"]').click();
  await page.locator('[data-key="road:own"]').click();
  await page.locator('[data-key="seed"]').fill(String(seed));
  await page.locator('[data-key="pack"]').click();
  await page.locator('[data-region="scene"]').waitFor();
  let mirror = createGame({ profession, seed });
  const memory = { shopped: new Set(), rests: new Map() };
  const used = new Set();
  let mismatch = null;
  let count = 0;
  for (; count < MAX_ACTIONS && !mirror.outcome && !mismatch; count += 1) {
    await settle(page);
    const saved = deserializeGame(JSON.stringify(await readGame(page)));
    if (!isDeepStrictEqual(plain(saved), plain(mirror))) {
      mismatch = { count, saved: saved && { day: saved.day, distance: saved.distance }, at: mirror.distance };
      break;
    }
    const action = bot.choose(saved, memory);
    used.add(action.type);
    await perform(page, saved, action);
    mirror = transition(mirror, action).state;
  }
  await settle(page);
  if (!mismatch && !isDeepStrictEqual(await readGame(page), plain(mirror))) mismatch = { count, at: 'the end' };
  return { state: mirror, used, mismatch, count };
}

/** The ending's checks shared by every outcome: heading, cause, numbers, rank, rent and one stone per fallen. */
async function endingShows(page, state, at) {
  const summary = summarize(state);
  const panel = page.locator('[data-region="actions"] .ending-panel');
  await panel.waitFor();
  check((await panel.locator('#ending-heading').innerText()) === summary.heading, at('the heading is summarize’s'));
  const text = await panel.innerText();
  check(!summary.cause || text.includes(summary.cause), at('the cause is summarize’s'), summary.cause);
  check(
    (await panel.locator('[data-score]').getAttribute('data-score')) === String(summary.score) &&
      text.includes(summary.score.toLocaleString('en-US')),
    at('the score is shown'),
    summary.score,
  );
  check(
    text.includes(summary.rank.title) && text.includes(summary.rank.line),
    at('the rank title and line are shown'),
    summary.rank,
  );
  check(text.includes(rentLine(summary)), at('the days of rent are shown'), rentLine(summary));
  const stats = await panel.locator('.ending-stats').innerText();
  check(
    stats.includes(summary.distance.toLocaleString('en-US')) &&
      stats.includes(String(summary.day)) &&
      stats.includes(String(summary.survivors.length)),
    at('miles, days and survivors are shown'),
    stats,
  );
  const stones = panel.locator('[data-headstone]');
  check((await stones.count()) === summary.fallen.length, at('one headstone per fallen traveler'), {
    stones: await stones.count(),
    fallen: summary.fallen.length,
  });
  for (const member of summary.fallen) {
    const stone = await panel.locator(`[data-headstone="${member.id}"]`).innerText();
    check(
      stone.includes(member.name) && stone.includes(member.line) && stone.includes(member.epitaph),
      at(`${member.name}’s headstone shows the name, the death line and the epitaph`),
      stone,
    );
    check(
      (await panel.locator(`[data-key="epitaph:${member.id}"]`).count()) === 1,
      at(`${member.name}’s headstone can be edited`),
    );
  }
  check((await panel.locator('[data-seed]').innerText()).includes(String(summary.seed)), at('the seed is shown'));
  return summary;
}

/** No overflow, nothing broken, controls large enough below 1000px wide. */
async function layoutHolds(page, at, label) {
  const probe = await probeLayout(page);
  check(probe.scrollWidth <= probe.width, at(`${label}: no horizontal overflow`), probe.scrollWidth);
  check(probe.broken.length === 0, at(`${label}: every image loads`), probe.broken);
  if (probe.width < 1000) {
    check(probe.small.length === 0, at(`${label}: every control is at least 44px`), probe.small);
    check(probe.smallText.length === 0, at(`${label}: editable text is at least 16px`), probe.smallText);
  }
}

/** The whole-journal dialog: every stored line, newest first, grouped by day. */
async function journalLists(page, state, opener, at) {
  await page.locator(opener).click();
  check(await dialogOpen(page, 'journal-dialog'), at('the whole journal opens'));
  const lines = await page.locator('#journal-dialog li').allInnerTexts();
  const expected = [...state.journal].reverse().map(entry => entry.text);
  check(isDeepStrictEqual(lines, expected), at('the journal lists every stored line, newest first'), {
    shown: lines.length,
    stored: expected.length,
    first: lines[0],
  });
  const days = await page
    .locator('#journal-dialog [data-day]')
    .evaluateAll(list => list.map(e => Number(e.dataset.day)));
  const stored = [...new Set([...state.journal].reverse().map(entry => entry.day))];
  check(isDeepStrictEqual(days, stored), at('the lines are grouped by day, latest day first'), days);
  await layoutHolds(page, at, 'the journal dialog');
}

// --- The winning journey -----------------------------------------------------------------------------------

async function winningJourney() {
  const at = label => `win ${WIN.width}: ${label}`;
  const expected = playInEngine(WIN);
  check(expected.state.outcome === 'won', at(`the engine wins seed ${WIN.seed} with the careful policy`));
  const { context, page, errors } = await openPage(browser, {
    width: WIN.width,
    height: WIN.height,
    permissions: CLIPBOARD,
  });
  try {
    const played = await playThrough(page, WIN);
    check(!played.mismatch, at('the saved journey follows the engine after every action'), played.mismatch);
    check(played.state.outcome === 'won', at('the journey through the controls is won'), played.state.outcome);
    check(
      ['autoPurchase', 'talk', 'meal', 'rest', 'ability', 'resolveEvent'].every(type => played.used.has(type)),
      at('the careful policy shopped, talked, ate, rested, used the ability and met encounters'),
      [...played.used],
    );
    const state = played.state;
    const summary = await endingShows(page, state, at);
    check(summary.fallen.length === 0, at('everyone arrived, so no headstones'), summary.fallen.length);
    await shot(page, 'ending-won-1440');

    // Copy result puts shareText on the clipboard.
    await page.locator('[data-key="copy-result"]').click();
    check((await clipboard(page)) === shareText(state), at('Copy result copies shareText'), await clipboard(page));
    check(
      (await toasts(page)).some(toast => toast.tone === 'ok'),
      at('a toast confirms the copy'),
      await toasts(page),
    );

    // The whole journal, from the journal region.
    await journalLists(page, state, '[data-region="journal"] [data-key="journal"]', at);
    await viewShot(page, 'journal-1440');
    await page.locator('#journal-dialog [data-key="close-journal"]').click();
    check(!(await dialogOpen(page, 'journal-dialog')), at('the journal closes'));

    // The record: once, still once after a reload and View saved ending.
    check(recordsOf(await readRecords(page), summary).length === 1, at('the ending is recorded once'));
    // Share, where the browser offers it: a stand-in records what would be shared.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: data => {
          window.__shared = data;
          return Promise.resolve();
        },
      });
    });
    await page.reload();
    await page.locator('[data-key="resume"]').waitFor();
    check(
      (await page.locator('[data-key="resume"]').innerText()).includes('View saved ending'),
      at('the title offers View saved ending'),
    );
    const best = await page.locator('[data-best]').innerText();
    check(
      best.includes(summary.score.toLocaleString('en-US')) && best.includes(summary.rank.title),
      at('the title shows the best score and its rank'),
      best,
    );
    await viewShot(page, 'title-1440');
    await page.locator('[data-key="resume"]').click();
    await page.locator('.ending-panel').waitFor();
    check(recordsOf(await readRecords(page), summary).length === 1, at('the record is still single after a reload'));
    const listed = await page.locator('[data-list="records"] li').allInnerTexts();
    check(
      listed.length === 1 && listed[0].includes(summary.score.toLocaleString('en-US')),
      at('best journeys lists this journey'),
      listed,
    );
    await page.locator('[data-key="share"]').click();
    const shared = await page.evaluate(() => window.__shared);
    check(shared?.text === shareText(state), at('Share hands shareText to the browser'), shared);
    await layoutHolds(page, at, 'the ending');

    // Replay this seed: step 1 with the background, then the seed chosen in the road options.
    await page.locator('[data-key="replay"]').click();
    check(!(await dialogOpen(page, 'confirm-dialog')), at('Replay asks no confirmation after an ending'));
    check(
      (await page.locator(`[data-key="profession:${WIN.profession}"]`).getAttribute('aria-checked')) === 'true',
      at('Replay opens step 1 with the same background'),
    );
    await page.locator('[data-key="to-crew"]').click();
    check(
      (await page.locator('[data-key="road:own"]').getAttribute('aria-checked')) === 'true' &&
        (await page.locator('[data-key="seed"]').inputValue()) === String(state.seed),
      at('the road options hold this seed'),
      await page.locator('[data-key="seed"]').inputValue(),
    );
    await page.locator('[data-key="pack"]').click();
    await page.locator('[data-region="scene"]').waitFor();
    const replay = await readGame(page);
    check(replay?.seed === state.seed, at('the new journey’s seed equals the old one'), replay?.seed);
    const names = state.party.map(member => member.name);
    check(
      isDeepStrictEqual(replay, plain(createGame({ profession: WIN.profession, names, seed: WIN.seed }))),
      at('the replay starts as a new journey: mile 0, day 1, a healthy crew'),
      replay && { distance: replay.distance, day: replay.day },
    );
    check(errors.length === 0, at('no browser errors'), errors);
  } finally {
    await context.close();
  }
}

// --- The losing journey ------------------------------------------------------------------------------------

async function losingJourney() {
  const at = label => `loss ${LOSS.width}: ${label}`;
  const expected = playInEngine(LOSS);
  check(
    expected.state.outcome === 'lost' && expected.used.has('tradeLuggage') && expected.used.has('push'),
    at(`the engine loses seed ${LOSS.seed} never shopping, using the last resorts`),
  );
  const { context, page, errors } = await openPage(browser, { width: LOSS.width, height: LOSS.height });
  try {
    const played = await playThrough(page, LOSS);
    check(!played.mismatch, at('the saved journey follows the engine after every action'), played.mismatch);
    check(played.state.outcome === 'lost', at('the journey through the controls is lost'), played.state.outcome);
    check(
      played.used.has('tradeLuggage') && played.used.has('push') && !played.used.has('autoPurchase'),
      at('it never shopped and used the last resorts'),
      [...played.used],
    );
    let state = played.state;
    const summary = await endingShows(page, state, at);
    check(summary.fallen.length === 5, at('five headstones'), summary.fallen.length);
    await shot(page, 'ending-lost-390');
    await layoutHolds(page, at, 'the ending');

    // Editing an epitaph on the ending.
    const first = summary.fallen[0];
    await page.locator(`[data-key="epitaph:${first.id}"]`).click();
    check(await dialogOpen(page, 'memorial-dialog'), at('Edit opens the memorial'));
    check(
      (await page.locator('#memorial-dialog [data-key="epitaph"]').inputValue()) === first.epitaph,
      at('the memorial holds the current epitaph'),
    );
    const words = 'Pushed with feeling, to the very end.';
    await page.locator('#memorial-dialog [data-key="epitaph"]').fill(words);
    await page.locator('#memorial-dialog [data-key="carve"]').click();
    await nextTask(page);
    check(!(await dialogOpen(page, 'memorial-dialog')), at('Carve it closes the memorial'));
    const saved = await readGame(page);
    check(
      saved.party.find(member => member.id === first.id)?.epitaph === words,
      at('the new epitaph is saved through setEpitaph'),
    );
    check(
      (await page.locator(`[data-headstone="${first.id}"]`).innerText()).includes(words),
      at('the headstone shows the new epitaph'),
    );
    check(
      (await page.evaluate(() => document.activeElement?.getAttribute('data-key'))) === `epitaph:${first.id}`,
      at('focus returns to the Edit control'),
    );
    state = deserializeGame(JSON.stringify(saved));

    // The whole journal, from the ending.
    await journalLists(page, state, '[data-key="ending-journal"]', at);
    await viewShot(page, 'journal-390');
    await page.keyboard.press('Escape');
    check(!(await dialogOpen(page, 'journal-dialog')), at('Escape closes the journal'));
    check(recordsOf(await readRecords(page), summary).length === 1, at('the loss is recorded once'));

    // Start another journey goes straight to step 1 (B16); the new journey starts fresh.
    await page.locator('[data-key="new"]').click();
    check(
      !(await dialogOpen(page, 'confirm-dialog')) && (await page.locator('[data-key="to-crew"]').count()) === 1,
      at('Start another journey goes to step 1 without a confirmation (B16)'),
    );
    await page.locator('[data-key="to-crew"]').click();
    await page.locator('[data-key="pack"]').click();
    await page.locator('[data-region="scene"]').waitFor();
    const fresh = await readGame(page);
    check(
      fresh.distance === 0 &&
        fresh.day === 1 &&
        !fresh.outcome &&
        fresh.party.every(member => member.health === 100 && statusOf(member).id === 'good'),
      at('a new journey starts at mile 0 on day 1 with a healthy crew'),
      { distance: fresh.distance, day: fresh.day, health: fresh.party.map(member => member.health) },
    );
    check(recordsOf(await readRecords(page), summary).length === 1, at('the old record stays'));
    check(errors.length === 0, at('no browser errors'), errors);
  } finally {
    await context.close();
  }
}

// --- A won ending with fallen travelers, and ten records at most -------------------------------------------

async function fallenWin() {
  const { state } = playInEngine(FALLEN_WIN);
  const summary = summarize(state);
  check(
    state.outcome === 'won' && summary.fallen.length === 2,
    `the engine wins seed ${FALLEN_WIN.seed} with the autopilot and two fallen`,
  );
  // Ten weaker journeys already on file: this one joins them, the weakest goes.
  const older = Array.from({ length: 10 }, (_, index) => ({
    key: `old-${index}`,
    seed: 1000 + index,
    day: 20,
    distance: 100 + index * 50,
    score: 20 + index * 10,
    outcome: 'lost',
    rank: 'Cautionary Tale',
    professionName: 'Barista',
    survivors: 0,
  }));
  for (const [width, height] of [
    [390, 664],
    [1440, 900],
  ]) {
    const at = label => `won with fallen ${width}: ${label}`;
    const opened = await openPage(browser, {
      width,
      height,
      storage: { [SAVE_KEY]: saveRecord(state), [RECORDS_KEY]: JSON.stringify(older) },
    });
    try {
      await viewShot(opened.page, `title-${width}`);
      await opened.page.locator('[data-key="resume"]').click();
      await endingShows(opened.page, state, at);
      const records = await readRecords(opened.page);
      check(
        records.length === 10 && records[0].score === summary.score && !records.some(entry => entry.key === 'old-0'),
        at('ten best journeys are kept, best first, the weakest dropped'),
        records.map(entry => entry.score),
      );
      const listed = await opened.page.locator('[data-list="records"] li').count();
      check(listed === 5, at('best journeys shows the top five'), listed);
      await shot(opened.page, `ending-won-fallen-${width}`);
      await opened.page.locator('[data-headstone]').first().scrollIntoViewIfNeeded();
      await opened.page.screenshot({ path: join(report.folder, `ending-won-fallen-${width}-view.png`) });
      await layoutHolds(opened.page, at, 'the ending');
      check(opened.errors.length === 0, at('no browser errors'), opened.errors);
    } finally {
      await opened.context.close();
    }
  }
}

// --- Moving a journey between devices ----------------------------------------------------------------------

/** A journey part way along: bought, driven twice, any encounter answered. */
function journeyUnderWay() {
  let state = newGame('barista', 77);
  for (const action of [{ type: 'autoPurchase' }, { type: 'travel' }, { type: 'travel' }]) {
    if (state.pendingEvent) {
      const answer = availableActions(state).find(option => option.enabled);
      state = transition(state, answer.action).state;
    }
    state = transition(state, action).state;
  }
  if (state.pendingEvent) {
    state = transition(state, availableActions(state).find(option => option.enabled).action).state;
  }
  return state;
}

async function openTransfer(page) {
  await page.locator('[data-key="transfer"]').click();
  await page.locator('#transfer-dialog[open]').waitFor();
}

async function transfer() {
  for (const [width, height] of [
    [390, 664],
    [1440, 900],
  ]) {
    const at = label => `transfer ${width}: ${label}`;
    const game = journeyUnderWay();
    const leg = { fromDistance: 0, toDistance: game.distance, fromDay: 1, toDay: game.day, fuelUsed: 3, foodUsed: 4 };
    const lastLeg = { ...leg, arrived: '' };
    const { context, page, errors } = await openPage(browser, {
      width,
      height,
      permissions: CLIPBOARD,
      storage: { [SAVE_KEY]: saveRecord(game, lastLeg) },
    });
    try {
      await openTransfer(page);
      await viewShot(page, `transfer-${width}`);
      await layoutHolds(page, at, 'the transfer dialog');

      // Download save file: the file holds the save record.
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#transfer-dialog [data-key="download-save"]').click(),
      ]);
      const file = JSON.parse(await readFile(await download.path(), 'utf8'));
      check(
        isDeepStrictEqual(file.game, plain(game)) && isDeepStrictEqual(file.ui?.lastLeg, lastLeg),
        at('Download save file holds the journey and its last leg'),
      );
      check(/\.json$/.test(download.suggestedFilename()), at('the file is named .json'), download.suggestedFilename());

      // Copy save code.
      await page.locator('#transfer-dialog [data-key="copy-code"]').click();
      const code = await clipboard(page);
      check(code.startsWith('PT2.'), at('Copy save code copies a PT2 code'), code.slice(0, 12));

      // A truncated code is refused with a toast; nothing changes.
      const before = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
      await page.locator('#transfer-dialog [data-key="import-text"]').fill(code.slice(0, Math.floor(code.length / 2)));
      await page.locator('#transfer-dialog [data-key="import"]').click();
      const refusal = await toasts(page);
      check(
        refusal.length === 1 && refusal[0].tone === 'error',
        at('a truncated code is refused with an amber toast'),
        refusal,
      );
      check(
        await page.locator('#toasts .toast[role="alert"]').isVisible(),
        at('the refusal toast is visible above the dialog'),
      );
      check(
        (await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)) === before,
        at('a refused code changes nothing'),
      );
      check(!(await dialogOpen(page, 'confirm-dialog')), at('a refused code asks nothing'));
      if (width === 390) await viewShot(page, 'transfer-refused-390');

      // Loading over a journey asks first; Keep it changes nothing.
      const other = createGame({ profession: 'dev', seed: 9 });
      await page.locator('#transfer-dialog [data-key="import-text"]').fill(saveRecord(other));
      await page.locator('#transfer-dialog [data-key="import"]').click();
      check(await dialogOpen(page, 'confirm-dialog'), at('loading over a journey asks first'));
      await page.locator('#confirm-dialog [data-key="cancel"]').click();
      check(
        (await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)) === before,
        at('declining keeps the journey'),
      );
      await page.locator('#transfer-dialog [data-key="close-transfer"]').click();
      check(!(await dialogOpen(page, 'transfer-dialog')), at('Close closes the dialog'));

      // Another device: storage cleared, the code pasted, Resume gives the same journey.
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.locator('[data-key="start"]').waitFor();
      check((await page.locator('[data-key="resume"]').count()) === 0, at('a cleared browser has no Resume'));
      await openTransfer(page);
      check(
        (await page.locator('#transfer-dialog [data-key="copy-code"]').count()) === 0,
        at('without a journey there is nothing to copy'),
      );
      await page.locator('#transfer-dialog [data-key="import-text"]').fill(code.slice(0, -6));
      await page.locator('#transfer-dialog [data-key="import"]').click();
      check(
        (await toasts(page)).some(toast => toast.tone === 'error') &&
          (await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)) === null,
        at('a truncated code on an empty device is refused and stores nothing'),
      );
      await page.locator('#transfer-dialog [data-key="import-text"]').fill(code);
      await page.locator('#transfer-dialog [data-key="import"]').click();
      check(!(await dialogOpen(page, 'confirm-dialog')), at('loading on an empty device asks nothing'));
      check(!(await dialogOpen(page, 'transfer-dialog')), at('loading closes the dialog'));
      await page.locator('[data-key="resume"]').click();
      await page.locator('[data-region="scene"]').waitFor();
      const record = await readRecord(page);
      check(isDeepStrictEqual(record?.game, plain(game)), at('Resume gives the same journey'));
      check(isDeepStrictEqual(record?.ui?.lastLeg, lastLeg), at('and the same last leg'));
      check(
        (await page.locator('[data-region="route"] [data-mile]').getAttribute('data-mile')) === String(game.distance),
        at('the route shows the journey’s mile'),
      );

      // Loading a bare state's JSON over this journey, after confirming.
      await page.locator('[data-key="home"]').click();
      await openTransfer(page);
      await page.locator('#transfer-dialog [data-key="import-text"]').fill(serializeGame(other));
      await page.locator('#transfer-dialog [data-key="import"]').click();
      await page.locator('#confirm-dialog [data-key="confirm"]').click();
      check(isDeepStrictEqual(await readGame(page), plain(other)), at('confirming replaces the journey'));
      check(errors.length === 0, at('no browser errors'), errors);
    } finally {
      await context.close();
    }
  }
}

// --- Another tab changes the save --------------------------------------------------------------------------

async function otherTab() {
  const { context, page, errors } = await openPage(browser, { width: 390, height: 664 });
  try {
    const other = await context.newPage();
    await other.goto(page.url());
    await other.locator('[data-key="start"]').waitFor();
    check((await page.locator('[data-key="resume"]').count()) === 0, 'tab one starts without Resume');
    await other.evaluate(([key, text]) => localStorage.setItem(key, text), [SAVE_KEY, saveRecord(newGame())]);
    await page.locator('[data-key="resume"]').waitFor({ timeout: 3000 });
    check(
      (await page.locator('[data-key="resume"]').innerText()).includes('Resume journey'),
      'a save made in another tab gives the title Resume',
    );
    await other.evaluate(key => localStorage.removeItem(key), SAVE_KEY);
    for (let tries = 0; tries < 20 && (await page.locator('[data-key="resume"]').count()); tries += 1) await pause(100);
    check((await page.locator('[data-key="resume"]').count()) === 0, 'a save removed in another tab takes Resume away');
    check(errors.length === 0, 'no browser errors with two tabs', errors);
  } finally {
    await context.close();
  }
}

try {
  await step('winning journey', winningJourney);
  await step('losing journey', losingJourney);
  await step('won ending with fallen travelers', fallenWin);
  await step('transfer', transfer);
  await step('another tab', otherTab);
} finally {
  await browser.close();
}
await report.finish(`win seed ${WIN.seed} at ${WIN.width}, loss seed ${LOSS.seed} at ${LOSS.width}`);
