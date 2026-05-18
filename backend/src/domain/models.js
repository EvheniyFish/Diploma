"use strict";
const crypto = require("crypto");
const Ajv = require("ajv");
const { getDb } = require("../db");
const { PASSPORT_SCHEMA } = require("../lib/passport_schema");

const ajv = new Ajv({ allErrors: true });
const validatePassport = ajv.compile(PASSPORT_SCHEMA);

function hashPassport(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);
}

function notFound(id) {
  const err = new Error(`Модель #${id} не знайдена`);
  err.code = "NOT_FOUND";
  return err;
}

function validateOrThrow(passport) {
  const valid = validatePassport(passport);
  if (!valid) {
    const err = new Error("Паспорт не відповідає схемі: " + ajv.errorsText(validatePassport.errors));
    err.statusCode = 422;
    err.validation = validatePassport.errors;
    throw err;
  }
}

const list = () =>
  getDb()
    .prepare(
      "SELECT id, model_code, display_name, category, weibull_eta, weibull_beta, created_at FROM equipment_models ORDER BY display_name"
    )
    .all();

const findById = (id) => {
  const row = getDb().prepare("SELECT * FROM equipment_models WHERE id = ?").get(id);
  return row || null;
};

const create = ({ passport }) => {
  validateOrThrow(passport);
  const passport_json = JSON.stringify(passport);
  const passport_hash = hashPassport(passport);
  const { lastInsertRowid } = getDb()
    .prepare(
      "INSERT INTO equipment_models (model_code, display_name, category, passport_json, passport_hash, weibull_eta, weibull_beta) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      passport.model_code,
      passport.display_name,
      passport.category,
      passport_json,
      passport_hash,
      passport.weibull_eta_hours,
      passport.weibull_beta
    );
  return findById(lastInsertRowid);
};

const update = (id, { passport }) => {
  const existing = findById(id);
  if (!existing) throw notFound(id);
  validateOrThrow(passport);
  const passport_json = JSON.stringify(passport);
  const passport_hash = hashPassport(passport);
  getDb()
    .prepare(
      "UPDATE equipment_models SET model_code=?, display_name=?, category=?, passport_json=?, passport_hash=?, weibull_eta=?, weibull_beta=? WHERE id=?"
    )
    .run(
      passport.model_code,
      passport.display_name,
      passport.category,
      passport_json,
      passport_hash,
      passport.weibull_eta_hours,
      passport.weibull_beta,
      id
    );
  return findById(id);
};

const remove = (id) => {
  const existing = findById(id);
  if (!existing) throw notFound(id);
  const inUse = getDb().prepare("SELECT 1 FROM equipment_units WHERE model_id=? AND is_active=1").get(id);
  if (inUse) {
    const err = new Error("Модель має активні одиниці обладнання та не може бути видалена");
    err.code = "CONFLICT";
    throw err;
  }
  getDb().prepare("DELETE FROM equipment_models WHERE id=?").run(id);
};

module.exports = { list, findById, create, update, remove };
