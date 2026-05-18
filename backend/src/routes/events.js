"use strict";
const { getDb } = require("../db");
const { stringify } = require("csv-stringify/sync");

module.exports = async (fastify) => {
  function buildQuery(filters) {
    const { unit_id, severity, event_type, from, to } = filters;
    let sql = "SELECT * FROM event_log WHERE 1=1";
    const params = [];

    if (unit_id) {
      sql += " AND unit_id=?";
      params.push(Number(unit_id));
    }
    if (severity) {
      sql += " AND severity=?";
      params.push(severity);
    }
    if (event_type) {
      sql += " AND event_type=?";
      params.push(event_type);
    }
    if (from) {
      sql += " AND ts>=?";
      params.push(from);
    }
    if (to) {
      sql += " AND ts<=?";
      params.push(to);
    }

    return { sql, params };
  }

  fastify.get("/events", async (req) => {
    const { unit_id, severity, event_type, from, to, limit = 100, offset = 0 } = req.query;
    const { sql, params } = buildQuery({ unit_id, severity, event_type, from, to });
    const rows = getDb()
      .prepare(`${sql} ORDER BY ts DESC LIMIT ? OFFSET ?`)
      .all(...params, Number(limit), Number(offset));

    return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload_json) }));
  });

  fastify.post(
    "/events",
    {
      schema: {
        body: {
          type: "object",
          required: ["severity", "event_type", "message"],
          properties: {
            unit_id: { type: "integer" },
            severity: { type: "string", enum: ["info", "warning", "critical"] },
            event_type: { type: "string", minLength: 1 },
            message: { type: "string", minLength: 1 },
            payload: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const { unit_id, severity, event_type, message, payload } = req.body;
      const payload_json = JSON.stringify(payload || {});
      const { lastInsertRowid } = getDb()
        .prepare(
          "INSERT INTO event_log (unit_id, severity, event_type, payload_json, message) VALUES (?, ?, ?, ?, ?)"
        )
        .run(unit_id ?? null, severity, event_type, payload_json, message);

      const row = getDb().prepare("SELECT * FROM event_log WHERE id=?").get(lastInsertRowid);
      return reply.code(201).send({ ...row, payload: JSON.parse(row.payload_json) });
    }
  );

  fastify.get("/events/export.csv", async (req, reply) => {
    const { unit_id, severity, event_type, from, to } = req.query;
    const { sql, params } = buildQuery({ unit_id, severity, event_type, from, to });
    const rows = getDb()
      .prepare(`${sql} ORDER BY ts DESC LIMIT 10000`)
      .all(...params);

    const csvRows = rows.map((r) => ({
      id: r.id,
      unit_id: r.unit_id ?? "",
      ts: r.ts,
      severity: r.severity,
      event_type: r.event_type,
      message: r.message,
      payload: r.payload_json,
    }));

    const csv = stringify(csvRows, {
      header: true,
      columns: ["id", "unit_id", "ts", "severity", "event_type", "message", "payload"],
    });

    reply
      .code(200)
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="events_${Date.now()}.csv"`)
      .send(csv);
  });
};
