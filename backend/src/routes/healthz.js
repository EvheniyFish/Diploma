"use strict";
const { getDb } = require("../db");
const { healthCheck } = require("../ml/client");

module.exports = async (fastify) => {
  fastify.get("/healthz", async (req, reply) => {
    let db_status = "ok";
    try {
      getDb().prepare("SELECT 1").get();
    } catch {
      db_status = "unavailable";
    }

    const ml_ok = await healthCheck();
    const ml_status = ml_ok ? "ok" : "unavailable";

    const overall = db_status === "ok" ? "ok" : "degraded";

    reply.code(overall === "ok" ? 200 : 503).send({
      status: overall,
      db: db_status,
      ml: ml_status,
    });
  });
};
