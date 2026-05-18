"use strict";

const http = require("http");

/**
 * Parse the JSON body of an incoming request.
 * Resolves to the parsed object, or rejects with an error.
 *
 * @param {http.IncomingMessage} req
 * @returns {Promise<object>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send a JSON response.
 *
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Create and start the simulator control REST API server.
 *
 * Endpoints:
 *   GET  /sim/state          — return all unit states
 *   POST /sim/inject_fault   — force a failure mode: {unit_id, mode_code, horizon_hours?}
 *   POST /sim/reset_unit     — reset unit to healthy: {unit_id}
 *   POST /sim/speed          — change speed factor: {factor}
 *   POST /sim/pause          — pause simulation
 *   POST /sim/resume         — resume simulation
 *
 * @param {number}             port       - TCP port to listen on
 * @param {Map<number, UnitState>} unitsMap - Map from unit_id → UnitState
 * @param {object}             simControl  - Mutable object with {timeSpeedFactor, paused}
 * @returns {http.Server}
 */
function createControlServer(port, unitsMap, simControl) {
  const server = http.createServer(async (req, res) => {
    const { method, url } = req;

    // -------------------------------------------------------------------------
    // GET /sim/state
    // -------------------------------------------------------------------------
    if (method === "GET" && url === "/sim/state") {
      const states = [];
      for (const unit of unitsMap.values()) {
        states.push(unit.toJSON());
      }
      return json(res, 200, states);
    }

    // -------------------------------------------------------------------------
    // POST /sim/inject_fault
    // -------------------------------------------------------------------------
    if (method === "POST" && url === "/sim/inject_fault") {
      let body;
      try { body = await readBody(req); } catch (e) {
        return json(res, 400, { error: "Invalid JSON" });
      }

      const { unit_id, mode_code, horizon_hours } = body;
      if (!unit_id || !mode_code) {
        return json(res, 400, { error: "unit_id and mode_code are required" });
      }

      const unit = unitsMap.get(Number(unit_id));
      if (!unit) {
        return json(res, 404, { error: `Unit ${unit_id} not found` });
      }

      try {
        unit.injectFault(mode_code, horizon_hours || undefined);
      } catch (e) {
        return json(res, 400, { error: e.message });
      }

      console.log(`[control] inject_fault unit=${unit_id} mode=${mode_code}`);
      return json(res, 200, { ok: true, unit_id: Number(unit_id), mode_code });
    }

    // -------------------------------------------------------------------------
    // POST /sim/reset_unit
    // -------------------------------------------------------------------------
    if (method === "POST" && url === "/sim/reset_unit") {
      let body;
      try { body = await readBody(req); } catch (e) {
        return json(res, 400, { error: "Invalid JSON" });
      }

      const { unit_id } = body;
      if (!unit_id) {
        return json(res, 400, { error: "unit_id is required" });
      }

      const unit = unitsMap.get(Number(unit_id));
      if (!unit) {
        return json(res, 404, { error: `Unit ${unit_id} not found` });
      }

      unit.reset();
      console.log(`[control] reset_unit unit=${unit_id}`);
      return json(res, 200, { ok: true, unit_id: Number(unit_id) });
    }

    // -------------------------------------------------------------------------
    // POST /sim/speed
    // -------------------------------------------------------------------------
    if (method === "POST" && url === "/sim/speed") {
      let body;
      try { body = await readBody(req); } catch (e) {
        return json(res, 400, { error: "Invalid JSON" });
      }

      const factor = parseFloat(body.factor);
      if (!isFinite(factor) || factor <= 0) {
        return json(res, 400, { error: "factor must be a positive number" });
      }

      simControl.timeSpeedFactor = factor;
      console.log(`[control] speed changed to ${factor}x`);
      return json(res, 200, { factor });
    }

    // -------------------------------------------------------------------------
    // POST /sim/pause
    // -------------------------------------------------------------------------
    if (method === "POST" && url === "/sim/pause") {
      simControl.paused = true;
      console.log("[control] simulation paused");
      return json(res, 200, { paused: true });
    }

    // -------------------------------------------------------------------------
    // POST /sim/resume
    // -------------------------------------------------------------------------
    if (method === "POST" && url === "/sim/resume") {
      simControl.paused = false;
      console.log("[control] simulation resumed");
      return json(res, 200, { paused: false });
    }

    // -------------------------------------------------------------------------
    // 404 fallthrough
    // -------------------------------------------------------------------------
    json(res, 404, { error: "Not found" });
  });

  server.listen(port, () => {
    console.log(`[control] REST API listening on port ${port}`);
  });

  server.on("error", err => {
    console.error(`[control] Server error: ${err.message}`);
  });

  return server;
}

module.exports = { createControlServer };
