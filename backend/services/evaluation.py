import json
from services.llm_provider import get_default_llm

EVALUATION_PROMPT = """You are an expert technical recruiter evaluating a job interview transcript.

Analyze the transcript and return ONLY valid JSON with:
- overall_score: float 1-5 (e.g. 4.2)
- hire_band: one of "Strong Yes", "Yes", "Maybe", "No", "Strong No"
- domain_scores: object mapping domain name to score 1-5
- strengths: array of 2-4 specific strength statements
- red_flags: array of 0-3 concern statements (empty array if none)
- notable_quotes: array of 1-3 direct quotes from candidate showing key insight
- summary: 2-3 sentence overall assessment

Be specific and evidence-based. Reference actual answers from the transcript.
Return ONLY the JSON object, no markdown."""


async def run_evaluation(session_config: dict, transcript: list) -> dict:
    llm = get_default_llm()

    # Build transcript string
    transcript_text = "\n".join([
        f"{t.get('speaker', 'unknown').upper()}: {t.get('text', '')}"
        for t in transcript
    ])

    job = session_config.get("job", {}) or {}
    role = job.get("title", "Software Engineer")
    domains = (job.get("jd_parsed", {}) or {}).get("question_domains", [])
    domain_names = [d.get("name", "") for d in domains] or ["Technical Skills", "Behavioral"]

    user_message = f"""Job Role: {role}
Interview Domains: {', '.join(domain_names)}

TRANSCRIPT:
{transcript_text[:8000]}

Evaluate this interview and provide your JSON assessment."""

    result = ""
    async for chunk in llm.stream_chat(
        system_prompt=EVALUATION_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        max_tokens=1500
    ):
        result += chunk

    result = result.strip()
    if result.startswith("```"):
        lines = result.split("\n")
        result = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        data = json.loads(result)
        return {
            "status": "complete",
            "overall_score": data.get("overall_score", 3.0),
            "hire_band": data.get("hire_band", "Maybe"),
            "domain_scores": data.get("domain_scores", {}),
            "strengths": data.get("strengths", []),
            "red_flags": data.get("red_flags", []),
            "notable_quotes": data.get("notable_quotes", []),
            "summary": data.get("summary", "Evaluation complete."),
        }
    except json.JSONDecodeError:
        return {
            "status": "complete",
            "overall_score": 3.0,
            "hire_band": "Maybe",
            "domain_scores": {},
            "strengths": [],
            "red_flags": [],
            "notable_quotes": [],
            "summary": "Evaluation completed. Manual review recommended.",
        }
