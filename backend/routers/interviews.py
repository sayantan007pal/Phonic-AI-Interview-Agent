import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from db.mongo import get_db
from models.interview_session import InterviewSession, CandidateInfo, JobInfo, ResumeInfo, InterviewConfig, InterviewState
from routers.auth import get_current_user, User

router = APIRouter()


class CreateInterviewRequest(BaseModel):
    candidate_name: str
    candidate_email: str
    candidate_phone: str
    candidate_country: Optional[str] = None
    job_title: str
    company: Optional[str] = None
    jd_raw: Optional[str] = None
    jd_template_id: Optional[str] = None
    resume_text: Optional[str] = None
    mode: str = "browser"
    accent: str = "us"
    interviewer_name: str = "Priya"
    total_duration_minutes: int = 30
    llm_provider: str = "ollama"
    scheduled_at: Optional[str] = None


@router.post("")
async def create_interview(req: CreateInterviewRequest, current_user: User = Depends(get_current_user)):
    db = get_db()
    session_id = str(uuid.uuid4())

    # Get voice ID for accent
    from services.cartesia_voices import CARTESIA_VOICES, get_voice_id
    voice_id = get_voice_id(req.accent)

    # Build config
    config = InterviewConfig(
        accent=req.accent,
        cartesia_voice_id=voice_id,
        interviewer_name=req.interviewer_name,
        total_duration_minutes=req.total_duration_minutes,
        llm_provider=req.llm_provider,
    )

    candidate = CandidateInfo(
        name=req.candidate_name,
        email=req.candidate_email,
        phone=req.candidate_phone,
        country=req.candidate_country,
    )

    job = JobInfo(
        title=req.job_title,
        company=req.company,
        jd_raw=req.jd_raw,
    )

    # Parse JD if provided
    if req.jd_raw:
        try:
            from services.jd_parser import parse_jd
            from models.interview_session import JDParsed
            parsed = await parse_jd(req.jd_raw)
            from pydantic import TypeAdapter
            job.jd_parsed = JDParsed(**parsed)
            config.domains = [d.get("name", "") for d in parsed.get("question_domains", [])]
        except Exception as e:
            print(f"JD parsing error: {e}")

    # Check for saved JD template
    if req.jd_template_id:
        try:
            jd_doc = await db.jd_templates.find_one({"_id": ObjectId(req.jd_template_id)})
            if jd_doc and jd_doc.get("parsed"):
                from models.interview_session import JDParsed
                job.jd_parsed = JDParsed(**jd_doc["parsed"])
                job.jd_raw = jd_doc.get("raw_text", job.jd_raw)
                config.domains = [d.get("name", "") for d in jd_doc["parsed"].get("question_domains", [])]
        except Exception as e:
            print(f"JD template load error: {e}")

    state = InterviewState(
        current_domain_name=config.domains[0] if config.domains else "Technical Skills"
    )

    session = InterviewSession(
        session_id=session_id,
        status="scheduled",
        mode=req.mode,
        candidate=candidate,
        job=job,
        config=config,
        state=state,
        scheduled_at=req.scheduled_at or datetime.now(timezone.utc).isoformat(),
        created_by=current_user.id,
    )

    doc = session.to_mongo()
    result = await db.interview_sessions.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return InterviewSession.from_mongo(doc)


@router.get("")
async def list_interviews(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    db = get_db()
    query = {}
    if status:
        query["status"] = status

    cursor = db.interview_sessions.find(query).sort("created_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    total = await db.interview_sessions.count_documents(query)
    sessions = [InterviewSession.from_mongo(doc) for doc in docs]
    return {"sessions": sessions, "total": total, "skip": skip, "limit": limit}


@router.get("/stats")
async def get_stats(current_user: User = Depends(get_current_user)):
    db = get_db()
    total = await db.interview_sessions.count_documents({})
    scheduled = await db.interview_sessions.count_documents({"status": "scheduled"})
    in_progress = await db.interview_sessions.count_documents({"status": "in_progress"})
    completed = await db.interview_sessions.count_documents({"status": "completed"})
    failed = await db.interview_sessions.count_documents({"status": "failed"})

    # Average score from completed interviews
    pipeline = [
        {"$match": {"status": "completed", "evaluation.overall_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg_score": {"$avg": "$evaluation.overall_score"}}}
    ]
    avg_result = await db.interview_sessions.aggregate(pipeline).to_list(length=1)
    avg_score = round(avg_result[0]["avg_score"], 1) if avg_result else None

    return {
        "total": total,
        "scheduled": scheduled,
        "in_progress": in_progress,
        "completed": completed,
        "failed": failed,
        "avg_score": avg_score,
    }


@router.get("/{session_id}")
async def get_interview(session_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = await db.interview_sessions.find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return InterviewSession.from_mongo(doc)


@router.post("/{session_id}/call")
async def trigger_call(session_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = await db.interview_sessions.find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "calling", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # TODO: Integrate telephony trigger here
    return {"status": "calling", "session_id": session_id, "message": "Call initiated"}


@router.post("/{session_id}/cancel")
async def cancel_interview(session_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    result = await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "cancelled", "session_id": session_id}


@router.get("/{session_id}/transcript")
async def get_transcript(session_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = await db.interview_sessions.find_one(
        {"session_id": session_id},
        {"transcript": 1, "status": 1}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"transcript": doc.get("transcript", []), "status": doc.get("status")}


@router.post("/{session_id}/transcript")
async def add_transcript_turn(session_id: str, turn: dict):
    db = get_db()
    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {
            "$push": {"transcript": turn},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    return {"ok": True}
