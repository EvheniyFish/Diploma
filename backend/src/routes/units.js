"use strict";
const unitsDomain = require("../domain/units");
const telemetryDomain = require("../domain/telemetry");
const { getDb } = require("../db");

module.exports = async (fastify) => {
  fastify.get("/units", async (req) => {
    const { model_id, status, q } = req.query;
    return unitsDomain.list({
      model_id: model_id ? Number(model_id) : undefined,
      status,
      q,
    });
  });

  fastify.get("/units/:id", async (req, reply) => {
    const unit = unitsDomain.findById(Number(req.params.id));
    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Одиниця #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    const result = { ...unit };
    if (result.passport_json) {
      result.passport = JSON.parse(result.passport_json);
      delete result.passport_json;
    }
    return result;
  });

  fastify.post(
    "/units",
    {
      schema: {
        body: {
          type: "object",
          required: ["model_id", "serial_no", "commissioned_at"],
          properties: {
            model_id: { type: "integer" },
            serial_no: { type: "string", minLength: 1 },
            location: { type: "string" },
            commissioned_at: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const unit = unitsDomain.create(req.body);
      const result = { ...unit };
      if (result.passport_json) {
        result.passport = JSON.parse(result.passport_json);
        delete result.passport_json;
      }
      return reply.code(201).send(result);
    }
  );

  fastify.put(
    "/units/:id",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            location: { type: "string" },
            notes: { type: "string" },
            is_active: { type: "integer", enum: [0, 1] },
            hours_run: { type: "number", minimum: 0 },
          },
        },
      },
    },
    async (req, reply) => {
      const unit = unitsDomain.findById(Number(req.params.id));
      if (!unit) {
        return reply.code(404).send({
          type: "https://httpstatuses.com/404",
          title: "Одиниця обладнання не знайдена",
          status: 404,
          detail: `Одиниця #${req.params.id} не знайдена`,
          instance: req.url,
        });
      }
      const updated = unitsDomain.update(Number(req.params.id), req.body);
      const result = { ...updated };
      if (result.passport_json) {
        result.passport = JSON.parse(result.passport_json);
        delete result.passport_json;
      }
      return result;
    }
  );

  fastify.delete("/units/:id", async (req, reply) => {
    const unit = unitsDomain.findById(Number(req.params.id));
    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Одиниця #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    unitsDomain.softDelete(Number(req.params.id));
    return reply.code(204).send();
  });

  fastify.get("/units/:id/telemetry", async (req, reply) => {
    const unit = unitsDomain.findById(Number(req.params.id));
    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Одиниця #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    const { channel, from, to, limit } = req.query;
    return telemetryDomain.query({
      unit_id: Number(req.params.id),
      channel,
      from,
      to,
      limit: limit ? Math.min(Number(limit), 10000) : 1000,
    });
  });

  fastify.get("/units/:id/forecast", async (req, reply) => {
    const unit = unitsDomain.findById(Number(req.params.id));
    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Одиниця #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    const health = getDb().prepare("SELECT * FROM health_state WHERE unit_id=?").get(Number(req.params.id));
    return { unit_id: Number(req.params.id), health: health || null };
  });

  fastify.get("/units/:id/events", async (req, reply) => {
    const unit = unitsDomain.findById(Number(req.params.id));
    if (!unit) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Одиниця обладнання не знайдена",
        status: 404,
        detail: `Одиниця #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    const { limit = 100, offset = 0 } = req.query;
    const events = getDb()
      .prepare(
        "SELECT * FROM event_log WHERE unit_id=? ORDER BY ts DESC LIMIT ? OFFSET ?"
      )
      .all(Number(req.params.id), Number(limit), Number(offset));
    return events.map((e) => ({ ...e, payload: JSON.parse(e.payload_json) }));
  });
};
