"use strict";

/**
 * First-order low-pass filter modelling thermal (or mechanical) inertia.
 *
 * Discrete-time update:
 *   alpha = dt / (tau + dt)
 *   y[t]  = y[t-1] * (1 - alpha) + x[t] * alpha
 *
 * When tau (inertia_seconds) is 0 the filter is bypassed.
 */
class LPFilter {
  /**
   * @param {number} inertia_seconds  - Time constant τ (seconds). 0 = no filtering.
   */
  constructor(inertia_seconds) {
    this.inertia = inertia_seconds;
    this.last = null;
  }

  /**
   * Feed a new raw sample and return the filtered value.
   *
   * @param {number} raw         - Unfiltered measurement
   * @param {number} dt_seconds  - Time step since last call
   * @returns {number}
   */
  update(raw, dt_seconds) {
    if (this.inertia === 0) return raw;
    if (this.last === null) {
      this.last = raw;
      return raw;
    }
    const alpha = dt_seconds / (this.inertia + dt_seconds);
    this.last = this.last * (1 - alpha) + raw * alpha;
    return this.last;
  }

  /** Reset filter state (e.g. after unit reset). */
  reset() {
    this.last = null;
  }
}

module.exports = { LPFilter };
