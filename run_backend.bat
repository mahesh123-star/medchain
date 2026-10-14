@echo off
echo ========================================================
echo Starting MedChain Backend (FastAPI on Port 8000)
echo ========================================================
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
