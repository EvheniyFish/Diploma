"use strict";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS equipment_models (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_code      TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    category        TEXT NOT NULL,
    passport_json   TEXT NOT NULL,
    passport_hash   TEXT NOT NULL,
    weibull_eta     REAL NOT NULL,
    weibull_beta    REAL NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS equipment_units (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id        INTEGER NOT NULL REFERENCES equipment_models(id),
    serial_no       TEXT NOT NULL UNIQUE,
    location        TEXT,
    commissioned_at TEXT NOT NULL,
    hours_run       REAL NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    notes           TEXT,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_units_model ON equipment_units(model_id);
CREATE INDEX IF NOT EXISTS idx_units_active ON equipment_units(is_active);

CREATE TABLE IF NOT EXISTS telemetry (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id         INTEGER NOT NULL REFERENCES equipment_units(id),
    channel_code    TEXT NOT NULL,
    ts              TEXT NOT NULL,
    value           REAL NOT NULL,
    quality         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_telemetry_unit_ts ON telemetry(unit_id, channel_code, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(ts);

CREATE TABLE IF NOT EXISTS ground_truth_state (
    unit_id         INTEGER PRIMARY KEY REFERENCES equipment_units(id),
    true_health     REAL NOT NULL,
    active_mode     TEXT,
    mode_started_at TEXT,
    rul_true_hours  REAL,
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS health_state (
    unit_id             INTEGER PRIMARY KEY REFERENCES equipment_units(id),
    status              TEXT NOT NULL DEFAULT 'ok',
    anomaly_score       REAL NOT NULL DEFAULT 0,
    predicted_mode      TEXT,
    predicted_mode_conf REAL,
    rul_hours           REAL,
    rul_lower_hours     REAL,
    rul_upper_hours     REAL,
    model_version       TEXT,
    last_updated        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS event_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id         INTEGER REFERENCES equipment_units(id),
    ts              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    severity        TEXT NOT NULL DEFAULT 'info',
    event_type      TEXT NOT NULL,
    payload_json    TEXT NOT NULL DEFAULT '{}',
    message         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_unit_ts ON event_log(unit_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity ON event_log(severity, ts DESC);

CREATE TABLE IF NOT EXISTS ml_model_versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    version_tag     TEXT NOT NULL UNIQUE,
    trained_at      TEXT NOT NULL,
    metrics_json    TEXT NOT NULL DEFAULT '{}',
    is_active       INTEGER NOT NULL DEFAULT 0,
    notes           TEXT
);
`;

function run(db) {
  db.exec(SCHEMA);
}

module.exports = { run };
