"use strict";
const config = require("../config");
const { getDb } = require("../db");
const { getFeatureWindow, buildFeatures } = require("../domain/telemetry");
const { upsert, escalateStaleRisk } = require("../domain/health");
const { predict } = require("./client");

let logger = console;

function setLogger(fastifyLog) {
  logger = fastifyLog;
}

async function assessUnit(unit) {
  const rows = getFeatureWindow(unit.id, 360);

  if (rows.length < 10) {
    logger.warn({ unit_id: unit.id }, "Недостатньо телеметрії для оцінки (менше 10 точок)");
    return;
  }

  let passport = null;
  if (unit.passport_json) {
    try { passport = JSON.parse(unit.passport_json); } catch (_) {}
  }

  const features = buildFeatures(rows, passport);

  let prediction;
  try {
    prediction = await predict({
      model_code: unit.model_code,
      passport_hash: unit.passport_hash,
      features,
    });
  } catch (err) {
    logger.warn({ unit_id: unit.id, err: err.message }, "ML-сервіс недоступний, пропускаємо одиницю");
    return;
  }

  const { new_status, previous_status, changed } = upsert(unit.id, prediction);

  if (changed) {
    getDb()
      .prepare(
        `INSERT INTO event_log (unit_id, severity, event_type, payload_json, message)
         VALUES (?, ?, 'status_changed', ?, ?)`
      )
      .run(
        unit.id,
        new_status === "imminent" ? "critical" : new_status === "risk" ? "warning" : "info",
        JSON.stringify({
          previous_status,
          new_status,
          anomaly_score: prediction.anomaly_score,
          rul_hours: prediction.rul_hours ?? null,
        }),
        `Статус змінено: ${previous_status} → ${new_status}`
      );

    logger.info({ unit_id: unit.id, previous_status, new_status }, "Статус одиниці змінено");
  }
}

async function runReassessment() {
  const units = getDb()
    .prepare(
      `SELECT u.id, u.model_id, m.model_code, m.passport_hash, m.passport_json
       FROM equipment_units u
       JOIN equipment_models m ON m.id = u.model_id
       WHERE u.is_active = 1`
    )
    .all();

  logger.info({ count: units.length }, "Запуск планового переоцінювання здоров'я обладнання");

  const results = await Promise.allSettled(units.map((u) => assessUnit(u)));

  let failed = 0;
  for (const r of results) {
    if (r.status === "rejected") {
      failed++;
      logger.error({ err: r.reason?.message }, "Помилка оцінки одиниці");
    }
  }

  const escalated = escalateStaleRisk();
  if (escalated > 0) {
    logger.warn({ escalated }, "Одиниці автоматично підвищено до imminent через тривалий стан risk");
  }

  logger.info({ total: units.length, failed, escalated }, "Переоцінювання завершено");
}

async function runForUnit(unit_id) {
  const unit = getDb()
    .prepare(
      `SELECT u.id, u.model_id, m.model_code, m.passport_hash, m.passport_json
       FROM equipment_units u
       JOIN equipment_models m ON m.id = u.model_id
       WHERE u.id=? AND u.is_active=1`
    )
    .get(unit_id);

  if (!unit) {
    const err = new Error(`Активна одиниця #${unit_id} не знайдена`);
    err.code = "NOT_FOUND";
    throw err;
  }

  await assessUnit(unit);
}

function start(fastifyLog) {
  if (fastifyLog) setLogger(fastifyLog);

  setTimeout(async () => {
    try {
      await runReassessment();
    } catch (err) {
      logger.error({ err: err.message }, "Помилка початкового переоцінювання");
    }
  }, 5000);

  setInterval(async () => {
    try {
      await runReassessment();
    } catch (err) {
      logger.error({ err: err.message }, "Помилка планового переоцінювання");
    }
  }, config.ml.scheduleIntervalMs);
}

module.exports = { start, runReassessment, runForUnit };
