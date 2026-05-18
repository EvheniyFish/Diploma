"use strict";
const { getDb } = require("../db");

const THRESHOLDS = {
  imminent: { score: 0.7, rul: 72 },
  risk: { score: 0.3, rul: 168 },
};

const HYSTERESIS = {
  score: 0.1,
  rulFactor: 0.9,
};

function classify(anomaly_score, rul_hours, current_status) {
  const rul = rul_hours != null ? rul_hours : Infinity;

  if (anomaly_score >= THRESHOLDS.imminent.score || rul <= THRESHOLDS.imminent.rul) {
    return "imminent";
  }
  if (anomaly_score >= THRESHOLDS.risk.score || rul <= THRESHOLDS.risk.rul) {
    return "risk";
  }

  if (current_status === "imminent") {
    const stricter_score = THRESHOLDS.imminent.score - HYSTERESIS.score;
    const stricter_rul = THRESHOLDS.imminent.rul / HYSTERESIS.rulFactor;
    if (anomaly_score >= stricter_score || rul <= stricter_rul) {
      return "imminent";
    }
  }

  if (current_status === "risk") {
    const stricter_score = THRESHOLDS.risk.score - HYSTERESIS.score;
    const stricter_rul = THRESHOLDS.risk.rul / HYSTERESIS.rulFactor;
    if (anomaly_score >= stricter_score || rul <= stricter_rul) {
      return "risk";
    }
  }

  return "ok";
}

const findByUnitId = (unit_id) =>
  getDb().prepare("SELECT * FROM health_state WHERE unit_id=?").get(unit_id) || null;

const upsert = (unit_id, prediction) => {
  const db = getDb();
  const current = db.prepare("SELECT status FROM health_state WHERE unit_id=?").get(unit_id);
  const current_status = current ? current.status : "ok";

  const new_status = classify(
    prediction.anomaly_score,
    prediction.rul_hours != null ? prediction.rul_hours : Infinity,
    current_status
  );

  db.prepare(
    `INSERT INTO health_state (unit_id, status, anomaly_score, predicted_mode, predicted_mode_conf,
      rul_hours, rul_lower_hours, rul_upper_hours, model_version, last_updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
     ON CONFLICT(unit_id) DO UPDATE SET
       status=excluded.status,
       anomaly_score=excluded.anomaly_score,
       predicted_mode=excluded.predicted_mode,
       predicted_mode_conf=excluded.predicted_mode_conf,
       rul_hours=excluded.rul_hours,
       rul_lower_hours=excluded.rul_lower_hours,
       rul_upper_hours=excluded.rul_upper_hours,
       model_version=excluded.model_version,
       last_updated=excluded.last_updated`
  ).run(
    unit_id,
    new_status,
    prediction.anomaly_score,
    prediction.predicted_mode ?? null,
    prediction.predicted_mode_conf ?? null,
    prediction.rul_hours ?? null,
    prediction.rul_lower_hours ?? null,
    prediction.rul_upper_hours ?? null,
    prediction.model_version ?? null
  );

  return { new_status, previous_status: current_status, changed: new_status !== current_status };
};

const escalateStaleRisk = () => {
  const db = getDb();
  const threshold_ts = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().replace("T", "T").slice(0, 19) + "Z";

  const stale = db
    .prepare(
      "SELECT unit_id FROM health_state WHERE status='risk' AND last_updated <= ?"
    )
    .all(threshold_ts);

  const updateStmt = db.prepare(
    "UPDATE health_state SET status='imminent', last_updated=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE unit_id=?"
  );

  const insertEvent = db.prepare(
    `INSERT INTO event_log (unit_id, severity, event_type, payload_json, message)
     VALUES (?, 'warning', 'status_escalated', ?, ?)`
  );

  const doEscalate = db.transaction((units) => {
    for (const { unit_id } of units) {
      updateStmt.run(unit_id);
      insertEvent.run(
        unit_id,
        JSON.stringify({ previous_status: "risk", new_status: "imminent", reason: "risk_timeout_48h" }),
        "Статус автоматично підвищено до imminent: стан risk тривав понад 48 годин"
      );
    }
  });

  doEscalate(stale);
  return stale.length;
};

module.exports = { classify, findByUnitId, upsert, escalateStaleRisk };
