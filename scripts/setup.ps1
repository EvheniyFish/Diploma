$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "Installing backend dependencies..."
Push-Location "$Root\backend"
npm ci
Pop-Location

Write-Host "Installing simulator dependencies..."
Push-Location "$Root\simulator"
npm ci
Pop-Location

Write-Host "Installing frontend dependencies..."
Push-Location "$Root\frontend"
npm ci
Pop-Location

$Python = Get-Command python -ErrorAction SilentlyContinue
if ($Python) {
  Write-Host "Creating Python virtual environment for ml_service..."
  Push-Location "$Root\ml_service"
  python -m venv .venv
  & ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
  & ".\.venv\Scripts\pip.exe" install -r requirements.txt
  Pop-Location
} else {
  Write-Warning "Python was not found. Install Python 3.11 to run ml_service locally."
}

Write-Host "Setup complete."
