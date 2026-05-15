"use strict";
const axios = require("axios");
const config = require("../config");
const { getDb } = require("../db");
const { getFeatureWindow } = require("../domain/telemetry");
const { upsert } = require("../domain/health");

const mlClient = axios.create({ baseURL: config.ml.url, timeout: 30000 });

async function assessUnit(unit) {
  const window = getFeatureWindow(unit.id, 360);
  if (window.length < 10) return;

  const passport = JSON.parse(unit.passport_json);
  const { buildFeatureVector } = require("../ml/features");
  const features = buildFeatureVector(window, passport);

  const { data } = await mlClient.post("/predict", {
    model_code: unit.model_code,
    passport_hash: unit.passport_hash,
    features,
  });

  upsert(unit.id, data);
}

async function runSchedule() {
  const units = getDb().prepare(`
    SELECT u.id, u.model_id, m.model_code, m.passport_json, m.passport_hash
    FROM equipment_units u
    JOIN equipment_models m ON m.id = u.model_id
    WHERE u.is_active = 1
  `).all();

  await Promise.allSettled(units.map(assessUnit));
}

function start() {
  setInterval(runSchedule, config.ml.scheduleInterval);
  setTimeout(runSchedule, 5000);
}

module.exports = { start, runSchedule };
