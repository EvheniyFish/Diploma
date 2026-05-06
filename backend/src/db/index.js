"use strict";
const Database = require("better-sqlite3");
const config = require("../config");

let db;

function getDb() {
  if (!db) {
    db = new Database(config.db.path);
    for (const [k, v] of Object.entries(config.db.pragma)) {
      db.pragma(`${k} = ${v}`);
    }
    require("./migrations").run(db);
  }
  return db;
}

module.exports = { getDb };
