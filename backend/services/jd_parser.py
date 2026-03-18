import json
from services.llm_provider import get_default_llm

JD_PARSE_PROMPT = """You are an expert HR analyst. Parse the following job description and return ONLY valid JSON.

Extract:
- role: job title (string)
- seniority: one of junior/mid/senior/lead/staff (string)
- required_skills: array of specific technical skills (array of strings)
- responsibilities: array of key responsibilities, max 5 (array of strings)
- question_domains: array of 3-4 objects, each with:
  - name: domain name (e.g. "Technical Depth", "System Design", "Behavioral")
  - skills: array of relevant skills to probe in this domain
  - time_minutes: integer, suggested time allocation
  - question_count: integer 1-2

Return ONLY the JSON object, no markdown, no explanation, no code blocks."""


async def parse_jd(jd_text: str) -> dict:
    llm = get_default_llm()
    result = ""
    async for chunk in llm.stream_chat(
        system_prompt=JD_PARSE_PROMPT,
        messages=[{"role": "user", "content": jd_text[:4000]}],
        max_tokens=1000
    ):
        result += chunk

    # Clean up JSON response
    result = result.strip()
    if result.startswith("```"):
        lines = result.split("\n")
        result = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        return json.loads(result)
    except json.JSONDecodeError:
        # Return basic structure if parsing fails
        return {
            "role": "Software Engineer",
            "seniority": "mid",
            "required_skills": [],
            "responsibilities": [],
            "question_domains": [
                {"name": "Technical Depth", "skills": [], "time_minutes": 10, "question_count": 2},
                {"name": "System Design", "skills": [], "time_minutes": 10, "question_count": 2},
                {"name": "Behavioral", "skills": [], "time_minutes": 10, "question_count": 2},
            ]
        }
