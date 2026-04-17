import asyncio
import json
import logging
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from db.mongo import get_db
from datetime import datetime, timezone

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Ozonetel CDR Model ────────────────────────────────────────────
class OzonetelCDR(BaseModel):
    """Ozonetel Call Detail Record from webhook callback"""
    AgentID: Optional[str] = None
    AgentName: Optional[str] = None
    AgentPhoneNumber: Optional[str] = None
    AgentStatus: Optional[str] = None  # answered / not_answered / NotDialed / user_disconnected
    AgentUniqueID: Optional[str] = None
    Apikey: Optional[str] = None
    AudioFile: Optional[str] = None  # Recording URL
    CallDuration: Optional[str] = None  # HH:MM:SS
    CallerConfAudioFile: Optional[str] = None
    CallerID: Optional[str] = None  # Customer phone number
    CampaignName: Optional[str] = None
    CampaignStatus: Optional[str] = None  # ONLINE / OFFLINE
    Comments: Optional[str] = None
    ConfDuration: Optional[str] = None
    CustomerStatus: Optional[str] = None  # answered / not_answered / InvalidNumber / etc.
    DataUniqueId: Optional[str] = None  # May contain session_id
    DialStatus: Optional[str] = None  # not_answered / answered / ring / invalid_number / exception
    DialedNumber: Optional[str] = None
    Did: Optional[str] = None
    Disposition: Optional[str] = None
    Duration: Optional[str] = None  # Total call duration HH:MM:SS
    EndTime: Optional[str] = None  # YYYY-MM-DD HH:MM:SS
    FallBackRule: Optional[str] = None
    HangupBy: Optional[str] = None  # UserHangup / AgentHangup / SystemHangup
    HoldDuration: Optional[str] = None
    Location: Optional[str] = None
    PhoneName: Optional[str] = None
    Skill: Optional[str] = None
    StartTime: Optional[str] = None  # YYYY-MM-DD HH:MM:SS
    Status: Optional[str] = None  # Answered / NotAnswered
    TimeToAnswer: Optional[str] = None
    TransferType: Optional[str] = None
    TransferredTo: Optional[str] = None
    Type: Optional[str] = None  # Progressive, Inbound, Manual, Preview, IVR, etc.
    UserName: Optional[str] = None
    UUI: Optional[str] = None  # User to User information (may contain extraData)
    UCID: Optional[str] = None  # Unique caller ID
    monitorUCID: Optional[str] = None
    CallID: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


def parse_duration_to_seconds(duration_str: str) -> int:
    """Convert HH:MM:SS to seconds"""
    if not duration_str:
        return 0
    try:
        parts = duration_str.split(":")
        if len(parts) == 3:
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        return int(parts[0])
    except (ValueError, AttributeError):
        return 0


def extract_session_id_from_cdr(cdr: OzonetelCDR) -> Optional[str]:
    """Extract session_id from various possible fields in the CDR"""
    # Try DataUniqueId first (often used for custom reference)
    if cdr.DataUniqueId:
        # Check if it's our session_id directly
        if len(cdr.DataUniqueId) >= 8:  # Basic UUID check
            return cdr.DataUniqueId
        # Try parsing as JSON
        try:
            data = json.loads(cdr.DataUniqueId)
            if isinstance(data, dict) and "session_id" in data:
                return data["session_id"]
        except (json.JSONDecodeError, TypeError):
            pass

    # Try UUI field (User to User information)
    if cdr.UUI:
        try:
            data = json.loads(cdr.UUI)
            if isinstance(data, dict) and "session_id" in data:
                return data["session_id"]
        except (json.JSONDecodeError, TypeError):
            # UUI might contain session_id directly
            if len(cdr.UUI) >= 8:
                return cdr.UUI

    return None


@router.post("/telnyx")
async def telnyx_webhook(request: Request):
    payload = await request.json()
    event_type = payload.get("data", {}).get("event_type", "")
    call_payload = payload.get("data", {}).get("payload", {})
    call_control_id = call_payload.get("call_control_id")
    session_id = call_payload.get("client_state")

    db = get_db()
    if event_type == "call.answered" and session_id:
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "in_progress", "call_started_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif event_type == "call.hangup" and session_id:
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "call_ended_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"status": "ok"}


@router.post("/exotel")
async def exotel_webhook(request: Request):
    form = await request.form()
    status = form.get("Status", "")
    session_id = form.get("CustomField")

    db = get_db()
    if status == "in-progress" and session_id:
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "in_progress", "call_started_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif status in ("completed", "busy", "no-answer", "failed") and session_id:
        new_status = "completed" if status == "completed" else "failed"
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": new_status, "call_ended_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"status": "ok"}


@router.post("/ozonetel")
async def ozonetel_webhook(request: Request):
    """
    Ozonetel callback webhook for call completion events.
    
    Ozonetel sends call details as form data with a 'data' field containing JSON.
    This endpoint extracts call details, matches the session, and updates the database.
    """
    db = get_db()
    
    try:
        # Parse the incoming request
        content_type = request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            # Direct JSON payload
            raw_data = await request.json()
        else:
            # Form data with 'data' field containing JSON
            form = await request.form()
            data_str = form.get("data", "{}")
            
            # Handle both single object and array formats
            if isinstance(data_str, str):
                raw_data = json.loads(data_str)
            else:
                raw_data = data_str
        
        # Handle array format (Ozonetel sometimes sends as array)
        if isinstance(raw_data, list):
            raw_data = raw_data[0] if raw_data else {}
        
        # Parse CDR
        cdr = OzonetelCDR(**raw_data)
        logger.info(f"Received Ozonetel CDR: Status={cdr.Status}, DialedNumber={cdr.DialedNumber}")
        
        # Extract session_id
        session_id = extract_session_id_from_cdr(cdr)
        
        # If no session_id found, try to find session by phone number
        session = None
        if session_id:
            session = await db.interview_sessions.find_one({"session_id": session_id})
        
        if not session and cdr.DialedNumber:
            # Clean phone number and search
            phone = cdr.DialedNumber.replace("+", "").replace(" ", "").strip()
            # Try different phone formats
            session = await db.interview_sessions.find_one({
                "$or": [
                    {"candidate.phone": phone},
                    {"candidate.phone": f"+{phone}"},
                    {"candidate.phone": {"$regex": phone[-10:] if len(phone) >= 10 else phone}},
                ],
                "status": {"$in": ["calling", "scheduled", "in_progress"]}
            })
            if session:
                session_id = session.get("session_id")
                logger.info(f"Found session by phone number: {session_id}")
        
        if not session_id:
            logger.warning(f"Could not find session for Ozonetel callback. DialedNumber: {cdr.DialedNumber}")
            return {"status": "ok", "message": "Session not found"}
        
        # Determine session status based on call outcome
        new_status = "completed"
        if cdr.Status:
            status_lower = cdr.Status.lower()
            if status_lower == "answered":
                new_status = "completed"
            elif status_lower in ("notanswered", "not_answered", "notconnected"):
                new_status = "failed"
        
        if cdr.CustomerStatus:
            customer_status_lower = cdr.CustomerStatus.lower()
            if customer_status_lower in ("invalidnumber", "invalid_number", "congestion", "busy", "exception"):
                new_status = "failed"
        
        # Convert duration to seconds
        duration_seconds = parse_duration_to_seconds(cdr.CallDuration or cdr.Duration)
        
        # Prepare update data
        update_data = {
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "ozonetel_cdr": cdr.model_dump(exclude_none=True),
        }
        
        # Add recording URL if available
        if cdr.AudioFile:
            update_data["recording_url"] = cdr.AudioFile
        
        # Add timestamps
        if cdr.StartTime:
            update_data["call_started_at"] = cdr.StartTime
        if cdr.EndTime:
            update_data["call_ended_at"] = cdr.EndTime
        
        # Add duration
        if duration_seconds > 0:
            update_data["duration_seconds"] = duration_seconds
        
        # Update the session
        result = await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        logger.info(f"Updated session {session_id}: status={new_status}, duration={duration_seconds}s, recording={cdr.AudioFile}")
        
        return {
            "status": "ok",
            "session_id": session_id,
            "call_status": new_status,
            "updated": result.modified_count > 0
        }
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Ozonetel callback JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}
    except Exception as e:
        logger.error(f"Error processing Ozonetel callback: {e}")
        return {"status": "error", "message": str(e)}
