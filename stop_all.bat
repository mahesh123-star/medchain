@echo off
title MedChain Shutdown
echo ========================================================
echo        STOPPING ALL MEDCHAIN SERVICES
echo ========================================================
echo.

echo Terminating Anvil...
taskkill /F /IM anvil.exe 2>nul

echo Terminating Python Uvicorn servers...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq MedChain*" 2>nul

echo Terminating Node / Vite frontend...
taskkill /F /IM node.exe 2>nul

echo.
echo All MedChain processes stopped.
pause
