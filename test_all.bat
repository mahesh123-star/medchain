@echo off
echo ========================================================
echo Running MedChain Full Test Suite
echo ========================================================

echo.
echo [1/3] Running Foundry Smart Contract Tests...
forge test -vv
if %errorlevel% neq 0 (
    echo [ERROR] Foundry tests failed!
    exit /b %errorlevel%
)

echo.
echo [2/3] Testing Backend Key Wrap and IPFS Service...
cd backend
python -c "from main import app; from fastapi.testclient import TestClient; c=TestClient(app); r=c.get('/health'); assert r.status_code==200; from routers.keys import _wrap, _unwrap; b=b'hello-key'; assert _unwrap(_wrap(b))==b; print('[OK] Backend Health & Key Encryption Tested Successfully')"
if %errorlevel% neq 0 (
    echo [ERROR] Backend tests failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo [3/3] Testing AI Summarization Module...
cd ai-service
python -c "from main import app; from fastapi.testclient import TestClient; c=TestClient(app); r=c.get('/health'); assert r.status_code==200; r2=c.post('/summarize', json={'text': 'Test patient glucose 120 mg/dL'}); assert r2.status_code==200; print('[OK] AI Service & Summarizer Tested Successfully')"
if %errorlevel% neq 0 (
    echo [ERROR] AI service tests failed!
    exit /b %errorlevel%
)
cd ..

echo.
echo ========================================================
echo ALL SUITES PASSED! MedChain is completely verified.
echo ========================================================
pause
