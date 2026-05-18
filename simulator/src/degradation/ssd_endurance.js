"use strict";

/**
 * SSD endurance exhaustion — SRV-R740-2U
 *
 * Wear percentage climbs monotonically toward 100 %. I/O latency spikes
 * exponentially as wear cells fail. Drive temperature rises from retries.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "ssd_wear_pct":
      // Rises from 0 toward ~95 % at full progress
      return 95 * progress;

    case "disk_io_latency_p99":
      // Exponential latency explosion
      return 200 * Math.pow(progress, 2);

    case "ssd_temp":
      return 15 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
