"use strict";
const os = require("os");
const fs = require("fs");
const { getDb } = require("../db");
const { ingest } = require("./telemetry");

const MODEL_CODE = "LOCAL-SRV";
const SERIAL_NO = os.hostname();
const INTERVAL_MS = 30_000;

const PASSPORT = {
  model_code: MODEL_CODE,
  display_name: "Local Server Hardware",
  category: "server",
  weibull_eta_hours: 87600,
  weibull_beta: 1.5,
  channels: [
    {
      code: "ram_used_pct",
      class: "Q",
      unit: "%",
      nominal: 50,
      operating_range: [0, 85],
      critical_range: [85, 100],
      noise_sigma: 0.5,
    },
    {
      code: "cpu_load_pct",
      class: "Q",
      unit: "%",
      nominal: 30,
      operating_range: [0, 90],
      critical_range: [90, 100],
      noise_sigma: 1.0,
    },
    {
      code: "disk_used_pct",
      class: "Q",
      unit: "%",
      nominal: 30,
      operating_range: [0, 90],
      critical_range: [90, 100],
      noise_sigma: 0.1,
    },
  ],
  failure_modes: [
    {
      code: "memory_pressure",
      name: "Перевантаження оперативної пам'яті",
      affected_channels: ["ram_used_pct"],
      typical_horizon_hours: 72,
    },
    {
      code: "cpu_overload",
      name: "Перевантаження процесора",
      affected_channels: ["cpu_load_pct"],
      typical_horizon_hours: 24,
    },
    {
      code: "disk_full",
      name: "Заповнення диску",
      affected_channels: ["disk_used_pct"],
      typical_horizon_hours: 168,
    },
  ],
};

async function getCpuLoadPct() {
  const cpus1 = os.cpus();
  await new Promise((r) => setTimeout(r, 200));
  const cpus2 = os.cpus();
  let totalDiff = 0;
  let idleDiff = 0;
  for (let i = 0; i < cpus1.length; i++) {
    const sum1 = Object.values(cpus1[i].times).reduce((a, b) => a + b, 0);
    const sum2 = Object.values(cpus2[i].times).reduce((a, b) => a + b, 0);
    totalDiff += sum2 - sum1;
    idleDiff += cpus2[i].times.idle - cpus1[i].times.idle;
  }
  return totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
}

async function getDiskUsedPct() {
  try {
    const drivePath = process.cwd().slice(0, 2) + "/";
    const stats = await fs.promises.statfs(drivePath);
    const total = stats.blocks * stats.bsize;
    const free = stats.bfree * stats.bsize;
    return total > 0 ? Math.round(((total - free) / total) * 100) : null;
  } catch {
    return null;
  }
}

function getRamUsedPct() {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

async function collectMetrics() {
  const [cpu_load_pct, disk_used_pct] = await Promise.all([getCpuLoadPct(), getDiskUsedPct()]);
  return {
    ram_used_pct: getRamUsedPct(),
    cpu_load_pct,
    disk_used_pct,
    ram_total_mb: Math.round(os.totalmem() / 1048576),
    ram_free_mb: Math.round(os.freemem() / 1048576),
    cpu_count: os.cpus().length,
    platform: os.platform(),
    hostname: os.hostname(),
  };
}

function ensureModel(db) {
  const existing = db.prepare("SELECT id FROM equipment_models WHERE model_code=?").get(MODEL_CODE);
  if (existing) return existing.id;

  const crypto = require("crypto");
  const passport_json = JSON.stringify(PASSPORT);
  const passport_hash = crypto
    .createHash("sha256")
    .update(passport_json)
    .digest("hex")
    .slice(0, 16);

  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO equipment_models (model_code, display_name, category, passport_json, passport_hash, weibull_eta, weibull_beta) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      PASSPORT.model_code,
      PASSPORT.display_name,
      PASSPORT.category,
      passport_json,
      passport_hash,
      PASSPORT.weibull_eta_hours,
      PASSPORT.weibull_beta
    );
  return lastInsertRowid;
}

function ensureUnit(db, model_id) {
  const existing = db
    .prepare("SELECT id FROM equipment_units WHERE serial_no=? AND model_id=?")
    .get(SERIAL_NO, model_id);
  if (existing) return existing.id;

  const today = new Date().toISOString().slice(0, 10);
  const tx = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO equipment_units (model_id, serial_no, location, commissioned_at, notes) VALUES (?, ?, ?, ?, ?)"
      )
      .run(model_id, SERIAL_NO, "Local Server", today, "Auto-registered by sysagent");
    db.prepare("INSERT INTO health_state (unit_id, status, anomaly_score) VALUES (?, 'ok', 0)").run(lastInsertRowid);
    return lastInsertRowid;
  });
  return tx();
}

let unitId = null;

function ensureRegistered() {
  const db = getDb();
  const model_id = ensureModel(db);
  unitId = ensureUnit(db, model_id);
  return unitId;
}

async function tick(log) {
  try {
    if (!unitId) ensureRegistered();
    const m = await collectMetrics();
    const ts = new Date().toISOString();
    const points = [];

    points.push({ unit_id: unitId, channel_code: "ram_used_pct", ts, value: m.ram_used_pct });
    if (m.cpu_load_pct !== null) {
      points.push({ unit_id: unitId, channel_code: "cpu_load_pct", ts, value: m.cpu_load_pct });
    }
    if (m.disk_used_pct !== null) {
      points.push({ unit_id: unitId, channel_code: "disk_used_pct", ts, value: m.disk_used_pct });
    }

    ingest(points);
    if (log) log.debug({ ram: m.ram_used_pct, cpu: m.cpu_load_pct, disk: m.disk_used_pct }, "sysagent tick");
  } catch (err) {
    if (log) log.warn({ err: err.message }, "sysagent tick failed");
  }
}

function start(log) {
  try {
    ensureRegistered();
    if (log) log.info({ unit_id: unitId, serial_no: SERIAL_NO }, "sysagent: Local Server unit registered");
  } catch (err) {
    if (log) log.warn({ err: err.message }, "sysagent: registration failed, will retry on first tick");
  }

  tick(log);
  setInterval(() => tick(log), INTERVAL_MS);
}

module.exports = { start, collectMetrics, getUnitId: () => unitId };
