"""Train IsolationForest + RandomForest + GradientBoosting per equipment model."""
import argparse, json, pickle
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestClassifier, GradientBoostingRegressor
import joblib

MODELS_DIR = Path(__file__).parent.parent / "models"
MODELS_DIR.mkdir(exist_ok=True)


def train_for_model(model_code: str, df: pd.DataFrame, feature_cols: list[str]):
    X = df[feature_cols].fillna(0).values
    y_mode = df["true_mode"].values
    y_rul = df["rul_hours"].values

    iso = IsolationForest(n_estimators=200, contamination=0.05, random_state=42, n_jobs=-1)
    iso.fit(X[y_mode == "HEALTHY"])

    clf = RandomForestClassifier(n_estimators=300, max_depth=12, random_state=42, n_jobs=-1)
    clf.fit(X, y_mode)

    rul_models = {}
    for q, alpha in [("q10", 0.1), ("q50", 0.5), ("q90", 0.9)]:
        gbr = GradientBoostingRegressor(loss="quantile", alpha=alpha, n_estimators=300, random_state=42)
        gbr.fit(X, y_rul)
        rul_models[q] = gbr

    importances = dict(zip(feature_cols, clf.feature_importances_))

    bundle = {
        "isolation_forest": iso,
        "classifier": clf,
        "rul_regressor": rul_models,
        "feature_names": feature_cols,
        "feature_importances": importances,
        "version": f"1.0.0-{model_code}",
    }
    out = MODELS_DIR / f"{model_code}.pkl"
    joblib.dump(bundle, out)
    print(f"Saved {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--model-code", required=True)
    args = parser.parse_args()

    df = pd.read_parquet(args.dataset)
    feature_cols = [c for c in df.columns if "__" in c]
    train_for_model(args.model_code, df, feature_cols)
