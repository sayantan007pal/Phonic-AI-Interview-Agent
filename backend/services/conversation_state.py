from datetime import datetime, timezone


class ConversationState:
    def __init__(self, config: dict):
        self.config = config
        self.current_domain_index = 0
        self.questions_asked_in_domain = 0
        self.followup_count = 0
        self.total_questions = 0
        self.all_turns = []
        self.session_id = config.get("session_id")

        jd_parsed = (config.get("job", {}) or {}).get("jd_parsed", {}) or {}
        self.domains = jd_parsed.get("question_domains", [
            {"name": "Technical Skills", "skills": [], "time_minutes": 10, "question_count": 2},
            {"name": "Problem Solving", "skills": [], "time_minutes": 10, "question_count": 2},
            {"name": "Behavioral", "skills": [], "time_minutes": 10, "question_count": 2},
        ])

    @property
    def current_domain(self) -> dict:
        if self.current_domain_index < len(self.domains):
            return self.domains[self.current_domain_index]
        return None

    def should_move_to_next_domain(self, answer_depth_score: int = 3) -> bool:
        max_questions = (self.current_domain or {}).get("question_count", 2)
        if self.followup_count >= 2:
            return True
        if answer_depth_score >= 4:
            return True
        if self.questions_asked_in_domain >= max_questions:
            return True
        return False

    def advance_domain(self):
        self.current_domain_index += 1
        self.questions_asked_in_domain = 0
        self.followup_count = 0

    def is_interview_complete(self) -> bool:
        return self.current_domain_index >= len(self.domains)

    def record_candidate_turn(self, text: str) -> dict:
        turn = {
            "turn": len(self.all_turns) + 1,
            "speaker": "candidate",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "domain": (self.current_domain or {}).get("name"),
        }
        self.all_turns.append(turn)
        return turn

    def record_agent_turn(self, text: str, question_type: str = "question") -> dict:
        turn = {
            "turn": len(self.all_turns) + 1,
            "speaker": "agent",
            "text": text,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "domain": (self.current_domain or {}).get("name"),
            "question_type": question_type,
        }
        self.all_turns.append(turn)
        self.questions_asked_in_domain += 1
        self.total_questions += 1
        return turn

    def get_state_dict(self) -> dict:
        return {
            "current_domain_index": self.current_domain_index,
            "current_domain_name": (self.current_domain or {}).get("name"),
            "questions_asked": self.total_questions,
            "followup_count": self.followup_count,
            "interview_complete": self.is_interview_complete(),
        }
