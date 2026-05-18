"use strict";

/**
 * Cavitation — PMP-CF250
 *
 * Pressure becomes erratic (high noise). Broadband vibration noise rises.
 * Motor draws more current as pump efficiency drops.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @param {object} channel   - channel descriptor (for noise_sigma)
 * @returns {number} delta
 */
function effect(channel_code, progress, channel) {
  const r = Math.random() * 2 - 1; // [-1, 1]

  switch (channel_code) {
    case "pressure_discharge": {
      const sigma = channel ? channel.noise_sigma : 0.05;
      // Mean drop + amplified noise
      return -1.5 * progress + r * sigma * (1 + 5 * progress);
    }

    case "vibration_x_rms": {
      const sigma = channel ? channel.noise_sigma : 0.05;
      return 3 * progress * Math.abs(r) * (sigma / 0.05);
    }

    case "vibration_y_rms": {
      const sigma = channel ? channel.noise_sigma : 0.05;
      return 3 * progress * Math.abs(r) * (sigma / 0.05);
    }

    case "winding_current":
      return 2 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
