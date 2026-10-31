/**
 * Playback timing: a speed table and a requestAnimationFrame loop that turns
 * elapsed time into a whole number of steps, carrying the remainder.
 * @module services/scheduler
 */

/** Steps (or race operations) per second for each speed-slider position. */
export const SPEEDS = Object.freeze([0.5, 1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200, 400, 800]);
export const DEFAULT_SPEED_INDEX = 5;

/** Longest frame gap counted, so a hidden tab does not jump ahead on return. */
export const MAX_FRAME_MS = 250;

/**
 * @param {number} index  slider position (clamped)
 * @returns {number} steps per second
 */
export function speedAt(index) {
  const i = Math.min(Math.max(Math.round(Number(index) || 0), 0), SPEEDS.length - 1);
  return SPEEDS[i];
}

/**
 * Clamps a slider position to the valid range.
 * @param {number} index
 */
export function clampSpeedIndex(index) {
  if (!Number.isFinite(Number(index))) return DEFAULT_SPEED_INDEX;
  return Math.min(Math.max(Math.round(Number(index)), 0), SPEEDS.length - 1);
}

/**
 * Converts elapsed time into whole steps.
 * @param {number} carry      fractional steps left over from earlier frames
 * @param {number} elapsedMs  time since the previous frame
 * @param {number} rate       steps per second
 * @returns {{steps: number, carry: number}}
 */
export function stepsDue(carry, elapsedMs, rate) {
  const elapsed = Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS);
  const total = carry + (elapsed / 1000) * rate;
  // The epsilon absorbs floating-point drift (e.g. 60 × 1/30 = 1.9999…).
  const steps = Math.floor(total + 1e-9);
  return { steps, carry: Math.max(0, total - steps) };
}

/**
 * A start/stop animation-frame loop that reports elapsed milliseconds.
 * @param {(elapsedMs: number) => void} onFrame
 * @param {{requestFrame?: Function, cancelFrame?: Function, now?: () => number}} [deps]
 */
export function createLoop(onFrame, deps = {}) {
  const requestFrame = deps.requestFrame ?? ((cb) => globalThis.requestAnimationFrame(cb));
  const cancelFrame = deps.cancelFrame ?? ((id) => globalThis.cancelAnimationFrame(id));
  const now = deps.now ?? (() => globalThis.performance.now());
  let frameId = null;
  let last = 0;

  const tick = () => {
    const time = now();
    const elapsed = time - last;
    last = time;
    frameId = requestFrame(tick);
    onFrame(elapsed);
  };

  return {
    start() {
      if (frameId !== null) return;
      last = now();
      frameId = requestFrame(tick);
    },
    stop() {
      if (frameId === null) return;
      cancelFrame(frameId);
      frameId = null;
    },
    get running() {
      return frameId !== null;
    },
  };
}
