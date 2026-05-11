"use strict";
const { weibullSample } = require("./weibull");

const STATUS = { HEALTHY: "HEALTHY", DEGRADING: "DEGRADING", FAILED: "FAILED" };

class UnitState {
  constructor({ unit_id, model_code, channels, failure_modes, weibull }) {
    this.unit_id = unit_id;
    this.model_code = model_code;
    this.channels = channels;
    this.failure_modes = failure_modes;
    this.health = 1.0;
    this.age_hours = 0;
    this.status = STATUS.HEALTHY;
    this.active_mode = null;
    this.mode_progress = 0;
    this.ttf_hours = weibullSample(weibull.eta, weibull.beta);
  }

  advance(dt_seconds) {
    this.age_hours += dt_seconds / 3600;

    if (this.status === STATUS.HEALTHY && this.age_hours >= this.ttf_hours) {
      this.status = STATUS.DEGRADING;
      const idx = Math.floor(Math.random() * this.failure_modes.length);
      this.active_mode = this.failure_modes[idx].code;
    }

    if (this.status === STATUS.DEGRADING) {
      this.mode_progress = Math.min(1, this.mode_progress + (dt_seconds / 3600) / 72);
      this.health = Math.max(0, 1 - this.mode_progress);
      if (this.health <= 0) this.status = STATUS.FAILED;
    }
  }

  sample() {
    const ts = new Date().toISOString();
    return this.channels.map((ch) => ({
      unit_id: this.unit_id,
      channel_code: ch.code,
      ts,
      value: this._synthesize(ch),
      quality: this.status === STATUS.FAILED ? 0 : 1,
    }));
  }

  _synthesize(ch) {
    const load = 0.7 + 0.3 * Math.sin(Date.now() / 60000);
    const noise = (Math.random() - 0.5) * ch.noise_sigma * 2;
    const nominal = ch.nominal + (ch.nominal * 0.1 * load);
    const deg = this.active_mode ? ch.nominal * 0.2 * this.mode_progress : 0;
    return nominal + deg + noise;
  }
}

module.exports = { UnitState };
