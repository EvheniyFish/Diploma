"""CASS ML Service — FastAPI application entry point."""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import config
from .inference import predict
from .registry import registry
from .schemas import HealthResponse, PredictRequest, PredictResponse, VersionResponse

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    stream=sys.stdout,
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CASS ML Service starting — preloading models from %s", config.MODELS_DIR)
    registry.preload_all()
    loaded = registry.loaded()
    if loaded:
        logger.info("Models in cache: %s", loaded)
    else:
        logger.info("No pre-trained models found — heuristic fallback active for all requests")
    yield
    logger.info("CASS ML Service shutting down")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="CASS ML Service",
    description=(
        "Stateless HTTP prediction microservice for the CASS predictive maintenance platform. "
        "Accepts a feature vector and returns anomaly_score, predicted_mode, and RUL with "
        "confidence intervals.  Falls back to a heuristic predictor when no trained .pkl bundle "
        "exists for the requested model_code."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/predict", response_model=PredictResponse, summary="Run prediction for a feature vector")
def predict_endpoint(req: PredictRequest) -> PredictResponse:
    """Accept a named feature vector and model_code, return prediction results.

    If no trained model bundle is found for the given model_code, the service
    automatically falls back to the heuristic predictor and returns
    ``model_version: "heuristic-v1"``.
    """
    try:
        return predict(req)
    except Exception as exc:
        logger.exception("Unexpected error during prediction for model_code=%s", req.model_code)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc


@app.get("/healthz", response_model=HealthResponse, summary="Health check")
def healthz() -> HealthResponse:
    """Return service status and list of model codes currently in memory cache."""
    return HealthResponse(status="ok", models_loaded=registry.loaded())


@app.get("/version", response_model=VersionResponse, summary="List loaded model versions")
def version_endpoint() -> VersionResponse:
    """Return a mapping of model_code -> version tag for all cached models."""
    return VersionResponse(versions=registry.versions())
