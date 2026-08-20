@echo off
title NEQTA V1
cd /d "%~dp0"
if not exist node_modules (
  echo Preparando a NEQTA pela primeira vez...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
start "NEQTA Server" /min cmd /c "npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:3000/dashboard"
exit
