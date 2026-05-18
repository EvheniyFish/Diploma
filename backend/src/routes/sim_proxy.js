"use strict";
const axios = require("axios");
const config = require("../config");

const simClient = axios.create({
  baseURL: config.simulator.url,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

async function proxyPost(path, body, reply) {
  try {
    const { data, status } = await simClient.post(path, body ?? {});
    reply.code(status).send(data);
  } catch (err) {
    if (err.response) {
      reply.code(err.response.status).send(err.response.data);
    } else {
      reply.code(502).send({
        type: "https://httpstatuses.com/502",
        title: "Симулятор недоступний",
        status: 502,
        detail: err.message,
      });
    }
  }
}

async function proxyGet(path, reply) {
  try {
    const { data, status } = await simClient.get(path);
    reply.code(status).send(data);
  } catch (err) {
    if (err.response) {
      reply.code(err.response.status).send(err.response.data);
    } else {
      reply.code(502).send({
        type: "https://httpstatuses.com/502",
        title: "Симулятор недоступний",
        status: 502,
        detail: err.message,
      });
    }
  }
}

module.exports = async (fastify) => {
  fastify.post("/sim/inject_fault", async (req, reply) => {
    await proxyPost("/inject_fault", req.body, reply);
  });

  fastify.get("/sim/state", async (req, reply) => {
    await proxyGet("/state", reply);
  });

  fastify.post("/sim/reset_unit", async (req, reply) => {
    await proxyPost("/reset_unit", req.body, reply);
  });

  fastify.post("/sim/speed", async (req, reply) => {
    await proxyPost("/speed", req.body, reply);
  });
};
