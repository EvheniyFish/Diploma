"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const config          = require("./config");
const { PASSPORTS }   = require("./passports");
const { UnitState }   = require("./unit_state");
const { IngestClient }= require("./ingest_client");
const { createControlServer } = require("./control");

// ---------------------------------------------------------------------------
// Unit registry
// ---------------------------------------------------------------------------

/**
 * 16 units in four families of four.
 * Backend IDs are 1-based, assigned in order: SRV x4, PMP x4, CRY x4, QA x4.
 * Initial hours_run from spec:
 * [8000, 15000, 22000, 3000, 12000, 18000, 5000, 9500,
 *  7200, 14400, 2800, 21000, 4000, 8800, 1200, 11000]
 */
const UNIT_DEFINITIONS = [
  // SRV-R740-2U — IDs 1-4
  { unit_id: 1,  model_code: "SRV-R740-2U", name: "SRV-001", initial_age_hours: 8000  },
  { unit_id: 2,  model_code: "SRV-R740-2U", name: "SRV-002", initial_age_hours: 15000 },
  { unit_id: 3,  model_code: "SRV-R740-2U", name: "SRV-003", initial_age_hours: 22000 },
  { unit_id: 4,  model_code: "SRV-R740-2U", name: "SRV-004", initial_age_hours: 3000  },
  // PMP-CF250 — IDs 5-8
  { unit_id: 5,  model_code: "PMP-CF250",   name: "PMP-001", initial_age_hours: 12000 },
  { unit_id: 6,  model_code: "PMP-CF250",   name: "PMP-002", initial_age_hours: 18000 },
  { unit_id: 7,  model_code: "PMP-CF250",   name: "PMP-003", initial_age_hours: 5000  },
  { unit_id: 8,  model_code: "PMP-CF250",   name: "PMP-004", initial_age_hours: 9500  },
  // CRY-LN2-15K — IDs 9-12
  { unit_id: 9,  model_code: "CRY-LN2-15K", name: "CRY-001", initial_age_hours: 7200  },
  { unit_id: 10, model_code: "CRY-LN2-15K", name: "CRY-002", initial_age_hours: 14400 },
  { unit_id: 11, model_code: "CRY-LN2-15K", name: "CRY-003", initial_age_hours: 2800  },
  { unit_id: 12, model_code: "CRY-LN2-15K", name: "CRY-004", initial_age_hours: 21000 },
  // QA-7000 — IDs 13-16
  { unit_id: 13, model_code: "QA-7000",      name: "QA-001",  initial_age_hours: 4000  },
  { unit_id: 14, model_code: "QA-7000",      name: "QA-002",  initial_age_hours: 8800  },
  { unit_id: 15, model_code: "QA-7000",      name: "QA-003",  initial_age_hours: 1200  },
  { unit_id: 16, model_code: "QA-7000",      name: "QA-004",  initial_age_hours: 11000 },
];

// Build Map<unit_id, UnitState>
const unitsMap = new Map();
for (const def of UNIT_DEFINITIONS) {
  const passport = PASSPORTS[def.model_code];
  if (!passport) throw new Error(`No passport for model ${def.model_code}`);
  const unit = new UnitState({
    unit_id:           def.unit_id,
    model_code:        def.model_code,
    passport,
    initial_age_hours: def.initial_age_hours,
    seed:              config.seed,
  });
  unitsMap.set(def.unit_id, unit);
}

// ---------------------------------------------------------------------------
// Shared simulation control object (mutated by control REST API)
// ---------------------------------------------------------------------------
const simControl = {
  timeSpeedFactor: config.timeSpeedFactor,
  paused:          false,
};

// ---------------------------------------------------------------------------
// Ingest client
// ---------------------------------------------------------------------------
const client = new IngestClient(config.backendUrl, config.ingestApiKey);

// ---------------------------------------------------------------------------
// Tick logic
// ---------------------------------------------------------------------------

/**
 * One simulation tick:
 *   1. Advance all units by (tick_seconds * speed_factor) of sim-time
 *   2. Sample all channels
 *   3. POST telemetry batch to /api/v1/ingest
 *   4. POST ground-truth (best-effort) to /api/v1/sim/ground-truth
 */
async function tick() {
  if (simControl.paused) return;

  const tick_s   = config.tickIntervalSeconds;
  const dt_hours = (tick_s * simControl.timeSpeedFactor) / 3600;

  const points       = [];
  const ground_truth = [];
  const ts           = new Date();

  for (const unit of unitsMap.values()) {
    unit.advance(dt_hours);
    const unit_points = unit.sampleWithDt(dt_hours, ts);
    points.push(...unit_points);
    ground_truth.push(unit.toJSON());
  }

  // Fire both posts concurrently; errors are logged but not fatal
  await Promise.all([
    client.send(points),
    client.sendGroundTruth(ground_truth),
  ]);

  // Log one summary line per tick
  const failed    = ground_truth.filter(s => s.status === "FAILED").length;
  const degrading = ground_truth.filter(s => s.status === "DEGRADING").length;
  console.log(
    `[tick] sim_age_range=[${Math.min(...ground_truth.map(s => s.age_hours)).toFixed(0)}` +
    `..${Math.max(...ground_truth.map(s => s.age_hours)).toFixed(0)}]h` +
    ` degrading=${degrading} failed=${failed}` +
    ` speed=${simControl.timeSpeedFactor}x` +
    ` points=${points.length}`
  );
}

// ---------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------

console.log(
  `[simulator] Starting real-time mode` +
  ` | ${unitsMap.size} units` +
  ` | tick=${config.tickIntervalSeconds}s` +
  ` | speed=${simControl.timeSpeedFactor}x` +
  ` | backend=${config.backendUrl}`
);

// Start control API
createControlServer(config.controlPort, unitsMap, simControl);

// Run first tick immediately, then on schedule
tick().catch(err => console.error("[tick] Error:", err.message));
const interval = setInterval(() => {
  tick().catch(err => console.error("[tick] Error:", err.message));
}, config.tickIntervalSeconds * 1000);

// Graceful shutdown
function shutdown() {
  console.log("[simulator] Shutting down...");
  clearInterval(interval);
  process.exit(0);
}
process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);
