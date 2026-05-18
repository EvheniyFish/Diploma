"use strict";
const { ingest } = require("../domain/telemetry");
const config = require("../config");

module.exports = async (fastify) => {
  fastify.post(
    "/ingest",
    {
      schema: {
        body: {
          type: "object",
          required: ["points"],
          properties: {
            points: {
              type: "array",
              minItems: 1,
              maxItems: config.ingest.batchLimit,
              items: {
                type: "object",
                required: ["unit_id", "channel_code", "ts", "value"],
                properties: {
                  unit_id: { type: "integer" },
                  channel_code: { type: "string", minLength: 1 },
                  ts: { type: "string" },
                  value: { type: "number" },
                  quality: { type: "integer", enum: [0, 1] },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const n = ingest(req.body.points);
      return reply.code(202).send({ accepted: n });
    }
  );
};
