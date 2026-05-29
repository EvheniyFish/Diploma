#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ADMIN_API_KEY="${ADMIN_API_KEY:-dev-admin-key}"
export INGEST_API_KEY="${INGEST_API_KEY:-dev-ingest-key}"

(cd "$ROOT/backend" && node src/db/seed.js)

cleanup() {
  jobs -p | xargs -r kill
}
trap cleanup EXIT INT TERM

(cd "$ROOT/backend" && npm run dev) &
(cd "$ROOT/simulator" && BACKEND_URL=http://localhost:3000 npm start) &

if [ -f "$ROOT/ml_service/.venv/bin/activate" ]; then
  (cd "$ROOT/ml_service" && . .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000) &
else
  echo "ml_service venv not found; skipping ML service. Run scripts/setup.sh after installing Python 3.11." >&2
fi

(cd "$ROOT/frontend" && npm run dev) &

echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:3000/api/v1/healthz"
wait
