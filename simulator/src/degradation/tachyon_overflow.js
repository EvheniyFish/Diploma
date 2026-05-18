"use strict";

/**
 * Tachyon overflow — QA-7000
 *
 * Tachyon emission rate spikes super-linearly. The resulting momentum
 * transfer elevates quantum flux pressure.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "tachyon_emission_rate":
      return 14 * Math.pow(progress, 1.8);

    case "quantum_flux_pressure":
      return 8 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
