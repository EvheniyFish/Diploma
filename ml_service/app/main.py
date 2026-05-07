from fastapi import FastAPI, HTTPException
from .schemas import PredictRequest, PredictResponse, HealthResponse
from .inference import predict
from .registry import registry

app = FastAPI(title="CASS ML Service", version="1.0.0")


@app.get("/healthz", response_model=HealthResponse)
def healthz():
    return HealthResponse(status="ok", models_loaded=list(registry.loaded()))


@app.post("/predict", response_model=PredictResponse)
def predict_endpoint(req: PredictRequest):
    try:
        return predict(req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
