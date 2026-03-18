import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from db.mongo import get_db
from models.interview_session import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

SECRET_KEY = os.environ.get("SECRET_KEY", "phonic-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def create_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_db()
    from bson import ObjectId
    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User.from_mongo(doc)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "recruiter"


@router.post("/login")
async def login(form: LoginRequest):
    db = get_db()
    doc = await db.users.find_one({"email": form.email})
    if not doc or not pwd_context.verify(form.password, doc["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = User.from_mongo(doc)
    token = create_token({"sub": user.id, "email": user.email, "role": user.role})
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": user.id, "email": user.email, "name": user.name, "role": user.role
    }}


@router.post("/register")
async def register(req: RegisterRequest):
    db = get_db()
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_context.hash(req.password)
    user_doc = {
        "email": req.email,
        "name": req.name,
        "role": req.role,
        "hashed_password": hashed,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    token = create_token({"sub": str(result.inserted_id), "email": req.email, "role": req.role})
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": str(result.inserted_id), "email": req.email, "name": req.name, "role": req.role
    }}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "name": current_user.name, "role": current_user.role}
