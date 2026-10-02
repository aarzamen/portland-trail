// The dialogs' contents. Each function returns the HTML for one of the <dialog> elements in index.html; the
// controller opens, fills and closes them. Encounter choices, their details and reasons come from the engine.

import { escapeHtml, optionButton, picture } from './views.js';

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
 * @param {{ name: string, line: string, epitaph: string, max: number, error: string }} view
 */
export function memorialDialog(view) {
  return `<form class="dialog-inner memorial" novalidate><p class="overline">In memory</p>
    <h2 id="memorial-title">${escapeHtml(view.name)}</h2>
    <p>${escapeHtml(view.line)}</p>
    <label class="name-field"><span>Epitaph</span>
      <input type="text" name="epitaph" value="${escapeHtml(view.epitaph)}" maxlength="${view.max}"
        autocomplete="off" spellcheck="false" data-key="epitaph" /></label>
    <p class="dialog-error" role="alert"${view.error ? '' : ' hidden'}>${escapeHtml(view.error)}</p>
    <div class="dialog-actions memorial-actions">
      <button type="button" class="button button-quiet" data-key="leave">Leave it</button>
      <button type="submit" class="button button-primary" data-key="carve">Carve it</button>
    </div>
  </form>`;
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
