"use strict";
const { getDb } = require("../db");
const { runReassessment, runForUnit } = require("../ml/scheduler");

module.exports = async (fastify) => {
  fastify.get("/forecast/summary", async () => {
    const db = getDb();

    const counts = db
      .prepare(
        `SELECT status, COUNT(*) as cnt
         FROM health_state h
         JOIN equipment_units u ON u.id = h.unit_id
         WHERE u.is_active = 1
         GROUP BY status`
      )
      .all();

    const countMap = { ok: 0, risk: 0, imminent: 0 };
    for (const row of counts) {
      if (row.status in countMap) countMap[row.status] = row.cnt;
    }

    const total = countMap.ok + countMap.risk + countMap.imminent;

    const top_risk = db
      .prepare(
        `SELECT u.id, u.serial_no, u.location, h.status, h.anomaly_score, h.rul_hours,
                h.predicted_mode, h.last_updated,
                m.model_code, m.display_name as model_display_name
         FROM health_state h
         JOIN equipment_units u ON u.id = h.unit_id
         JOIN equipment_models m ON m.id = u.model_id
         WHERE u.is_active = 1 AND h.status IN ('risk','imminent')
         ORDER BY CASE WHEN h.rul_hours IS NULL THEN 9999999 ELSE h.rul_hours END ASC
         LIMIT 5`
      )
      .all();

    return { counts: countMap, total, top_risk };
  });

  fastify.get("/forecast/units/:id", async (req, reply) => {
    const unit_id = Number(req.params.id);
    const db = getDb();
    const unit = db
      .prepare("SELECT id, serial_no, location FROM equipment_units WHERE id=? AND is_active=1")
      .get(unit_id);

    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Активна одиниця #${unit_id} не знайдена`,
        instance: req.url,
      });
    }

    const health = db.prepare("SELECT * FROM health_state WHERE unit_id=?").get(unit_id);
    return { unit_id, health: health || null };
  });

  fastify.post("/forecast/refresh", async (req, reply) => {
    const { unit_id } = req.query;

    if (unit_id) {
      await runForUnit(Number(unit_id));
      return reply.code(202).send({ triggered: true, unit_id: Number(unit_id) });
    }

    runReassessment().catch((err) => {
      fastify.log.error({ err: err.message }, "Помилка фонового переоцінювання");
    });

    return reply.code(202).send({ triggered: true, unit_id: null });
  });
};
