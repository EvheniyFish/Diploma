"use strict";
module.exports = {
  db: {
    path: process.env.DB_PATH || "./cass.db",
    pragma: { journal_mode: "WAL", synchronous: "NORMAL", cache_size: -65536 },
  },
  ml: {
    url: process.env.ML_SERVICE_URL || "http://localhost:8000",
    scheduleInterval: parseInt(process.env.ML_SCHEDULE_MS || "300000"),
  },
  ingest: {
    batchLimit: 5000,
  },
};
