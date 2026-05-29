# CASS - Condition-based Anomaly & Signature System

CASS is a predictive maintenance demo platform with a Fastify API, SQLite storage, FastAPI ML service, Node.js telemetry simulator, and Vue frontend.

## Services

| Service | Stack | Default URL |
| --- | --- | --- |
| Frontend | Vue 3, Vite, Nginx in Docker | http://localhost:5173 |
| Backend API | Node.js 20, Fastify, SQLite | http://localhost:3000/api/v1 |
| ML service | Python 3.11, FastAPI, scikit-learn | internal in Docker, http://localhost:8000 locally |
| Simulator | Node.js 20 | internal control API on 3001 |

## Fastest Start: Docker

Requirements:

- Docker Desktop on Windows/macOS, or Docker Engine + Compose on Linux.

```bash
cp .env.example .env
docker compose up --build -d
docker compose logs -f
```

Open:

```text
http://localhost:5173
```

Useful commands:

```bash
docker compose ps
docker compose logs -f backend
docker compose down
docker compose down -v   # also removes the SQLite volume
```

The backend container seeds the demo database automatically on first start. The seed is idempotent and skips when models already exist.

## Windows Local Development

Requirements:

- Node.js 20 LTS
- Python 3.11, optional but needed for the ML service
- PowerShell

Install dependencies:

```powershell
cd D:\PersonalProjects\CASS
.\scripts\setup.ps1
```

Start all local dev services:

```powershell
.\scripts\start-dev.ps1
```

The script opens separate PowerShell windows for backend, simulator, frontend, and ML service when the Python virtual environment exists.

Manual Windows start:

```powershell
cd D:\PersonalProjects\CASS\backend
npm ci
node src\db\seed.js
npm run dev
```

```powershell
cd D:\PersonalProjects\CASS\simulator
npm ci
npm start
```

```powershell
cd D:\PersonalProjects\CASS\frontend
npm ci
npm run dev
```

```powershell
cd D:\PersonalProjects\CASS\ml_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Linux/macOS Local Development

Requirements:

- Node.js 20 LTS
- Python 3.11, optional but needed for the ML service

```bash
cd /path/to/CASS
chmod +x scripts/*.sh
./scripts/setup.sh
./scripts/start-dev.sh
```

Manual Linux/macOS start uses the same service order:

```bash
cd backend && npm ci && node src/db/seed.js && npm run dev
cd simulator && npm ci && npm start
cd frontend && npm ci && npm run dev
cd ml_service && python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Environment

Copy `.env.example` to `.env` for Docker Compose:

```env
ADMIN_API_KEY=change-me-admin
INGEST_API_KEY=change-me-ingest
FRONTEND_PORT=5173
BACKEND_PORT=3000
CORS_ORIGIN=http://localhost:5173
```

For production-like use, change both API keys. The frontend currently sends `VITE_ADMIN_KEY` when configured for local development, so do not expose a real admin key in a public client build without adding a proper login/session layer.
In Docker, `ADMIN_API_KEY` is passed into the frontend build as `VITE_ADMIN_KEY`; rebuild the frontend image after changing `.env`:

```bash
docker compose up --build -d frontend backend
```

## Health Check

```bash
curl -H "x-api-key: dev-admin-key" http://localhost:3000/api/v1/healthz
```

Expected without ML:

```json
{"status":"ok","db":"ok","ml":"unavailable"}
```

Expected with ML running:

```json
{"status":"ok","db":"ok","ml":"ok"}
```
