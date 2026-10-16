"""
Summarizer module — parses PDF bytes or raw text, extracts clean clinical
content using PyPDF and NLP regex cleaning, then summarizes using OpenAI,
Gemini, or a high-quality local clinical extractive summarizer.
"""
from __future__ import annotations

import io
import os
import re
import base64
from typing import Tuple, Optional
from pypdf import PdfReader

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── System prompt for LLM providers ──────────────────────────────────────────

SYSTEM_PROMPT = """You are a medical report summarizer assistant.
Analyze the provided medical report and generate a concise, professional summary in plain words with the following sections:
- Patient & Exam Overview
- Vital Signs & Observations
- Key Diagnostic Findings
- Current Medications
- Assessment & Recommendations

Rules:
- Output only natural language words and clear bullet points.
- Do NOT output raw PDF markers, stream tokens, brackets, or code.
- Do NOT invent diagnoses or facts not in the text.
- If a section is not mentioned, state "None recorded".
"""

MAX_TEXT_CHARS = 12_000


def extract_clean_text(raw_text: str = "", pdf_base64: Optional[str] = None) -> str:
    """
    Extracts pure human-readable text from either a Base64 PDF or raw text stream.
    Strips all PDF structural tokens, object definitions, and PostScript commands.
    """
    extracted_text = ""

    # 1. Try decoding from Base64 PDF bytes first
    if pdf_base64 and pdf_base64.strip():
        try:
            pdf_bytes = base64.b64decode(pdf_base64.strip())
            reader = PdfReader(io.BytesIO(pdf_bytes))
            pages = []
            for p in reader.pages:
                t = p.extract_text()
                if t:
                    pages.append(t)
            extracted_text = "\n".join(pages).strip()
        except Exception as e:
            print("Failed to parse base64 PDF with pypdf:", e)

    # 2. If no text yet and raw_text starts with PDF header or contains PDF stream markers
    if not extracted_text and raw_text:
        if "%PDF-" in raw_text or "stream" in raw_text or "endobj" in raw_text:
            try:
                # Try parsing raw_text as latin-1 bytes
                pdf_bytes = raw_text.encode("latin1", errors="ignore")
                reader = PdfReader(io.BytesIO(pdf_bytes))
                pages = []
                for p in reader.pages:
                    t = p.extract_text()
                    if t:
                        pages.append(t)
                extracted_text = "\n".join(pages).strip()
            except Exception:
                pass

            # If pypdf couldn't read the stream, use regex to pull text inside parenthesis: (Text) Tj or (Text) '
            if not extracted_text:
                matches = re.findall(r"\((.*?)\)\s*(?:Tj|'|\")", raw_text)
                cleaned = []
                for m in matches:
                    line = m.replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\").strip()
                    if line and not line.startswith("%") and not line.startswith("---"):
                        cleaned.append(line)
                if cleaned:
                    extracted_text = "\n".join(cleaned)

        if not extracted_text:
            extracted_text = raw_text

    # 3. Clean any remaining PDF artifacts and formatting noise
    cleaned_lines = []
    for line in extracted_text.splitlines():
        line = line.strip()
        # Skip PDF syntax lines
        if not line:
            continue
        if re.match(r"^(%PDF|\d+\s+\d+\s+obj|<<|>>|endobj|stream|endstream|xref|trailer|startxref|%%EOF|BT|ET|\d+\s+TL|/F\d+)", line):
            continue
        # Remove trailing PDF string markers like ") '" or ") Tj"
        line = re.sub(r"^\(|\)\s*['\"]?$|\)\s*Tj$", "", line).strip()
        if line and len(line) > 1:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


async def summarize(raw_text: str = "", pdf_base64: Optional[str] = None) -> Tuple[str, str]:
    """
    Returns (summary_in_words, provider_name).
    """
    clean_text = extract_clean_text(raw_text, pdf_base64)
    if not clean_text or len(clean_text.strip()) < 10:
        return "The provided document contains no readable clinical text.", "none"

    truncated = clean_text[:MAX_TEXT_CHARS]

    # Try OpenAI
    if OPENAI_API_KEY:
        res = await _summarize_openai(truncated)
        if res:
            return res, "openai"

    # Try Gemini
    if GEMINI_API_KEY:
        res = await _summarize_gemini(truncated)
        if res:
            return res, "gemini"

    # High quality local clinical extractive summarizer
    return _extractive_clinical_summary(clean_text), "local-extractive"


async def _summarize_openai(text: str) -> Optional[str]:
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


async def _summarize_gemini(text: str) -> Optional[str]:
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


def _extractive_clinical_summary(text: str) -> str:
    """
    Parses clean medical text into structured words without any raw code or PDF artifacts.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]

    patient_info = []
    vitals = []
    findings = []
    meds = []
    plan = []

    current_section = "findings"

    for line in lines:
        lower = line.lower()

        # Classify sections based on medical headers
        if any(k in lower for k in ["patient name", "date of birth", "sex:", "exam date", "ordering physician", "cardiologist", "radiologist"]):
            patient_info.append(line)
        elif any(k in lower for k in ["vital signs", "blood pressure", "heart rate", "pulse", "spo2", "temperature", "bmi"]):
            vitals.append(line)
        elif any(k in lower for k in ["medication", "prescribed", "lisinopril", "metformin", "aspirin", "atorvastatin", "multivitamin"]):
            meds.append(line)
        elif any(k in lower for k in ["plan", "recommend", "impression", "assessment", "follow-up", "holter", "dietary", "lifestyle"]):
            plan.append(line)
        elif any(k in lower for k in ["test name", "glucose", "cholesterol", "ecg", "echocardiogram", "mri", "findings", "triglycerides", "hba1c"]):
            findings.append(line)
        else:
            # Add to findings if it contains clinical keywords
            if any(k in lower for k in ["normal", "abnormal", "elevated", "high", "low", "lvef", "ventricular", "atrial", "infarction", "syndrome"]):
                findings.append(line)

    # Format cleanly into words and bullet points
    summary_parts = ["### Clinical Medical Summary (In Words)\n"]

    if patient_info:
        summary_parts.append("**Patient & Service Overview:**")
        for p in patient_info[:3]:
            # Clean separators
            clean_p = p.replace("--------------------------------------------------------------------------------", "").strip()
            if clean_p:
                summary_parts.append(f"- {clean_p}")
        summary_parts.append("")

    if vitals:
        summary_parts.append("**Vital Signs & Measurements:**")
        for v in vitals[:3]:
            clean_v = v.replace('VITAL SIGNS:', '').strip()
            if clean_v:
                summary_parts.append(f"- {clean_v}")
        summary_parts.append("")

    if findings:
        summary_parts.append("**Key Diagnostic Findings:**")
        for f in findings[:5]:
            clean_f = re.sub(r"^\d+[\.\)]\s*", "", f).strip()
            if clean_f and not clean_f.startswith("---") and not clean_f == "DIAGNOSTIC FINDINGS:":
                summary_parts.append(f"- {clean_f}")
        summary_parts.append("")

    if meds:
        summary_parts.append("**Medications:**")
        for m in meds[:4]:
            clean_m = re.sub(r"^CURRENT MEDICATIONS:|\-|\*|^\d+[\.\)]", "", m).strip()
            if clean_m:
                summary_parts.append(f"- {clean_m}")
        summary_parts.append("")

    if plan:
        summary_parts.append("**Clinical Assessment & Plan:**")
        for pl in plan[:4]:
            clean_pl = re.sub(r"^(ASSESSMENT & PLAN:|CLINICAL IMPRESSION & RECOMMENDATIONS:|\d+[\.\)]|\-)", "", pl).strip()
            if clean_pl:
                summary_parts.append(f"- {clean_pl}")
        summary_parts.append("")

    # If parsing couldn't isolate sections, provide top clean sentences
    if len(summary_parts) <= 2:
        summary_parts.append("**Key Clinical Notes:**")
        for l in lines[:6]:
            if len(l) > 15 and not l.startswith("%"):
                summary_parts.append(f"- {l}")
        summary_parts.append("")

    summary_parts.append("_Generated via local clinical extraction. Configure OPENAI_API_KEY in ai-service/.env for generative LLM summaries._")
    return "\n".join(summary_parts)
