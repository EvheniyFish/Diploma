"use strict";
const { getDb } = require("../db");

const ingest = (points) => {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO telemetry (unit_id, channel_code, ts, value, quality) VALUES (?, ?, ?, ?, ?)"
  );

  const updateHours = db.prepare(
    "UPDATE equipment_units SET hours_run=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=? AND hours_run < ?"
  );

  const doIngest = db.transaction((rows) => {
    const maxTsByUnit = {};

    for (const r of rows) {
      stmt.run(r.unit_id, r.channel_code, r.ts, r.value, r.quality ?? 1);
      if (!maxTsByUnit[r.unit_id] || r.ts > maxTsByUnit[r.unit_id].ts) {
        maxTsByUnit[r.unit_id] = r;
      }
    }

    for (const [unit_id, latest] of Object.entries(maxTsByUnit)) {
      const latestRow = db
        .prepare(
          "SELECT MAX(CAST(strftime('%s', ts) AS REAL)) as max_epoch, MIN(CAST(strftime('%s', ts) AS REAL)) as min_epoch FROM telemetry WHERE unit_id=?"
        )
        .get(unit_id);

      if (latestRow && latestRow.max_epoch && latestRow.min_epoch) {
        const spanHours = (latestRow.max_epoch - latestRow.min_epoch) / 3600;
        const unit = db.prepare("SELECT hours_run FROM equipment_units WHERE id=?").get(unit_id);
        if (unit) {
          const newHours = Math.max(unit.hours_run, spanHours);
          updateHours.run(newHours, unit_id, newHours + 1);
        }
      }
    }
  });

  doIngest(points);
  return points.length;
};

const query = ({ unit_id, channel, from, to, limit = 1000 }) => {
  let sql = "SELECT id, unit_id, channel_code, ts, value, quality FROM telemetry WHERE unit_id=?";
  const params = [unit_id];
  if (channel) {
    sql += " AND channel_code=?";
    params.push(channel);
  }
  if (from) {
    sql += " AND ts>=?";
    params.push(from);
  }
  if (to) {
    sql += " AND ts<=?";
    params.push(to);
  }
  sql += " ORDER BY ts DESC LIMIT ?";
  params.push(Math.min(limit, 10000));
  return getDb().prepare(sql).all(...params);
};

const getFeatureWindow = (unit_id, n = 360) =>
  getDb()
    .prepare(
      "SELECT channel_code, ts, value FROM telemetry WHERE unit_id=? ORDER BY ts DESC LIMIT ?"
    )
    .all(unit_id, n);

function buildFeatures(rows, passport) {
  if (!rows || rows.length === 0) return {};

  const byChannel = {};
  for (const r of rows) {
    if (!byChannel[r.channel_code]) byChannel[r.channel_code] = [];
    byChannel[r.channel_code].push(r.value);
  }

  const chMeta = {};
  if (passport && Array.isArray(passport.channels)) {
    for (const ch of passport.channels) {
      chMeta[ch.code] = ch;
    }
  }

  const features = {};
  for (const [ch, values] of Object.entries(byChannel)) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];
    const mid = Math.floor(n / 2);
    const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    let slope = 0;
    if (n >= 2) {
      const xMean = (n - 1) / 2;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (values[i] - mean);
        den += (i - xMean) ** 2;
      }
      slope = den !== 0 ? num / den : 0;
    }

    features[`${ch}__mean`] = mean;
    features[`${ch}__std`] = std;
    features[`${ch}__min`] = min;
    features[`${ch}__max`] = max;
    features[`${ch}__median`] = median;
    features[`${ch}__slope`] = slope;

    const meta = chMeta[ch];
    if (meta) {
      const nominal = meta.nominal ?? 0;
      const opRange = meta.operating_range ?? [0, 1];
      const critRange = meta.critical_range ?? [null, null];
      const opLow = opRange[0];
      const opHigh = opRange[1];
      const opWidth = Math.max(1, Math.abs(opHigh - opLow));
      const critLow = critRange[0];
      const critHigh = critRange[1];

      features[`${ch}__dev_from_nominal`] = (mean - nominal) / opWidth;
      features[`${ch}__time_above_op`] = values.filter((v) => v > opHigh).length / n;
      features[`${ch}__time_below_op`] = values.filter((v) => v < opLow).length / n;

      if (critHigh != null && critLow != null) {
        if (critHigh > critLow) {
          features[`${ch}__in_critical`] = values.filter((v) => v >= critLow && v <= critHigh).length / n;
        } else {
          features[`${ch}__in_critical`] = values.filter((v) => v <= critHigh).length / n;
        }
      }
    }
  }

  return features;
}

module.exports = { ingest, query, getFeatureWindow, buildFeatures };
