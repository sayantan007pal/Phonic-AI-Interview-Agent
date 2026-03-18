import asyncio
from fastapi import APIRouter, Request
from db.mongo import get_db
from datetime import datetime, timezone

router = APIRouter()


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
    form = await request.form()
    session_id = form.get("session_id")
    status = form.get("status", "")
    db = get_db()
    if session_id:
        await db.interview_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"status": "ok"}
