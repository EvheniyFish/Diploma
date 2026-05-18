"use strict";

/**
 * Containment drift — QA-7000
 *
 * Slow decay of containment field with gradual vacuum integrity loss.
 * Dimensional resonance frequency shifts with growing oscillation amplitude
 * as the resonance cavity geometry drifts.
 *
 * @param {string} channel_code
 * @param {number} progress   [0, 1]
 * @param {object} channel    - channel descriptor (for nominal)
 * @returns {number} delta
 */
function effect(channel_code, progress, channel) {
  switch (channel_code) {
    case "containment_field_strength":
      return -2 * progress;

    case "vacuum_chamber_integrity":
      return -5 * progress;

    case "dimensional_resonance_freq": {
      // Multiply nominal by shift factor; return multiplicative delta
      const nominal = channel ? channel.nominal : 2400000;
      const shift = (1 + 0.2 * Math.sin(progress * 15) * progress) - 1;
      return nominal * shift;
    }

    default:
      return 0;
  }
}

module.exports = { effect };
