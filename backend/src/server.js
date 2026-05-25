"use strict";
require("dotenv").config();
const fastify = require("fastify")({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" } }
        : undefined,
  },
});

const config = require("./config");
const { getDb } = require("./db");
const scheduler = require("./ml/scheduler");
const sysagent = require("./domain/sysagent");

async function build() {
  getDb();

  await fastify.register(require("@fastify/cors"), {
    origin: config.corsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  });

  await fastify.register(require("@fastify/rate-limit"), {
    max: 500,
    timeWindow: "1 minute",
    errorResponseBuilder: (req, context) => ({
      type: "https://httpstatuses.com/429",
      title: "Перевищено ліміт запитів",
      status: 429,
      detail: `Максимум ${context.max} запитів за ${context.after}. Спробуйте пізніше.`,
      instance: req.url,
    }),
  });

  await fastify.register(require("./plugins/error_handler"));

  await fastify.register(require("./plugins/auth"));

  const API_PREFIX = "/api/v1";

  await fastify.register(require("./routes/healthz"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/models"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/units"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/ingest"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/forecast"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/events"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/dashboard"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/sim_proxy"), { prefix: API_PREFIX });
  await fastify.register(require("./routes/sysinfo"), { prefix: API_PREFIX });

  return fastify;
}

async function start() {
  try {
    await build();
    await fastify.listen({ port: config.port, host: config.host });
    scheduler.start(fastify.log);
    sysagent.start(fastify.log);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { build };
