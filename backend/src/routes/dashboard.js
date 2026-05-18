"use strict";
const { getDb } = require("../db");

module.exports = async (fastify) => {
  fastify.get("/dashboard/summary", async () => {
    const db = getDb();

    const statusCounts = db
      .prepare(
        `SELECT h.status, COUNT(*) as cnt
         FROM health_state h
         JOIN equipment_units u ON u.id = h.unit_id
         WHERE u.is_active = 1
         GROUP BY h.status`
      )
      .all();

    const countMap = { ok: 0, risk: 0, imminent: 0 };
    for (const row of statusCounts) {
      if (row.status in countMap) countMap[row.status] = row.cnt;
    }

    const total_units = db
      .prepare("SELECT COUNT(*) as cnt FROM equipment_units WHERE is_active=1")
      .get().cnt;

    const recent_events = db
      .prepare(
        `SELECT e.id, e.unit_id, e.ts, e.severity, e.event_type, e.message, u.serial_no
         FROM event_log e
         LEFT JOIN equipment_units u ON u.id = e.unit_id
         ORDER BY e.ts DESC LIMIT 10`
      )
      .all();

    const top_risk = db
      .prepare(
        `SELECT u.id, u.serial_no, u.location, h.status, h.anomaly_score, h.rul_hours,
                m.model_code, m.display_name as model_display_name
         FROM health_state h
         JOIN equipment_units u ON u.id = h.unit_id
         JOIN equipment_models m ON m.id = u.model_id
         WHERE u.is_active=1 AND h.status IN ('risk','imminent')
         ORDER BY CASE WHEN h.rul_hours IS NULL THEN 9999999 ELSE h.rul_hours END ASC
         LIMIT 5`
      )
      .all();

    return {
      counts: countMap,
      total_units,
      top_risk,
      recent_events,
    };
  });
};
