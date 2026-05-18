"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs      = require("fs");
const path    = require("path");
const config  = require("./config");
const { PASSPORTS } = require("./passports");
const { UnitState } = require("./unit_state");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** 6 months of simulation time at 1-hour resolution */
const TOTAL_SIM_HOURS  = 4380;   // 6 × 30 × 24.25 ≈ 4380
const STEP_HOURS       = 1;      // 1 h per step
const TOTAL_STEPS      = Math.floor(TOTAL_SIM_HOURS / STEP_HOURS);
const LOG_EVERY_PCT    = 10;     // log progress every 10%

const OUTPUT_DIR = path.join(__dirname, "..", "training_data");

// ---------------------------------------------------------------------------
// Unit definitions (identical to index.js)
// ---------------------------------------------------------------------------

const UNIT_DEFINITIONS = [
  { unit_id: 1,  model_code: "SRV-R740-2U", name: "SRV-001", initial_age_hours: 8000  },
  { unit_id: 2,  model_code: "SRV-R740-2U", name: "SRV-002", initial_age_hours: 15000 },
  { unit_id: 3,  model_code: "SRV-R740-2U", name: "SRV-003", initial_age_hours: 22000 },
  { unit_id: 4,  model_code: "SRV-R740-2U", name: "SRV-004", initial_age_hours: 3000  },
  { unit_id: 5,  model_code: "PMP-CF250",   name: "PMP-001", initial_age_hours: 12000 },
  { unit_id: 6,  model_code: "PMP-CF250",   name: "PMP-002", initial_age_hours: 18000 },
  { unit_id: 7,  model_code: "PMP-CF250",   name: "PMP-003", initial_age_hours: 5000  },
  { unit_id: 8,  model_code: "PMP-CF250",   name: "PMP-004", initial_age_hours: 9500  },
  { unit_id: 9,  model_code: "CRY-LN2-15K", name: "CRY-001", initial_age_hours: 7200  },
  { unit_id: 10, model_code: "CRY-LN2-15K", name: "CRY-002", initial_age_hours: 14400 },
  { unit_id: 11, model_code: "CRY-LN2-15K", name: "CRY-003", initial_age_hours: 2800  },
  { unit_id: 12, model_code: "CRY-LN2-15K", name: "CRY-004", initial_age_hours: 21000 },
  { unit_id: 13, model_code: "QA-7000",      name: "QA-001",  initial_age_hours: 4000  },
  { unit_id: 14, model_code: "QA-7000",      name: "QA-002",  initial_age_hours: 8800  },
  { unit_id: 15, model_code: "QA-7000",      name: "QA-003",  initial_age_hours: 1200  },
  { unit_id: 16, model_code: "QA-7000",      name: "QA-004",  initial_age_hours: 11000 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format elapsed time as "Xm Ys".
 */
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * Ensure output directory exists.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `[offline] Starting dataset generation` +
    ` | ${TOTAL_SIM_HOURS}h sim time` +
    ` | ${STEP_HOURS}h resolution` +
    ` | ${TOTAL_STEPS} steps` +
    ` | ${UNIT_DEFINITIONS.length} units`
  );

  ensureDir(OUTPUT_DIR);

  // Initialise all units
  const units = UNIT_DEFINITIONS.map(def => {
    const passport = PASSPORTS[def.model_code];
    if (!passport) throw new Error(`No passport for model ${def.model_code}`);
    return new UnitState({
      unit_id:           def.unit_id,
      model_code:        def.model_code,
      passport,
      initial_age_hours: def.initial_age_hours,
      seed:              config.seed,
    });
  });

  // Buffer per model: Map<model_code, Array<record>>
  const buffers = new Map();
  for (const def of UNIT_DEFINITIONS) {
    if (!buffers.has(def.model_code)) buffers.set(def.model_code, []);
  }

  const logStepInterval = Math.max(1, Math.floor(TOTAL_STEPS * LOG_EVERY_PCT / 100));
  const startMs = Date.now();

  // Simulated wall-clock starts at epoch 0 for reproducibility
  // (training data uses monotone step index as timestamp)
  let sim_step = 0;

  for (let step = 0; step < TOTAL_STEPS; step++) {
    sim_step = step;
    const sim_hour = step * STEP_HOURS;

    // Simulated ISO timestamp (base = 2020-01-01T00:00:00Z)
    const ts = new Date(1577836800000 + sim_hour * 3600000).toISOString();

    for (const unit of units) {
      // Advance state
      unit.advance(STEP_HOURS);

      // Sample all channels
      const channel_points = unit.sampleWithDt(STEP_HOURS, new Date(ts));

      // Ground-truth state at this step
      const state = unit.toJSON();

      // Build one record per channel
      const model_buf = buffers.get(unit.model_code);
      for (const pt of channel_points) {
        model_buf.push({
          unit_id:       unit.unit_id,
          model_code:    unit.model_code,
          channel_code:  pt.channel_code,
          ts:            pt.ts,
          value:         pt.value,
          true_health:   state.health,
          active_mode:   state.active_mode,
          rul_true_hours: state.rul_true_hours,
        });
      }
    }

    // Progress logging
    if ((step + 1) % logStepInterval === 0 || step + 1 === TOTAL_STEPS) {
      const pct     = Math.round((step + 1) / TOTAL_STEPS * 100);
      const elapsed = formatElapsed(Date.now() - startMs);
      const failed  = units.filter(u => u.status === "FAILED").length;
      const degrad  = units.filter(u => u.status === "DEGRADING").length;
      console.log(
        `[offline] ${pct}% | step=${step + 1}/${TOTAL_STEPS}` +
        ` sim_hour=${sim_hour.toFixed(0)}` +
        ` degrading=${degrad} failed=${failed}` +
        ` elapsed=${elapsed}`
      );
    }
  }

  // Write one JSON file per model
  const models = [...buffers.keys()];
  console.log(`[offline] Writing ${models.length} output files to ${OUTPUT_DIR}`);

  for (const model_code of models) {
    const records = buffers.get(model_code);
    const file_name = `${model_code.replace(/[^a-z0-9_-]/gi, "_")}.json`;
    const out_path  = path.join(OUTPUT_DIR, file_name);

    fs.writeFileSync(out_path, JSON.stringify(records, null, 0), "utf8");
    const size_mb = (fs.statSync(out_path).size / 1024 / 1024).toFixed(2);
    console.log(`[offline]   ${file_name} — ${records.length} records — ${size_mb} MB`);
  }

  const total_elapsed = formatElapsed(Date.now() - startMs);
  console.log(`[offline] Done in ${total_elapsed}.`);
}

main().catch(err => {
  console.error("[offline] Fatal error:", err);
  process.exit(1);
});
