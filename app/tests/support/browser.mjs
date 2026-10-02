// Shared pieces of the browser suites: the browser launch, fixtures stored as the save record, reading the
// saved journey back, a layout probe and a small reporter. Every suite prints one summary line, writes a JSON
// report under app/test-results/<suite>/ and exits non-zero when a check failed.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCATIONS } from '../../src/data.js';
import { createGame, serializeGame } from '../../src/engine.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const SAVE_KEY = 'the-portland-trail:save';
export const RECORDS_KEY = 'the-portland-trail:records';
export const LEGACY_KEY = 'the-portland-trail:v1';
export const LEGACY_LEG_KEY = 'the-portland-trail:last-leg:v1';
export const SOURCE_URL = process.env.TEST_URL || 'http://127.0.0.1:4387/';
export const DIST_URL = process.env.TEST_DIST_URL || SOURCE_URL;
const RESULTS = fileURLToPath(new URL('../../test-results/', import.meta.url));

export function launch() {
  return chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
}

/** The save record the interface writes, holding this journey. */
export function saveRecord(game, lastLeg = null) {
  return JSON.stringify({
    app: 'the-portland-trail',
    format: 2,
    game: JSON.parse(serializeGame(game)),
    ui: { lastLeg },
  });
}

/** A state as the save writes it and reads it back: plain data for deep comparison. */
export const plain = game => JSON.parse(serializeGame(game));

/**
 * A reporter. `check` records a result and keeps going; `step` runs one case and records an exception as a
 * failure, so one broken case does not hide the others.
 */
export function suite(name) {
  const checks = [];
  const failures = [];
  const check = (ok, label, evidence) => {
    const passed = Boolean(ok);
    checks.push({ label, passed, ...(passed || evidence === undefined ? {} : { evidence }) });
    if (!passed) failures.push(evidence === undefined ? label : `${label}: ${JSON.stringify(evidence)}`);
    return passed;
  };
  return {
    check,
    async step(label, run) {
      try {
        await run();
      } catch (error) {
        check(false, `${label} threw`, String(error?.message ?? error).split('\n')[0]);
      }
    },
    /** Writes the report, prints the summary line and the failures, and sets the exit code. */
    async finish(note) {
      const folder = join(RESULTS, name);
      await mkdir(folder, { recursive: true });
      await writeFile(
        join(folder, 'report.json'),
        JSON.stringify({ suite: name, passed: !failures.length, checks, failures }, null, 2) + '\n',
      );
      for (const failure of failures) console.log(`  ✗ ${failure}`);
      console.log(`${name}: ${checks.length} checks, ${failures.length} failed${note ? ` (${note})` : ''}.`);
      process.exitCode = failures.length ? 1 : 0;
    },
    folder: join(RESULTS, name),
  };
}

/**
 * Opens the game in a new context. `storage` (key → text) is written into localStorage before the first load
 * only, so later reloads see what the game itself saved. `permissions` are granted to the context (for example
 * the clipboard's). Page errors, console errors and failed responses are collected in `errors`.
 */
export async function openPage(
  browser,
  {
    url = SOURCE_URL,
    width = 390,
    height = 664,
    storage = null,
    motion = 'reduce',
    mobile = width < 1000,
    permissions = [],
  } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: motion,
    isMobile: mobile,
    hasTouch: mobile,
    permissions,
  });
  if (storage) {
    await context.addInitScript(entries => {
      if (sessionStorage.getItem('fixture-loaded')) return;
      for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
      sessionStorage.setItem('fixture-loaded', 'yes');
    }, storage);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on('dialog', dialog => {
    errors.push(`browser dialog: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  await page.goto(url);
  await page.locator('[data-key="start"]').waitFor();
  return { context, page, errors };
}

/** Opens the game with this journey saved and resumes it. */
export async function openJourney(browser, game, options = {}) {
  const opened = await openPage(browser, { ...options, storage: { [SAVE_KEY]: saveRecord(game, options.lastLeg) } });
  await opened.page.locator('[data-key="resume"]').click();
  await opened.page.locator('[data-region="scene"]').waitFor();
  return opened;
}

/** The whole save record, parsed; null when there is none. */
export function readRecord(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SAVE_KEY);
}

/** The stored best journeys; [] when there are none. */
export function readRecords(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '[]'), RECORDS_KEY);
}

/** The saved journey; null when there is none. */
export async function readGame(page) {
  return (await readRecord(page))?.game ?? null;
}

/** A rectangle for the first element matching the selector, or null. */
export function rectOf(page, selector) {
  return page.evaluate(css => {
    const element = document.querySelector(css);
    if (!element) return null;
    const { x, y, width, height, bottom, right } = element.getBoundingClientRect();
    return { x, y, width, height, bottom, right };
  }, selector);
}

/**
 * What the layout checks need: horizontal overflow, images that did not load, controls under 43.5px in
 * either direction and editable controls with text under 16px. Only rendered controls count, and only those
 * in an open dialog or outside any dialog.
 */
export async function probeLayout(page) {
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  return page.evaluate(() => {
    const shown = element => element.getClientRects().length > 0 && !element.closest('dialog:not([open])');
    const label = element =>
      (element.getAttribute('data-key') || element.getAttribute('aria-label') || element.textContent || '')
        .trim()
        .slice(0, 40);
    const controls = [...document.querySelectorAll('button, input, select, summary, a[href]')].filter(shown);
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      broken: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
      small: controls
        .filter(element => {
          const box = element.getBoundingClientRect();
          return box.width < 43.5 || box.height < 43.5;
        })
        .map(element => {
          const box = element.getBoundingClientRect();
          return { control: label(element), width: Math.round(box.width), height: Math.round(box.height) };
        }),
      smallText: [...document.querySelectorAll('input, select')]
        .filter(shown)
        .filter(element => parseFloat(getComputedStyle(element).fontSize) < 16)
        .map(element => ({ control: label(element), font: getComputedStyle(element).fontSize })),
    };
  });
}

/** True when the dialog with this id is open. */
export function dialogOpen(page, id) {
  return page.locator(`#${id}`).evaluate(dialog => dialog.open);
}

/** The text of every toast now on screen, with its tone. */
export function toasts(page) {
  return page
    .locator('#toasts .toast')
    .evaluateAll(list => list.map(toast => ({ tone: toast.dataset.tone, text: toast.textContent.trim() })));
}

export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// --- Fixtures: journeys built with the engine -------------------------------------------------------------

/** A fresh journey in the starting shop. */
export const newGame = (profession = 'dev', seed = 21) => createGame({ profession, seed });

/** A copy of the journey on the road at this mile, with any supplies changed. */
export function onRoad(game, mile, inventory = {}) {
  const next = structuredClone(game);
  Object.assign(next, { phase: 'travel', distance: mile });
  Object.assign(next.inventory, inventory);
  return checked(next);
}

/** A copy of the journey stopped (not shopping) at this stop, with any supplies changed. */
export function atStop(game, stopId, inventory = {}) {
  const next = structuredClone(game);
  Object.assign(next, { phase: 'location', distance: LOCATIONS.find(stop => stop.id === stopId).miles });
  Object.assign(next.inventory, inventory);
  return checked(next);
}

/** A copy of the journey with this encounter pending. */
export function withEncounter(game, eventId) {
  const next = structuredClone(game);
  next.flags.nextToken += 1;
  next.pendingEvent = { id: eventId, token: next.flags.nextToken };
  return checked(next);
}

/** The journey, after checking that the save accepts it unchanged. */
function checked(game) {
  serializeGame(game);
  return game;
}
