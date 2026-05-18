"use strict";
const { getDb } = require("../db");

function notFound(id) {
  const err = new Error(`Одиниця обладнання #${id} не знайдена`);
  err.code = "NOT_FOUND";
  return err;
}

const list = ({ model_id, status, q } = {}) => {
  let sql = `
    SELECT u.id, u.model_id, u.serial_no, u.location, u.commissioned_at,
           u.hours_run, u.is_active, u.notes, u.created_at, u.updated_at,
           m.model_code, m.display_name as model_display_name, m.category,
           h.status, h.anomaly_score, h.rul_hours, h.predicted_mode, h.last_updated as health_updated
    FROM equipment_units u
    JOIN equipment_models m ON m.id = u.model_id
    LEFT JOIN health_state h ON h.unit_id = u.id
    WHERE u.is_active = 1
  `;
  const params = [];
  if (model_id) {
    sql += " AND u.model_id = ?";
    params.push(model_id);
  }
  if (status) {
    sql += " AND h.status = ?";
    params.push(status);
  }
  if (q) {
    sql += " AND (u.serial_no LIKE ? OR u.location LIKE ?)";
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += " ORDER BY u.serial_no";
  return getDb().prepare(sql).all(...params);
};

const findById = (id) => {
  const row = getDb()
    .prepare(
      `SELECT u.id, u.model_id, u.serial_no, u.location, u.commissioned_at,
              u.hours_run, u.is_active, u.notes, u.created_at, u.updated_at,
              m.model_code, m.display_name as model_display_name, m.category,
              m.passport_json, m.weibull_eta, m.weibull_beta,
              h.status, h.anomaly_score, h.rul_hours, h.rul_lower_hours, h.rul_upper_hours,
              h.predicted_mode, h.predicted_mode_conf, h.model_version, h.last_updated as health_updated
       FROM equipment_units u
       JOIN equipment_models m ON m.id = u.model_id
       LEFT JOIN health_state h ON h.unit_id = u.id
       WHERE u.id = ?`
    )
    .get(id);
  return row || null;
};

const create = ({ model_id, serial_no, location, commissioned_at, notes }) => {
  const db = getDb();
  const modelExists = db.prepare("SELECT id FROM equipment_models WHERE id=?").get(model_id);
  if (!modelExists) {
    const err = new Error(`Модель #${model_id} не знайдена`);
    err.statusCode = 422;
    throw err;
  }

  const doCreate = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        "INSERT INTO equipment_units (model_id, serial_no, location, commissioned_at, notes) VALUES (?, ?, ?, ?, ?)"
      )
      .run(model_id, serial_no, location ?? null, commissioned_at, notes ?? null);

    db.prepare("INSERT INTO health_state (unit_id, status, anomaly_score) VALUES (?, 'ok', 0)").run(lastInsertRowid);

    return lastInsertRowid;
  });

  const id = doCreate();
  return findById(id);
};

const update = (id, fields) => {
  const existing = findById(id);
  if (!existing) throw notFound(id);

  const allowed = ["location", "notes", "is_active", "hours_run"];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${key}=?`);
      params.push(fields[key]);
    }
  }

  if (sets.length === 0) return existing;

  sets.push("updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now')");
  params.push(id);

  getDb()
    .prepare(`UPDATE equipment_units SET ${sets.join(",")} WHERE id=?`)
    .run(...params);

  return findById(id);
};

const softDelete = (id) => {
  const existing = findById(id);
  if (!existing) throw notFound(id);
  getDb()
    .prepare("UPDATE equipment_units SET is_active=0, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")
    .run(id);
};

module.exports = { list, findById, create, update, softDelete };
