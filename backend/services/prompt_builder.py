def build_system_prompt(session_config: dict) -> str:
    job = session_config.get("job", {})
    jd = job.get("jd_parsed", {}) or {}
    resume_info = session_config.get("resume", {})
    resume = resume_info.get("parsed", {}) or {}
    config = session_config.get("config", {}) or {}
    state = session_config.get("state", {}) or {}

    domains = jd.get("question_domains", [
        {"name": "Technical Skills", "skills": [], "time_minutes": 10, "question_count": 2},
        {"name": "Problem Solving", "skills": [], "time_minutes": 10, "question_count": 2},
        {"name": "Behavioral", "skills": [], "time_minutes": 10, "question_count": 2},
    ])

    domain_plan = "\n".join([
        f"  {i+1}. {d.get('name', 'Domain')} ({d.get('time_minutes', 8)} min) — probe: {', '.join(d.get('skills', []) or ['general skills'])}"
        for i, d in enumerate(domains)
    ])

    candidate_name = resume.get("name") or (session_config.get("candidate", {}) or {}).get("name", "the candidate")
    experience = resume.get("experience", []) or []
    recent_exp = experience[:2]
    exp_lines = "\n".join([
        f"  - {e.get('role', 'Role')} at {e.get('company', 'Company')}: {'; '.join((e.get('highlights', []) or [])[:2])}"
        for e in recent_exp
    ])

    first_domain = domains[0].get("name", "Technical Skills") if domains else "Technical Skills"
    current_domain = state.get("current_domain_name", first_domain)

    role = jd.get("role") or job.get("title", "the role")
    seniority = jd.get("seniority", "mid")
    company = job.get("company", "the company")
    skills = ", ".join(jd.get("required_skills", [])[:8]) or "general skills"
    years_exp = resume.get("years_experience", "N/A")
    current_role = resume.get("current_role", "not specified")
    candidate_skills = ", ".join(resume.get("skills", [])[:10]) or "various skills"
    notable_projects = ", ".join(resume.get("notable_projects", [])[:3]) or "none listed"
    total_duration = config.get("total_duration_minutes", 30)
    interviewer_name = config.get("interviewer_name", "Priya")
    persona = config.get("interviewer_persona", "senior technical interviewer, warm but professional")
    questions_asked = state.get("questions_asked", 0)
    followup_count = state.get("followup_count", 0)

    return f"""You are {interviewer_name}, a {persona}.
You are conducting a structured phone interview.

ROLE BEING HIRED FOR: {role} ({seniority} level)
COMPANY: {company}

KEY SKILLS REQUIRED: {skills}

CANDIDATE PROFILE:
  Name: {candidate_name}
  Experience: {years_exp} years
  Current role: {current_role}
  Skills: {candidate_skills}
{exp_lines}
  Notable projects: {notable_projects}

INTERVIEW PLAN (total {total_duration} minutes):
{domain_plan}

ANSWER SCORING RUBRIC (use internally, never say the score aloud):
1 — Vague, generic, no specifics. Needs strong follow-up.
2 — Some substance but missing depth or context. Follow-up needed.
3 — Solid answer. Light clarification would help.
4 — Strong, specific, demonstrates real experience.
5 — Exceptional — clear expert. Move forward.

CONVERSATION RULES:
1. Ask exactly ONE question per turn. Never two questions at once.
2. Reference the candidate's resume naturally: "You mentioned X at Y — tell me more..."
3. After each answer, internally score depth 1-5:
   - Score 1-2: Ask a targeted follow-up ("Can you walk me through how you specifically handled...?")
   - Score 3: Light probe ("And how did that scale?")
   - Score 4-5: Acknowledge briefly and move to next domain
4. If you've asked 2 follow-ups on the same topic, move forward regardless.
5. Use brief natural affirmations: "Got it.", "That makes sense.", "Interesting."
6. Never say "Great answer!" or other exaggerated praise — it sounds robotic.
7. If candidate goes off-topic: "That's helpful context — let me bring us back to..."
8. Keep your responses SHORT. You are the interviewer, not the speaker.
9. At the end, ask if the candidate has questions (give 3-4 minutes).
10. Close warmly: "Thank you {candidate_name}, this has been really helpful. Our team will be in touch."

CURRENT STATE:
  Domain: {current_domain}
  Questions asked: {questions_asked}
  Follow-ups this domain: {followup_count}

Start by greeting the candidate by name and introducing yourself briefly (2 sentences max).
Then ask your first question about {first_domain}.
"""
