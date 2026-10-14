@echo off
title MedChain Master Launcher
echo ========================================================
echo        STARTING ALL MEDCHAIN SERVICES AUTOMATICALLY     
echo ========================================================
echo.

:: 1. Start Anvil Blockchain in a new window
echo [1/4] Launching Anvil local blockchain...
start "MedChain [1] - Anvil Blockchain (8545)" cmd /k "anvil --chain-id 31337 --port 8545"

:: Wait 3 seconds for Anvil to start up
echo Waiting for Anvil to initialize...
timeout /t 3 /nobreak >nul

:: 2. Deploy the smart contract
echo.
echo [2/4] Deploying MedChain Smart Contract to Anvil...
call forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

:: 3. Start Backend API
echo.
echo [3/4] Launching FastAPI Backend (:8000)...
start "MedChain [2] - Backend API (8000)" cmd /k "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

:: 4. Start AI Summarizer Service
echo.
echo [4/4] Launching AI Summarizer Service (:8001)...
start "MedChain [3] - AI Service (8001)" cmd /k "cd ai-service && python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"

:: 5. Start Frontend
echo.
echo [5/5] Launching React / Vite Frontend (:5173)...
start "MedChain [4] - React Frontend (5173)" cmd /k "cd frontend && npm run dev"

:: Wait 2 seconds and open browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo   ALL SERVICES ARE RUNNING!
echo   - Anvil:       http://127.0.0.1:8545
echo   - Backend:     http://127.0.0.1:8000
echo   - AI Service:  http://127.0.0.1:8001
echo   - Frontend:    http://localhost:5173
echo ========================================================
echo.
echo You can keep this window open or close it.
pause
