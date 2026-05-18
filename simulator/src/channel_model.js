"use strict";

const { LPFilter } = require("./filters");

// Degradation mode → module map
const DEGRADATION_MODULES = {
  thermal_runaway:          require("./degradation/thermal_runaway"),
  fan_bearing_wear:         require("./degradation/fan_bearing_wear"),
  ssd_endurance_exhaustion: require("./degradation/ssd_endurance"),
  psu_degradation:          require("./degradation/psu_degradation"),
  bearing_wear:             require("./degradation/bearing_wear"),
  rotor_imbalance:          require("./degradation/rotor_imbalance"),
  cavitation:               require("./degradation/cavitation"),
  winding_short:            require("./degradation/winding_short"),
  vacuum_breach:            require("./degradation/vacuum_breach"),
  compressor_wear:          require("./degradation/compressor_wear"),
  filter_clog:              require("./degradation/filter_clog"),
  field_decoherence:        require("./degradation/field_decoherence"),
  tachyon_overflow:         require("./degradation/tachyon_overflow"),
  containment_drift:        require("./degradation/containment_drift"),
};

/**
 * Box-Muller transform: returns a single standard-normal sample.
 */
function gaussianNoise() {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * ChannelModel synthesises a realistic sensor reading.
 *
 * Value composition:
 *   raw = base_value + load_modulation + degradation_effect + noise [+ outlier]
 *   output = LP_filter(raw)
 *
 * Monotone (class R) channels simply accumulate age_hours * (nominal rate)
 * or a fixed increment per step — they skip the normal synthesis path.
 */
class ChannelModel {
  /**
   * @param {object} channel  - Channel descriptor from passport
   */
  constructor(channel) {
    this.channel = channel;
    this.filter  = new LPFilter(channel.inertia_seconds || 0);
    // Monotone accumulator: track total accumulated value
    this._accumulator = channel.nominal; // for uptime/runtime starts at 0 anyway
  }

  /**
   * Compute the next sample value.
   *
   * @param {number} age_hours      - Current simulated age of the unit (hours)
   * @param {number} dt_hours       - Simulation time step (hours)
   * @param {string|null} active_mode - Active failure mode code, or null
   * @param {number} mode_progress  - [0,1] progress of the active failure mode
   * @returns {number}
   */
  sample(age_hours, dt_hours, active_mode, mode_progress) {
    const ch = this.channel;

    // --- Monotone channels (running totals) ---
    if (ch.monotone) {
      // Only accumulate when there is a real time step (dt > 0).
      // Passing dt=0 is used when the caller just wants to read the current value.
      if (dt_hours > 0) {
        this._accumulator += dt_hours;
      }
      return this._accumulator;
    }

    // --- Base value ---
    const base = ch.nominal;

    // --- Daily load modulation (8% amplitude, 24-h period) ---
    const load_mod = ch.nominal * 0.08 * Math.sin(2 * Math.PI * age_hours / 24);

    // --- Degradation effect ---
    let deg = 0;
    if (active_mode && DEGRADATION_MODULES[active_mode]) {
      deg = DEGRADATION_MODULES[active_mode].effect(
        ch.code,
        mode_progress,
        ch,           // channel descriptor (for noise_sigma / nominal)
        age_hours     // some modes use time base (e.g. rotor_imbalance)
      );
    }

    // --- White noise ---
    const noise = ch.noise_sigma > 0 ? gaussianNoise() * ch.noise_sigma : 0;

    // --- Occasional outlier spike (probability 0.001) ---
    let outlier = 0;
    if (Math.random() < 0.001) {
      outlier = gaussianNoise() * ch.noise_sigma * 10;
    }

    const raw = base + load_mod + deg + noise + outlier;

    // --- LP filter (thermal / mechanical inertia) ---
    const dt_seconds = dt_hours * 3600;
    return this.filter.update(raw, dt_seconds);
  }

  /**
   * Seed the filter's initial state and the accumulator.
   * Called once when the unit is initialised with a known age.
   *
   * @param {number} age_hours  - Initial age
   */
  initialise(age_hours) {
    if (this.channel.monotone) {
      this._accumulator = age_hours;
    } else {
      // Pre-warm the filter at the nominal value so we start without a
      // transient step from null → nominal.
      this.filter.last = this.channel.nominal;
    }
  }

  /** Reset state after a unit reset. */
  reset(age_hours) {
    this.filter.reset();
    if (this.channel.monotone) {
      this._accumulator = age_hours;
    }
  }
}

module.exports = { ChannelModel, DEGRADATION_MODULES };
