#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing backend dependencies..."
(cd "$ROOT/backend" && npm ci)

echo "Installing simulator dependencies..."
(cd "$ROOT/simulator" && npm ci)

echo "Installing frontend dependencies..."
(cd "$ROOT/frontend" && npm ci)

if command -v python3 >/dev/null 2>&1; then
  echo "Creating Python virtual environment for ml_service..."
  (cd "$ROOT/ml_service" \
    && python3 -m venv .venv \
    && . .venv/bin/activate \
    && python -m pip install --upgrade pip \
    && pip install -r requirements.txt)
else
  echo "Python 3 was not found. Install Python 3.11 to run ml_service locally." >&2
fi

echo "Setup complete."
