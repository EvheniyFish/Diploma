"use strict";
const axios = require("axios");
const config = require("../config");

const mlClient = axios.create({
  baseURL: config.ml.url,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

async function predict({ model_code, passport_hash, features }) {
  const { data } = await mlClient.post("/predict", { model_code, passport_hash, features });
  return data;
}

async function healthCheck() {
  try {
    await mlClient.get("/healthz", { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

module.exports = { predict, healthCheck };
