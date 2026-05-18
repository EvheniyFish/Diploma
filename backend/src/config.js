"use strict";
require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT || "3000"),
  host: process.env.HOST || "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  db: {
    path: process.env.DB_PATH || "./data/cass.db",
    pragma: { journal_mode: "WAL", synchronous: "NORMAL", cache_size: -65536 },
  },

  ml: {
    url: process.env.ML_SERVICE_URL || "http://localhost:8000",
    scheduleIntervalMs: parseInt(process.env.REASSESSMENT_INTERVAL_MS || "300000"),
  },

  simulator: {
    url: process.env.SIMULATOR_URL || "http://localhost:3001",
  },

  auth: {
    adminKey: process.env.ADMIN_API_KEY || "dev-admin-key",
    ingestKey: process.env.INGEST_API_KEY || "dev-ingest-key",
  },

  ingest: {
    batchLimit: 5000,
  },

  telemetry: {
    retentionDays: parseInt(process.env.TELEMETRY_RETENTION_DAYS || "14"),
  },
};
