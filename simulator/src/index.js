"use strict";
require("dotenv").config();
const { UnitState } = require("./unit_state");
const { IngestClient } = require("./ingest_client");
const config = require("./config");

const client = new IngestClient(config.API_URL, config.API_KEY);
const units = config.UNITS.map((u) => new UnitState(u));

async function tick() {
  const points = [];
  for (const unit of units) {
    unit.advance(config.INTERVAL_MS / 1000);
    points.push(...unit.sample());
  }
  try {
    await client.send(points);
  } catch (e) {
    console.error("Ingest error:", e.message);
  }
}

console.log(`Simulator started — ${units.length} units, interval ${config.INTERVAL_MS}ms`);
setInterval(tick, config.INTERVAL_MS);
tick();
