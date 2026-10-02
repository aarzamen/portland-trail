// Shared fragments and the screens outside the journey: the title and the two setup steps. Views turn data into
// HTML text; they never decide rules. Every value that came from a save or from the player goes through
// escapeHtml.

import { ITEMS, MONEY, PROFESSIONS } from '../data.js';
import { describeAbility } from '../engine.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text made safe for HTML content and attribute values. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ENTITIES[character]);
}

/** A number as it is shown: grouped thousands, at most two decimals. */
export function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** A change as it is shown, with a true minus sign: +2, −4, ±0 is shown as 0. */
export function signed(value) {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `−${formatNumber(-value)}`;
  return '0';
}

// Phones and phones turned sideways get the 960-pixel scene art.
export const PHONE_ART = '(max-width: 760px), (max-height: 500px) and (pointer: coarse)';

/** True on a device that gets the 960-pixel scene art. */
export const phoneArt = () => matchMedia(PHONE_ART).matches;

/** The URL of a scene's art: the full file or the 960-pixel one. */
export function sceneUrl(sceneId, small = false) {
  return `./assets/scenes/${sceneId}${small ? '-960' : ''}.webp`;
}

/** A scene as a <picture>: the 960-pixel art on phones, the full art otherwise. */
export function picture(sceneId, alt, className) {
  return (
    `<picture class="responsive-picture"><source media="${PHONE_ART}" srcset="${sceneUrl(sceneId, true)}" />` +
    `<img class="${className}" src="${sceneUrl(sceneId)}" alt="${escapeHtml(alt)}" decoding="async" /></picture>`
  );
}

/** The build stamp as the footer shows it: v0.2.0 · sha+ · branch · date, without empty parts. */
export function stampText(build) {
  const sha = build.sha ? `${build.sha}${build.dirty ? '+' : ''}` : '';
  return [`v${build.version}`, sha, build.branch, build.date].filter(Boolean).join(' · ');
}

/** The short label of a supply: Cash, Food, Fuel, Seeds, Repairs, Kombucha, NFTs. */
export function supplyLabel(id) {
  return id === MONEY.id ? MONEY.label : (ITEMS.find(item => item.id === id)?.short ?? id);
}

/** The ids of the supplies in display order: cash first, then the items. */
export const SUPPLY_IDS = [MONEY.id, ...ITEMS.map(item => item.id)];

/**
 * A button for an action option. A blocked option stays focusable and clickable, marked aria-disabled, so the
 * reason can be read and a click is answered with it.
 */
export function optionButton(option, className, inner = escapeHtml(option.label)) {
  const disabled = option.enabled ? '' : ' aria-disabled="true"';
  const described = option.describedBy ? ` aria-describedby="${option.describedBy}"` : '';
  const key = escapeHtml(option.key);
  return `<button type="button" class="${className}" data-key="${key}"${disabled}${described}>${inner}</button>`;
}

/** An id fragment made from a key: 'useItem:kombucha' → 'useItem-kombucha'. */
export const idFor = key => String(key).replace(/[^a-zA-Z0-9_-]/g, '-');

const TITLE_ALT = 'A scruffy van stacked high for the long drive to Portland';

// --- Title -----------------------------------------------------------------------------------------------

/**
 * @param {{ saved: null | { ended: boolean }, stamp: string, best: null | { score: number, rank: string } }} view
 *   best: the best stored journey, when there is one
 */
export function titleView({ saved, stamp, best }) {
  const resume = saved
    ? `<button type="button" class="button button-outline button-large" data-key="resume">${
        saved.ended ? 'View saved ending' : 'Resume journey'
      }</button>`
    : '';
  const record = best
    ? `<p class="title-best" data-best><span>Best journey</span> <b>${formatNumber(best.score)}</b> points ·
        ${escapeHtml(best.rank)}</p>`
    : '';
  return `<section class="title-screen" id="top">
    <div class="title-art">${picture('title', TITLE_ALT, 'title-image')}</div>
    <div class="title-copy"><p class="title-kicker">A road trip of dubious judgment</p>
      <h1>The Portland<br />Trail<span class="title-period">.</span></h1>
      <p class="title-deck">Five travelers. One overburdened van. A thousand miles of detours, bad decisions,
        and surprisingly expensive snacks.</p>
      <div class="title-actions">
        <button type="button" class="button button-primary button-large" data-key="start">Start a new journey</button>
        ${resume}
      </div>
      ${record}
      <button type="button" class="button button-quiet title-transfer" data-key="transfer">
        Move a journey between devices</button>
      <p class="title-footnote">Every choice sticks. The road rarely does.</p>
      <p class="title-stamp">${escapeHtml(stamp)}</p>
    </div>
  </section>`;
}

// --- Step 1: background ----------------------------------------------------------------------------------

function startingKit(inventory) {
  return SUPPLY_IDS.filter(id => Number(inventory?.[id]) > 0)
    .map(id => `<span>${escapeHtml(supplyLabel(id))} <strong>${formatNumber(inventory[id])}</strong></span>`)
    .join('');
}

/** @param {{ selected: string }} view */
export function backgroundView({ selected }) {
  const cards = PROFESSIONS.map((item, index) => {
    const checked = selected === item.id;
    const id = escapeHtml(item.id);
    const card = `profession-card${checked ? ' is-selected' : ''}`;
    const ability = escapeHtml(describeAbility(item.id));
    return `<button type="button" class="${card}" role="radio" aria-checked="${checked}" data-profession="${id}"
        data-key="profession:${id}" tabindex="${checked ? '0' : '-1'}">
        <span class="profession-card-top"><span class="profession-number">0${index + 1}</span>
          <img src="./assets/sprites/portrait-${id}.png" alt="" class="profession-portrait" /></span>
        <strong>${escapeHtml(item.name)}</strong>
        <span class="profession-description">${escapeHtml(item.description)}</span>
        <span class="profession-ability"><b>Specialty: ${escapeHtml(item.ability.label)}</b>${ability}</span>
        <span class="profession-start"><b>Starting kit</b>${startingKit(item.inventory)}</span>
      </button>`;
  }).join('');
  return `<section class="setup-screen" id="top"><div class="setup-head"><span class="step-mark">1 / 2</span>
      <p class="overline">Before the wheels turn</p><h1>Who booked this trip?</h1>
      <p>Pick your background. Your training may help. Your baggage definitely will.</p></div>
    <div class="profession-grid" role="radiogroup" aria-label="Choose a background">${cards}</div>
    <div class="setup-footer">
      <button type="button" class="button button-quiet" data-key="back-title">Back to the title</button>
      <button type="button" class="button button-primary button-large" data-key="to-crew">Continue to the crew</button>
    </div>
  </section>`;
}

// --- Step 2: crew and road -------------------------------------------------------------------------------

const ROADS = [
  { id: 'surprise', label: 'Surprise me', detail: 'A road nobody has driven yet.' },
  { id: 'daily', label: 'Today’s road', detail: 'Everyone who plays today gets this road. Seed {seed}.' },
  { id: 'own', label: 'A seed of your own', detail: 'Type a word or a number. The same seed gives the same road.' },
];

/**
 * @param {{ names: string[], maxName: number, road: 'surprise'|'daily'|'own', seedText: string,
 *   dailySeed: number }} view
 */
export function crewView({ names, maxName, road, seedText, dailySeed }) {
  const fields = names
    .map(
      (name, index) =>
        `<label class="name-field"><span>Traveler ${index + 1}</span>
          <input name="traveler-${index}" type="text" value="${escapeHtml(name)}" maxlength="${maxName}"
            autocomplete="off" spellcheck="false" data-key="name:${index}" /></label>`,
    )
    .join('');
  const roads = ROADS.map(
    option =>
      `<button type="button" class="road-option${road === option.id ? ' is-selected' : ''}" role="radio"
        aria-checked="${road === option.id}" tabindex="${road === option.id ? '0' : '-1'}" data-key="road:${option.id}"
        data-road="${option.id}"><strong>${escapeHtml(option.label)}</strong>
        <span>${escapeHtml(option.detail.replace('{seed}', String(dailySeed)))}</span></button>`,
  ).join('');
  return `<section class="setup-screen setup-names" id="top">
    <div class="setup-head"><span class="step-mark">2 / 2</span>
      <p class="overline">Passenger manifest</p><h1>Name the five travelers.</h1>
      <p>They will all fit in the van. Personal space is another matter.</p></div>
    <form id="names-form" class="names-form" novalidate>
      <div class="name-fields">${fields}</div>
      <div class="setup-tools">
        <button type="button" class="button button-quiet" data-key="shuffle">Shuffle names</button>
      </div>
      <fieldset class="road-choice"><legend>Which road?</legend>
        <div class="road-options" role="radiogroup" aria-label="Which road">${roads}</div>
        <label class="name-field road-seed"><span>Your seed</span>
          <input id="road-seed" name="seed" type="text" value="${escapeHtml(seedText)}" maxlength="64"
            autocomplete="off" spellcheck="false" data-key="seed" /></label>
      </fieldset>
      <div class="setup-footer">
        <button type="button" class="button button-quiet" data-key="back-background">Back to backgrounds</button>
        <button type="submit" class="button button-primary button-large" data-key="pack">Pack the van</button>
      </div>
    </form>
  </section>`;
}
