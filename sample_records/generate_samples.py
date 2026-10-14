"""
Generates synthetic medical report PDFs for testing MedChain.
Pure Python — no external PDF generation libraries required.
Creates valid PDF 1.4 documents containing realistic clinical text.
"""
import os

def create_pdf(filename: str, title: str, lines: list[str]):
    # Form PDF objects
    content_stream = "BT\n/F1 16 Tf\n50 750 Td\n(" + title.replace("(", "\(").replace(")", "\)") + ") Tj\nET\n"
    content_stream += "BT\n/F2 10 Tf\n50 720 Td\n15 TL\n"
    for line in lines:
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content_stream += f"({escaped}) '\n"
    content_stream += "ET\n"

    stream_bytes = content_stream.encode("latin1")
    stream_len = len(stream_bytes)

    objects = []
    # 1: Catalog
    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    # 2: Pages
    objects.append(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n")
    # 3: Page
    objects.append(b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n")
    # 4: Contents
    objects.append(f"4 0 obj\n<< /Length {stream_len} >>\nstream\n".encode("latin1") + stream_bytes + b"endstream\nendobj\n")
    # 5: Font F1 (Bold title)
    objects.append(b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")
    # 6: Font F2 (Body)
    objects.append(b"6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")

    # Assemble PDF with cross-reference table
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = b""
    xref = [0]
    offset = len(header)

    for obj in objects:
        xref.append(offset)
        body += obj
        offset += len(obj)

    xref_pos = len(header) + len(body)
    xref_table = f"xref\n0 {len(xref)}\n0000000000 65535 f \n".encode("latin1")
    for pos in xref[1:]:
        xref_table += f"{pos:010d} 00000 n \n".encode("latin1")

    trailer = f"trailer\n<< /Size {len(xref)} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin1")

    with open(filename, "wb") as f:
        f.write(header + body + xref_table + trailer)
    print(f"Generated {filename}")

if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))

    # 1. Comprehensive Metabolic & Lipid Panel
    create_pdf(
        os.path.join(out_dir, "sample_blood_test.pdf"),
        "METROPOLITAN GENERAL HOSPITAL - LAB REPORT",
        [
            "Patient Name: John Doe (SYNTHETIC RECORD FOR TESTING)",
            "Date of Birth: 1985-04-12 | Sex: Male | Date of Service: 2026-10-10",
            "Ordering Physician: Dr. Sarah Jenkins, MD | Specimen: Venous Blood",
            "--------------------------------------------------------------------------------",
            "TEST NAME                      RESULT       REFERENCE INTERVAL   FLAG",
            "--------------------------------------------------------------------------------",
            "Fasting Blood Glucose          118 mg/dL    70 - 99 mg/dL        HIGH",
            "Hemoglobin A1c (HbA1c)         6.2 %        < 5.7 %              HIGH",
            "Total Cholesterol              215 mg/dL    < 200 mg/dL          HIGH",
            "Triglycerides                  185 mg/dL    < 150 mg/dL          HIGH",
            "HDL Cholesterol                 42 mg/dL    > 40 mg/dL           NORMAL",
            "LDL Cholesterol (calculated)   136 mg/dL    < 100 mg/dL          HIGH",
            "Serum Creatinine               0.95 mg/dL   0.70 - 1.30 mg/dL    NORMAL",
            "Estimated GFR (eGFR)            94 mL/min   > 60 mL/min          NORMAL",
            "Blood Urea Nitrogen (BUN)       16 mg/dL    7 - 20 mg/dL         NORMAL",
            "--------------------------------------------------------------------------------",
            "CLINICAL IMPRESSION & RECOMMENDATIONS:",
            "1. Impaired fasting glucose and elevated HbA1c consistent with pre-diabetes.",
            "2. Mild hyperlipidemia with elevated LDL and triglycerides.",
            "3. Recommend dietary lifestyle modifications, low glycemic intake, and regular exercise.",
            "4. Follow-up lipid and glycemic panel recommended in 3 months.",
            "5. Prescribed: Metformin 500mg once daily with evening meal if diet unadjusted."
        ]
    )

    # 2. Cardiology Consultation Note
    create_pdf(
        os.path.join(out_dir, "sample_cardiology_consult.pdf"),
        "CARDIOVASCULAR CARE SPECIALISTS - CONSULTATION NOTE",
        [
            "Patient Name: Alice Smith (SYNTHETIC RECORD FOR TESTING)",
            "Date of Birth: 1978-08-22 | Sex: Female | Date of Exam: 2026-10-05",
            "Cardiologist: Dr. Marcus Vance, FACC",
            "--------------------------------------------------------------------------------",
            "CHIEF COMPLAINT: Episodic palpitations and exertional fatigue for 3 weeks.",
            "",
            "VITAL SIGNS:",
            "Blood Pressure: 138/84 mmHg | Heart Rate: 78 bpm (regular) | SpO2: 98% room air",
            "",
            "DIAGNOSTIC FINDINGS:",
            "1. Electrocardiogram (ECG): Normal sinus rhythm with rare premature atrial complexes.",
            "2. Transthoracic Echocardiogram (TTE):",
            "   - Left ventricular ejection fraction (LVEF): 60-65% (Preserved).",
            "   - No regional wall motion abnormalities.",
            "   - Trace mitral regurgitation, hemodynamically insignificant.",
            "",
            "CURRENT MEDICATIONS:",
            "- Lisinopril 10 mg orally once daily",
            "- Multivitamin daily",
            "",
            "ASSESSMENT & PLAN:",
            "1. Benign premature atrial contractions in setting of mild work-related stress.",
            "2. Blood pressure borderline controlled on Lisinopril 10 mg.",
            "3. Discontinue excess caffeine; maintain hydration.",
            "4. 48-hour Holter monitor ordered to evaluate intermittent palpitation frequency.",
            "5. Return to clinic in 4 weeks for monitor review."
        ]
    )

    # 3. Brain MRI Diagnostic Report
    create_pdf(
        os.path.join(out_dir, "sample_mri_report.pdf"),
        "ADVANCED NEURO-IMAGING INSTITUTE - MRI REPORT",
        [
            "Patient Name: Robert Chen (SYNTHETIC RECORD FOR TESTING)",
            "Date of Birth: 1962-11-03 | Sex: Male | Exam Date: 2026-10-08",
            "Radiologist: Dr. Elena Rostova, MD | Clinical Indication: Recurrent Cephalea",
            "--------------------------------------------------------------------------------",
            "EXAMINATION: Magnetic Resonance Imaging (MRI) of the Brain without IV Contrast",
            "TECHNIQUE: Multiplanar T1, T2, FLAIR, DWI, and Gradient Echo sequences.",
            "",
            "FINDINGS:",
            "- Brain parenchyma demonstrates normal morphology and signal intensity.",
            "- Minimal punctate non-specific white matter hyperintensities in subcortical regions,",
            "  common and consistent with mild chronic microvascular ischemic changes of age.",
            "- No acute intracranial hemorrhage, mass effect, midline shift, or herniation.",
            "- Ventricular system and basilar cisterns are within normal limits for patient age.",
            "- Diffusion weighted imaging (DWI) reveals no evidence of acute territorial infarction.",
            "- Major intracranial vascular flow voids appear preserved.",
            "",
            "IMPRESSION:",
            "1. Unremarkable brain MRI with no acute intracranial abnormality.",
            "2. Mild chronic microvascular white matter changes, non-urgent.",
            "3. Recommend neurologist follow-up for tension vs migraine headache management."
        ]
    )
