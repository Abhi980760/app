from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import io
import uuid
import base64
import asyncio
import logging
import random
import string
import bcrypt
import jwt
import resend

from certificate_pdf import build_certificate_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@zoomintern.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "ZoomAdmin@2026")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
CEO_NAME = os.environ.get("CEO_NAME", "Abhishek Singh Tomar")
CEO_TITLE = os.environ.get("CEO_TITLE", "CEO & Founder, ZoomIntern")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ZoomIntern API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zoomintern")


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    email: str


class Program(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    area: str  # e.g. Programming, AI & ML, Mathematics, Finance
    location: str = "Remote"
    duration_weeks: int = 6
    tags: List[str] = []
    description: str = ""
    active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProgramIn(BaseModel):
    title: str
    area: str
    location: str = "Remote"
    duration_weeks: int = 6
    tags: List[str] = []
    description: str = ""
    active: bool = True


class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    program_id: str
    program_title: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    university: Optional[str] = None
    motivation: Optional[str] = None
    status: str = "pending"  # pending | reviewed | accepted | rejected
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ApplicationIn(BaseModel):
    program_id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    university: Optional[str] = None
    motivation: Optional[str] = None


class Certificate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    certificate_id: str  # ZI-2026-XXXX
    intern_name: str
    intern_email: EmailStr
    area: str  # internship area / program title
    start_date: str  # ISO date
    end_date: str
    issue_date: str
    duration_weeks: int = 6
    email_sent: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CertificateIn(BaseModel):
    intern_name: str
    intern_email: EmailStr
    area: str
    start_date: str
    end_date: str
    issue_date: Optional[str] = None
    send_email: bool = True


# ---------- Auth helpers ----------
def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _create_token(email: str) -> str:
    payload = {
        "sub": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def require_admin(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = payload.get("sub")
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin


# ---------- Startup seeding ----------
@app.on_event("startup")
async def seed_data():
    existing = await db.admins.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not existing:
        await db.admins.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": _hash_password(ADMIN_PASSWORD),
            "name": CEO_NAME,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {ADMIN_EMAIL}")

    # Seed default programs if empty
    if await db.programs.count_documents({}) == 0:
        defaults = [
            ("Python Internship", "Programming", 6, ["Python", "OOP", "Automation"]),
            ("C++ Internship", "Programming", 6, ["C++", "Data Structures", "Algorithms"]),
            ("Java Internship", "Programming", 6, ["Java", "OOP", "Collections"]),
            ("Machine Learning Internship", "AI & ML", 6, ["Python", "scikit-learn", "PyTorch"]),
            ("AI Certification Internship", "AI & ML", 4, ["LLMs", "Prompting", "Agents"]),
            ("Probability Internship", "Mathematics", 6, ["Probability", "Statistics"]),
            ("Financial Mathematics Internship", "Finance", 4, ["Modeling", "Excel", "Python"]),
            ("Web Development Internship", "Programming", 6, ["React", "FastAPI", "MongoDB"]),
            ("Data Science Internship", "AI & ML", 6, ["Pandas", "SQL", "Visualization"]),
        ]
        docs = []
        for title, area, weeks, tags in defaults:
            p = Program(title=title, area=area, duration_weeks=weeks, tags=tags,
                        description=f"A hands-on {weeks}-week {title.lower()} with mentor sign-off and a verifiable certificate.")
            docs.append(p.model_dump())
        await db.programs.insert_many(docs)
        logger.info(f"Seeded {len(docs)} programs")


# ---------- Utility ----------
def _generate_cert_id() -> str:
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.digits, k=4))
    return f"ZI-{year}-{suffix}"


async def _unique_cert_id() -> str:
    for _ in range(20):
        cid = _generate_cert_id()
        exists = await db.certificates.find_one({"certificate_id": cid}, {"_id": 0})
        if not exists:
            return cid
    return f"ZI-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex[:6].upper()}"


def _verify_url_for(cert_id: str) -> str:
    # We don't know the public URL from backend; use env or a relative marker.
    base = os.environ.get("PUBLIC_BASE_URL", "")
    if base:
        return f"{base.rstrip('/')}/verify?id={cert_id}"
    return f"https://zoomintern.app/verify?id={cert_id}"


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"message": "ZoomIntern API"}


@api_router.get("/programs", response_model=List[Program])
async def list_programs(active_only: bool = True):
    query = {"active": True} if active_only else {}
    docs = await db.programs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/programs/{program_id}", response_model=Program)
async def get_program(program_id: str):
    doc = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Program not found")
    return doc


@api_router.post("/applications", response_model=Application)
async def create_application(body: ApplicationIn):
    program = await db.programs.find_one({"id": body.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    app_obj = Application(program_title=program["title"], **body.model_dump())
    await db.applications.insert_one(app_obj.model_dump())
    return app_obj


@api_router.get("/certificates/verify/{cert_id}")
async def verify_certificate(cert_id: str):
    doc = await db.certificates.find_one({"certificate_id": cert_id}, {"_id": 0})
    if not doc:
        return {"valid": False}
    return {
        "valid": True,
        "certificate_id": doc["certificate_id"],
        "intern_name": doc["intern_name"],
        "area": doc["area"],
        "start_date": doc["start_date"],
        "end_date": doc["end_date"],
        "issue_date": doc["issue_date"],
        "duration_weeks": doc["duration_weeks"],
        "ceo_name": CEO_NAME,
    }


@api_router.get("/certificates/{cert_id}/pdf")
async def download_certificate_pdf(cert_id: str):
    doc = await db.certificates.find_one({"certificate_id": cert_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Certificate not found")
    pdf_bytes = build_certificate_pdf(
        intern_name=doc["intern_name"],
        area=doc["area"],
        start_date=doc["start_date"],
        end_date=doc["end_date"],
        issue_date=doc["issue_date"],
        duration_weeks=doc["duration_weeks"],
        certificate_id=doc["certificate_id"],
        verify_url=_verify_url_for(doc["certificate_id"]),
        ceo_name=CEO_NAME,
        ceo_title=CEO_TITLE,
    )
    filename = f"ZoomIntern-{doc['certificate_id']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ---------- Admin routes ----------
@api_router.post("/admin/login", response_model=TokenOut)
async def admin_login(body: LoginIn):
    admin = await db.admins.find_one({"email": body.email}, {"_id": 0})
    if not admin or not _verify_password(body.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_token(admin["email"])
    return TokenOut(token=token, email=admin["email"])


@api_router.get("/admin/me")
async def admin_me(admin=Depends(require_admin)):
    return {"email": admin["email"], "name": admin.get("name", "Admin")}


@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    programs = await db.programs.count_documents({})
    active_programs = await db.programs.count_documents({"active": True})
    applications = await db.applications.count_documents({})
    pending = await db.applications.count_documents({"status": "pending"})
    certs = await db.certificates.count_documents({})
    return {
        "programs": programs,
        "active_programs": active_programs,
        "applications": applications,
        "pending_review": pending,
        "certificates": certs,
    }


# --- programs admin ---
@api_router.post("/admin/programs", response_model=Program)
async def create_program(body: ProgramIn, admin=Depends(require_admin)):
    p = Program(**body.model_dump())
    await db.programs.insert_one(p.model_dump())
    return p


@api_router.put("/admin/programs/{program_id}", response_model=Program)
async def update_program(program_id: str, body: ProgramIn, admin=Depends(require_admin)):
    existing = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    update = body.model_dump()
    await db.programs.update_one({"id": program_id}, {"$set": update})
    existing.update(update)
    return existing


@api_router.delete("/admin/programs/{program_id}")
async def delete_program(program_id: str, admin=Depends(require_admin)):
    res = await db.programs.delete_one({"id": program_id})
    return {"deleted": res.deleted_count}


# --- applications admin ---
@api_router.get("/admin/applications", response_model=List[Application])
async def list_applications(admin=Depends(require_admin)):
    docs = await db.applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.patch("/admin/applications/{app_id}")
async def update_application_status(app_id: str, status: str, admin=Depends(require_admin)):
    if status not in {"pending", "reviewed", "accepted", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.applications.update_one({"id": app_id}, {"$set": {"status": status}})
    return {"updated": res.modified_count}


# --- certificates admin ---
@api_router.get("/admin/certificates", response_model=List[Certificate])
async def list_certificates(admin=Depends(require_admin)):
    docs = await db.certificates.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api_router.post("/admin/certificates", response_model=Certificate)
async def issue_certificate(body: CertificateIn, admin=Depends(require_admin)):
    # Calc weeks
    try:
        sd = datetime.fromisoformat(body.start_date)
        ed = datetime.fromisoformat(body.end_date)
        weeks = max(1, round((ed - sd).days / 7))
    except Exception:
        weeks = 6
    issue = body.issue_date or datetime.now(timezone.utc).date().isoformat()
    cid = await _unique_cert_id()
    cert = Certificate(
        certificate_id=cid,
        intern_name=body.intern_name.strip(),
        intern_email=body.intern_email,
        area=body.area.strip(),
        start_date=body.start_date,
        end_date=body.end_date,
        issue_date=issue,
        duration_weeks=weeks,
    )
    await db.certificates.insert_one(cert.model_dump())

    if body.send_email:
        try:
            await _send_certificate_email(cert)
            await db.certificates.update_one({"id": cert.id}, {"$set": {"email_sent": True}})
            cert.email_sent = True
        except Exception as e:
            logger.warning(f"Email send failed: {e}")

    return cert


@api_router.post("/admin/certificates/{cert_id}/resend")
async def resend_email(cert_id: str, admin=Depends(require_admin)):
    doc = await db.certificates.find_one({"certificate_id": cert_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Certificate not found")
    cert = Certificate(**doc)
    try:
        await _send_certificate_email(cert)
        await db.certificates.update_one({"id": cert.id}, {"$set": {"email_sent": True}})
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email send failed: {e}")


@api_router.delete("/admin/certificates/{cert_id}")
async def delete_certificate(cert_id: str, admin=Depends(require_admin)):
    res = await db.certificates.delete_one({"certificate_id": cert_id})
    return {"deleted": res.deleted_count}


async def _send_certificate_email(cert: Certificate):
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY not configured")
    pdf_bytes = build_certificate_pdf(
        intern_name=cert.intern_name,
        area=cert.area,
        start_date=cert.start_date,
        end_date=cert.end_date,
        issue_date=cert.issue_date,
        duration_weeks=cert.duration_weeks,
        certificate_id=cert.certificate_id,
        verify_url=_verify_url_for(cert.certificate_id),
        ceo_name=CEO_NAME,
        ceo_title=CEO_TITLE,
    )
    attachment = {
        "filename": f"ZoomIntern-{cert.certificate_id}.pdf",
        "content": list(pdf_bytes),
    }
    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#0b0d14;color:#f8fafc;padding:24px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#12141d;border:1px solid #272B3C;border-radius:14px;padding:32px;">
          <tr><td style="font-size:22px;font-weight:800;color:#FBBF24;letter-spacing:-0.5px;">ZoomIntern</td></tr>
          <tr><td style="padding-top:16px;font-size:20px;color:#f8fafc;">Congratulations, {cert.intern_name}!</td></tr>
          <tr><td style="padding-top:12px;font-size:14px;color:#94a3b8;line-height:1.6;">
            You have successfully completed the <b style="color:#f8fafc;">{cert.area}</b> internship at ZoomIntern
            ({cert.start_date} → {cert.end_date}). Your official certificate is attached to this email.
          </td></tr>
          <tr><td style="padding-top:20px;font-size:13px;color:#94a3b8;">
            Certificate ID: <b style="color:#34D399;">{cert.certificate_id}</b><br/>
            Verify at: {_verify_url_for(cert.certificate_id)}
          </td></tr>
          <tr><td style="padding-top:24px;font-size:13px;color:#94a3b8;">
            Warm regards,<br/>
            <b style="color:#f8fafc;">{CEO_NAME}</b><br/>
            {CEO_TITLE}
          </td></tr>
        </table>
      </td></tr>
    </table>
    """
    params = {
        "from": SENDER_EMAIL,
        "to": [cert.intern_email],
        "subject": f"Your ZoomIntern Certificate — {cert.certificate_id}",
        "html": html,
        "attachments": [attachment],
    }
    await asyncio.to_thread(resend.Emails.send, params)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
