"use strict";

const axios = require("axios");

const RETRY_COUNT   = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_SIZE     = 5000;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Pause for `ms` milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTTP client that POSTs telemetry points to the backend ingest endpoint.
 *
 * Guarantees:
 *   - Batches up to BATCH_SIZE points per request (avoids oversized payloads)
 *   - Retries up to RETRY_COUNT times with RETRY_DELAY_MS between attempts
 *   - Logs errors to stderr; never throws (fire-and-forget safe)
 *   - Includes X-Api-Key header on every request
 */
class IngestClient {
  /**
   * @param {string} baseUrl  - Backend root URL, e.g. http://localhost:3000
   * @param {string} apiKey   - Value for the X-Api-Key / x-api-key header
   */
  constructor(baseUrl, apiKey) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        "x-api-key":    apiKey,
        "content-type": "application/json",
      },
      timeout: REQUEST_TIMEOUT_MS,
    });
  }

  /**
   * Send telemetry points to /api/v1/ingest.
   * Large batches are split automatically.
   *
   * @param {Array} points - Telemetry point objects
   */
  async send(points) {
    if (!points || points.length === 0) return;

    for (let offset = 0; offset < points.length; offset += BATCH_SIZE) {
      const batch = points.slice(offset, offset + BATCH_SIZE);
      await this._postWithRetry("/api/v1/ingest", { points: batch });
    }
  }

  /**
   * Send ground-truth data to the optional backend endpoint.
   * Failures are silently swallowed — this endpoint may not exist.
   *
   * @param {Array} ground_truth - Array of ground-truth state objects
   */
  async sendGroundTruth(ground_truth) {
    if (!ground_truth || ground_truth.length === 0) return;
    try {
      await this.http.post("/api/v1/sim/ground-truth", { ground_truth });
    } catch (err) {
      // Optional endpoint — do not log noise if it doesn't exist (404/ECONNREFUSED)
      if (err.response && err.response.status !== 404) {
        console.error("[ingest] ground-truth POST failed:", err.message);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  async _postWithRetry(path, body) {
    let lastErr;
    for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
      try {
        await this.http.post(path, body);
        return; // success
      } catch (err) {
        lastErr = err;
        if (attempt < RETRY_COUNT) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
    console.error(
      `[ingest] POST ${path} failed after ${RETRY_COUNT} attempts: ${lastErr.message}`
    );
  }
}

module.exports = { IngestClient };
