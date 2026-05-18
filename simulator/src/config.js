"use strict";
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

module.exports = {
  backendUrl: process.env.BACKEND_URL || "http://localhost:3000",
  ingestApiKey: process.env.INGEST_API_KEY || "dev-ingest-key",
  tickIntervalSeconds: parseInt(process.env.TICK_INTERVAL_SECONDS || "10", 10),
  timeSpeedFactor: parseFloat(process.env.TIME_SPEED_FACTOR || "1.0"),
  seed: parseInt(process.env.SEED || "42", 10),
  controlPort: parseInt(process.env.CONTROL_PORT || "3001", 10),
};
