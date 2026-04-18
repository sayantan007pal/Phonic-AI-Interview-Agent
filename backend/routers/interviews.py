import uuid
import os
import json
import httpx
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from db.mongo import get_db
from models.interview_session import InterviewSession, CandidateInfo, JobInfo, ResumeInfo, InterviewConfig, InterviewState
from routers.auth import get_current_user, User

router = APIRouter()
logger = logging.getLogger(__name__)


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

    # Get candidate phone number and country
    candidate = doc.get("candidate", {})
    phone = candidate.get("phone")
    country = candidate.get("country", "IN")  # Default to India
    if not phone:
        raise HTTPException(status_code=400, detail="Candidate phone number not found")

    # Country code mapping
    COUNTRY_CODES = {
        "IN": "91",
        "US": "1",
        "UK": "44",
        "AU": "61",
        "CA": "1",
        "UAE": "971",
        "SG": "65",
    }
    country_code = COUNTRY_CODES.get(country.upper(), "91")  # Default to India

    # Normalize phone number: strip all non-digits, get last 10 digits, prepend country code
    digits_only = ''.join(filter(str.isdigit, phone))
    # Get last 10 digits (the actual phone number without country code)
    phone_10_digit = digits_only[-10:] if len(digits_only) >= 10 else digits_only
    # Prepend country code
    phone_normalized = f"{country_code}{phone_10_digit}"

    logger.info(f"Phone normalized: {phone} -> {phone_normalized} (country: {country})")

    # Ozonetel API configuration - read from DB settings with env fallback
    settings_doc = await db.app_settings.find_one({"key": "global"}) or {}
    api_key = settings_doc.get("ozonetel_api_key") or os.getenv("OZONETEL_API_KEY")
    api_url = settings_doc.get("ozonetel_api_url") or os.getenv("OZONETEL_API_URL")
    campaign_name = settings_doc.get("ozonetel_campaign_name") or os.getenv("OZONETEL_CAMPAIGN_NAME")
    username = settings_doc.get("ozonetel_username") or os.getenv("OZONETEL_USERNAME")
    callback_url = settings_doc.get("ozonetel_callback_url") or os.getenv("OZONETEL_CALLBACK_URL")

    logger.info(f"Ozonetel config - api_key: {'SET' if api_key else 'MISSING'}, "
                f"api_url: {api_url}, campaign: {campaign_name}, "
                f"username: {'SET' if username else 'MISSING'}")

    if not all([api_key, api_url, campaign_name, username]):
        missing = []
        if not api_key: missing.append("api_key")
        if not api_url: missing.append("api_url")
        if not campaign_name: missing.append("campaign_name")
        if not username: missing.append("username")
        raise HTTPException(status_code=500, detail=f"Ozonetel configuration missing: {', '.join(missing)}")

    # Prepare Ozonetel API payload
    # numbersDetails contains the phone numbers and custom data
    # Keep it simple - just phoneNumber and uniqueId for tracking
    numbers_details = [{
        "phoneNumber": phone_normalized,
        "uniqueId": session_id  # This comes back as DataUniqueId in callback
    }]

    # Ozonetel API expects form-urlencoded data with JSON-encoded numbersDetails
    form_data = {
        "apiKey": api_key,
        "userName": username,
        "campaignName": campaign_name,
        "numbersDetails": json.dumps(numbers_details)
    }

    logger.info(f"Triggering Ozonetel call for session {session_id}, phone: {phone_normalized}, campaign: {campaign_name}")
    logger.debug(f"Ozonetel form_data: {form_data}")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Send as form-urlencoded data (not JSON body)
            response = await client.post(api_url, data=form_data)
            logger.info(f"Ozonetel response status: {response.status_code}")
            logger.debug(f"Ozonetel response body: {response.text}")
            response.raise_for_status()
            ozonetel_response = response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Ozonetel API HTTP error: {e.response.status_code} - {e.response.text}")
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "ozonetel_response": {"status": "error", "message": e.response.text}
            }}
        )
        raise HTTPException(status_code=500, detail=f"Ozonetel API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Ozonetel API exception: {str(e)}")
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "ozonetel_response": {"status": "error", "message": str(e)}
            }}
        )
        raise HTTPException(status_code=500, detail=f"Failed to trigger call: {str(e)}")

    # Check if Ozonetel returned an error
    if ozonetel_response.get("status") == "error":
        logger.error(f"Ozonetel returned error: {ozonetel_response}")
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": "failed",
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "ozonetel_response": ozonetel_response
            }}
        )
        raise HTTPException(status_code=500, detail=f"Ozonetel error: {ozonetel_response.get('message', 'Unknown error')}")

    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "calling",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "ozonetel_response": ozonetel_response
        }}
    )

    logger.info(f"Call initiated successfully for session {session_id}")
    return {"status": "calling", "session_id": session_id, "message": "Call initiated via Ozonetel"}


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


@router.post("/{session_id}/reset")
async def reset_interview(session_id: str, current_user: User = Depends(get_current_user)):
    """
    Reset a stuck interview back to 'scheduled' status so it can be retried.
    Useful for interviews stuck in 'calling' or 'failed' status.
    """
    db = get_db()
    doc = await db.interview_sessions.find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    current_status = doc.get("status")
    # Only allow reset from certain statuses
    if current_status not in ["calling", "failed", "cancelled"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reset interview with status '{current_status}'. Only 'calling', 'failed', or 'cancelled' interviews can be reset."
        )

    result = await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": "scheduled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "ozonetel_response": None,  # Clear previous Ozonetel response
            "state": {
                "current_domain_index": 0,
                "current_domain_name": doc.get("config", {}).get("domains", ["Technical Skills"])[0] if doc.get("config", {}).get("domains") else "Technical Skills",
                "questions_asked": 0,
                "followup_count": 0,
                "interview_complete": False
            }
        }}
    )

    logger.info(f"Interview {session_id} reset from '{current_status}' to 'scheduled'")
    return {"status": "scheduled", "session_id": session_id, "message": f"Interview reset from '{current_status}' to 'scheduled'"}


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
