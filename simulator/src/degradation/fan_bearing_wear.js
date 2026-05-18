"use strict";

/**
 * Fan bearing wear — SRV-R740-2U
 *
 * RPM drops with increasing variance (rough bearing). Heat builds up
 * from reduced airflow.
 *
 * Note: variance scaling is applied here as an additional random perturbation
 * on top of the channel's own noise_sigma — the caller still adds its own
 * gaussian noise separately, so this module adds a scaled random term.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  const r = Math.random() * 2 - 1; // uniform [-1, 1] as noise carrier

  switch (channel_code) {
    case "fan_rpm_front":
      // Mean drop + high-variance flutter
      return -200 * progress + r * 30 * (1 + 4 * progress);

    case "fan_rpm_rear":
      return -150 * progress + r * 25 * (1 + 3 * progress);

    case "cpu_temp_pkg":
      return 5 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
