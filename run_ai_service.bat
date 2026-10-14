@echo off
echo ========================================================
echo Starting MedChain AI Summarizer (FastAPI on Port 8001)
echo ========================================================
cd ai-service
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
pause
