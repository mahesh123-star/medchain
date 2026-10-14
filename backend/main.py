"""
MedChain Backend — Main FastAPI application.
Handles encrypted IPFS uploads and secure AES key delivery.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import ipfs, keys  # noqa: E402  (after load_dotenv)


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("MedChain backend starting up…")
    yield
    print("MedChain backend shutting down.")


app = FastAPI(
    title="MedChain Backend",
    description="Encrypted IPFS storage and secure key delivery for MedChain.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CORS_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ipfs.router, prefix="/ipfs", tags=["IPFS"])
app.include_router(keys.router, prefix="/keys", tags=["Keys"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "medchain-backend"}
