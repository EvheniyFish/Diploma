"use strict";

/**
 * Filter clog — CRY-LN2-15K
 *
 * Restricted flow raises dewar pressure and accelerates boil-off while
 * LN2 level drops as refill becomes impeded.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "dewar_pressure":
      return 0.5 * progress;

    case "ln2_level_pct":
      return -30 * progress;

    case "boil_off_rate":
      return 1.5 * progress;

    default:
      return 0;
  }
}

module.exports = { effect };
