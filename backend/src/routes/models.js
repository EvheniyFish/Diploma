"use strict";
const domain = require("../domain/models");

module.exports = async (fastify) => {
  fastify.get("/models", async () => {
    return domain.list();
  });

  fastify.get("/models/:id", async (req, reply) => {
    const m = domain.findById(Number(req.params.id));
    if (!m) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Модель не знайдена",
        status: 404,
        detail: `Модель #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    return { ...m, passport: JSON.parse(m.passport_json) };
  });

  fastify.post(
    "/models",
    {
      schema: {
        body: {
          type: "object",
          required: ["passport"],
          properties: {
            passport: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const m = domain.create(req.body);
      return reply.code(201).send({ ...m, passport: JSON.parse(m.passport_json) });
    }
  );

  fastify.put("/models/:id", async (req, reply) => {
    const existing = domain.findById(Number(req.params.id));
    if (!existing) {
      return reply.code(404).send({
        type: "https://httpstatuses.com/404",
        title: "Модель не знайдена",
        status: 404,
        detail: `Модель #${req.params.id} не знайдена`,
        instance: req.url,
      });
    }
    const m = domain.update(Number(req.params.id), req.body);
    return { ...m, passport: JSON.parse(m.passport_json) };
  });

  fastify.delete("/models/:id", async (req, reply) => {
    domain.remove(Number(req.params.id));
    return reply.code(204).send();
  });
};
