import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


_PROJECT_ROOT = Path(__file__).parent.parent


class Config:
    PORT: int = int(os.getenv("PORT", "8000"))
    # MODELS_DIR: if the env var is a relative path, resolve it relative to the
    # project root (ml_service/), not relative to the process CWD.
    _models_raw: str = os.getenv("MODELS_DIR", "./models")
    MODELS_DIR: Path = (
        Path(_models_raw)
        if Path(_models_raw).is_absolute()
        else (_PROJECT_ROOT / _models_raw).resolve()
    )
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info").upper()


config = Config()
