"use strict";

/**
 * Compressor wear — CRY-LN2-15K
 *
 * Current increases and becomes noisier; oil overheats; compressor cycles
 * more frequently to maintain target pressure.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  const r = Math.random() * 2 - 1; // [-1, 1]

  switch (channel_code) {
    case "compressor_current":
      return 6 * progress + r * 0.15 * (1 + 2 * progress);

    case "compressor_oil_temp":
      return 35 * progress;

    case "condense_cycles_per_hour":
      return 4 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
