import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db.mongo import connect_db, close_db, get_db
from routers import auth, interviews, jd, resume, evaluations, settings, webhooks

# ── App Factory ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await seed_demo_user()
    yield
    await close_db()


async def seed_demo_user():
    """Create a default admin user for demo purposes"""
    db = get_db()
    existing = await db.users.find_one({"email": "admin@phonic.ai"})
    if not existing:
        import bcrypt
        from datetime import datetime, timezone
        hashed = bcrypt.hashpw("phonic123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        await db.users.insert_one({
            "email": "admin@phonic.ai",
            "name": "Admin User",
            "role": "admin",
            "hashed_password": hashed,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        print("Seeded demo user: admin@phonic.ai / phonic123")


app = FastAPI(title="Phonic Interview Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(interviews.router, prefix="/api/interviews", tags=["interviews"])
app.include_router(jd.router, prefix="/api/jd", tags=["jd"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(evaluations.router, prefix="/api/evaluations", tags=["evaluations"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])


# ── Public endpoint for candidate interview room ───────────────────
@app.get("/api/public/interview/{session_id}")
async def get_public_interview(session_id: str):
    """Public endpoint — no auth required. Returns limited session info for candidate room."""
    db = get_db()
    doc = await db.interview_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0, "session_id": 1, "status": 1, "mode": 1,
         "candidate.name": 1, "job.title": 1, "job.company": 1,
         "config.accent": 1, "config.interviewer_name": 1, "config.total_duration_minutes": 1}
    )
    if not doc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    return doc


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "phonic-api"}


# ── WebSocket: Live Interview Voice Pipeline ────────────────────────────────────
@app.websocket("/api/ws/voice/{session_id}")
async def voice_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()

    db = get_db()
    session_doc = await db.interview_sessions.find_one({"session_id": session_id})
    if not session_doc:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    # Convert mongo doc to dict for pipeline
    session_doc["_id"] = str(session_doc.get("_id", ""))
    # Serialize nested docs
    for key in ["config", "job", "resume", "candidate", "state"]:
        if session_doc.get(key) and hasattr(session_doc[key], "__dict__"):
            session_doc[key] = dict(session_doc[key])

    try:
        from pipeline.interview_pipeline import run_interview_pipeline
        await run_interview_pipeline(websocket, session_id, session_doc)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Voice WS error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass


# ── WebSocket: Live Transcript Monitor (Recruiter) ─────────────────────────────
active_monitor_connections: dict[str, list[WebSocket]] = {}


@app.websocket("/api/ws/monitor/{session_id}")
async def monitor_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    if session_id not in active_monitor_connections:
        active_monitor_connections[session_id] = []
    active_monitor_connections[session_id].append(websocket)

    try:
        # Send current transcript on connect
        db = get_db()
        doc = await db.interview_sessions.find_one(
            {"session_id": session_id},
            {"transcript": 1, "status": 1, "state": 1}
        )
        if doc:
            await websocket.send_json({
                "event": "session.connected",
                "data": {
                    "transcript": doc.get("transcript", []),
                    "status": doc.get("status"),
                    "state": doc.get("state", {}),
                }
            })

        # Keep connection alive
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"event": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        if session_id in active_monitor_connections:
            active_monitor_connections[session_id] = [
                ws for ws in active_monitor_connections[session_id] if ws != websocket
            ]


async def broadcast_to_monitors(session_id: str, message: dict):
    """Broadcast a message to all monitor connections for a session"""
    connections = active_monitor_connections.get(session_id, [])
    disconnected = []
    for ws in connections:
        try:
            await ws.send_json(message)
        except:
            disconnected.append(ws)
    for ws in disconnected:
        connections.remove(ws)
