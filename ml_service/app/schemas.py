from pydantic import BaseModel, Field
from typing import Optional


class PredictRequest(BaseModel):
    model_code: str
    passport_hash: str
    features: dict[str, float] = Field(description="Named feature vector")


class PredictResponse(BaseModel):
    anomaly_score: float = Field(ge=0.0, le=1.0)
    predicted_mode: Optional[str] = None
    predicted_mode_conf: Optional[float] = None
    rul_hours: Optional[float] = None
    rul_lower_hours: Optional[float] = None
    rul_upper_hours: Optional[float] = None
    model_version: str
    explanation: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str = "ok"
    models_loaded: list[str] = []
