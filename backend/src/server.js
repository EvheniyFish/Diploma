"use strict";
require("dotenv").config();
const fastify = require("fastify")({ logger: true });

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

fastify.register(require("@fastify/cors"), {
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
});

fastify.get("/healthz", async () => ({ status: "ok" }));

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
