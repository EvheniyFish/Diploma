"use strict";

/**
 * Field decoherence — QA-7000
 *
 * Containment field strength decays with oscillations. Entanglement
 * coherence drops. Tachyon emission rises as containment weakens.
 *
 * @param {string} channel_code
 * @param {number} progress  [0, 1]
 * @returns {number} delta
 */
function effect(channel_code, progress) {
  switch (channel_code) {
    case "containment_field_strength":
      return -3 * progress + Math.sin(progress * 10) * 0.5;

    case "entanglement_coherence":
      return -25 * progress;

    case "tachyon_emission_rate":
      return 12 * Math.pow(progress, 1.3);

    default:
      return 0;
  }
}

module.exports = { effect };
