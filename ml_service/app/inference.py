import numpy as np
from .registry import registry
from .schemas import PredictRequest, PredictResponse


def predict(req: PredictRequest) -> PredictResponse:
    bundle = registry.get(req.model_code)
    iso_model = bundle["isolation_forest"]
    clf = bundle.get("classifier")
    rul_model = bundle.get("rul_regressor")
    feature_names = bundle["feature_names"]
    version = bundle.get("version", "unknown")

    X = np.array([[req.features.get(f, 0.0) for f in feature_names]])

    raw_score = iso_model.decision_function(X)[0]
    anomaly_score = float(np.clip(0.5 - raw_score / 2, 0.0, 1.0))

    predicted_mode = None
    predicted_mode_conf = None
    if clf is not None and anomaly_score >= 0.3:
        predicted_mode = clf.classes_[np.argmax(clf.predict_proba(X)[0])]
        predicted_mode_conf = float(np.max(clf.predict_proba(X)[0]))

    rul_hours = rul_lower = rul_upper = None
    if rul_model is not None:
        rul_hours = float(max(0, rul_model["q50"].predict(X)[0]))
        rul_lower = float(max(0, rul_model["q10"].predict(X)[0]))
        rul_upper = float(max(0, rul_model["q90"].predict(X)[0]))

    importances = bundle.get("feature_importances", {})
    top_features = dict(sorted(importances.items(), key=lambda x: -x[1])[:5])

    return PredictResponse(
        anomaly_score=anomaly_score,
        predicted_mode=predicted_mode,
        predicted_mode_conf=predicted_mode_conf,
        rul_hours=rul_hours,
        rul_lower_hours=rul_lower,
        rul_upper_hours=rul_upper,
        model_version=version,
        explanation={"top_features": top_features},
    )
