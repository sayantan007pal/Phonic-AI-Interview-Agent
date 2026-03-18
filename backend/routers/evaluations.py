from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from db.mongo import get_db
from routers.auth import get_current_user, User
from datetime import datetime, timezone

router = APIRouter()


@router.get("/{session_id}")
async def get_evaluation(session_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = await db.interview_sessions.find_one(
        {"session_id": session_id},
        {"evaluation": 1, "transcript": 1, "status": 1}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "status": doc.get("status"),
        "evaluation": doc.get("evaluation"),
        "transcript": doc.get("transcript", [])
    }


@router.post("/{session_id}/run")
async def run_evaluation(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    db = get_db()
    doc = await db.interview_sessions.find_one({"session_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    transcript = doc.get("transcript", [])
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript to evaluate")

    # Set evaluation status to processing
    await db.interview_sessions.update_one(
        {"session_id": session_id},
        {"$set": {"evaluation.status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    async def _run_eval():
        try:
            from services.evaluation import run_evaluation as _eval
            result = await _eval(doc, transcript)
            await db.interview_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"evaluation": result, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        except Exception as e:
            await db.interview_sessions.update_one(
                {"session_id": session_id},
                {"$set": {"evaluation.status": "failed", "evaluation.error": str(e)}}
            )

    background_tasks.add_task(_run_eval)
    return {"status": "processing", "session_id": session_id}
