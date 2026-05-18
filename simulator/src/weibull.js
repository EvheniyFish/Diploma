"use strict";

/**
 * Seeded pseudo-random number generator (Mulberry32).
 * Returns a function that produces values in [0, 1).
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample a random variate from a Weibull distribution using the inverse-CDF method.
 *
 * TTF = eta * (-ln(1 - U)) ^ (1/beta)
 *
 * @param {number} eta   - Scale parameter (characteristic life, hours)
 * @param {number} beta  - Shape parameter (failure rate behaviour)
 * @param {number} [seed] - Optional integer seed for reproducibility
 * @returns {number} Time-to-failure in hours
 */
function sampleWeibull(eta, beta, seed) {
  const u = seed !== undefined ? mulberry32(seed)() : Math.random();
  // Guard against u === 0 which would give -ln(1) = 0, and u === 1 → -ln(0) = Inf
  const safe = Math.min(Math.max(u, 1e-9), 1 - 1e-9);
  return eta * Math.pow(-Math.log(1 - safe), 1 / beta);
}

module.exports = { sampleWeibull, mulberry32 };
