"""
IPFS Service — uploads encrypted files to Pinata and retrieves them.
Pinata credentials are NEVER exposed to the browser.
Includes fallback simulated local storage if PINATA_JWT is not configured,
ensuring offline testing and prototype evaluation can succeed immediately.
"""
from __future__ import annotations

import os
import hashlib
import base64
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter()

PINATA_JWT = os.getenv("PINATA_JWT", "").strip()
PINATA_GATEWAY = os.getenv("PINATA_GATEWAY", "https://gateway.pinata.cloud")
MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB

# Local cache for offline simulation
_local_ipfs_cache: dict[str, bytes] = {}


class UploadResponse(BaseModel):
    cid: str
    gateway_url: str
    mode: str = "pinata"


# ─── Upload ──────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_encrypted_file(
    file: UploadFile = File(...),
    record_name: str = Form(...),
):
    """
    Accepts an already-encrypted binary blob from the frontend and pins it
    to IPFS via Pinata. The file was encrypted with AES-256-GCM in browser.
    """
    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_FILE_BYTES // 1024 // 1024} MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if not PINATA_JWT:
        # Fallback simulation: Generate pseudo IPFS CID (Qm + sha256 base58-like prefix)
        digest = hashlib.sha256(content).digest()
        simulated_cid = "Qm" + hashlib.sha256(digest).hexdigest()[:44]
        _local_ipfs_cache[simulated_cid] = content
        print(f"[IPFS Mock] Stored {record_name} locally under simulated CID: {simulated_cid}")
        return UploadResponse(
            cid=simulated_cid,
            gateway_url=f"/ipfs/retrieve/{simulated_cid}",
            mode="simulated_local",
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                headers={"Authorization": f"Bearer {PINATA_JWT}"},
                files={"file": (record_name + ".enc", content, "application/octet-stream")},
                data={"pinataMetadata": f'{{"name": "{record_name}"}}'},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Pinata upload failed: {exc.response.status_code} {exc.response.text}",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Network error: {exc}") from exc

    cid = resp.json()["IpfsHash"]
    _local_ipfs_cache[cid] = content
    return UploadResponse(
        cid=cid,
        gateway_url=f"{PINATA_GATEWAY}/ipfs/{cid}",
        mode="pinata",
    )


# ─── Retrieve ─────────────────────────────────────────────────────────────────

@router.get("/retrieve/{cid}")
async def retrieve_encrypted_file(cid: str):
    """
    Fetches an encrypted file from IPFS via Pinata gateway (or local cache).
    Returns raw bytes. The frontend decrypts using the key delivered by /keys.
    """
    if not cid or len(cid) > 128:
        raise HTTPException(status_code=400, detail="Invalid CID")

    # Check local cache first (works offline or for cached items)
    if cid in _local_ipfs_cache:
        return Response(content=_local_ipfs_cache[cid], media_type="application/octet-stream")

    url = f"{PINATA_GATEWAY}/ipfs/{cid}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"IPFS retrieval failed: {exc.response.status_code}",
            ) from exc
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Network error: {exc}") from exc

    return Response(content=resp.content, media_type="application/octet-stream")
