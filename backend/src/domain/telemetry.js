"use strict";
const { getDb } = require("../db");

const ingest = (points) => {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO telemetry (unit_id,channel_code,ts,value,quality) VALUES (?,?,?,?,?)");
  const insertMany = db.transaction((rows) => { for (const r of rows) stmt.run(r.unit_id, r.channel_code, r.ts, r.value, r.quality ?? 1); });
  insertMany(points);
  return points.length;
};

const query = ({ unit_id, channel_code, from, to, limit = 1000 }) => {
  let sql = "SELECT channel_code, ts, value, quality FROM telemetry WHERE unit_id = ?";
  const params = [unit_id];
  if (channel_code) { sql += " AND channel_code = ?"; params.push(channel_code); }
  if (from) { sql += " AND ts >= ?"; params.push(from); }
  if (to)   { sql += " AND ts <= ?"; params.push(to); }
  sql += " ORDER BY ts DESC LIMIT ?";
  params.push(limit);
  return getDb().prepare(sql).all(...params);
};

const getFeatureWindow = (unit_id, n = 360) =>
  getDb().prepare("SELECT channel_code, ts, value FROM telemetry WHERE unit_id=? ORDER BY ts DESC LIMIT ?").all(unit_id, n);

module.exports = { ingest, query, getFeatureWindow };
