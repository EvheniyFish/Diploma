"use strict";
module.exports = {
  API_URL: process.env.API_URL || "http://localhost:3000",
  API_KEY: process.env.API_KEY || "dev-key",
  INTERVAL_MS: parseInt(process.env.INTERVAL_MS || "10000"),
  SPEED_FACTOR: parseFloat(process.env.SPEED_FACTOR || "1.0"),
  UNITS: JSON.parse(process.env.UNITS_JSON || "[]"),
};
