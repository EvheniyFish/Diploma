"use strict";
require("dotenv").config();
const crypto = require("crypto");
const { getDb } = require("./index");

function hashPassport(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

const PASSPORTS = [
  {
    model_code: "SRV-R740-2U",
    display_name: "Серверна стійка Dell R740 (2U)",
    category: "compute",
    weibull_eta_hours: 43800,
    weibull_beta: 2.4,
    channels: [
      { code: "cpu_temp_pkg", class: "T", unit: "°C", nominal: 55, operating_range: [30, 75], critical_range: [85, 105], inertia_seconds: 30, noise_sigma: 0.6 },
      { code: "cpu_temp_core_avg", class: "T", unit: "°C", nominal: 58, operating_range: [35, 80], critical_range: [90, 110], inertia_seconds: 25, noise_sigma: 0.5 },
      { code: "cpu_load_pct", class: "F", unit: "%", nominal: 35, operating_range: [0, 95], critical_range: [98, 100], inertia_seconds: 5, noise_sigma: 2 },
      { code: "ram_usage_pct", class: "F", unit: "%", nominal: 50, operating_range: [0, 90], critical_range: [95, 100], inertia_seconds: 3, noise_sigma: 1 },
      { code: "ram_ecc_errors_rate", class: "Q", unit: "err/min", nominal: 0, operating_range: [0, 2], critical_range: [10, 9999], inertia_seconds: 0, noise_sigma: 0.1 },
      { code: "ssd_wear_pct", class: "R", unit: "%", nominal: 0, operating_range: [0, 80], critical_range: [95, 100], inertia_seconds: 0, noise_sigma: 0 },
      { code: "ssd_temp", class: "T", unit: "°C", nominal: 40, operating_range: [25, 60], critical_range: [70, 85], inertia_seconds: 60, noise_sigma: 0.3 },
      { code: "fan_rpm_front", class: "F", unit: "rpm", nominal: 4500, operating_range: [2000, 7000], critical_range: [0, 1500], inertia_seconds: 5, noise_sigma: 50 },
      { code: "fan_rpm_rear", class: "F", unit: "rpm", nominal: 4000, operating_range: [2000, 7000], critical_range: [0, 1500], inertia_seconds: 5, noise_sigma: 50 },
      { code: "psu_voltage_12v", class: "E", unit: "V", nominal: 12.0, operating_range: [11.4, 12.6], critical_range: [11.0, 13.0], inertia_seconds: 1, noise_sigma: 0.05 },
      { code: "psu_current", class: "E", unit: "A", nominal: 25, operating_range: [10, 50], critical_range: [0, 60], inertia_seconds: 2, noise_sigma: 0.5 },
      { code: "network_rx_errors_rate", class: "Q", unit: "err/s", nominal: 0, operating_range: [0, 5], critical_range: [50, 9999], inertia_seconds: 0, noise_sigma: 0.2 },
      { code: "disk_io_latency_p99", class: "Q", unit: "ms", nominal: 5, operating_range: [0, 20], critical_range: [100, 9999], inertia_seconds: 0, noise_sigma: 0.5 },
      { code: "uptime_hours", class: "R", unit: "h", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
      { code: "gpu_temp", class: "T", unit: "°C", nominal: 60, operating_range: [40, 85], critical_range: [95, 105], inertia_seconds: 20, noise_sigma: 0.8 },
    ],
    failure_modes: [
      { code: "thermal_runaway", name: "Тепловий розгін", affected_channels: ["cpu_temp_pkg", "fan_rpm_front", "gpu_temp"], signature: "rising_T_compensating_F", typical_horizon_hours: 72 },
      { code: "fan_bearing_wear", name: "Знос підшипника вентилятора", affected_channels: ["fan_rpm_front", "fan_rpm_rear", "cpu_temp_pkg"], signature: "rpm_std_increase", typical_horizon_hours: 240 },
      { code: "ssd_endurance_exhaustion", name: "Вичерпання ресурсу SSD", affected_channels: ["ssd_wear_pct", "disk_io_latency_p99", "ssd_temp"], signature: "monotone_wear_increase", typical_horizon_hours: 720 },
      { code: "psu_degradation", name: "Деградація блоку живлення", affected_channels: ["psu_voltage_12v", "psu_current"], signature: "voltage_instability", typical_horizon_hours: 168 },
    ],
  },
  {
    model_code: "PMP-CF250",
    display_name: "Відцентровий насос CF-250",
    category: "rotary",
    weibull_eta_hours: 26280,
    weibull_beta: 2.1,
    channels: [
      { code: "vibration_x_rms", class: "V", unit: "mm/s", nominal: 2.5, operating_range: [0, 7], critical_range: [11.2, 9999], inertia_seconds: 2, noise_sigma: 0.2 },
      { code: "vibration_y_rms", class: "V", unit: "mm/s", nominal: 2.5, operating_range: [0, 7], critical_range: [11.2, 9999], inertia_seconds: 2, noise_sigma: 0.2 },
      { code: "vibration_z_rms", class: "V", unit: "mm/s", nominal: 1.5, operating_range: [0, 4.5], critical_range: [7, 9999], inertia_seconds: 2, noise_sigma: 0.1 },
      { code: "bearing_temp_de", class: "T", unit: "°C", nominal: 50, operating_range: [25, 85], critical_range: [95, 9999], inertia_seconds: 60, noise_sigma: 0.4 },
      { code: "bearing_temp_nde", class: "T", unit: "°C", nominal: 48, operating_range: [25, 85], critical_range: [95, 9999], inertia_seconds: 60, noise_sigma: 0.4 },
      { code: "winding_current", class: "E", unit: "A", nominal: 18, operating_range: [10, 25], critical_range: [32, 9999], inertia_seconds: 3, noise_sigma: 0.3 },
      { code: "winding_temp", class: "T", unit: "°C", nominal: 70, operating_range: [40, 110], critical_range: [130, 9999], inertia_seconds: 90, noise_sigma: 0.6 },
      { code: "pressure_discharge", class: "F", unit: "bar", nominal: 6.0, operating_range: [4, 8], critical_range: [2, 10], inertia_seconds: 5, noise_sigma: 0.05 },
      { code: "flow_rate", class: "F", unit: "m³/h", nominal: 250, operating_range: [150, 320], critical_range: [100, 380], inertia_seconds: 10, noise_sigma: 2 },
      { code: "rpm", class: "F", unit: "rpm", nominal: 2960, operating_range: [2900, 3020], critical_range: [2860, 3060], inertia_seconds: 3, noise_sigma: 5 },
      { code: "runtime_hours", class: "R", unit: "h", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
    ],
    failure_modes: [
      { code: "bearing_wear", name: "Знос підшипника", affected_channels: ["vibration_x_rms", "vibration_y_rms", "bearing_temp_de"], typical_horizon_hours: 360 },
      { code: "rotor_imbalance", name: "Дисбаланс ротора", affected_channels: ["vibration_x_rms", "vibration_y_rms", "vibration_z_rms"], typical_horizon_hours: 168 },
      { code: "cavitation", name: "Кавітація", affected_channels: ["pressure_discharge", "vibration_x_rms", "winding_current"], typical_horizon_hours: 48 },
      { code: "winding_short", name: "Замикання обмотки", affected_channels: ["winding_current", "winding_temp"], typical_horizon_hours: 24 },
    ],
  },
  {
    model_code: "CRY-LN2-15K",
    display_name: "Кріогенна установка LN2-15K",
    category: "cryo",
    weibull_eta_hours: 35040,
    weibull_beta: 1.8,
    channels: [
      { code: "dewar_pressure", class: "F", unit: "bar", nominal: 1.1, operating_range: [0.9, 1.5], critical_range: [2.0, 9999], inertia_seconds: 20, noise_sigma: 0.01 },
      { code: "cold_head_temp", class: "T", unit: "K", nominal: 4.2, operating_range: [4.0, 10], critical_range: [20, 9999], inertia_seconds: 120, noise_sigma: 0.05 },
      { code: "compressor_current", class: "E", unit: "A", nominal: 14, operating_range: [10, 20], critical_range: [25, 9999], inertia_seconds: 5, noise_sigma: 0.2 },
      { code: "compressor_oil_temp", class: "T", unit: "°C", nominal: 55, operating_range: [30, 80], critical_range: [95, 9999], inertia_seconds: 180, noise_sigma: 0.3 },
      { code: "ln2_level_pct", class: "F", unit: "%", nominal: 70, operating_range: [30, 95], critical_range: [0, 10], inertia_seconds: 60, noise_sigma: 0.5 },
      { code: "boil_off_rate", class: "F", unit: "l/h", nominal: 0.5, operating_range: [0.2, 1.0], critical_range: [3.0, 9999], inertia_seconds: 30, noise_sigma: 0.02 },
      { code: "vacuum_pressure", class: "E", unit: "Pa", nominal: 0.0001, operating_range: [0.00001, 0.001], critical_range: [0.01, 9999], inertia_seconds: 300, noise_sigma: 0.000005 },
      { code: "condense_cycles_per_hour", class: "F", unit: "cyc/h", nominal: 0.5, operating_range: [0, 2], critical_range: [5, 9999], inertia_seconds: 0, noise_sigma: 0 },
      { code: "runtime_hours", class: "R", unit: "h", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
      { code: "defrost_count", class: "R", unit: "count", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
    ],
    failure_modes: [
      { code: "vacuum_breach", name: "Витік ізоляції вакууму", affected_channels: ["vacuum_pressure", "boil_off_rate", "compressor_current"], typical_horizon_hours: 144 },
      { code: "compressor_wear", name: "Деградація компресора", affected_channels: ["compressor_current", "compressor_oil_temp", "condense_cycles_per_hour"], typical_horizon_hours: 480 },
      { code: "filter_clog", name: "Забивання фільтра", affected_channels: ["dewar_pressure", "ln2_level_pct", "boil_off_rate"], typical_horizon_hours: 96 },
    ],
  },
  {
    model_code: "QA-7000",
    display_name: "Квантовий анігілятор QA-7000",
    category: "experimental",
    weibull_eta_hours: 17520,
    weibull_beta: 1.5,
    channels: [
      { code: "quantum_flux_pressure", class: "T", unit: "qfp", nominal: 42.0, operating_range: [38, 47], critical_range: [52, 9999], inertia_seconds: 15, noise_sigma: 0.3 },
      { code: "containment_field_strength", class: "E", unit: "kG", nominal: 12.5, operating_range: [11.0, 14.0], critical_range: [0, 9.0], inertia_seconds: 10, noise_sigma: 0.1 },
      { code: "tachyon_emission_rate", class: "Q", unit: "count/s", nominal: 0, operating_range: [0, 3], critical_range: [15, 9999], inertia_seconds: 0, noise_sigma: 0.1 },
      { code: "vacuum_chamber_integrity", class: "F", unit: "%", nominal: 99.5, operating_range: [98, 100], critical_range: [0, 95], inertia_seconds: 120, noise_sigma: 0.05 },
      { code: "entanglement_coherence", class: "Q", unit: "%", nominal: 87, operating_range: [80, 95], critical_range: [0, 70], inertia_seconds: 30, noise_sigma: 0.5 },
      { code: "annihilation_cycle_count", class: "R", unit: "count", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
      { code: "dimensional_resonance_freq", class: "V", unit: "Hz", nominal: 2400000, operating_range: [2280000, 2520000], critical_range: [2040000, 2760000], inertia_seconds: 5, noise_sigma: 500 },
      { code: "core_temp_kelvin", class: "T", unit: "K", nominal: 0.05, operating_range: [0.02, 0.1], critical_range: [0.5, 9999], inertia_seconds: 300, noise_sigma: 0.001 },
      { code: "total_runtime_hours", class: "R", unit: "h", nominal: 0, operating_range: [0, 9999], critical_range: [0, 0], inertia_seconds: 0, noise_sigma: 0 },
    ],
    failure_modes: [
      { code: "field_decoherence", name: "Декогеренція поля", affected_channels: ["containment_field_strength", "entanglement_coherence", "tachyon_emission_rate"], typical_horizon_hours: 120 },
      { code: "tachyon_overflow", name: "Перевантаження тахіонів", affected_channels: ["tachyon_emission_rate", "quantum_flux_pressure"], typical_horizon_hours: 48 },
      { code: "containment_drift", name: "Дрейф утримуючого поля", affected_channels: ["containment_field_strength", "vacuum_chamber_integrity", "dimensional_resonance_freq"], typical_horizon_hours: 240 },
    ],
  },
];

const UNITS = [
  { model_code: "SRV-R740-2U", serial_no: "SRV-001", location: "ДЦ-1 стійка А1", hours_run: 8000, commissioned_at: "2023-02-15T00:00:00Z" },
  { model_code: "SRV-R740-2U", serial_no: "SRV-002", location: "ДЦ-1 стійка А2", hours_run: 15000, commissioned_at: "2022-07-20T00:00:00Z" },
  { model_code: "SRV-R740-2U", serial_no: "SRV-003", location: "ДЦ-2 стійка B1", hours_run: 22000, commissioned_at: "2021-12-01T00:00:00Z" },
  { model_code: "SRV-R740-2U", serial_no: "SRV-004", location: "ДЦ-2 стійка B2", hours_run: 3000, commissioned_at: "2023-10-05T00:00:00Z" },
  { model_code: "PMP-CF250", serial_no: "PMP-001", location: "НС-1 агрегат 1", hours_run: 12000, commissioned_at: "2022-10-10T00:00:00Z" },
  { model_code: "PMP-CF250", serial_no: "PMP-002", location: "НС-1 агрегат 2", hours_run: 18000, commissioned_at: "2022-02-14T00:00:00Z" },
  { model_code: "PMP-CF250", serial_no: "PMP-003", location: "НС-2 агрегат 1", hours_run: 5000, commissioned_at: "2023-07-01T00:00:00Z" },
  { model_code: "PMP-CF250", serial_no: "PMP-004", location: "НС-2 агрегат 2", hours_run: 9500, commissioned_at: "2023-01-18T00:00:00Z" },
  { model_code: "CRY-LN2-15K", serial_no: "CRY-001", location: "Лаб 101", hours_run: 7200, commissioned_at: "2023-04-20T00:00:00Z" },
  { model_code: "CRY-LN2-15K", serial_no: "CRY-002", location: "Лаб 203", hours_run: 14400, commissioned_at: "2022-06-01T00:00:00Z" },
  { model_code: "CRY-LN2-15K", serial_no: "CRY-003", location: "Лаб 305", hours_run: 2800, commenced_at: "2023-12-01T00:00:00Z", commissioned_at: "2023-12-01T00:00:00Z" },
  { model_code: "CRY-LN2-15K", serial_no: "CRY-004", location: "Лаб 401", hours_run: 21000, commissioned_at: "2021-10-15T00:00:00Z" },
  { model_code: "QA-7000", serial_no: "QA-001", location: "Сектор Альфа", hours_run: 4000, commissioned_at: "2023-09-01T00:00:00Z" },
  { model_code: "QA-7000", serial_no: "QA-002", location: "Сектор Бета", hours_run: 8800, commissioned_at: "2023-01-10T00:00:00Z" },
  { model_code: "QA-7000", serial_no: "QA-003", location: "Сектор Гамма", hours_run: 1200, commissioned_at: "2024-04-01T00:00:00Z" },
  { model_code: "QA-7000", serial_no: "QA-004", location: "Сектор Дельта", hours_run: 11000, commissioned_at: "2022-09-20T00:00:00Z" },
];

function seed() {
  const db = getDb();

  const existing = db.prepare("SELECT COUNT(*) as cnt FROM equipment_models").get();
  if (existing.cnt > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  const insertModel = db.prepare(
    "INSERT INTO equipment_models (model_code, display_name, category, passport_json, passport_hash, weibull_eta, weibull_beta) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const insertUnit = db.prepare(
    "INSERT INTO equipment_units (model_id, serial_no, location, commissioned_at, hours_run) VALUES (?, ?, ?, ?, ?)"
  );

  const insertHealth = db.prepare(
    "INSERT INTO health_state (unit_id, status, anomaly_score) VALUES (?, 'ok', 0)"
  );

  const doSeed = db.transaction(() => {
    const modelIdByCode = {};

    for (const passport of PASSPORTS) {
      const passport_json = JSON.stringify(passport);
      const passport_hash = hashPassport(passport);
      const { lastInsertRowid } = insertModel.run(
        passport.model_code,
        passport.display_name,
        passport.category,
        passport_json,
        passport_hash,
        passport.weibull_eta_hours,
        passport.weibull_beta
      );
      modelIdByCode[passport.model_code] = lastInsertRowid;
    }

    for (const u of UNITS) {
      const model_id = modelIdByCode[u.model_code];
      if (!model_id) throw new Error(`Unknown model_code: ${u.model_code}`);
      const { lastInsertRowid } = insertUnit.run(
        model_id,
        u.serial_no,
        u.location,
        u.commissioned_at,
        u.hours_run
      );
      insertHealth.run(lastInsertRowid);
    }
  });

  doSeed();
  console.log(`Seeded ${PASSPORTS.length} models and ${UNITS.length} units.`);
}

seed();
