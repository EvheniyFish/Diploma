"use strict";

/**
 * PSU degradation — SRV-R740-2U
 *
 * Voltage develops growing oscillations; current becomes unstable
 * with both a mean rise and high random variability.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @param {object} channel   - full channel descriptor (for noise_sigma)
 * @returns {number} delta
 */
function effect(channel_code, progress, channel) {
  switch (channel_code) {
    case "psu_voltage_12v":
      // Oscillations with amplitude growing proportional to progress
      return Math.sin(progress * 20) * 0.3 * progress;

    case "psu_current": {
      const noise_sigma = channel ? channel.noise_sigma : 0.3;
      const r = (Math.random() * 2 - 1); // [-1, 1]
      return 10 * progress + noise_sigma * 5 * progress * r;
    }

    default:
      return 0;
  }
}

module.exports = { effect };
