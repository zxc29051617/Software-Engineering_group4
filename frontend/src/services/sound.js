/**
 * Optional sonification (off by default): a short triangle-wave blip whose
 * pitch follows the value being compared or moved. The audio context is
 * created on first use, after a user gesture, as browsers require.
 * @module services/sound
 */

export const FREQUENCY_RANGE = Object.freeze({ low: 120, high: 1200 });

/**
 * Maps a value in 0..max to a frequency in Hz.
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
export function frequencyFor(value, max) {
  const { low, high } = FREQUENCY_RANGE;
  if (!(max > 0)) return low;
  const ratio = Math.min(Math.max(value / max, 0), 1);
  return low + ratio * (high - low);
}

/**
 * @returns {{readonly enabled: boolean, setEnabled: (on: boolean) => void, play: (value: number, max: number) => void}}
 */
export function createSound() {
  let enabled = false;
  /** @type {AudioContext|null} */
  let context = null;

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    return context;
  }

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = Boolean(on);
      if (enabled) ensureContext()?.resume?.();
    },
    play(value, max) {
      if (!enabled) return;
      const audio = ensureContext();
      if (!audio) return;
      const start = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequencyFor(value, max), start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.1);
    },
  };
}
