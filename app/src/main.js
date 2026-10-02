// The controller (spec 9). It keeps the journey, sends every engine action through one dispatch path, saves,
// changes screens through one show path, and asks the views to draw. It holds no rules: what can be done, what
// it costs and why it is refused all come from the engine.

import { BUILD } from './build-info.js';
import { DEFAULT_NAMES, EVENTS, LIMITS, LOCATIONS, NAME_POOL, PROFESSIONS, REGIONS, RULES } from './data.js';
import {
  availableActions,
  createGame,
  currentStop,
  dailySeed,
  forecast,
  lastStop,
  nextStop,
  paceOptions,
  rationOptions,
  recommendSupplies,
  regionAt,
  routeStops,
  seedFromText,
  shopItems,
  statusOf,
  summarize,
  transition,
  weatherName,
} from './engine.js';
import { confirmDialog, encounterDialog, memorialDialog } from './ui/dialogs.js';
import { drawScreen, forget, patchRegions } from './ui/render.js';
import * as sound from './ui/sound.js';
import { PROBLEMS, SAVE_KEY, loadJourney, readSettings, saveJourney } from './ui/storage.js';
import { TRIP_SHELL, sceneIdOf, tripRegions } from './ui/trip-views.js';
import {
  SUPPLY_IDS,
  backgroundView,
  crewView,
  formatNumber,
  phoneArt,
  sceneUrl,
  stampText,
  supplyLabel,
  titleView,
} from './ui/views.js';

const DRIVE_MS = 950;
const TOAST_MS = 5000;
const CUE_MS = 2400;
const TYPE_MS = 18;
const PRIMARY = '[data-key="travel"]';
const EVENT_FOCUS = '[data-key="event:done"], #event-dialog [data-key^="event:"]:not([aria-disabled="true"])';

const app = /** @type {HTMLElement} */ (document.querySelector('#app'));
const banner = /** @type {HTMLElement} */ (document.querySelector('#banner'));
const toastRegion = /** @type {HTMLElement} */ (document.querySelector('#toasts'));
const saveStatus = /** @type {HTMLElement} */ (document.querySelector('#save-status'));
const headerNew = /** @type {HTMLButtonElement} */ (document.querySelector('#new-journey-header'));
const eventDialog = /** @type {HTMLDialogElement} */ (document.querySelector('#event-dialog'));
const memorialElement = /** @type {HTMLDialogElement} */ (document.querySelector('#memorial-dialog'));
const confirmElement = /** @type {HTMLDialogElement} */ (document.querySelector('#confirm-dialog'));

// --- What the interface remembers ------------------------------------------------------------------------

/** @type {any} the journey in play, or on file before it is resumed */
let game = null;
/** @type {any} the receipt of the last drive */
let lastLeg = null;
/** @type {'title'|'background'|'crew'|'game'} */
let screen = 'title';
const setup = { profession: PROFESSIONS[0].id, names: [...DEFAULT_NAMES], road: 'surprise', seedText: '' };
/** @type {string[]} the journal lines of the latest action */
let notes = [];
/** @type {null | { at: number, resources: string[], party: string[], atmosphere: boolean }} */
let cue = null;
let routeOpen = false;
/** @type {Record<string, number>} the quantity chosen in each shop row */
const shopQuantity = {};
/** @type {null | { id: string, text: string }} what is typed in a quantity field while it has focus */
let quantityDraft = null;
/** @type {null | { before: any, notes: string[], started: number, focus: string | null }} */
let playback = null;
/**
 * @type {null | { token: number, id: string, step: 'choose'|'outcome', results: string[], fallen: any[],
 *   error: string, typed: string }}
 */
let encounter = null;
/** @type {{ memberId: string, name: string, line: string, epitaph: string, error: string }[]} */
let memorials = [];
const problems = new Set();
let toastTimer = 0;
let typingTimer = 0;
let offlineNoted = false;

const motionAllowed = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const eventOf = id => EVENTS.find(event => event.id === id);

// --- Messages (spec 9.4) ---------------------------------------------------------------------------------

function clearToast() {
  clearTimeout(toastTimer);
  toastRegion.replaceChildren();
}

/** A transient message near the bottom: 'ok' in the phosphor style, 'error' in amber. */
function toast(message, tone = 'ok') {
  clearToast();
  const element = document.createElement('div');
  element.className = 'toast';
  element.dataset.tone = tone;
  element.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  element.textContent = message;
  toastRegion.append(element);
  toastTimer = window.setTimeout(clearToast, TOAST_MS);
}

function drawChrome() {
  const message = [...problems].join(' ');
  if (banner.textContent !== message) banner.textContent = message;
  banner.hidden = !message;
  headerNew.hidden = screen !== 'game' || !game;
  headerNew.disabled = Boolean(playback);
  let status = 'Local game';
  if (problems.has(PROBLEMS.unsaved) || problems.has(PROBLEMS.unavailable)) status = 'Playing without a save';
  else if (screen === 'game') status = 'Journey saved';
  else if (game) status = 'Journey on file';
  if (saveStatus.textContent !== status) saveStatus.textContent = status;
}

// --- Saving ----------------------------------------------------------------------------------------------

/** Save, and keep the banner true: a save that works ends every storage problem, one that fails is reported. */
function persist() {
  if (saveJourney(game, lastLeg)) {
    for (const problem of Object.values(PROBLEMS)) problems.delete(problem);
  } else {
    problems.add(PROBLEMS.unsaved);
  }
}

/** True when a traveler is dead, as the engine sees it. */
const isDead = member => statusOf(member).id === 'dead';

// --- Drawing ---------------------------------------------------------------------------------------------

function activeCue() {
  if (!cue || playback || performance.now() - cue.at > CUE_MS) return { resources: [], party: [], atmosphere: false };
  return cue;
}

/** The shop's rows with the chosen quantities, held between 0 and what can be bought, and Auto-buy. */
function shopModel(state) {
  const items = shopItems(state).map(item => {
    const quantity = Math.max(0, Math.min(shopQuantity[item.id] ?? 1, item.canBuy));
    shopQuantity[item.id] = quantity;
    let reason = '';
    if (item.canBuy < 1) reason = transition(state, { type: 'purchase', cart: { [item.id]: 1 } }).error ?? '';
    else if (quantity < 1) reason = 'Choose how many to buy.';
    // While its field has focus, a quantity shows exactly what was typed, even an empty field.
    const text = quantityDraft?.id === item.id ? quantityDraft.text : String(quantity);
    return { ...item, qty: quantity, qtyText: text, buyEnabled: quantity >= 1, reason };
  });
  const probe = transition(state, { type: 'autoPurchase' });
  return { items, plan: recommendSupplies(state), autoBuy: { enabled: !probe.error, reason: probe.error ?? '' } };
}

function tripModel() {
  const playing = Boolean(playback);
  const state = playing ? playback.before : game;
  const ended = state.phase === 'ended';
  return {
    state,
    playing,
    options: availableActions(state),
    forecast: ended ? null : forecast(state),
    summary: ended ? summarize(state) : null,
    shop: state.phase === 'shop' ? shopModel(state) : null,
    paces: paceOptions(state),
    rations: rationOptions(state),
    notes: playing ? playback.notes : notes,
    lastLeg,
    routeOpen,
    cue: activeCue(),
    professionName: PROFESSIONS.find(item => item.id === state.profession)?.name ?? '',
    weather: weatherName(state),
    stop: currentStop(state),
    next: nextStop(state.distance),
    region: regionAt(state.distance),
    crew: state.party.map(member => ({
      id: member.id,
      name: member.name,
      health: member.health,
      status: statusOf(member),
      // The bar's colour follows health alone, so a sick traveler's bar still shows how much is left.
      band: statusOf({ health: member.health, sick: false }).id,
      epitaph: member.epitaph,
    })),
    stops: routeStops(state),
    goal: RULES.goalMiles,
  };
}

function screenHtml() {
  if (screen === 'background') return backgroundView({ selected: setup.profession });
  if (screen === 'crew') {
    return crewView({
      names: setup.names,
      maxName: LIMITS.name,
      road: /** @type {any} */ (setup.road),
      seedText: setup.seedText,
      dailySeed: dailySeed(),
    });
  }
  return titleView({ saved: game ? { ended: game.phase === 'ended' } : null, stamp: stampText(BUILD) });
}

/** Draw the current screen, then open whatever dialog the journey is waiting on. */
function draw() {
  if (screen === 'game' && game) {
    drawScreen(app, TRIP_SHELL);
    patchRegions(app, tripRegions(tripModel()), PRIMARY);
  } else {
    drawScreen(app, screenHtml());
  }
  app.inert = Boolean(playback);
  app.setAttribute('aria-busy', String(Boolean(playback)));
  drawChrome();
  if (screen === 'game' && game && !playback) openDialogs();
}

/** The one path for every change of screen. Transient messages do not follow the player (B12). */
function show(next) {
  if (playback) return;
  screen = next;
  clearToast();
  if (next !== 'game') {
    for (const dialog of [eventDialog, memorialElement, confirmElement]) if (dialog.open) dialog.close();
  }
  draw();
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  if (!document.querySelector('dialog[open]')) app.focus({ preventScroll: true });
}

// --- Dialogs: memorials, then the encounter (spec 9.3 steps 4 to 6) --------------------------------------

function openDialogs() {
  if (memorialElement.open || confirmElement.open) return;
  if (encounter?.step === 'outcome') {
    drawEncounter();
    return;
  }
  if (memorials.length) {
    if (eventDialog.open) eventDialog.close();
    drawMemorial();
    return;
  }
  const pending = game?.pendingEvent;
  if (pending) {
    if (!encounter || encounter.token !== pending.token) {
      const full = eventOf(pending.id).description;
      encounter = {
        token: pending.token,
        id: pending.id,
        step: 'choose',
        results: [],
        fallen: [],
        error: '',
        typed: '',
      };
      encounter.typed = motionAllowed() ? '' : full;
      sound.play('event');
    }
    drawEncounter();
    return;
  }
  encounter = null;
  if (eventDialog.open) {
    eventDialog.close();
    focusPrimary();
  }
}

function focusPrimary() {
  const target = app.querySelector(PRIMARY) ?? app.querySelector('[data-key]');
  if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  else app.focus({ preventScroll: true });
}

function drawEncounter() {
  const event = eventOf(encounter.id);
  const options = encounter.step === 'choose' ? availableActions(game).filter(option => option.group === 'event') : [];
  const html = encounterDialog({
    event,
    step: encounter.step,
    options,
    results: encounter.results,
    typed: encounter.typed,
    error: encounter.error,
  });
  drawScreen(eventDialog, html, EVENT_FOCUS);
  if (!eventDialog.open) {
    eventDialog.showModal();
    const first = eventDialog.querySelector(EVENT_FOCUS);
    if (first instanceof HTMLElement) first.focus();
  }
  if (encounter.step === 'choose' && encounter.typed.length < event.description.length && !typingTimer) {
    typingTimer = window.setInterval(typeOn, TYPE_MS);
  }
}

/** One more character of the encounter text (L4). */
function typeOn() {
  const full = encounter && eventOf(encounter.id).description;
  if (!encounter || encounter.step !== 'choose' || encounter.typed.length >= full.length) {
    clearInterval(typingTimer);
    typingTimer = 0;
    return;
  }
  encounter.typed = full.slice(0, encounter.typed.length + 1);
  const span = eventDialog.querySelector('[data-typed]');
  if (span) span.textContent = encounter.typed;
}

function completeTyping() {
  if (!encounter || encounter.step !== 'choose') return;
  encounter.typed = eventOf(encounter.id).description;
  const span = eventDialog.querySelector('[data-typed]');
  if (span) span.textContent = encounter.typed;
}

function keepGoing() {
  const fallen = encounter?.fallen ?? [];
  encounter = null;
  memorials.push(...fallen);
  eventDialog.close();
  openDialogs();
  if (!document.querySelector('dialog[open]')) focusPrimary();
}

function memorialFor(member) {
  const record = summarize(game).fallen.find(entry => entry.id === member.id);
  return { memberId: member.id, name: member.name, line: record?.line ?? '', epitaph: member.epitaph, error: '' };
}

function drawMemorial() {
  const current = memorials[0];
  drawScreen(memorialElement, memorialDialog({ ...current, max: LIMITS.epitaph }), '[data-key="epitaph"]');
  if (!memorialElement.open) {
    memorialElement.showModal();
    sound.play('death');
    const field = memorialElement.querySelector('[data-key="epitaph"]');
    if (field instanceof HTMLInputElement) field.focus();
  }
}

function carve() {
  const current = memorials[0];
  const field = memorialElement.querySelector('[data-key="epitaph"]');
  const text = field instanceof HTMLInputElement ? field.value : '';
  // A refused epitaph stays in the field, to be corrected.
  current.epitaph = text;
  if (dispatch({ type: 'setEpitaph', memberId: current.memberId, text })) memorialElement.close();
}

function openConfirm() {
  drawScreen(
    confirmElement,
    confirmDialog({
      overline: 'Saved journey',
      title: 'Start over?',
      text: 'Your current journey will be replaced when the new crew leaves the city.',
      confirm: 'Start a new journey',
      cancel: 'Keep playing',
    }),
  );
  confirmElement.showModal();
  const cancel = confirmElement.querySelector('[data-key="cancel"]');
  if (cancel instanceof HTMLElement) cancel.focus();
}

// --- The one path for engine actions ---------------------------------------------------------------------

const arrivedAt = state =>
  state.phase === 'location' || state.outcome === 'won' ? lastStop(state.distance).shortName : '';
const twoDecimals = value => Math.round(value * 100) / 100;

/** The receipt of a drive (or a push), and the miles an encounter adds to it. */
function updateLeg(before, after, action) {
  const moved = after.distance > before.distance || after.day > before.day;
  if ((action.type === 'travel' || action.type === 'push') && moved) {
    lastLeg = {
      fromDistance: before.distance,
      toDistance: after.distance,
      fromDay: before.day,
      toDay: after.day,
      fuelUsed: Math.max(0, twoDecimals(before.inventory.fuel - after.inventory.fuel)),
      foodUsed: Math.max(0, twoDecimals(before.inventory.food - after.inventory.food)),
      arrived: arrivedAt(after),
    };
  } else if (action.type === 'resolveEvent' && lastLeg && after.distance > before.distance) {
    lastLeg = { ...lastLeg, toDistance: after.distance, toDay: after.day, arrived: arrivedAt(after) };
  }
}

function soundsFor(before, after, action, fallen) {
  if (after.outcome && !before.outcome) sound.play(after.outcome === 'won' ? 'win' : 'lose');
  else if (action.type === 'purchase' || action.type === 'autoPurchase') sound.play('buy');
  else if (after.phase === 'location' && before.phase !== 'location' && after.distance !== before.distance) {
    sound.play('arrive');
  } else if (action.type === 'resolveEvent') {
    const hurt = after.party.some((member, index) => member.health < before.party[index].health);
    sound.play(fallen.length || hurt ? 'bad' : 'good');
  }
}

/** A toast that says what Auto-buy packed. */
function packedMessage(before, after) {
  const bought = SUPPLY_IDS.filter(id => id !== 'money' && after.inventory[id] > before.inventory[id]).map(
    id => `${after.inventory[id] - before.inventory[id]} ${supplyLabel(id).toLowerCase()}`,
  );
  const spent = formatNumber(before.inventory.money - after.inventory.money);
  return `Packed ${bought.join(', ')} for $${spent}. $${formatNumber(after.inventory.money)} left for the road.`;
}

/**
 * Send one action to the engine. A refusal is shown where the player is looking: in the open dialog, or as an
 * amber toast. On success: save, play the drive from the previous state (B7), draw, then memorials and the
 * encounter. Returns true when the engine accepted the action.
 */
function dispatch(action) {
  if (!game || playback) return false;
  clearToast();
  const before = game;
  const result = transition(game, action);
  if (result.error) {
    if (memorialElement.open && memorials.length) {
      memorials[0].error = result.error;
      drawMemorial();
    } else if (eventDialog.open && encounter) {
      encounter.error = result.error;
      drawEncounter();
    } else {
      toast(result.error, 'error');
    }
    return false;
  }
  game = result.state;
  const previousNotes = notes;
  if (result.notes.length) notes = result.notes;
  updateLeg(before, game, action);
  cue = {
    at: performance.now(),
    resources: SUPPLY_IDS.filter(id => before.inventory[id] !== game.inventory[id]),
    party: game.party
      .filter(
        (member, index) => member.health !== before.party[index].health || member.sick !== before.party[index].sick,
      )
      .map(member => member.id),
    atmosphere:
      game.phase === 'location' &&
      (before.distance !== game.distance || ['rest', 'forage', 'talk', 'meal', 'resolveEvent'].includes(action.type)),
  };
  persist();
  const fallen = game.party.filter((member, index) => isDead(member) && !isDead(before.party[index]));
  soundsFor(before, game, action, fallen);
  if (action.type === 'resolveEvent') {
    encounter = { ...encounter, step: 'outcome', results: result.notes, fallen: fallen.map(memorialFor), error: '' };
  } else {
    memorials.push(...fallen.map(memorialFor));
  }
  if (action.type === 'autoPurchase') toast(packedMessage(before, game), 'ok');
  if (action.type === 'travel' && game.distance > before.distance && motionAllowed()) {
    startDrive(before, previousNotes);
    return true;
  }
  draw();
  return true;
}

// --- The drive (B7, E3) ----------------------------------------------------------------------------------

function preload(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
}

function startDrive(before, previousNotes) {
  const active = document.activeElement;
  const focus = active instanceof HTMLElement ? active.getAttribute('data-key') : null;
  playback = { before, notes: previousNotes, started: performance.now(), focus };
  preload(sceneUrl(sceneIdOf(game, currentStop(game), regionAt(game.distance)), phoneArt()));
  if (game.pendingEvent) preload(sceneUrl(eventOf(game.pendingEvent.id).scene, phoneArt()));
  sound.play('drive');
  draw();
  requestAnimationFrame(stepDrive);
}

function stepDrive(now) {
  if (!playback) return;
  const progress = Math.max(0, Math.min(1, (now - playback.started) / DRIVE_MS));
  const eased = 1 - (1 - progress) ** 2;
  const from = playback.before.distance;
  const mile = Math.round(from + (game.distance - from) * eased);
  const set = (selector, apply) => {
    const element = app.querySelector(selector);
    if (element instanceof HTMLElement) apply(element);
  };
  set('[data-trip-distance]', element => (element.textContent = mile.toLocaleString('en-US')));
  set('[data-trip-progress]', element => (element.style.width = `${(mile / RULES.goalMiles) * 100}%`));
  set('[data-mile]', element => element.setAttribute('data-mile', String(mile)));
  set('.route-track', element => element.setAttribute('aria-valuenow', String(mile)));
  set('[data-drive-distance]', element => (element.textContent = `+${mile - from} mi`));
  if (progress < 1) {
    requestAnimationFrame(stepDrive);
    return;
  }
  const { focus } = playback;
  playback = null;
  draw();
  if (!document.querySelector('dialog[open]')) {
    const target = (focus && app.querySelector(`[data-key="${CSS.escape(focus)}"]`)) || app.querySelector(PRIMARY);
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  }
}

// --- Setup -----------------------------------------------------------------------------------------------

function startNewJourney() {
  if (playback) return;
  if (game && !game.outcome) openConfirm();
  else show('background');
}

function shuffleNames() {
  const pool = [...NAME_POOL];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[other]] = [pool[other], pool[index]];
  }
  setup.names = pool.slice(0, setup.names.length);
  draw();
}

function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function packVan() {
  let seed;
  if (setup.road === 'daily') seed = dailySeed();
  else if (setup.road === 'own') {
    if (!setup.seedText.trim()) {
      toast('Type a seed, or choose another road.', 'error');
      const field = app.querySelector('[data-key="seed"]');
      if (field instanceof HTMLElement) field.focus();
      return;
    }
    seed = seedFromText(setup.seedText);
  } else seed = randomSeed();
  const names = setup.names.map((name, index) => (name.trim() ? name : DEFAULT_NAMES[index]));
  try {
    game = createGame({ profession: setup.profession, names, seed });
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error');
    return;
  }
  lastLeg = null;
  notes = [game.journal.at(-1).text];
  cue = null;
  routeOpen = false;
  encounter = null;
  memorials = [];
  for (const id of Object.keys(shopQuantity)) delete shopQuantity[id];
  persist();
  show('game');
}

/** Arrow keys move through a radio group (backgrounds, roads); the choice follows focus. */
function moveRadio(target, step) {
  const group = target.closest('[role="radiogroup"]');
  const radios = [...group.querySelectorAll('[role="radio"]')];
  const next = radios[(radios.indexOf(target) + step + radios.length) % radios.length];
  choose(next.getAttribute('data-key'));
  const focus = app.querySelector(`[data-key="${CSS.escape(next.getAttribute('data-key'))}"]`);
  if (focus instanceof HTMLElement) focus.focus();
}

/** A radio-like choice on a setup screen. Returns true when the key was one. */
function choose(key) {
  if (key.startsWith('profession:')) setup.profession = key.slice('profession:'.length);
  else if (key.startsWith('road:')) setup.road = key.slice('road:'.length);
  else return false;
  draw();
  return true;
}

// --- The shop's stepper ----------------------------------------------------------------------------------

function step(id, change) {
  const row = shopItems(game).find(item => item.id === id);
  if (!row) return;
  const current = shopQuantity[id] ?? 1;
  const next = change === 'max' ? row.canBuy : current + change;
  shopQuantity[id] = Math.max(0, Math.min(next, row.canBuy));
  draw();
}

function buy(id) {
  const quantity = shopQuantity[id] ?? 1;
  const before = game;
  if (dispatch({ type: 'purchase', cart: { [id]: quantity } })) {
    const spent = formatNumber(before.inventory.money - game.inventory.money);
    toast(`Bought ${quantity} ${supplyLabel(id).toLowerCase()} for $${spent}.`);
    shopQuantity[id] = 1;
    draw();
  }
}

// --- Events ----------------------------------------------------------------------------------------------

function onClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  if (target.closest('#event-dialog .event-text')) completeTyping();
  const control = target.closest('[data-key]');
  if (!control) return;
  const key = control.getAttribute('data-key');
  if (key === 'home') event.preventDefault();
  if (playback) return;
  if (control.closest('#confirm-dialog')) {
    confirmElement.close();
    if (key === 'confirm') show('background');
    return;
  }
  if (control.closest('#memorial-dialog')) {
    if (key === 'leave') memorialElement.close();
    if (key === 'carve') {
      event.preventDefault();
      carve();
    }
    return;
  }
  if (choose(key)) return;
  switch (key) {
    case 'start':
    case 'new':
    case 'new-header':
      startNewJourney();
      return;
    case 'resume':
      if (game) show('game');
      return;
    case 'home':
      show('title');
      return;
    case 'back-title':
      show('title');
      return;
    case 'to-crew':
      show('crew');
      return;
    case 'back-background':
      show('background');
      return;
    case 'shuffle':
      shuffleNames();
      return;
    case 'event:done':
      keepGoing();
      return;
    case 'autoPurchase':
      dispatch({ type: 'autoPurchase' });
      return;
    default:
  }
  const [kind, id] = key.split(':');
  if (kind === 'less') return step(id, -1);
  if (kind === 'more') return step(id, 1);
  if (kind === 'max') return step(id, 'max');
  if (kind === 'buy') return buy(id);
  if (!game || control.tagName === 'SELECT' || control.tagName === 'INPUT' || control.tagName === 'SUMMARY') return;
  const option = availableActions(game).find(entry => entry.key === key);
  if (option) dispatch(option.action);
}

function onInput(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) return;
  const key = field.getAttribute('data-key') ?? '';
  if (key.startsWith('name:')) setup.names[Number(key.slice(5))] = field.value;
  else if (key === 'seed') {
    setup.seedText = field.value;
    if (setup.road !== 'own') {
      setup.road = 'own';
      draw();
    }
  } else if (key.startsWith('qty:') && game) {
    const id = key.slice(4);
    const most = shopItems(game).find(item => item.id === id)?.canBuy ?? 0;
    const digits = field.value.replace(/\D/g, '');
    const typed = digits === '' ? 0 : Number.parseInt(digits, 10);
    shopQuantity[id] = Math.min(typed, most);
    // The field keeps what was typed (an empty field stays empty); only a number past canBuy is replaced.
    quantityDraft = { id, text: typed > most ? String(most) : digits };
    // The region may draw the same HTML as before (6 typed over 6), so the field itself is corrected here.
    if (field.value !== quantityDraft.text) field.value = quantityDraft.text;
    draw();
  }
}

function onChange(event) {
  const field = event.target;
  if (!(field instanceof HTMLSelectElement) || playback) return;
  const key = field.getAttribute('data-key');
  if (key === 'setPace') dispatch({ type: 'setPace', pace: field.value });
  if (key === 'setRations') dispatch({ type: 'setRations', rations: field.value });
}

function onKeydown(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (eventDialog.open && target?.closest('#event-dialog') && !['Tab', 'Shift'].includes(event.key)) completeTyping();
  const arrows = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (target?.matches('[role="radio"]') && event.key in arrows) {
    event.preventDefault();
    moveRadio(target, arrows[event.key]);
  }
}

// Text fields select what they hold when they gain focus; the click that focused one does not undo it.
let selectedOnFocus = null;
function onFocusIn(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || field.type !== 'text') return;
  field.select();
  selectedOnFocus = field;
}

// A quantity field shows its number again once it loses focus. The draw waits until focus has moved, so the
// control that receives it is kept.
function onFocusOut(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement) || !quantityDraft) return;
  const key = `qty:${quantityDraft.id}`;
  if (field.getAttribute('data-key') !== key) return;
  // A redraw replaces the field and its focus moves to the new one: that is not the player leaving it.
  setTimeout(() => {
    if (!quantityDraft || document.activeElement?.getAttribute('data-key') === key) return;
    quantityDraft = null;
    if (screen === 'game') draw();
  }, 0);
}

function onMouseUp(event) {
  if (event.target === selectedOnFocus) event.preventDefault();
  selectedOnFocus = null;
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.id === 'names-form') packVan();
  else if (form.closest('#memorial-dialog')) carve();
}

function onToggle(event) {
  if (event.target instanceof HTMLDetailsElement && event.target.closest('[data-region="route"]')) {
    routeOpen = event.target.open;
  }
}

document.addEventListener('click', onClick);
document.addEventListener('input', onInput);
document.addEventListener('change', onChange);
document.addEventListener('keydown', onKeydown);
document.addEventListener('focusin', onFocusIn);
document.addEventListener('focusout', onFocusOut);
document.addEventListener('mouseup', onMouseUp);
document.addEventListener('submit', onSubmit);
document.addEventListener('toggle', onToggle, true);

// The encounter cannot be dismissed (B1): Escape is cancelled, and a dialog the browser closes anyway reopens.
eventDialog.addEventListener('cancel', event => event.preventDefault());
eventDialog.addEventListener('close', () => {
  forget(eventDialog);
  clearInterval(typingTimer);
  typingTimer = 0;
  if (screen === 'game' && !playback && (game?.pendingEvent || encounter?.step === 'outcome')) openDialogs();
});
// A memorial closes any way the player likes; the default epitaph stays unless one was carved.
memorialElement.addEventListener('close', () => {
  forget(memorialElement);
  memorials.shift();
  if (screen !== 'game') return;
  openDialogs();
  if (!document.querySelector('dialog[open]')) focusPrimary();
});

// Another tab changed the save: the title's Resume follows it.
window.addEventListener('storage', event => {
  if (event.key !== SAVE_KEY || screen !== 'title') return;
  adopt(loadJourney());
  draw();
});

// --- Offline (spec 8, F5) --------------------------------------------------------------------------------

/** Every scene the journey can show, for this device. */
function sceneUrls() {
  const small = phoneArt();
  const ids = new Set(['title', 'departure', 'victory', 'loss']);
  for (const entry of [...LOCATIONS, ...REGIONS, ...EVENTS]) ids.add(entry.scene);
  return [...ids].map(id => new URL(sceneUrl(id, small), document.baseURI).href);
}

async function setUpOffline() {
  if (!('serviceWorker' in navigator)) return;
  const workers = navigator.serviceWorker;
  if (BUILD.mode !== 'build') {
    // A built copy served earlier on this origin must not shadow the source.
    try {
      const scope = new URL('./', document.baseURI).href;
      for (const registration of await workers.getRegistrations()) {
        if (registration.scope.startsWith(scope)) await registration.unregister();
      }
      if ('caches' in window) {
        for (const name of await caches.keys()) if (name.startsWith('portland-trail-')) await caches.delete(name);
      }
    } catch {
      // Nothing to clean up.
    }
    return;
  }
  workers.addEventListener('message', event => {
    if (event.data?.type !== 'scenes-cached' || offlineNoted) return;
    offlineNoted = true;
    toast('Ready to play offline', 'ok');
  });
  workers.startMessages();
  try {
    await workers.register('./sw.js');
    const registration = await workers.ready;
    registration.active?.postMessage({ type: 'cache-scenes', urls: sceneUrls() });
  } catch {
    // The game plays online without a worker.
  }
}

// --- Start -----------------------------------------------------------------------------------------------

/** Take the journey on file as the current one, with its receipt, its latest note and any storage problem. */
function adopt(loaded) {
  game = loaded.game;
  lastLeg = loaded.lastLeg;
  notes = game?.journal.length ? [game.journal.at(-1).text] : [];
  problems.delete(PROBLEMS.unreadable);
  problems.delete(PROBLEMS.unavailable);
  if (loaded.problem) problems.add(loaded.problem);
}

adopt(loadJourney());
sound.setEnabled(readSettings().sound);
const stamp = document.querySelector('#build-stamp');
if (stamp) stamp.textContent = stampText(BUILD);
draw();
setUpOffline();
