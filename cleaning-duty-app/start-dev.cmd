@echo off
setlocal
set "NODE_DIR=%~dp0..\.tools\node-v22.22.3-win-x64"
if exist "%NODE_DIR%\npm.cmd" (
  set "PATH=%NODE_DIR%;%PATH%"
  set "NPM_CMD=%NODE_DIR%\npm.cmd"
) else (
  set "NPM_CMD=npm"
)
echo Starting Cleaning Duty at http://127.0.0.1:3000/login
echo.
call "%NPM_CMD%" run dev -- --hostname 127.0.0.1 --port 3000
pause
