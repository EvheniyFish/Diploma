"use strict";

/**
 * Vacuum breach — CRY-LN2-15K
 *
 * Vacuum pressure rises by orders of magnitude (gas ingress). Boil-off
 * accelerates, compressor works harder, cold head warms up.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @param {object} channel   - channel descriptor (for nominal)
 * @returns {number} delta
 */
function effect(channel_code, progress, channel) {
  switch (channel_code) {
    case "vacuum_pressure": {
      // Nominal is 0.0001 Pa; at full breach rises ~3 orders of magnitude.
      // delta = nominal * 1000 * progress^2 so final ≈ 0.1 Pa
      const nominal = channel ? channel.nominal : 0.0001;
      return nominal * 1000 * Math.pow(progress, 2);
    }

    case "boil_off_rate":
      return 2.5 * progress;

    case "compressor_current":
      return 8 * progress;

    case "cold_head_temp":
      return 15 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
