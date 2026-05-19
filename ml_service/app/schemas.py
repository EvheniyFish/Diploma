from pydantic import BaseModel, Field
from typing import Optional


class PredictRequest(BaseModel):
    model_code: str = Field(..., description="Equipment model code, e.g. SRV-R740-2U")
    features: dict[str, float] = Field(..., description="Named feature vector")
    passport_hash: Optional[str] = Field(None, description="Optional passport SHA-256 hash for cache invalidation")


class FeatureContribution(BaseModel):
    name: str
    contribution: float


class PredictResponse(BaseModel):
    anomaly_score: float = Field(..., ge=0.0, le=1.0, description="Anomaly score in [0, 1]; higher = more anomalous")
    predicted_mode: Optional[str] = Field(None, description="Predicted failure mode code, or null if healthy")
    predicted_mode_conf: Optional[float] = Field(None, ge=0.0, le=1.0, description="Classifier confidence")
    rul_hours: Optional[float] = Field(None, ge=0.0, description="Predicted remaining useful life in hours")
    rul_lower_hours: Optional[float] = Field(None, ge=0.0, description="10th percentile RUL")
    rul_upper_hours: Optional[float] = Field(None, ge=0.0, description="90th percentile RUL")
    model_version: str = Field(..., description="Version tag of the model bundle used")
    explanation: dict = Field(default_factory=dict, description="Explanation payload with top feature contributions")


class HealthResponse(BaseModel):
    status: str = "ok"
    models_loaded: list[str] = Field(default_factory=list, description="Model codes currently in memory cache")


class VersionResponse(BaseModel):
    versions: dict[str, str] = Field(default_factory=dict, description="Mapping model_code -> version tag")
