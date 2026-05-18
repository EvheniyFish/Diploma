"use strict";

/**
 * Rotor imbalance — PMP-CF250
 *
 * Characteristic sinusoidal vibration at 2x shaft frequency appears in X/Y
 * (90° phase shift between axes — classical imbalance signature). RPM
 * oscillates around nominal as the governor fights the imbalance torque.
 *
 * @param {string} channel_code
 * @param {number} progress      [0, 1]
 * @param {object} _passport     unused, present for uniform call signature
 * @param {number} age_hours     current simulated age (drives sinusoidal time base)
 * @returns {number} delta
 */
function effect(channel_code, progress, _passport, age_hours) {
  // 2x rpm frequency → ~98.67 Hz; express in units of age_hours so the
  // oscillation completes many cycles per hour of sim-time (visible in data)
  const twiceRpm_cyclesPerHour = 2 * 2960 * 60; // cycles per hour
  const phase = 2 * Math.PI * twiceRpm_cyclesPerHour * (age_hours || 0);

  switch (channel_code) {
    case "vibration_x_rms":
      return 8 * progress + 8 * progress * Math.sin(phase);

    case "vibration_y_rms":
      // 90° phase offset between X and Y axes
      return 8 * progress + 8 * progress * Math.sin(phase + Math.PI / 2);

    case "vibration_z_rms":
      return 3 * progress;

    case "rpm": {
      // Oscillates ±20*progress rpm around nominal
      const r = Math.random() * 2 - 1;
      return 20 * progress * r;
    }

    default:
      return 0;
  }
}

module.exports = { effect };
