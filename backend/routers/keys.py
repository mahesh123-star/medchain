"""
Key Service — stores and delivers AES-256-GCM keys securely.

Design:
  • When a patient uploads a record, the frontend generates an AES key and IV.
    The frontend calls POST /keys/store to hand the key to the backend.
    The backend wraps the key with a server-side secret (AES-256-GCM) and
    stores it mapped to the recordId.

  • When a patient approves a doctor's request the frontend calls
    POST /keys/grant to generate a per-grant token containing the key
    encrypted for that doctor (using the doctor's public key supplied by
    the doctor during registration or request).

  • When a doctor retrieves a record they call POST /keys/retrieve with
    their wallet signature to prove identity.  The backend verifies the
    on-chain grant is still active before returning the key.

NOTE: This is a simplified academic implementation.  In production you
would use a Hardware Security Module or a dedicated secrets manager.
"""
from __future__ import annotations

import os
import json
import hashlib
import secrets
import base64
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

router = APIRouter()

# ─── Master wrapping key (derived from env var) ───────────────────────────────
_WRAP_SECRET_HEX = os.getenv("KEY_WRAP_SECRET", "")

def _get_wrap_key() -> bytes:
    """Derive a 32-byte wrapping key from the configured secret."""
    if not _WRAP_SECRET_HEX:
        raise HTTPException(status_code=503, detail="Key service not configured: missing KEY_WRAP_SECRET")
    raw = bytes.fromhex(_WRAP_SECRET_HEX) if len(_WRAP_SECRET_HEX) == 64 else None
    if raw is None:
        # Fallback: hash the secret to get 32 bytes
        raw = hashlib.sha256(_WRAP_SECRET_HEX.encode()).digest()
    return raw


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
KEYS_FILE = os.path.join(DATA_DIR, "keys_store.json")

# Persistent key and grant store: automatically loaded from and saved to disk
_key_store: dict[str, str] = {}   # record_id → base64(wrapped_key_bundle)
_grant_store: dict[str, str] = {} # f"{record_id}:{doctor_addr}" → base64(grant_bundle)

def _load_stores():
    global _key_store, _grant_store
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(KEYS_FILE):
        try:
            with open(KEYS_FILE, "r", encoding="utf-8") as f:
                content = json.load(f)
                _key_store = content.get("keys", {})
                _grant_store = content.get("grants", {})
                print(f"[Keys Persistence] Loaded {len(_key_store)} keys and {len(_grant_store)} grants from disk.")
        except Exception as e:
            print(f"[Keys Persistence] Error loading keys: {e}")

def _save_stores():
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        with open(KEYS_FILE, "w", encoding="utf-8") as f:
            json.dump({"keys": _key_store, "grants": _grant_store}, f, indent=2)
    except Exception as e:
        print(f"[Keys Persistence] Error saving keys: {e}")

_load_stores()


def _wrap(plaintext: bytes) -> str:
    """AES-256-GCM wrap plaintext bytes; return base64 ciphertext."""
    key = _get_wrap_key()
    nonce = secrets.token_bytes(12)
    ct = AESGCM(key).encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ct).decode()


def _unwrap(b64: str) -> bytes:
    """Unwrap a previously wrapped bundle."""
    key = _get_wrap_key()
    raw = base64.b64decode(b64)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key).decrypt(nonce, ct, None)


# ─── Models ──────────────────────────────────────────────────────────────────

class StoreKeyRequest(BaseModel):
    record_id: str          # hex bytes32
    aes_key_b64: str        # base64-encoded 32-byte AES key
    iv_b64: str             # base64-encoded 12-byte IV


class GrantKeyRequest(BaseModel):
    record_id: str
    doctor_address: str     # lowercase checksummed Ethereum address
    # For this prototype the key is re-encrypted with the server wrap key
    # tagged for the specific doctor address.  In production use the
    # doctor's RSA/ECIES public key.


class RetrieveKeyRequest(BaseModel):
    record_id: str
    doctor_address: str


class KeyResponse(BaseModel):
    aes_key_b64: str
    iv_b64: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/store", status_code=201)
async def store_key(req: StoreKeyRequest):
    """
    Called by patient frontend immediately after upload.
    Wraps and stores the AES key for the given record.
    """
    bundle = json.dumps({"key": req.aes_key_b64, "iv": req.iv_b64}).encode()
    _key_store[req.record_id] = _wrap(bundle)
    _save_stores()
    return {"stored": True, "record_id": req.record_id}


@router.post("/grant", status_code=201)
async def grant_key(req: GrantKeyRequest):
    """
    Called by patient frontend when approving doctor access.
    Creates a per-grant key bundle tagged to the doctor's address.
    """
    wrapped = _key_store.get(req.record_id)
    if not wrapped:
        raise HTTPException(status_code=404, detail="Key not found for this record")

    bundle = _unwrap(wrapped)
    data = json.loads(bundle)

    # Tag the grant with the doctor address so the unwrap can verify it
    grant_bundle = json.dumps({
        "key": data["key"],
        "iv": data["iv"],
        "doctor": req.doctor_address.lower(),
        "record_id": req.record_id,
    }).encode()

    grant_key_str = f"{req.record_id}:{req.doctor_address.lower()}"
    _grant_store[grant_key_str] = _wrap(grant_bundle)
    _save_stores()
    return {"granted": True}


@router.post("/retrieve", response_model=KeyResponse)
async def retrieve_key(req: RetrieveKeyRequest):
    """
    Called by approved doctor to retrieve the decryption key.
    In production this endpoint must verify:
      1. The caller's wallet signature (EIP-712 or personal_sign).
      2. On-chain grant is still active (call hasActiveAccess on contract).
    For this prototype we trust the supplied doctor_address.
    """
    grant_key_str = f"{req.record_id}:{req.doctor_address.lower()}"
    wrapped = _grant_store.get(grant_key_str)
    if not wrapped:
        raise HTTPException(
            status_code=403,
            detail="No grant found for this doctor and record. Ensure access has been approved.",
        )

    try:
        bundle = _unwrap(wrapped)
    except Exception:
        raise HTTPException(status_code=500, detail="Key decryption failed")

    data = json.loads(bundle)

    # Verify the grant is for the requesting doctor
    if data.get("doctor") != req.doctor_address.lower():
        raise HTTPException(status_code=403, detail="Doctor address mismatch")

    return KeyResponse(aes_key_b64=data["key"], iv_b64=data["iv"])
