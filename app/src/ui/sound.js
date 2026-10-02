// Sound (L8). The controller calls play() at these moments: drive, arrive, event, good, bad, buy, death, win
// and lose. Each is a few short notes from Web Audio oscillators with quick envelopes, kept quiet. No files.
// Nothing is created until sound is on and the player has touched the page: the audio context is made lazily
// on the first play() after a user gesture, so the browser never blocks or warns about audio on load.

/** @typedef {'drive'|'arrive'|'event'|'good'|'bad'|'buy'|'death'|'win'|'lose'} ToneName */

// Each note: frequency in hertz, length in seconds, and the oscillator's wave. A frequency of 0 is a rest.
/** @type {Record<ToneName, [number, number, OscillatorType][]>} */
const TONES = {
  drive: [
    [110, 0.08, 'square'],
    [123, 0.08, 'square'],
    [147, 0.12, 'square'],
  ],
  arrive: [
    [523, 0.07, 'square'],
    [659, 0.07, 'square'],
    [784, 0.14, 'square'],
  ],
  event: [
    [392, 0.06, 'square'],
    [0, 0.04, 'square'],
    [392, 0.06, 'square'],
    [311, 0.14, 'square'],
  ],
  good: [
    [659, 0.06, 'triangle'],
    [988, 0.12, 'triangle'],
  ],
  bad: [
    [220, 0.08, 'sawtooth'],
    [165, 0.16, 'sawtooth'],
  ],
  buy: [
    [1319, 0.04, 'square'],
    [1760, 0.08, 'square'],
  ],
  death: [
    [294, 0.18, 'triangle'],
    [262, 0.18, 'triangle'],
    [196, 0.36, 'triangle'],
  ],
  win: [
    [523, 0.09, 'square'],
    [659, 0.09, 'square'],
    [784, 0.09, 'square'],
    [1047, 0.28, 'square'],
  ],
  lose: [
    [330, 0.14, 'triangle'],
    [294, 0.14, 'triangle'],
    [262, 0.14, 'triangle'],
    [196, 0.4, 'triangle'],
  ],
};

// Loudness at the peak of each note. Square and sawtooth waves are loud for their level.
const PEAK = { square: 0.035, sawtooth: 0.03, triangle: 0.08, sine: 0.08 };
const ATTACK = 0.008;

let enabled = false;
let touched = false;
/** @type {AudioContext | null} */
let context = null;

// The first touch, click or key anywhere counts as the gesture that lets audio start.
if (typeof window !== 'undefined') {
  const mark = () => {
    touched = true;
    for (const type of ['pointerdown', 'keydown']) window.removeEventListener(type, mark, true);
  };
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, mark, true);
}

/** The audio context, made on first use; null where the browser has none or refuses one. */
function audio() {
  if (!context) {
    const Context = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
    if (!Context) return null;
    try {
      context = new Context();
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

/** Play a named tone, when sound is on and the player has touched the page. */
export function play(/** @type {ToneName} */ name) {
  if (!enabled || !touched) return;
  const notes = TONES[name];
  if (!notes) return;
  const output = audio();
  if (!output) return;
  let at = output.currentTime + 0.01;
  for (const [frequency, length, wave] of notes) {
    if (frequency > 0) {
      const oscillator = output.createOscillator();
      const gain = output.createGain();
      oscillator.type = wave;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(PEAK[wave], at + ATTACK);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(gain).connect(output.destination);
      oscillator.start(at);
      oscillator.stop(at + length + 0.02);
    }
    at += length;
  }
}

/** @param {boolean} on */
export function setEnabled(on) {
  enabled = on === true;
}

export function isEnabled() {
  return enabled;
}
