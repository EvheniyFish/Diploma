"use strict";

/**
 * Thermal runaway — SRV-R740-2U
 *
 * CPU and GPU temperatures rise super-linearly. Fans spin up to compensate
 * but saturate and drop at high progress.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta to add to base value
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "cpu_temp_pkg":
      return 30 * Math.pow(progress, 1.5);

    case "cpu_temp_core_avg":
      return 35 * Math.pow(progress, 1.5);

    case "fan_rpm_front": {
      const ramp = 1500 * Math.min(1, progress * 2);
      const sat  = progress > 0.7 ? -500 : 0;
      return ramp + sat;
    }

    case "fan_rpm_rear": {
      const ramp = 1200 * Math.min(1, progress * 2);
      const sat  = progress > 0.7 ? -400 : 0;
      return ramp + sat;
    }

    case "gpu_temp":
      return 20 * Math.pow(progress, 1.5);

    default:
      return 0;
  }
}

module.exports = { effect };
