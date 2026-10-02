// The dialogs' contents. Each function returns the HTML for one of the <dialog> elements in index.html; the
// controller opens, fills and closes them. Encounter choices, their details and reasons come from the engine.

import { escapeHtml, formatNumber, optionButton, picture } from './views.js';

/**
 * The encounter (spec 9.3 steps 5 and 6). While choosing, the text types itself out (L4) and the choices are
 * usable at once; after a choice the same dialog shows the result lines with Keep going (F1).
 * @param {{
 *   event: { title: string, description: string, type: string, scene: string },
 *   step: 'choose' | 'outcome',
 *   options: { key: string, label: string, detail: string, reason: string, enabled: boolean }[],
 *   results: string[],
 *   typed: string,
 *   error: string,
 * }} view
 */
export function encounterDialog(view) {
  const { event } = view;
  const art = `<div class="event-art">${picture(event.scene, `Illustration for ${event.title}`, 'event-image')}</div>`;
  const error = `<p class="dialog-error" role="alert"${view.error ? '' : ' hidden'}>${escapeHtml(view.error)}</p>`;
  if (view.step === 'outcome') {
    const lines = view.results.map(line => `<li>${escapeHtml(line)}</li>`).join('');
    return `${art}<div class="dialog-inner"><p class="overline">What happened</p>
      <h2 id="event-title">${escapeHtml(event.title)}</h2>
      <ul class="event-results">${lines}</ul>${error}
      <div class="dialog-actions">
        <button type="button" class="button button-primary" data-key="event:done">Keep going</button>
      </div></div>`;
  }
  const overline = event.type === 'critical' ? 'Critical moment' : 'Road encounter';
  const choices = view.options
    .map(option => {
      if (option.key === 'event:continue') return optionButton(option, 'button button-primary');
      const note = option.enabled ? option.detail : option.reason;
      const inner = `<span>${escapeHtml(option.label)}</span>${note ? `<small>${escapeHtml(note)}</small>` : ''}`;
      return optionButton(option, 'button button-dialog', inner);
    })
    .join('');
  return `${art}<div class="dialog-inner"><p class="overline">${overline}</p>
    <h2 id="event-title">${escapeHtml(event.title)}</h2>
    <p class="event-text"><span class="visually-hidden">${escapeHtml(event.description)}</span><span
      aria-hidden="true" data-typed>${escapeHtml(view.typed)}</span></p>
    ${error}<div class="dialog-actions">${choices}</div></div>`;
}

/**
 * A memorial for a traveler who died (F2): the name, the death line and an epitaph field holding the default.
 * Reopened from a headstone, it edits the epitaph already carved.
 * @param {{ name: string, line: string, epitaph: string, max: number, error: string, editing?: boolean }} view
 */
export function memorialDialog(view) {
  const overline = view.editing ? 'Recarve the headstone' : 'In memory';
  const leave = view.editing ? 'Keep it' : 'Leave it';
  return `<form class="dialog-inner memorial" novalidate><p class="overline">${overline}</p>
    <h2 id="memorial-title">${escapeHtml(view.name)}</h2>
    <p>${escapeHtml(view.line)}</p>
    <label class="name-field"><span>Epitaph</span>
      <input type="text" name="epitaph" value="${escapeHtml(view.epitaph)}" maxlength="${view.max}"
        autocomplete="off" spellcheck="false" data-key="epitaph" /></label>
    <p class="dialog-error" role="alert"${view.error ? '' : ' hidden'}>${escapeHtml(view.error)}</p>
    <div class="dialog-actions memorial-actions">
      <button type="button" class="button button-quiet" data-key="leave">${leave}</button>
      <button type="submit" class="button button-primary" data-key="carve">Carve it</button>
    </div>
  </form>`;
}

/**
 * The whole journal (E4): every stored line, newest first, grouped by day.
 * @param {{ journal: { day: number, text: string }[], logged: number }} view
 */
export function journalDialog({ journal, logged }) {
  /** @type {{ day: number, lines: string[] }[]} */
  const days = [];
  for (const entry of [...journal].reverse()) {
    if (days.at(-1)?.day !== entry.day) days.push({ day: entry.day, lines: [] });
    days.at(-1).lines.push(entry.text);
  }
  const groups = days
    .map(
      ({ day, lines }) =>
        `<section class="journal-day" data-day="${day}"><h3>Day ${formatNumber(day)}</h3>
          <ol>${lines.map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ol></section>`,
    )
    .join('');
  const count = `${formatNumber(journal.length)} ${journal.length === 1 ? 'line' : 'lines'}`;
  const faded = logged > journal.length ? ` The oldest ${formatNumber(logged - journal.length)} have faded.` : '';
  return `<div class="dialog-inner journal-full"><p class="overline">Field journal</p>
    <h2 id="journal-title">The whole journal</h2>
    <p>${count}, newest first.${faded}</p>
    <div class="journal-days">${groups || '<p>The journal is still clean.</p>'}</div>
    <div class="dialog-actions">
      <button type="button" class="button button-primary" data-key="close-journal">Close the journal</button>
    </div>
  </div>`;
}

/**
 * Moving a journey between devices (F13): copy or download this device's journey, or paste one to load.
 * @param {{ journey: string, text: string }} view   journey: a short description, '' when there is none
 */
export function transferDialog({ journey, text }) {
  const send = journey
    ? `<p>On this device: ${escapeHtml(journey)}. Copy its code or download it, then load it on the other device.</p>
      <div class="dialog-actions transfer-send">
        <button type="button" class="button button-outline" data-key="copy-code">Copy save code</button>
        <button type="button" class="button button-outline" data-key="download-save">Download save file</button>
      </div>`
    : '<p>There is no journey on this device yet. Load one from another device below.</p>';
  return `<div class="dialog-inner transfer"><p class="overline">Move a journey</p>
    <h2 id="transfer-title">Between devices</h2>
    ${send}
    <form class="transfer-load" novalidate>
      <label class="name-field"><span>Paste a save code or the contents of a save file</span>
        <textarea name="code" rows="4" autocomplete="off" autocapitalize="off" spellcheck="false"
          data-key="import-text">${escapeHtml(text)}</textarea></label>
      <div class="dialog-actions transfer-actions">
        <button type="button" class="button button-quiet" data-key="close-transfer">Close</button>
        <button type="submit" class="button button-primary" data-key="import">Load this journey</button>
      </div>
    </form>
  </div>`;
}

/**
 * A question with two answers.
 * @param {{ overline: string, title: string, text: string, confirm: string, cancel: string }} view
 */
export function confirmDialog(view) {
  return `<div class="dialog-inner"><p class="overline">${escapeHtml(view.overline)}</p>
    <h2 id="confirm-title">${escapeHtml(view.title)}</h2>
    <p>${escapeHtml(view.text)}</p>
    <div class="dialog-actions">
      <button type="button" class="button button-quiet" data-key="cancel">${escapeHtml(view.cancel)}</button>
      <button type="button" class="button button-primary" data-key="confirm">${escapeHtml(view.confirm)}</button>
    </div>
  </div>`;
}
