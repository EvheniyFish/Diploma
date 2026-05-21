"""Prediction pipeline for CASS ML service.

Two code paths:
  1. ML bundle path — uses the loaded .pkl bundle for the model_code.
  2. Heuristic fallback — used when no trained bundle exists.

The heuristic is fully functional and suitable for demo without training data.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from .features import build_feature_vector
from .registry import registry
from .schemas import PredictRequest, PredictResponse

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Heuristic fallback
# ---------------------------------------------------------------------------

def heuristic_predict(model_code: str, features: dict[str, float]) -> PredictResponse:
    """Compute anomaly score and RUL without a trained model.

    The heuristic aggregates deviation-related feature suffixes:
        __dev_from_nominal  — normalised distance from nominal
        __time_above_op     — fraction of time above operating range
        __time_below_op     — fraction of time below operating range
        __in_critical       — fraction of time in critical zone (weighted x4)

    Final anomaly_score = clip(p80(indicators) * 0.5 + 0.05, 0, 0.95).
    RUL is inversely proportional to anomaly_score over a 0–720 hour range.
    """
    anomaly_indicators: list[float] = []

    for name, value in features.items():
        if name.endswith("__dev_from_nominal"):
            anomaly_indicators.append(abs(value))
        elif name.endswith("__time_above_op") or name.endswith("__time_below_op"):
            anomaly_indicators.append(float(value) * 2.0)
        elif name.endswith("__in_critical"):
            anomaly_indicators.append(float(value) * 4.0)

    # Also consider slope-based trend indicators
    for name, value in features.items():
        if name.endswith("__slope") and abs(value) > 0:
            anomaly_indicators.append(min(1.0, abs(value) * 10.0))

    if not anomaly_indicators:
        anomaly_score = 0.05
    else:
        raw = float(np.percentile(anomaly_indicators, 80))
        anomaly_score = min(0.95, raw * 1.0 + 0.05)

    # Find the most anomalous channel by dev_from_nominal
    worst_channel: Optional[str] = None
    worst_val = 0.0
    for name, val in features.items():
        if name.endswith("__dev_from_nominal") and abs(val) > worst_val:
            worst_val = abs(val)
            worst_channel = name[: -len("__dev_from_nominal")]

    # RUL: inversely proportional to anomaly_score, range 1–720 hours
    rul = max(1.0, (1.0 - anomaly_score) * 720.0)

    predicted_mode: Optional[str] = None
    predicted_mode_conf: Optional[float] = None
    if anomaly_score >= 0.3:
        predicted_mode = "unknown_degradation"
        predicted_mode_conf = round(anomaly_score, 4)

    top_features: list[dict] = []
    if worst_channel:
        top_features = [
            {"name": f"{worst_channel}__dev_from_nominal", "contribution": round(worst_val, 4)}
        ]

    return PredictResponse(
        anomaly_score=round(anomaly_score, 4),
        predicted_mode=predicted_mode,
        predicted_mode_conf=predicted_mode_conf,
        rul_hours=round(rul, 1),
        rul_lower_hours=round(rul * 0.6, 1),
        rul_upper_hours=round(rul * 1.5, 1),
        model_version="heuristic-v1",
        explanation={"top_features": top_features},
    )


# ---------------------------------------------------------------------------
# ML bundle prediction
# ---------------------------------------------------------------------------

def _top_features_from_bundle(
    bundle: dict,
    features: dict[str, float],
    feature_names: list[str],
    n: int = 5,
) -> list[dict]:
    """Compute top-N feature contributions.

    Method: multiply the classifier's feature_importances by the absolute
    deviation of the feature value from its mean importance-weighted value.
    Falls back to raw importances if per-feature mean is unavailable.
    """
    importances: dict[str, float] = bundle.get("feature_importances", {})
    if not importances:
        return []

    scored: list[tuple[float, str]] = []
    feature_means: dict[str, float] = bundle.get("feature_means", {})

    for name in feature_names:
        imp = importances.get(name, 0.0)
        if imp <= 0.0:
            continue
        val = features.get(name, 0.0)
        baseline = feature_means.get(name, 0.0)
        contribution = imp * abs(val - baseline)
        scored.append((contribution, name))

    scored.sort(reverse=True)
    return [{"name": name, "contribution": round(score, 4)} for score, name in scored[:n]]


def ml_predict(bundle: dict, features: dict[str, float]) -> PredictResponse:
    """Run the full ML prediction pipeline using a loaded model bundle."""
    iso_forest = bundle.get("isolation_forest")
    classifier = bundle.get("classifier")
    rul_models: Optional[dict] = bundle.get("rul_q10") and bundle  # check via individual keys below
    feature_names: list[str] = bundle.get("feature_names", [])
    version: str = bundle.get("version", "unknown")
    failure_modes: list[str] = bundle.get("failure_modes", [])

    if not feature_names:
        logger.warning("Bundle has no feature_names — falling back to heuristic")
        return heuristic_predict("", features)

    # Step 1 — Build feature vector
    X = build_feature_vector(features, feature_names)

    # Step 2 — Anomaly score from IsolationForest
    if iso_forest is not None:
        raw_score = float(iso_forest.decision_function(X)[0])
        # decision_function returns higher values for normal samples.
        # We map it to [0, 1] where 1 = most anomalous.
        anomaly_score = float(np.clip(0.5 - raw_score / 2.0, 0.0, 1.0))
    else:
        logger.warning("Bundle %s has no isolation_forest — anomaly_score set to 0.1", version)
        anomaly_score = 0.1

    # Step 3 — Failure mode classification
    predicted_mode: Optional[str] = None
    predicted_mode_conf: Optional[float] = None

    if classifier is not None and anomaly_score >= 0.3:
        try:
            proba = classifier.predict_proba(X)[0]
            best_idx = int(np.argmax(proba))
            predicted_mode = str(classifier.classes_[best_idx])
            predicted_mode_conf = round(float(proba[best_idx]), 4)
            # If the classifier labels the sample as HEALTHY, don't report a mode
            if predicted_mode.upper() == "HEALTHY":
                predicted_mode = None
                predicted_mode_conf = None
        except Exception:
            logger.exception("Classifier.predict_proba failed")

    # Step 4 — RUL quantile regression
    rul_hours: Optional[float] = None
    rul_lower_hours: Optional[float] = None
    rul_upper_hours: Optional[float] = None

    rul_q10 = bundle.get("rul_q10")
    rul_q50 = bundle.get("rul_q50")
    rul_q90 = bundle.get("rul_q90")

    # Support legacy bundles where RUL models were stored under "rul_regressor" dict
    if rul_q10 is None and rul_q50 is None:
        legacy = bundle.get("rul_regressor")
        if isinstance(legacy, dict):
            rul_q10 = legacy.get("q10")
            rul_q50 = legacy.get("q50")
            rul_q90 = legacy.get("q90")

    if rul_q50 is not None:
        try:
            rul_hours = float(max(0.0, rul_q50.predict(X)[0]))
        except Exception:
            logger.exception("rul_q50.predict failed")
    if rul_q10 is not None:
        try:
            rul_lower_hours = float(max(0.0, rul_q10.predict(X)[0]))
        except Exception:
            logger.exception("rul_q10.predict failed")
    if rul_q90 is not None:
        try:
            rul_upper_hours = float(max(0.0, rul_q90.predict(X)[0]))
        except Exception:
            logger.exception("rul_q90.predict failed")

    # Step 5 — Explanation: top feature contributions
    top_feats = _top_features_from_bundle(bundle, features, feature_names, n=5)

    return PredictResponse(
        anomaly_score=round(anomaly_score, 4),
        predicted_mode=predicted_mode,
        predicted_mode_conf=predicted_mode_conf,
        rul_hours=round(rul_hours, 1) if rul_hours is not None else None,
        rul_lower_hours=round(rul_lower_hours, 1) if rul_lower_hours is not None else None,
        rul_upper_hours=round(rul_upper_hours, 1) if rul_upper_hours is not None else None,
        model_version=version,
        explanation={"top_features": top_feats},
    )


# ---------------------------------------------------------------------------
# Unified entry point
# ---------------------------------------------------------------------------

def predict(req: PredictRequest) -> PredictResponse:
    """Route a predict request to the ML bundle or heuristic fallback."""
    bundle = registry.get(req.model_code)

    if bundle is None:
        logger.info(
            "No trained bundle for model_code=%s — using heuristic predictor",
            req.model_code,
        )
        return heuristic_predict(req.model_code, req.features)

    return ml_predict(bundle, req.features)
