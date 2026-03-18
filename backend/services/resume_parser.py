import json
import os
from services.llm_provider import get_default_llm

RESUME_PARSE_PROMPT = """Parse this resume text and return ONLY valid JSON with:
- name: full name (string)
- email: email address (string)
- phone: phone number (string)
- years_experience: estimated total years as integer
- current_role: most recent job title (string)
- skills: array of technical skills (array of strings, max 15)
- experience: array of {company, role, duration, highlights} objects (max 4)
- notable_projects: array of project names/descriptions, max 3 (array of strings)
- education: array of degree/institution strings (array of strings)

Return ONLY the JSON object, no markdown, no code blocks."""


async def parse_resume_text(text: str) -> dict:
    llm = get_default_llm()
    result = ""
    async for chunk in llm.stream_chat(
        system_prompt=RESUME_PARSE_PROMPT,
        messages=[{"role": "user", "content": text[:6000]}],
        max_tokens=1000
    ):
        result += chunk

    result = result.strip()
    if result.startswith("```"):
        lines = result.split("\n")
        result = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        return json.loads(result)
    except json.JSONDecodeError:
        return {
            "name": "Unknown",
            "email": "",
            "phone": "",
            "years_experience": 0,
            "current_role": "",
            "skills": [],
            "experience": [],
            "notable_projects": [],
            "education": []
        }


async def parse_resume_file(file_path: str) -> dict:
    ext = os.path.splitext(file_path)[1].lower()
    raw_text = ""

    try:
        if ext == ".pdf":
            try:
                from unstructured.partition.pdf import partition_pdf
                elements = partition_pdf(filename=file_path)
                raw_text = "\n".join([str(e) for e in elements])
            except ImportError:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    raw_text = "\n".join([page.extract_text() or "" for page in pdf.pages])
        elif ext in (".docx", ".doc"):
            try:
                from unstructured.partition.docx import partition_docx
                elements = partition_docx(filename=file_path)
                raw_text = "\n".join([str(e) for e in elements])
            except ImportError:
                import docx
                doc = docx.Document(file_path)
                raw_text = "\n".join([p.text for p in doc.paragraphs])
        elif ext == ".txt":
            with open(file_path, "r") as f:
                raw_text = f.read()
        else:
            raise ValueError(f"Unsupported file type: {ext}")
    except Exception as e:
        raw_text = f"Error extracting text: {str(e)}"

    return await parse_resume_text(raw_text)
