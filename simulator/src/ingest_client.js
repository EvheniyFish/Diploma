"use strict";
const axios = require("axios");

class IngestClient {
  constructor(baseUrl, apiKey) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      timeout: 5000,
    });
  }

  async send(points) {
    if (!points.length) return;
    await this.http.post("/api/v1/ingest", { points });
  }
}

module.exports = { IngestClient };
