import numpy as np
from typing import Any


def extract_features(telemetry_window: list[dict], passport: dict) -> dict[str, float]:
    channels = {ch["code"]: ch for ch in passport.get("channels", [])}
    by_channel: dict[str, list[float]] = {}

    for row in telemetry_window:
        by_channel.setdefault(row["channel_code"], []).append(row["value"])

    features: dict[str, float] = {}

    for code, values in by_channel.items():
        if not values:
            continue
        arr = np.array(values, dtype=float)
        ch = channels.get(code, {})
        nominal = ch.get("nominal", 0) or 1e-9
        prefix = code

        features[f"{prefix}__mean"] = float(np.mean(arr))
        features[f"{prefix}__std"] = float(np.std(arr))
        features[f"{prefix}__min"] = float(np.min(arr))
        features[f"{prefix}__max"] = float(np.max(arr))
        features[f"{prefix}__median"] = float(np.median(arr))
        features[f"{prefix}__skew"] = float(_safe_skew(arr))
        features[f"{prefix}__kurt"] = float(_safe_kurt(arr))
        features[f"{prefix}__slope"] = float(_slope(arr))
        features[f"{prefix}__dev_from_nominal"] = float((np.mean(arr) - nominal) / nominal)

    return features


def _safe_skew(arr: np.ndarray) -> float:
    std = np.std(arr)
    if std < 1e-9:
        return 0.0
    return float(np.mean(((arr - np.mean(arr)) / std) ** 3))


def _safe_kurt(arr: np.ndarray) -> float:
    std = np.std(arr)
    if std < 1e-9:
        return 0.0
    return float(np.mean(((arr - np.mean(arr)) / std) ** 4) - 3)


def _slope(arr: np.ndarray) -> float:
    n = len(arr)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    return float(np.polyfit(x, arr, 1)[0])
