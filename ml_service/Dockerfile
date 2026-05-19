FROM python:3.11-slim

# System dependencies for scipy/numpy (BLAS/LAPACK)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/
COPY training/ ./training/
COPY .env .env

# Create directories that must exist at runtime
RUN mkdir -p models training_data

# Expose service port
EXPOSE 8000

# Run uvicorn; PORT env var is respected via the shell expansion below
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --log-level ${LOG_LEVEL:-info}"]
