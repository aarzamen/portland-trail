// Sound (L8). The controller calls play() at these moments: drive, arrive, event, good, bad, buy, death, win
// and lose. The generated tones come later; for now nothing plays, and the switch is only remembered.

let enabled = false;

/** @param {'drive'|'arrive'|'event'|'good'|'bad'|'buy'|'death'|'win'|'lose'} name */
export function play(name) {
  void name;
}

/** @param {boolean} on */
export function setEnabled(on) {
  enabled = on === true;
}

export function isEnabled() {
  return enabled;
}
