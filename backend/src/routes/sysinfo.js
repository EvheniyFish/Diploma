"use strict";
const { collectMetrics, getUnitId } = require("../domain/sysagent");
const { getDb } = require("../db");

module.exports = async (fastify) => {
  fastify.get("/sysinfo", async (req, reply) => {
    const metrics = await collectMetrics();

    const unitId = getUnitId();
    let health = null;
    if (unitId) {
      health = getDb()
        .prepare(
          "SELECT status, anomaly_score, rul_hours, predicted_mode, last_updated FROM health_state WHERE unit_id=?"
        )
        .get(unitId);
    }

    return reply.send({
      unit_id: unitId,
      metrics,
      health: health || null,
    });
  });
};
