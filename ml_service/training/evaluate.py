"""CASS ML model evaluation script.

Loads a saved .pkl bundle and a held-out test set (or re-uses the training data
with a fixed 80/20 split), then prints and saves metrics.

Usage:
    python -m training.evaluate --model-code SRV-R740-2U
    python -m training.evaluate --model-code SRV-R740-2U --passport path/to/passport.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import label_binarize

PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.features import extract_features  # noqa: E402
from training.train import build_windowed_features, load_training_data  # noqa: E402

MODELS_DIR = PROJECT_ROOT / "models"
TRAINING_DATA_DIR = PROJECT_ROOT / "training_data"

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def anomaly_roc_auc(iso_forest, X: np.ndarray, y_label: np.ndarray) -> float:
    """Compute ROC-AUC for binary anomaly detection (HEALTHY vs. not-HEALTHY)."""
    y_binary = (y_label != "HEALTHY").astype(int)
    if y_binary.sum() == 0 or y_binary.sum() == len(y_binary):
        logger.warning("Cannot compute ROC-AUC: all samples are in the same class")
        return float("nan")
    scores = -iso_forest.decision_function(X)  # negate: higher = more anomalous
    return float(roc_auc_score(y_binary, scores))


def rul_metrics(model, X: np.ndarray, y_rul: np.ndarray) -> dict[str, float]:
    """Compute MAE, RMSE, and MAPE for a RUL model."""
    mask = np.isfinite(y_rul)
    if mask.sum() == 0:
        return {"mae": float("nan"), "rmse": float("nan"), "mape": float("nan")}
    Xm, ym = X[mask], y_rul[mask]
    preds = np.maximum(0.0, model.predict(Xm))
    errors = np.abs(preds - ym)
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean(errors ** 2)))
    nonzero = ym > 0
    mape = float(np.mean(errors[nonzero] / ym[nonzero])) * 100 if nonzero.sum() > 0 else float("nan")
    return {"mae": round(mae, 2), "rmse": round(rmse, 2), "mape": round(mape, 2)}


# ---------------------------------------------------------------------------
# Main evaluation
# ---------------------------------------------------------------------------

def evaluate(model_code: str, passport: dict[str, Any]) -> dict[str, Any]:
    """Load bundle + training data, rebuild val split, compute and print metrics."""
    bundle_path = MODELS_DIR / f"{model_code}.pkl"
    if not bundle_path.exists():
        logger.error("Bundle not found: %s — run training/train.py first", bundle_path)
        sys.exit(1)

    logger.info("Loading bundle from %s", bundle_path)
    bundle = joblib.load(bundle_path)
    version = bundle.get("version", "unknown")
    feature_names: list[str] = bundle.get("feature_names", [])

    records = load_training_data(model_code)
    windowed_df = build_windowed_features(records, passport)

    feature_cols = [c for c in windowed_df.columns if not c.startswith("_")]
    X = windowed_df[feature_cols].values.astype(np.float64)
    y_label = windowed_df["_label"].values
    y_rul = windowed_df["_rul_hours"].values
    groups = windowed_df["_unit_id"].values

    # Reproduce identical split used at training time
    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    _, val_idx = next(splitter.split(X, y_label, groups=groups))

    X_val = X[val_idx]
    y_label_val = y_label[val_idx]
    y_rul_val = y_rul[val_idx]

    logger.info("Validation set: %d windows", len(X_val))

    results: dict[str, Any] = {
        "model_code": model_code,
        "version": version,
        "trained_at": bundle.get("trained_at"),
        "val_windows": int(len(X_val)),
    }

    # --- Anomaly detection ROC-AUC ---
    iso = bundle.get("isolation_forest")
    if iso is not None:
        auc = anomaly_roc_auc(iso, X_val, y_label_val)
        results["anomaly_roc_auc"] = round(auc, 4) if np.isfinite(auc) else None
        logger.info("Anomaly detection ROC-AUC: %s", results["anomaly_roc_auc"])
    else:
        logger.warning("Bundle has no isolation_forest — skipping anomaly ROC-AUC")
        results["anomaly_roc_auc"] = None

    # --- Classifier metrics ---
    clf = bundle.get("classifier")
    if clf is not None:
        y_pred = clf.predict(X_val)
        bal_acc = float(balanced_accuracy_score(y_label_val, y_pred))
        results["classifier_balanced_accuracy"] = round(bal_acc, 4)
        logger.info("Classifier balanced accuracy: %.4f", bal_acc)

        report = classification_report(y_label_val, y_pred, zero_division=0, output_dict=True)
        results["classification_report"] = report

        cm = confusion_matrix(y_label_val, y_pred, labels=clf.classes_.tolist())
        results["confusion_matrix"] = {
            "labels": clf.classes_.tolist(),
            "matrix": cm.tolist(),
        }

        # Print readable report
        print("\n--- Classification Report ---")
        print(classification_report(y_label_val, y_pred, zero_division=0))
    else:
        logger.warning("Bundle has no classifier — skipping classification metrics")
        results["classifier_balanced_accuracy"] = None

    # --- RUL metrics ---
    rul_q50 = bundle.get("rul_q50")
    # Legacy bundle support
    if rul_q50 is None:
        legacy = bundle.get("rul_regressor")
        if isinstance(legacy, dict):
            rul_q50 = legacy.get("q50")

    if rul_q50 is not None:
        m = rul_metrics(rul_q50, X_val, y_rul_val)
        results["rul_q50_mae_hours"] = m["mae"]
        results["rul_q50_rmse_hours"] = m["rmse"]
        results["rul_q50_mape_pct"] = m["mape"]
        logger.info("RUL q50  MAE=%.1f h  RMSE=%.1f h  MAPE=%.1f%%", m["mae"], m["rmse"], m["mape"])
    else:
        logger.warning("Bundle has no rul_q50 — skipping RUL metrics")
        results["rul_q50_mae_hours"] = None

    # --- Print summary ---
    print("\n=== Evaluation summary ===")
    print(f"  model_code              : {model_code}")
    print(f"  bundle version          : {version}")
    print(f"  validation windows      : {len(X_val)}")
    if results.get("anomaly_roc_auc") is not None:
        print(f"  anomaly ROC-AUC         : {results['anomaly_roc_auc']:.4f}")
    if results.get("classifier_balanced_accuracy") is not None:
        print(f"  clf balanced accuracy   : {results['classifier_balanced_accuracy']:.4f}")
    if results.get("rul_q50_mae_hours") is not None:
        print(f"  RUL q50 MAE             : {results['rul_q50_mae_hours']:.1f} h")
        print(f"  RUL q50 RMSE            : {results['rul_q50_rmse_hours']:.1f} h")
        print(f"  RUL q50 MAPE            : {results['rul_q50_mape_pct']:.1f}%")
    print()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Evaluate a CASS ML bundle on held-out validation data.",
    )
    parser.add_argument(
        "--model-code",
        required=True,
        help="Equipment model code (e.g. SRV-R740-2U)",
    )
    parser.add_argument(
        "--passport",
        default=None,
        help="Path to equipment passport JSON (used for feature extraction context)",
    )
    parser.add_argument(
        "--save-metrics",
        default=None,
        help="Path to write metrics JSON (optional)",
    )
    args = parser.parse_args()

    if args.passport:
        with open(args.passport, "r", encoding="utf-8") as fh:
            passport = json.load(fh)
    else:
        passport = {"channels": []}
        logger.warning("No --passport provided — contextual features will be zero")

    metrics = evaluate(args.model_code, passport)

    if args.save_metrics:
        out_path = Path(args.save_metrics)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(metrics, fh, indent=2, default=str)
        logger.info("Metrics saved to %s", out_path)


if __name__ == "__main__":
    main()
