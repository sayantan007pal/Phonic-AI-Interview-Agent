from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import os, aiofiles, tempfile
from db.mongo import get_db
from models.interview_session import JDTemplate, JDParsed
from routers.auth import get_current_user, User

router = APIRouter()


class ParseJDRequest(BaseModel):
    text: str


class SaveJDRequest(BaseModel):
    title: str
    company: Optional[str] = None
    raw_text: str
    parsed: Optional[dict] = None


@router.post("/parse")
async def parse_jd(req: ParseJDRequest, current_user: User = Depends(get_current_user)):
    from services.jd_parser import parse_jd as _parse
    try:
        result = await _parse(req.text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_jd(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    content = await file.read()
    jd_text = content.decode("utf-8", errors="ignore")
    from services.jd_parser import parse_jd as _parse
    try:
        parsed = await _parse(jd_text)
        return {"raw_text": jd_text, "parsed": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save")
async def save_jd(req: SaveJDRequest, current_user: User = Depends(get_current_user)):
    db = get_db()
    doc = {
        "title": req.title,
        "company": req.company,
        "raw_text": req.raw_text,
        "parsed": req.parsed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id,
    }
    result = await db.jd_templates.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return JDTemplate.from_mongo(doc)


@router.get("")
async def list_jds(current_user: User = Depends(get_current_user)):
    db = get_db()
    cursor = db.jd_templates.find({}).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    return [JDTemplate.from_mongo(d) for d in docs]


@router.delete("/{jd_id}")
async def delete_jd(jd_id: str, current_user: User = Depends(get_current_user)):
    from bson import ObjectId
    db = get_db()
    result = await db.jd_templates.delete_one({"_id": ObjectId(jd_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="JD not found")
    return {"deleted": True}
