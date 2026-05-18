"use strict";

/**
 * Winding short circuit — PMP-CF250
 *
 * Current and temperature rise super-linearly; reduced torque causes
 * speed drop.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "winding_current":
      return 8 * Math.pow(progress, 1.5);

    case "winding_temp":
      return 60 * Math.pow(progress, 1.5);

    case "rpm":
      return -50 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
