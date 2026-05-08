"use strict";
const { getDb } = require("../db");
const crypto = require("crypto");

function hashPassport(passport) {
  return crypto.createHash("sha256").update(JSON.stringify(passport)).digest("hex").slice(0, 16);
}

const list = () =>
  getDb().prepare("SELECT id, model_code, name, category, manufacturer, is_active, created_at FROM equipment_models ORDER BY name").all();

const findById = (id) =>
  getDb().prepare("SELECT * FROM equipment_models WHERE id = ?").get(id);

const create = ({ model_code, name, category, manufacturer, passport }) => {
  const passport_json = JSON.stringify(passport);
  const passport_hash = hashPassport(passport);
  const { lastInsertRowid } = getDb()
    .prepare("INSERT INTO equipment_models (model_code,name,category,manufacturer,passport_json,passport_hash) VALUES (?,?,?,?,?,?)")
    .run(model_code, name, category, manufacturer ?? null, passport_json, passport_hash);
  return findById(lastInsertRowid);
};

const update = (id, { name, category, manufacturer, passport }) => {
  const passport_json = JSON.stringify(passport);
  const passport_hash = hashPassport(passport);
  getDb()
    .prepare("UPDATE equipment_models SET name=?,category=?,manufacturer=?,passport_json=?,passport_hash=?,updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")
    .run(name, category, manufacturer ?? null, passport_json, passport_hash, id);
  return findById(id);
};

const remove = (id) => {
  const inUse = getDb().prepare("SELECT 1 FROM equipment_units WHERE model_id=? AND is_active=1").get(id);
  if (inUse) throw Object.assign(new Error("Model has active units"), { code: "CONFLICT" });
  getDb().prepare("DELETE FROM equipment_models WHERE id=?").run(id);
};

module.exports = { list, findById, create, update, remove };
