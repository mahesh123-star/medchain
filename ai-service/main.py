"""
MedChain AI Summarization Service.

Accepts decrypted medical report text or base64 PDF bytes and returns
a structured clinical summary in clean words.
"""
from __future__ import annotations

import os
from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from summarizer import summarize

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("MedChain AI Service starting…")
    yield
    print("MedChain AI Service shutting down.")


app = FastAPI(
    title="MedChain AI Service",
    description="Medical report summarization — academic prototype.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummarizeRequest(BaseModel):
    text: Optional[str] = ""
    pdf_base64: Optional[str] = None


class SummarizeResponse(BaseModel):
    summary: str
    provider: str
    disclaimer: str = (
        "AI-generated summaries are for informational assistance only and are NOT "
        "a substitute for professional clinical judgment. Always consult a qualified "
        "healthcare provider for medical decisions."
    )


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_report(req: SummarizeRequest):
    summary, provider = await summarize(req.text or "", req.pdf_base64)
    return SummarizeResponse(summary=summary, provider=provider)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "medchain-ai"}
