#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Change ADMIN_API_KEY and INGEST_API_KEY before production use." >&2
fi

docker compose up --build -d

echo "CASS is starting:"
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000/api/v1/healthz"
echo "Logs:     docker compose logs -f"
