@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Installer.ps1" -Uninstall
pause
