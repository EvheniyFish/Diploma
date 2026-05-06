"use strict";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS equipment_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    manufacturer TEXT,
    passport_json TEXT NOT NULL,
    passport_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS equipment_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id INTEGER NOT NULL REFERENCES equipment_models(id),
    serial_number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    location TEXT,
    commissioned_at TEXT,
    age_hours REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES equipment_units(id),
    channel_code TEXT NOT NULL,
    ts TEXT NOT NULL,
    value REAL NOT NULL,
    quality INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_telemetry_unit_channel_ts
    ON telemetry(unit_id, channel_code, ts DESC);

  CREATE TABLE IF NOT EXISTS health_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL UNIQUE REFERENCES equipment_units(id),
    status TEXT NOT NULL DEFAULT 'OK',
    anomaly_score REAL,
    predicted_mode TEXT,
    predicted_mode_conf REAL,
    rul_hours REAL,
    rul_lower_hours REAL,
    rul_upper_hours REAL,
    model_version TEXT,
    assessed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER REFERENCES equipment_units(id),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS ml_model_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_code TEXT NOT NULL,
    version TEXT NOT NULL,
    trained_at TEXT NOT NULL,
    metrics_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );
`;

function run(db) {
  db.exec(SCHEMA);
}

module.exports = { run };
