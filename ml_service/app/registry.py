import logging
from pathlib import Path
from typing import Optional

import joblib

from .config import config

logger = logging.getLogger(__name__)


class ModelRegistry:
    """Thread-safe lazy model registry with heuristic fallback.

    On cache miss, attempts to load a .pkl bundle from MODELS_DIR.
    If no bundle exists for a model_code, returns None so the caller
    can fall back to the heuristic predictor.
    """

    def __init__(self) -> None:
        self._cache: dict[str, dict] = {}

    def preload_all(self) -> None:
        """Load all .pkl files found in MODELS_DIR into memory cache at startup."""
        models_dir = config.MODELS_DIR
        if not models_dir.exists():
            logger.warning("MODELS_DIR %s does not exist — no models preloaded", models_dir)
            return

        for pkl_path in sorted(models_dir.glob("*.pkl")):
            model_code = pkl_path.stem
            try:
                bundle = joblib.load(pkl_path)
                self._cache[model_code] = bundle
                version = bundle.get("version", "unknown")
                logger.info("Preloaded model bundle: %s  version=%s", model_code, version)
            except Exception:
                logger.exception("Failed to load model bundle from %s — skipping", pkl_path)

    def get(self, model_code: str) -> Optional[dict]:
        """Return model bundle for model_code, or None if not found.

        First checks in-memory cache, then attempts disk load.
        Does NOT raise — returns None to trigger heuristic fallback.
        """
        if model_code in self._cache:
            return self._cache[model_code]

        pkl_path = config.MODELS_DIR / f"{model_code}.pkl"
        if not pkl_path.exists():
            logger.debug("No .pkl bundle found for model_code=%s — heuristic fallback will be used", model_code)
            return None

        try:
            bundle = joblib.load(pkl_path)
            self._cache[model_code] = bundle
            logger.info("Lazy-loaded model bundle: %s  version=%s", model_code, bundle.get("version", "unknown"))
            return bundle
        except Exception:
            logger.exception("Failed to load model bundle %s — heuristic fallback will be used", pkl_path)
            return None

    def loaded(self) -> list[str]:
        """Return list of model codes currently in memory cache."""
        return list(self._cache.keys())

    def versions(self) -> dict[str, str]:
        """Return mapping model_code -> version string for cached models."""
        return {code: bundle.get("version", "unknown") for code, bundle in self._cache.items()}


registry = ModelRegistry()
