@echo off
setlocal
set "NODE_DIR=%~dp0..\.tools\node-v22.22.3-win-x64"
if exist "%NODE_DIR%\npm.cmd" (
  set "PATH=%NODE_DIR%;%PATH%"
  set "NPM_CMD=%NODE_DIR%\npm.cmd"
) else (
  set "NPM_CMD=npm"
)
call "%NPM_CMD%" run lint
if errorlevel 1 goto end
call "%NPM_CMD%" run typecheck
if errorlevel 1 goto end
call "%NPM_CMD%" run build
:end
pause
