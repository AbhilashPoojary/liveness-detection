/**
 * math.js — shared numeric helpers used by the quality & liveness engines.
 * All functions are pure and deterministic (no randomness, no AI calls).
 */

/** Clamp a value between min and max. */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Linearly map a value from one range to another, clamped to [0,1] output range unless specified. */
export function mapRange(value, inMin, inMax, outMin = 0, outMax = 100) {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

/** Euclidean distance between two {x,y} points. */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Simple moving average of a numeric array. */
export function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

/** Standard deviation of a numeric array. */
export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const mean = average(arr);
  const variance = average(arr.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

/** Weighted average given parallel arrays of values and weights. */
export function weightedAverage(values, weights) {
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] * (weights[i] ?? 1);
    weightSum += weights[i] ?? 1;
  }
  return weightSum === 0 ? 0 : sum / weightSum;
}

/** Convert radians to degrees. */
export function toDegrees(rad) {
  return (rad * 180) / Math.PI;
}

export default {
  clamp,
  mapRange,
  distance,
  average,
  stdDev,
  weightedAverage,
  toDegrees,
};
