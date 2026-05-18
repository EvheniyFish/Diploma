"use strict";

/**
 * Bearing wear — PMP-CF250
 *
 * Vibration amplitudes increase with growing variance (rough bearing surface).
 * Bearing temperatures climb super-linearly.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  const r = Math.random() * 2 - 1; // [-1, 1]

  switch (channel_code) {
    case "vibration_x_rms":
      return 5 * progress + r * 0.05 * (1 + 3 * progress);

    case "vibration_y_rms":
      return 4 * progress + r * 0.05 * (1 + 2.5 * progress);

    case "bearing_temp_de":
      return 40 * Math.pow(progress, 1.2);

    case "bearing_temp_nde":
      return 30 * Math.pow(progress, 1.1);

    default:
      return 0;
  }
}

module.exports = { effect };
