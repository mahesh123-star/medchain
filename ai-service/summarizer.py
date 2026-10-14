"""
Summarizer module — tries AI providers in priority order, falls back to
local extractive summarisation when no API key is available.
"""
from __future__ import annotations

import os
import re
import textwrap
from typing import Tuple

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a medical report summarizer assistant.
Given a medical report text, produce a structured summary with the following sections:
- Patient Overview (if identifiable — skip if no patient info present)
- Key Findings
- Medications (list them if mentioned)
- Important Dates / Lab Values / Measurements
- Recommendations or Next Steps (if mentioned)

Rules:
- Be concise and accurate.
- Do NOT invent or infer diagnoses, medications, or facts not present in the text.
- If a section has no relevant information, write "Not mentioned in this report."
- If the text is empty, too short, or garbled, state that the report could not be processed.
- Do not repeat the disclaimer at the end — it will be added automatically.
"""

MAX_TEXT_CHARS = 12_000  # Truncate very large inputs to avoid excess token usage


async def summarize(text: str) -> Tuple[str, str]:
    """
    Returns (summary_text, provider_name).
    Tries OpenAI → Gemini → local extractive.
    """
    if not text or not text.strip():
        return "The provided document is empty or contains no readable text.", "none"

    truncated = text[:MAX_TEXT_CHARS]

    if OPENAI_API_KEY:
        result = await _summarize_openai(truncated)
        if result:
            return result, "openai"

    if GEMINI_API_KEY:
        result = await _summarize_gemini(truncated)
        if result:
            return result, "gemini"

    return _extractive_summary(truncated), "local-extractive"


# ─── OpenAI ──────────────────────────────────────────────────────────────────

async def _summarize_openai(text: str) -> str | None:
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Medical report:\n\n{text}"},
            ],
            max_tokens=800,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        print(f"OpenAI error: {exc}")
        return None


# ─── Google Gemini ────────────────────────────────────────────────────────────

async def _summarize_gemini(text: str) -> str | None:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = SYSTEM_PROMPT + f"\n\nMedical report:\n\n{text}"
        resp = await model.generate_content_async(prompt)
        return resp.text.strip()
    except Exception as exc:
        print(f"Gemini error: {exc}")
        return None


# ─── Local Extractive Fallback ────────────────────────────────────────────────

def _extractive_summary(text: str) -> str:
    """
    Simple extractive summariser:
    - Splits into sentences.
    - Scores by keyword relevance.
    - Returns top sentences grouped into sections.
    """
    MEDICAL_KEYWORDS = [
        "diagnosis", "diagnos", "patient", "result", "test", "blood",
        "pressure", "glucose", "level", "mg", "ml", "mmol", "mg/dl",
        "normal", "abnormal", "elevated", "low", "high", "medication",
        "prescribed", "treatment", "recommend", "follow", "appointment",
        "surgery", "procedure", "scan", "mri", "ct", "x-ray", "biopsy",
        "report", "findings", "impression", "conclusion",
    ]

    sentences = re.split(r'(?<=[.!?])\s+', text)
    scored = []
    for s in sentences:
        s = s.strip()
        if len(s) < 20:
            continue
        score = sum(1 for kw in MEDICAL_KEYWORDS if kw.lower() in s.lower())
        scored.append((score, s))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [s for _, s in scored[:8]]

    if not top:
        return "No significant medical content could be extracted from the provided text."

    summary_lines = [
        "**Key Findings (Extractive Summary)**",
        "",
        *[f"• {s}" for s in top[:4]],
        "",
        "**Additional Information**",
        "",
        *[f"• {s}" for s in top[4:]],
        "",
        "_Note: This is a local extractive summary. Configure OPENAI_API_KEY or GEMINI_API_KEY_",
        "_in the ai-service .env file for AI-powered structured summaries._",
    ]

    return "\n".join(summary_lines)
