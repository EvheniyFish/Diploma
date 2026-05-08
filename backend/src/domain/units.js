"use strict";
const { getDb } = require("../db");

const list = ({ model_id, status, q } = {}) => {
  let sql = `
    SELECT u.*, m.model_code, m.name as model_name, m.category,
           h.status, h.anomaly_score, h.rul_hours, h.predicted_mode, h.assessed_at
    FROM equipment_units u
    JOIN equipment_models m ON m.id = u.model_id
    LEFT JOIN health_state h ON h.unit_id = u.id
    WHERE u.is_active = 1
  `;
  const params = [];
  if (model_id) { sql += " AND u.model_id = ?"; params.push(model_id); }
  if (status)   { sql += " AND h.status = ?";   params.push(status); }
  if (q)        { sql += " AND (u.name LIKE ? OR u.serial_number LIKE ? OR u.location LIKE ?)"; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  sql += " ORDER BY u.name";
  return getDb().prepare(sql).all(...params);
};

const findById = (id) =>
  getDb().prepare(`
    SELECT u.*, m.model_code, m.name as model_name, m.passport_json,
           h.status, h.anomaly_score, h.rul_hours, h.predicted_mode,
           h.predicted_mode_conf, h.rul_lower_hours, h.rul_upper_hours, h.assessed_at
    FROM equipment_units u
    JOIN equipment_models m ON m.id = u.model_id
    LEFT JOIN health_state h ON h.unit_id = u.id
    WHERE u.id = ?
  `).get(id);

const create = ({ model_id, serial_number, name, location, commissioned_at, notes }) => {
  const { lastInsertRowid } = getDb()
    .prepare("INSERT INTO equipment_units (model_id,serial_number,name,location,commissioned_at,notes) VALUES (?,?,?,?,?,?)")
    .run(model_id, serial_number, name, location ?? null, commissioned_at ?? null, notes ?? null);
  return findById(lastInsertRowid);
};

module.exports = { list, findById, create };
