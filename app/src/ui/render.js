// Drawing (spec 9.1). A screen is a fixed shell of named regions; each draw replaces a region only when its
// HTML changed. When the focused control is inside a replaced region, focus returns to the control with the
// same data-key (keeping a text field's selection), or else to the fallback, normally the primary action.

const drawn = new WeakMap();

/** What is needed to put focus back: the control's key and, for a text field, its selection. */
function remember(element) {
  const memory = { key: element.getAttribute('data-key'), selection: null };
  try {
    if (typeof element.selectionStart === 'number') memory.selection = [element.selectionStart, element.selectionEnd];
  } catch {
    // Inputs without a text selection.
  }
  return memory;
}

function restore(root, memory, fallback) {
  const key = memory.key && root.querySelector(`[data-key="${CSS.escape(memory.key)}"]`);
  const target = key || (fallback && root.querySelector(fallback));
  if (!(target instanceof HTMLElement)) return;
  target.focus({ preventScroll: true });
  const field = /** @type {HTMLInputElement} */ (target);
  if (key && memory.selection && typeof field.setSelectionRange === 'function') {
    try {
      field.setSelectionRange(memory.selection[0], memory.selection[1]);
    } catch {
      // Not a text field after all.
    }
  }
}

/**
 * Replace the content of `element` with `html` unless it already shows exactly that.
 * @returns {boolean} true when the content was replaced
 */
function replace(element, html) {
  if (drawn.get(element) === html) return false;
  element.innerHTML = html;
  drawn.set(element, html);
  return true;
}

/**
 * Draw the named regions inside `root`. Regions are elements with a data-region attribute that stay in place;
 * only their content changes.
 * @param {ParentNode} root
 * @param {Record<string, string>} regions   region name → HTML
 * @param {string} [fallback]                selector to focus when the focused control is gone
 * @returns {string[]} the names of the regions that were replaced
 */
export function patchRegions(root, regions, fallback) {
  const active = document.activeElement;
  let memory = null;
  const replaced = [];
  for (const [name, html] of Object.entries(regions)) {
    const element = root.querySelector(`[data-region="${name}"]`);
    if (!element) continue;
    const held = active instanceof Element && element.contains(active);
    if (held && drawn.get(element) !== html) memory = remember(active);
    if (replace(element, html)) replaced.push(name);
  }
  if (memory) restore(root, memory, fallback);
  return replaced;
}

/**
 * Draw a whole screen into `root` when it changed, keeping focus by data-key.
 * @returns {boolean} true when the screen was replaced
 */
export function drawScreen(root, html, fallback) {
  const active = document.activeElement;
  const memory = active instanceof Element && root.contains(active) && active !== root ? remember(active) : null;
  if (!replace(root, html)) return false;
  if (memory) restore(root, memory, fallback);
  return true;
}

/** Forget what a root shows, so the next draw writes it again. */
export function forget(element) {
  drawn.delete(element);
}
