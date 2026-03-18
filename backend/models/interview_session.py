from pydantic import BaseModel, Field, BeforeValidator
from typing import Optional, List, Any, Annotated
from datetime import datetime, timezone
from bson import ObjectId


def coerce_object_id(v: Any) -> str:
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(coerce_object_id)]


class BaseDocument(BaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    model_config = {"populate_by_name": True, "arbitrary_types_allowed": True}

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        if "_id" in data and data["_id"] is None:
            del data["_id"]
        return data

    @classmethod
    def from_mongo(cls, doc: dict):
        if doc is None:
            return None
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return cls(**doc)


# ── Candidate ─────────────────────────────────────────────────────
class CandidateInfo(BaseModel):
    name: str
    email: str
    phone: str
    country_code: Optional[str] = None
    country: Optional[str] = None


# ── Job ────────────────────────────────────────────────────────────
class QuestionDomain(BaseModel):
    name: str
    skills: List[str] = []
    time_minutes: int = 8
    question_count: int = 2


class JDParsed(BaseModel):
    role: Optional[str] = None
    seniority: Optional[str] = None
    required_skills: List[str] = []
    responsibilities: List[str] = []
    question_domains: List[QuestionDomain] = []


class JobInfo(BaseModel):
    title: str
    company: Optional[str] = None
    jd_raw: Optional[str] = None
    jd_parsed: Optional[JDParsed] = None


# ── Resume ─────────────────────────────────────────────────────────
class ExperienceItem(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    duration: Optional[str] = None
    highlights: List[str] = []


class ResumeParsed(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    years_experience: Optional[int] = None
    current_role: Optional[str] = None
    skills: List[str] = []
    experience: List[ExperienceItem] = []
    notable_projects: List[str] = []
    education: List[str] = []


class ResumeInfo(BaseModel):
    file_url: Optional[str] = None
    parsed: Optional[ResumeParsed] = None


# ── Config ─────────────────────────────────────────────────────────
class InterviewConfig(BaseModel):
    accent: str = "us"
    cartesia_voice_id: Optional[str] = None
    interviewer_name: str = "Priya"
    interviewer_persona: str = "senior technical interviewer, warm but professional"
    total_duration_minutes: int = 30
    llm_provider: str = "ollama"
    domains: List[str] = []


# ── Telephony ──────────────────────────────────────────────────────
class TelephonyInfo(BaseModel):
    provider: Optional[str] = None
    caller_id: Optional[str] = None
    call_sid: Optional[str] = None
    telnyx_call_control_id: Optional[str] = None


# ── LiveKit ────────────────────────────────────────────────────────
class LiveKitInfo(BaseModel):
    room_name: Optional[str] = None
    candidate_token: Optional[str] = None
    recruiter_token: Optional[str] = None


# ── State ──────────────────────────────────────────────────────────
class InterviewState(BaseModel):
    current_domain_index: int = 0
    current_domain_name: Optional[str] = None
    questions_asked: int = 0
    followup_count: int = 0
    interview_complete: bool = False


# ── Transcript Turn ────────────────────────────────────────────────
class TranscriptTurn(BaseModel):
    turn: int
    speaker: str  # "agent" | "candidate"
    text: str
    timestamp: Optional[str] = None
    domain: Optional[str] = None
    question_type: Optional[str] = None
    score: Optional[int] = None


# ── Evaluation ─────────────────────────────────────────────────────
class EvaluationResult(BaseModel):
    status: str = "pending"
    overall_score: Optional[float] = None
    hire_band: Optional[str] = None
    domain_scores: Optional[dict] = None
    strengths: List[str] = []
    red_flags: List[str] = []
    notable_quotes: List[str] = []
    summary: Optional[str] = None
    report_url: Optional[str] = None


# ── Full Session ────────────────────────────────────────────────────
class InterviewSession(BaseDocument):
    session_id: str
    status: str = "scheduled"
    mode: str = "phone"
    candidate: Optional[CandidateInfo] = None
    job: Optional[JobInfo] = None
    resume: Optional[ResumeInfo] = None
    config: Optional[InterviewConfig] = None
    telephony: Optional[TelephonyInfo] = None
    livekit: Optional[LiveKitInfo] = None
    scheduled_at: Optional[str] = None
    call_started_at: Optional[str] = None
    call_ended_at: Optional[str] = None
    duration_seconds: Optional[int] = None
    state: Optional[InterviewState] = None
    transcript: List[TranscriptTurn] = []
    evaluation: Optional[EvaluationResult] = None
    recording_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None


# ── JD Template ────────────────────────────────────────────────────
class JDTemplate(BaseDocument):
    title: str
    company: Optional[str] = None
    raw_text: str
    parsed: Optional[JDParsed] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── User ───────────────────────────────────────────────────────────
class User(BaseDocument):
    email: str
    role: str = "recruiter"
    name: str
    hashed_password: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ── Settings ───────────────────────────────────────────────────────
class AppSettings(BaseDocument):
    key: str = "global"
    llm_provider: str = "ollama"
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"
    deepgram_api_key: Optional[str] = None
    cartesia_api_key: Optional[str] = None
    cartesia_custom_voice_id: Optional[str] = None
    telnyx_api_key: Optional[str] = None
    telnyx_public_key: Optional[str] = None
    telnyx_did_us: Optional[str] = None
    telnyx_did_uk: Optional[str] = None
    telnyx_did_au: Optional[str] = None
    telnyx_did_ca: Optional[str] = None
    telnyx_did_uae: Optional[str] = None
    telnyx_did_eu: Optional[str] = None
    telnyx_did_sg: Optional[str] = None
    telnyx_connection_id_us: Optional[str] = None
    telnyx_connection_id_uk: Optional[str] = None
    telnyx_connection_id_au: Optional[str] = None
    telnyx_connection_id_default: Optional[str] = None
    india_telephony_provider: str = "exotel"
    exotel_api_key: Optional[str] = None
    exotel_api_token: Optional[str] = None
    exotel_sid: Optional[str] = None
    exotel_virtual_number: Optional[str] = None
    ozonetel_api_key: Optional[str] = None
    ozonetel_did: Optional[str] = None
    livekit_url: str = "ws://localhost:7880"
    livekit_api_key: Optional[str] = None
    livekit_api_secret: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "ap-south-1"
    s3_bucket_name: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
