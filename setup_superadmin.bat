@echo off
echo Running Superadmin Setup...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0setup_superadmin.ps1"
pause

