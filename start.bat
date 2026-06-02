@echo off
cd /d "%~dp0"
set "BUNDLED_NODE=C:\Users\tomas\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" server.mjs
) else (
  node server.mjs
)
