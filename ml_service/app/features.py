"""Feature extraction for CASS ML service.

Two public functions:
  - extract_features(window, passport) -> dict[str, float]
      Used by the offline training pipeline to turn a raw telemetry window
      into a named feature vector.
  - build_feature_vector(features, feature_names) -> np.ndarray
      Used at inference time to build an ordered numpy array from a
      pre-computed feature dict (sent by the backend scheduler).
"""

from __future__ import annotations

from typing import Any

import numpy as np

try:
    from scipy.stats import skew as scipy_skew, kurtosis as scipy_kurtosis

    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _skew(arr: np.ndarray) -> float:
    """Pearson's moment coefficient of skewness (bias-corrected if scipy available)."""
    if len(arr) < 3:
        return 0.0
    if _SCIPY_AVAILABLE:
        return float(scipy_skew(arr, bias=False))
    std = float(np.std(arr, ddof=1))
    if std < 1e-12:
        return 0.0
    return float(np.mean(((arr - np.mean(arr)) / std) ** 3))


def _kurtosis(arr: np.ndarray) -> float:
    """Excess kurtosis (Fisher's definition, bias-corrected if scipy available)."""
    if len(arr) < 4:
        return 0.0
    if _SCIPY_AVAILABLE:
        return float(scipy_kurtosis(arr, fisher=True, bias=False))
    std = float(np.std(arr, ddof=1))
    if std < 1e-12:
        return 0.0
    return float(np.mean(((arr - np.mean(arr)) / std) ** 4) - 3)


def _slope(arr: np.ndarray) -> float:
    """Slope of a least-squares linear fit over the array (per-sample rate)."""
    n = len(arr)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    coeffs = np.polyfit(x, arr, 1)
    return float(coeffs[0])


def _fft_bands(arr: np.ndarray, sample_rate_hz: float = 1.0) -> tuple[float, float, float, float]:
    """Compute fractional spectral power in three bands and dominant frequency.

    Bands:
        low:  0 – 10 Hz
        mid:  10 – 100 Hz
        high: 100+ Hz

    Returns:
        (fft_low, fft_mid, fft_high, fft_peak)
        All power fractions are in [0, 1] and sum to ~1.
        fft_peak is the dominant frequency in Hz.
    """
    n = len(arr)
    if n < 4:
        return 0.0, 0.0, 0.0, 0.0

    windowed = arr * np.hanning(n)
    spectrum = np.abs(np.fft.rfft(windowed))
    power = spectrum ** 2

    total_power = float(np.sum(power))
    if total_power < 1e-30:
        return 0.0, 0.0, 0.0, 0.0

    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate_hz)

    mask_low = freqs <= 10.0
    mask_mid = (freqs > 10.0) & (freqs <= 100.0)
    mask_high = freqs > 100.0

    fft_low = float(np.sum(power[mask_low]) / total_power)
    fft_mid = float(np.sum(power[mask_mid]) / total_power)
    fft_high = float(np.sum(power[mask_high]) / total_power)

    peak_idx = int(np.argmax(power))
    fft_peak = float(freqs[peak_idx])

    return fft_low, fft_mid, fft_high, fft_peak


# ---------------------------------------------------------------------------
# Public API — offline feature extraction
# ---------------------------------------------------------------------------

def extract_features(
    telemetry_window: list[dict[str, Any]],
    passport: dict[str, Any],
) -> dict[str, float]:
    """Extract a named feature vector from a raw telemetry window.

    Args:
        telemetry_window: List of telemetry row dicts.  Each dict must have
            at minimum ``channel_code`` (str) and ``value`` (float).
            Optionally ``ts`` (ISO-8601 string, used for ordering).
        passport: Equipment model passport dict as stored in the DB.
            Must contain ``channels`` list with per-channel metadata.

    Returns:
        Flat dict mapping feature_name -> float.
        Missing channels are silently ignored (not filled); the returned
        dict covers only channels present in the window.

    Notes:
        The function is deliberately side-effect-free and does not access
        any external state.  It is used both in the offline training
        pipeline and can be called from unit tests.
    """
    # Build channel metadata lookup: code -> channel dict
    ch_meta: dict[str, dict] = {ch["code"]: ch for ch in passport.get("channels", [])}

    # Group values by channel, preserving insertion order (== time order)
    by_channel: dict[str, list[float]] = {}
    for row in telemetry_window:
        code = row.get("channel_code", "")
        val = row.get("value")
        if code and val is not None:
            try:
                by_channel.setdefault(code, []).append(float(val))
            except (TypeError, ValueError):
                pass

    features: dict[str, float] = {}

    for code, values in by_channel.items():
        if not values:
            continue

        arr = np.array(values, dtype=float)
        ch = ch_meta.get(code, {})
        ch_class = ch.get("class", "")
        nominal = ch.get("nominal", 0.0)
        op_range: list[float] = ch.get("operating_range", [0.0, 1.0])
        crit_range: list[float] = ch.get("critical_range", [float("-inf"), float("inf")])

        # Protect against degenerate ranges
        op_low = float(op_range[0])
        op_high = float(op_range[1])
        op_width = max(1.0, abs(op_high - op_low))
        crit_low = float(crit_range[0])
        crit_high = float(crit_range[1])

        mean_val = float(np.mean(arr))
        p = code  # prefix alias

        # --- Statistical features ---
        features[f"{p}__mean"] = mean_val
        features[f"{p}__std"] = float(np.std(arr, ddof=0))
        features[f"{p}__min"] = float(np.min(arr))
        features[f"{p}__max"] = float(np.max(arr))
        features[f"{p}__median"] = float(np.median(arr))
        features[f"{p}__skew"] = _skew(arr)
        features[f"{p}__kurt"] = _kurtosis(arr)
        features[f"{p}__slope"] = _slope(arr)
        features[f"{p}__last"] = float(arr[-1])

        # --- Contextual features (relative to passport) ---
        features[f"{p}__dev_from_nominal"] = (mean_val - nominal) / op_width
        features[f"{p}__time_above_op"] = float(np.mean(arr > op_high))
        features[f"{p}__time_below_op"] = float(np.mean(arr < op_low))

        # Critical range fraction: fraction of points falling in the critical band.
        # Critical range is defined as the dangerous zone — may be above or below
        # the operating range depending on the channel.
        if crit_high > crit_low:
            features[f"{p}__in_critical"] = float(np.mean((arr >= crit_low) & (arr <= crit_high)))
        else:
            # Inverted critical (e.g. fan RPM where critical is [0, 1500])
            features[f"{p}__in_critical"] = float(np.mean(arr <= crit_high))

        # --- Spectral features for V-class channels ---
        if ch_class == "V":
            # Assume 1 Hz equivalent spacing when exact timestamps are absent.
            # In production the backend should pass the actual sample rate.
            fft_low, fft_mid, fft_high, fft_peak = _fft_bands(arr, sample_rate_hz=1.0)
            features[f"{p}__fft_low"] = fft_low
            features[f"{p}__fft_mid"] = fft_mid
            features[f"{p}__fft_high"] = fft_high
            features[f"{p}__fft_peak"] = fft_peak

    # --- Cross-channel correlations ---
    # Correlate T-V, T-F, E-F pairs.
    # Only compute when both channels have the same number of samples.
    class_map: dict[str, list[str]] = {}
    for code in by_channel:
        ch_class = ch_meta.get(code, {}).get("class", "")
        if ch_class:
            class_map.setdefault(ch_class, []).append(code)

    pair_classes = [("T", "V"), ("T", "F"), ("E", "F")]
    for cls_a, cls_b in pair_classes:
        codes_a = class_map.get(cls_a, [])
        codes_b = class_map.get(cls_b, [])
        for ca in codes_a:
            for cb in codes_b:
                arr_a = np.array(by_channel[ca], dtype=float)
                arr_b = np.array(by_channel[cb], dtype=float)
                min_len = min(len(arr_a), len(arr_b))
                if min_len < 4:
                    continue
                arr_a = arr_a[:min_len]
                arr_b = arr_b[:min_len]
                std_a = float(np.std(arr_a))
                std_b = float(np.std(arr_b))
                if std_a < 1e-12 or std_b < 1e-12:
                    corr = 0.0
                else:
                    corr = float(np.corrcoef(arr_a, arr_b)[0, 1])
                    if not np.isfinite(corr):
                        corr = 0.0
                features[f"corr_{ca}_{cb}"] = corr

    return features


# ---------------------------------------------------------------------------
# Public API — inference-time vector assembly
# ---------------------------------------------------------------------------

def build_feature_vector(
    features: dict[str, float],
    feature_names: list[str],
) -> np.ndarray:
    """Assemble an ordered numpy array from a named feature dict.

    Missing feature names are filled with 0.0.  Extra keys in ``features``
    that are not in ``feature_names`` are silently ignored.

    Args:
        features: Named feature dict as received in PredictRequest.features.
        feature_names: Ordered list of feature names as stored in the model bundle.

    Returns:
        2-D numpy array of shape (1, len(feature_names)) with dtype float64.
    """
    vec = np.array(
        [features.get(name, 0.0) for name in feature_names],
        dtype=np.float64,
    ).reshape(1, -1)
    return vec
