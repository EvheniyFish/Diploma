"use strict";

const PASSPORT_SCHEMA = {
  type: "object",
  required: ["model_code", "display_name", "category", "weibull_eta_hours", "weibull_beta", "channels"],
  additionalProperties: true,
  properties: {
    model_code: { type: "string", minLength: 1 },
    display_name: { type: "string", minLength: 1 },
    category: { type: "string", minLength: 1 },
    weibull_eta_hours: { type: "number", exclusiveMinimum: 0 },
    weibull_beta: { type: "number", exclusiveMinimum: 0 },
    channels: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["code", "class", "unit", "nominal", "operating_range", "critical_range"],
        additionalProperties: true,
        properties: {
          code: { type: "string", minLength: 1 },
          class: { type: "string", enum: ["T", "F", "E", "Q", "R", "V"] },
          unit: { type: "string" },
          nominal: { type: "number" },
          operating_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          critical_range: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
          inertia_seconds: { type: "number", minimum: 0 },
          noise_sigma: { type: "number", minimum: 0 },
        },
      },
    },
    failure_modes: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "name"],
        additionalProperties: true,
        properties: {
          code: { type: "string" },
          name: { type: "string" },
          affected_channels: { type: "array", items: { type: "string" } },
          typical_horizon_hours: { type: "number" },
        },
      },
    },
  },
};

module.exports = { PASSPORT_SCHEMA };
