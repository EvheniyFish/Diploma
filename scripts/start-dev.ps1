$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$AdminKey = if ($env:ADMIN_API_KEY) { $env:ADMIN_API_KEY } else { "dev-admin-key" }
$IngestKey = if ($env:INGEST_API_KEY) { $env:INGEST_API_KEY } else { "dev-ingest-key" }

Push-Location "$Root\backend"
$env:ADMIN_API_KEY = $AdminKey
$env:INGEST_API_KEY = $IngestKey
node src\db\seed.js
Pop-Location

Write-Host "Starting CASS services. Close the opened PowerShell windows to stop them."

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; `$env:ADMIN_API_KEY='$AdminKey'; `$env:INGEST_API_KEY='$IngestKey'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\simulator'; `$env:BACKEND_URL='http://localhost:3000'; `$env:INGEST_API_KEY='$IngestKey'; npm start"

if (Test-Path "$Root\ml_service\.venv\Scripts\Activate.ps1") {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\ml_service'; . .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 127.0.0.1 --port 8000"
} else {
  Write-Warning "ml_service venv not found; skipping ML service. Run scripts\setup.ps1 after installing Python 3.11."
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend'; npm run dev"

Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3000/api/v1/healthz"
