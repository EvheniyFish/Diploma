import os
import joblib
from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent / "models"

class ModelRegistry:
    def __init__(self):
        self._cache: dict = {}

    def get(self, model_code: str):
        if model_code not in self._cache:
            path = MODELS_DIR / f"{model_code}.pkl"
            if not path.exists():
                raise KeyError(model_code)
            self._cache[model_code] = joblib.load(path)
        return self._cache[model_code]

    def loaded(self):
        return list(self._cache.keys())

registry = ModelRegistry()
