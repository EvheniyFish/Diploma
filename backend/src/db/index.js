"use strict";
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const config = require("../config");

let db;

function getDb() {
  if (!db) {
    const dbPath = path.resolve(config.db.path);
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    for (const [k, v] of Object.entries(config.db.pragma)) {
      db.pragma(`${k} = ${v}`);
    }
    require("./migrations").run(db);
  }
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb };
