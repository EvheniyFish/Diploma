"use strict";
const config = require("../config");

const VALID_KEYS = new Set([config.auth.adminKey, config.auth.ingestKey]);

module.exports = async function auth(fastify) {
  fastify.addHook("onRequest", async (request, reply) => {
    const key = request.headers["x-api-key"];
    if (!key || !VALID_KEYS.has(key)) {
      reply.code(401).send({
        type: "https://httpstatuses.com/401",
        title: "Unauthorized",
        status: 401,
        detail: "Необхідний заголовок x-api-key з дійсним ключем",
        instance: request.url,
      });
    }
  });
};
