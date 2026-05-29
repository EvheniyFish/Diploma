$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Warning "Created .env from .env.example. Change ADMIN_API_KEY and INGEST_API_KEY before production use."
}

docker compose up --build -d

Write-Host "CASS is starting:"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3000/api/v1/healthz"
Write-Host "Logs:     docker compose logs -f"

Pop-Location
