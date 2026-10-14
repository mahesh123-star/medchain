# MedChain Master PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       STARTING ALL MEDCHAIN SERVICES (PowerShell)      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Anvil
Write-Host "`n[1/5] Launching Anvil local blockchain..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "anvil --chain-id 31337 --port 8545"

# Wait for Anvil to initialize
Start-Sleep -Seconds 3

# 2. Deploy Contract
Write-Host "`n[2/5] Deploying MedChain Smart Contract to Anvil..." -ForegroundColor Green
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 3. Start Backend
Write-Host "`n[3/5] Launching FastAPI Backend (:8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

# 4. Start AI Service
Write-Host "`n[4/5] Launching AI Summarizer Service (:8001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ai-service; python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"

# 5. Start Frontend
Write-Host "`n[5/5] Launching React / Vite Frontend (:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

# Wait 2 seconds and open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  ALL SERVICES ARE RUNNING!" -ForegroundColor Green
Write-Host "  - Anvil:       http://127.0.0.1:8545"
Write-Host "  - Backend:     http://127.0.0.1:8000"
Write-Host "  - AI Service:  http://127.0.0.1:8001"
Write-Host "  - Frontend:    http://localhost:5173"
Write-Host "========================================================`n" -ForegroundColor Cyan
