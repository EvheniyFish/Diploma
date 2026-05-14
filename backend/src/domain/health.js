"use strict";
const { getDb } = require("../db");

const STATUS_THRESHOLDS = { IMMINENT: { score: 0.7, rul: 72 }, RISK: { score: 0.3, rul: 168 } };

function classify(score, rul) {
  if (score >= STATUS_THRESHOLDS.IMMINENT.score || rul <= STATUS_THRESHOLDS.IMMINENT.rul) return "IMMINENT";
  if (score >= STATUS_THRESHOLDS.RISK.score || rul <= STATUS_THRESHOLDS.RISK.rul) return "RISK";
  return "OK";
}

const upsert = (unit_id, prediction) => {
  const status = classify(prediction.anomaly_score, prediction.rul_hours ?? Infinity);
  getDb().prepare(`
    INSERT INTO health_state (unit_id,status,anomaly_score,predicted_mode,predicted_mode_conf,
      rul_hours,rul_lower_hours,rul_upper_hours,model_version,assessed_at)
    VALUES (?,?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    ON CONFLICT(unit_id) DO UPDATE SET
      status=excluded.status, anomaly_score=excluded.anomaly_score,
      predicted_mode=excluded.predicted_mode, predicted_mode_conf=excluded.predicted_mode_conf,
      rul_hours=excluded.rul_hours, rul_lower_hours=excluded.rul_lower_hours,
      rul_upper_hours=excluded.rul_upper_hours, model_version=excluded.model_version,
      assessed_at=excluded.assessed_at
  `).run(unit_id, status, prediction.anomaly_score, prediction.predicted_mode ?? null,
         prediction.predicted_mode_conf ?? null, prediction.rul_hours ?? null,
         prediction.rul_lower_hours ?? null, prediction.rul_upper_hours ?? null,
         prediction.model_version ?? null);
  return status;
};

module.exports = { upsert, classify };
