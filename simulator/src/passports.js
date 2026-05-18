"use strict";

/**
 * Equipment passports for all four model types.
 *
 * Channel descriptor fields:
 *   code           - unique channel identifier
 *   type           - T=temperature, F=flow/generic, Q=quality/error, E=electrical, V=vibration, R=running-total
 *   unit           - engineering unit label
 *   nominal        - healthy operating value
 *   noise_sigma    - 1-sigma white noise amplitude
 *   inertia_seconds - LP-filter time constant (0 = no filter)
 *   monotone       - true if channel only accumulates (class R)
 *
 * failure_modes fields:
 *   code           - identifier used in degradation modules
 *   typical_horizon_hours - expected duration from onset to failure
 *
 * weibull: { eta, beta } — characteristic life and shape for TTF distribution
 */

const SRV_R740_2U = {
  model_code: "SRV-R740-2U",
  weibull: { eta: 43800, beta: 2.4 },
  channels: [
    { code: "cpu_temp_pkg",           type: "T", unit: "°C",     nominal: 55,        noise_sigma: 0.5,  inertia_seconds: 120,  monotone: false },
    { code: "cpu_temp_core_avg",      type: "T", unit: "°C",     nominal: 58,        noise_sigma: 0.6,  inertia_seconds: 120,  monotone: false },
    { code: "cpu_load_pct",           type: "F", unit: "%",      nominal: 35,        noise_sigma: 2.0,  inertia_seconds: 30,   monotone: false },
    { code: "ram_usage_pct",          type: "F", unit: "%",      nominal: 50,        noise_sigma: 1.0,  inertia_seconds: 10,   monotone: false },
    { code: "ram_ecc_errors_rate",    type: "Q", unit: "err/min",nominal: 0,         noise_sigma: 0.02, inertia_seconds: 0,    monotone: false },
    { code: "ssd_wear_pct",           type: "R", unit: "%",      nominal: 0,         noise_sigma: 0.1,  inertia_seconds: 0,    monotone: true  },
    { code: "ssd_temp",               type: "T", unit: "°C",     nominal: 40,        noise_sigma: 0.4,  inertia_seconds: 60,   monotone: false },
    { code: "fan_rpm_front",          type: "F", unit: "rpm",    nominal: 4500,      noise_sigma: 30,   inertia_seconds: 5,    monotone: false },
    { code: "fan_rpm_rear",           type: "F", unit: "rpm",    nominal: 4000,      noise_sigma: 25,   inertia_seconds: 5,    monotone: false },
    { code: "psu_voltage_12v",        type: "E", unit: "V",      nominal: 12.0,      noise_sigma: 0.02, inertia_seconds: 2,    monotone: false },
    { code: "psu_current",            type: "E", unit: "A",      nominal: 25,        noise_sigma: 0.3,  inertia_seconds: 2,    monotone: false },
    { code: "network_rx_errors_rate", type: "Q", unit: "err/s",  nominal: 0,         noise_sigma: 0.005,inertia_seconds: 0,    monotone: false },
    { code: "disk_io_latency_p99",    type: "Q", unit: "ms",     nominal: 5,         noise_sigma: 0.5,  inertia_seconds: 0,    monotone: false },
    { code: "uptime_hours",           type: "R", unit: "h",      nominal: 0,         noise_sigma: 0,    inertia_seconds: 0,    monotone: true  },
    { code: "gpu_temp",               type: "T", unit: "°C",     nominal: 60,        noise_sigma: 0.8,  inertia_seconds: 90,   monotone: false },
  ],
  failure_modes: [
    { code: "thermal_runaway",          typical_horizon_hours: 72  },
    { code: "fan_bearing_wear",         typical_horizon_hours: 240 },
    { code: "ssd_endurance_exhaustion", typical_horizon_hours: 720 },
    { code: "psu_degradation",          typical_horizon_hours: 168 },
  ],
};

const PMP_CF250 = {
  model_code: "PMP-CF250",
  weibull: { eta: 26280, beta: 2.1 },
  channels: [
    { code: "vibration_x_rms",   type: "V", unit: "mm/s", nominal: 2.5,  noise_sigma: 0.05, inertia_seconds: 2,   monotone: false },
    { code: "vibration_y_rms",   type: "V", unit: "mm/s", nominal: 2.5,  noise_sigma: 0.05, inertia_seconds: 2,   monotone: false },
    { code: "vibration_z_rms",   type: "V", unit: "mm/s", nominal: 1.5,  noise_sigma: 0.03, inertia_seconds: 2,   monotone: false },
    { code: "bearing_temp_de",   type: "T", unit: "°C",   nominal: 50,   noise_sigma: 0.4,  inertia_seconds: 180, monotone: false },
    { code: "bearing_temp_nde",  type: "T", unit: "°C",   nominal: 48,   noise_sigma: 0.4,  inertia_seconds: 180, monotone: false },
    { code: "winding_current",   type: "E", unit: "A",    nominal: 18,   noise_sigma: 0.2,  inertia_seconds: 5,   monotone: false },
    { code: "winding_temp",      type: "T", unit: "°C",   nominal: 70,   noise_sigma: 0.5,  inertia_seconds: 240, monotone: false },
    { code: "pressure_discharge",type: "F", unit: "bar",  nominal: 6.0,  noise_sigma: 0.05, inertia_seconds: 10,  monotone: false },
    { code: "flow_rate",         type: "F", unit: "m³/h", nominal: 250,  noise_sigma: 1.0,  inertia_seconds: 10,  monotone: false },
    { code: "rpm",               type: "F", unit: "rpm",  nominal: 2960, noise_sigma: 5,    inertia_seconds: 3,   monotone: false },
    { code: "runtime_hours",     type: "R", unit: "h",    nominal: 0,    noise_sigma: 0,    inertia_seconds: 0,   monotone: true  },
  ],
  failure_modes: [
    { code: "bearing_wear",    typical_horizon_hours: 360 },
    { code: "rotor_imbalance", typical_horizon_hours: 168 },
    { code: "cavitation",      typical_horizon_hours: 48  },
    { code: "winding_short",   typical_horizon_hours: 24  },
  ],
};

const CRY_LN2_15K = {
  model_code: "CRY-LN2-15K",
  weibull: { eta: 35040, beta: 1.8 },
  channels: [
    { code: "dewar_pressure",             type: "F", unit: "bar",    nominal: 1.1,    noise_sigma: 0.005, inertia_seconds: 30,  monotone: false },
    { code: "cold_head_temp",             type: "T", unit: "K",      nominal: 4.2,    noise_sigma: 0.02,  inertia_seconds: 300, monotone: false },
    { code: "compressor_current",         type: "E", unit: "A",      nominal: 14,     noise_sigma: 0.15,  inertia_seconds: 5,   monotone: false },
    { code: "compressor_oil_temp",        type: "T", unit: "°C",     nominal: 55,     noise_sigma: 0.3,   inertia_seconds: 120, monotone: false },
    { code: "ln2_level_pct",              type: "F", unit: "%",      nominal: 70,     noise_sigma: 0.5,   inertia_seconds: 60,  monotone: false },
    { code: "boil_off_rate",              type: "F", unit: "l/h",    nominal: 0.5,    noise_sigma: 0.01,  inertia_seconds: 20,  monotone: false },
    { code: "vacuum_pressure",            type: "E", unit: "Pa",     nominal: 0.0001, noise_sigma: 0.00001, inertia_seconds: 60, monotone: false },
    { code: "condense_cycles_per_hour",   type: "F", unit: "cyc/h",  nominal: 0.5,    noise_sigma: 0.02,  inertia_seconds: 0,   monotone: false },
    { code: "runtime_hours",              type: "R", unit: "h",      nominal: 0,      noise_sigma: 0,     inertia_seconds: 0,   monotone: true  },
    { code: "defrost_count",              type: "R", unit: "count",  nominal: 0,      noise_sigma: 0,     inertia_seconds: 0,   monotone: true  },
  ],
  failure_modes: [
    { code: "vacuum_breach",    typical_horizon_hours: 144 },
    { code: "compressor_wear",  typical_horizon_hours: 480 },
    { code: "filter_clog",      typical_horizon_hours: 96  },
  ],
};

const QA_7000 = {
  model_code: "QA-7000",
  weibull: { eta: 17520, beta: 1.5 },
  channels: [
    { code: "quantum_flux_pressure",     type: "T", unit: "qfp",     nominal: 42.0,     noise_sigma: 0.1,   inertia_seconds: 30,  monotone: false },
    { code: "containment_field_strength",type: "E", unit: "kG",      nominal: 12.5,     noise_sigma: 0.02,  inertia_seconds: 10,  monotone: false },
    { code: "tachyon_emission_rate",     type: "Q", unit: "count/s", nominal: 0,        noise_sigma: 0.005, inertia_seconds: 0,   monotone: false },
    { code: "vacuum_chamber_integrity",  type: "F", unit: "%",       nominal: 99.5,     noise_sigma: 0.05,  inertia_seconds: 20,  monotone: false },
    { code: "entanglement_coherence",    type: "Q", unit: "%",       nominal: 87,       noise_sigma: 0.3,   inertia_seconds: 15,  monotone: false },
    { code: "annihilation_cycle_count",  type: "R", unit: "count",   nominal: 0,        noise_sigma: 0,     inertia_seconds: 0,   monotone: true  },
    { code: "dimensional_resonance_freq",type: "V", unit: "Hz",      nominal: 2400000,  noise_sigma: 50,    inertia_seconds: 5,   monotone: false },
    { code: "core_temp_kelvin",          type: "T", unit: "K",       nominal: 0.05,     noise_sigma: 0.001, inertia_seconds: 600, monotone: false },
    { code: "total_runtime_hours",       type: "R", unit: "h",       nominal: 0,        noise_sigma: 0,     inertia_seconds: 0,   monotone: true  },
  ],
  failure_modes: [
    { code: "field_decoherence",  typical_horizon_hours: 120 },
    { code: "tachyon_overflow",   typical_horizon_hours: 48  },
    { code: "containment_drift",  typical_horizon_hours: 240 },
  ],
};

/** Map from model_code to passport object */
const PASSPORTS = {
  "SRV-R740-2U": SRV_R740_2U,
  "PMP-CF250":   PMP_CF250,
  "CRY-LN2-15K": CRY_LN2_15K,
  "QA-7000":     QA_7000,
};

module.exports = { PASSPORTS, SRV_R740_2U, PMP_CF250, CRY_LN2_15K, QA_7000 };
