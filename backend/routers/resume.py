import os, aiofiles, tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel
from db.mongo import get_db
from routers.auth import get_current_user, User
from datetime import datetime, timezone

router = APIRouter()


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    allowed = {".pdf", ".docx", ".doc", ".txt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")

    # Save temp file
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        from services.resume_parser import parse_resume_file
        parsed = await parse_resume_file(tmp_path)
    finally:
        os.unlink(tmp_path)

    # Store in DB
    db = get_db()
    doc = {
        "filename": file.filename,
        "parsed": parsed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    result = await db.resumes.insert_one(doc)
    return {"id": str(result.inserted_id), "filename": file.filename, "parsed": parsed}


@router.post("/parse-text")
async def parse_resume_text_endpoint(
    body: dict,
    current_user: User = Depends(get_current_user)
):
    text = body.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    from services.resume_parser import parse_resume_text
    parsed = await parse_resume_text(text)
    return parsed


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: User = Depends(get_current_user)):
    from bson import ObjectId
    db = get_db()
    doc = await db.resumes.find_one({"_id": ObjectId(resume_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Resume not found")
    doc["_id"] = str(doc["_id"])
    return doc
