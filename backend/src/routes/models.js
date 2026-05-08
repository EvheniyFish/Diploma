"use strict";
const domain = require("../domain/models");

module.exports = async (fastify) => {
  fastify.get("/models", async () => domain.list());

  fastify.get("/models/:id", async (req, reply) => {
    const m = domain.findById(Number(req.params.id));
    if (!m) return reply.code(404).send({ title: "Not Found" });
    return { ...m, passport: JSON.parse(m.passport_json) };
  });

  fastify.post("/models", {
    schema: {
      body: {
        type: "object",
        required: ["model_code", "name", "category", "passport"],
        properties: {
          model_code: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          manufacturer: { type: "string" },
          passport: { type: "object" },
        },
      },
    },
  }, async (req, reply) => {
    const m = domain.create(req.body);
    return reply.code(201).send(m);
  });

  fastify.put("/models/:id", async (req, reply) => {
    const m = domain.findById(Number(req.params.id));
    if (!m) return reply.code(404).send({ title: "Not Found" });
    return domain.update(Number(req.params.id), req.body);
  });

  fastify.delete("/models/:id", async (req, reply) => {
    try {
      domain.remove(Number(req.params.id));
      return reply.code(204).send();
    } catch (e) {
      if (e.code === "CONFLICT") return reply.code(409).send({ title: e.message });
      throw e;
    }
  });
};
