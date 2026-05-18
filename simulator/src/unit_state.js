"use strict";

const { sampleWeibull } = require("./weibull");
const { ChannelModel }  = require("./channel_model");

const STATUS = {
  HEALTHY:   "HEALTHY",
  DEGRADING: "DEGRADING",
  FAILED:    "FAILED",
};

/**
 * Full state machine for one monitored unit.
 *
 * Lifecycle:
 *   HEALTHY  → (age approaches TTF, stochastic trigger) → DEGRADING
 *   DEGRADING → (health < 0.05) → FAILED
 *   FAILED   stays failed until explicitly reset via control API
 */
class UnitState {
  /**
   * @param {object} opts
   * @param {number} opts.unit_id        - Backend unit_id (1-based)
   * @param {string} opts.model_code     - e.g. "SRV-R740-2U"
   * @param {object} opts.passport       - Full passport object from passports.js
   * @param {number} opts.initial_age_hours - Starting simulated age
   * @param {number} [opts.seed]         - Weibull sampling seed
   */
  constructor({ unit_id, model_code, passport, initial_age_hours, seed }) {
    this.unit_id   = unit_id;
    this.model_code = model_code;
    this.passport  = passport;

    // Core state
    this.health     = 1.0;
    this.age_hours  = initial_age_hours;
    this.status     = STATUS.HEALTHY;

    // Degradation state
    this.active_mode          = null;
    this.mode_progress        = 0;
    this.mode_started_at_hours = null;
    this._mode_horizon_hours  = null; // randomised horizon for current mode

    // TTF: sample from Weibull; the unit's "failure clock" starts at birth
    // but we offset by initial_age so remaining life = TTF - initial_age
    const ttf_from_birth = sampleWeibull(
      passport.weibull.eta,
      passport.weibull.beta,
      seed !== undefined ? seed + unit_id : undefined
    );
    // If unit is already older than sampled TTF, push TTF further out
    this.ttf_hours = Math.max(ttf_from_birth, initial_age_hours * 1.1 + 1000);

    // Build channel models
    this._channel_models = new Map();
    for (const ch of passport.channels) {
      const model = new ChannelModel(ch);
      model.initialise(initial_age_hours);
      this._channel_models.set(ch.code, model);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Advance simulation by dt_hours of simulated time.
   * Updates age, evaluates state transitions, advances mode progress.
   *
   * @param {number} dt_hours - Simulated hours to advance
   */
  advance(dt_hours) {
    if (this.status === STATUS.FAILED) return;

    this.age_hours += dt_hours;

    // --- State transition: HEALTHY → DEGRADING ---
    if (this.status === STATUS.HEALTHY) {
      const onset_threshold = this.ttf_hours * 0.7;
      if (this.age_hours >= onset_threshold) {
        // Stochastic trigger: probability per step proportional to dt
        const p_trigger = 0.001 * dt_hours;
        if (Math.random() < p_trigger) {
          this._start_failure_mode();
        }
        // Hard trigger: if already past TTF, always start
        if (this.age_hours >= this.ttf_hours && this.status === STATUS.HEALTHY) {
          this._start_failure_mode();
        }
      }
    }

    // --- Advance mode progress ---
    if (this.status === STATUS.DEGRADING) {
      const horizon = this._mode_horizon_hours || 72;
      const dp = dt_hours / (horizon * 0.9 + 0.1 * horizon * Math.random());
      this.mode_progress = Math.min(1, this.mode_progress + dp);

      // health = max(0, 1 - progress * (0.7 + 0.3 * progress))
      this.health = Math.max(0, 1 - this.mode_progress * (0.7 + 0.3 * this.mode_progress));

      if (this.health < 0.05) {
        this.health = 0;
        this.status = STATUS.FAILED;
      }
    }
  }

  /**
   * Sample all channels and return an array of telemetry point objects.
   *
   * @param {Date} [ts] - Timestamp (defaults to now)
   * @returns {Array<{unit_id, channel_code, ts, value, quality}>}
   */
  sample(ts) {
    // Delegate to sampleWithDt with a zero dt so monotone channels don't
    // accumulate extra time — caller must have already called advance().
    return this.sampleWithDt(0, ts);
  }

  /**
   * Sample all channels with an explicit dt_hours (used by the main loop
   * so the LP filter gets a proper time step).
   *
   * @param {number} dt_hours
   * @param {Date}   [ts]
   * @returns {Array}
   */
  sampleWithDt(dt_hours, ts) {
    const iso = (ts || new Date()).toISOString();
    const points = [];

    for (const ch of this.passport.channels) {
      const model = this._channel_models.get(ch.code);
      let value;
      try {
        value = model.sample(
          this.age_hours,
          dt_hours,
          this.status !== STATUS.FAILED ? this.active_mode : null,
          this.mode_progress
        );
      } catch (_) {
        value = ch.nominal;
      }

      points.push({
        unit_id:      this.unit_id,
        channel_code: ch.code,
        ts:           iso,
        value:        Number(value.toFixed(6)),
        quality:      this.status === STATUS.FAILED ? 0 : 1,
      });
    }

    return points;
  }

  /**
   * Compute remaining useful life (true ground truth), in hours.
   * For a healthy unit: ttf_hours - age_hours (clamped to 0).
   * For a degrading unit: pro-rated remaining mode horizon.
   * For a failed unit: 0.
   */
  get rul_true_hours() {
    if (this.status === STATUS.FAILED) return 0;
    if (this.status === STATUS.HEALTHY) {
      return Math.max(0, this.ttf_hours - this.age_hours);
    }
    // DEGRADING: remaining progress fraction * effective horizon
    const remaining_progress = 1 - this.mode_progress;
    const horizon = this._mode_horizon_hours || 72;
    return Math.max(0, remaining_progress * horizon);
  }

  /**
   * Serialise current state (for /sim/state API and ground-truth ingest).
   */
  toJSON() {
    return {
      unit_id:            this.unit_id,
      model_code:         this.model_code,
      health:             this.health,
      age_hours:          this.age_hours,
      ttf_hours:          this.ttf_hours,
      active_mode:        this.active_mode,
      mode_progress:      this.mode_progress,
      mode_started_at_hours: this.mode_started_at_hours,
      status:             this.status,
      rul_true_hours:     this.rul_true_hours,
    };
  }

  // ---------------------------------------------------------------------------
  // Control API helpers
  // ---------------------------------------------------------------------------

  /**
   * Force a specific failure mode (used by /sim/inject_fault).
   *
   * @param {string} mode_code
   * @param {number} [horizon_hours]
   */
  injectFault(mode_code, horizon_hours) {
    const mode_def = this.passport.failure_modes.find(m => m.code === mode_code);
    if (!mode_def && !horizon_hours) {
      throw new Error(`Unknown failure mode: ${mode_code}`);
    }
    this.active_mode           = mode_code;
    this.mode_progress         = 0.01;
    this.mode_started_at_hours = this.age_hours;
    this._mode_horizon_hours   = horizon_hours || (mode_def ? mode_def.typical_horizon_hours : 72);
    this.status                = STATUS.DEGRADING;
    this.health                = Math.max(0, 1 - this.mode_progress * (0.7 + 0.3 * this.mode_progress));
  }

  /**
   * Reset unit to fully healthy state (used by /sim/reset_unit).
   */
  reset() {
    this.health                = 1.0;
    this.active_mode           = null;
    this.mode_progress         = 0;
    this.mode_started_at_hours = null;
    this._mode_horizon_hours   = null;
    this.status                = STATUS.HEALTHY;

    // Re-sample TTF from current age
    this.ttf_hours = this.age_hours + sampleWeibull(
      this.passport.weibull.eta,
      this.passport.weibull.beta
    );

    // Reset channel model filters
    for (const ch of this.passport.channels) {
      const model = this._channel_models.get(ch.code);
      model.reset(this.age_hours);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _start_failure_mode() {
    const modes = this.passport.failure_modes;
    const chosen = modes[Math.floor(Math.random() * modes.length)];
    this.active_mode           = chosen.code;
    this.mode_progress         = 0;
    this.mode_started_at_hours = this.age_hours;
    // Randomise the actual horizon ±20% around typical
    const jitter = 0.8 + Math.random() * 0.4;
    this._mode_horizon_hours   = chosen.typical_horizon_hours * jitter;
    this.status                = STATUS.DEGRADING;
  }
}

module.exports = { UnitState, STATUS };
