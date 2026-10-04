from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, File, UploadFile, Request
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
import asyncio
import logging
import random
import string
import bcrypt
import jwt
import hashlib
import secrets
import re
import ipaddress
import requests
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse, quote

from certificate_pdf import build_certificate_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
JWT_SECRET = os.environ["JWT_SECRET"]
CEO_NAME = os.environ["CEO_NAME"]
CEO_TITLE = os.environ["CEO_TITLE"]
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ["EMERGENT_EMAIL_KEY"]
EMAIL_FROM_NAME = os.environ["EMAIL_FROM_NAME"]
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ["EMERGENT_LLM_KEY"]
APP_NAME = "zoomintern"
storage_key = None

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ZoomIntern API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zoomintern")


# ---------- Managed email safety gate ----------
_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        return not any(host == shortener or host.endswith("." + shortener) for shortener in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [value for key, value in attrs if key.lower() in ("href", "src") and value]
        if tag.lower() == "a":
            self._href = dict((key.lower(), value) for key, value in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("Email content cannot contain forms or input fields")
    body = f"{subject}\n{html}".lower()
    if any(phrase in body for phrase in _CRED_ASK):
        raise ValueError("Email content cannot request credentials")
    for url in scan.urls:
        clean_url = url.strip().lower()
        if clean_url.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not clean_url.startswith("https://"):
            raise ValueError("Email links must use absolute HTTPS URLs")
        parsed = urlparse(clean_url)
        if not _host_ok(parsed.hostname or "") or parsed.username is not None:
            raise ValueError("Email link host is not permitted")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for match in _HOSTISH.finditer(text):
            if not _same_site(match.group(1).lower(), real):
                raise ValueError("Email link text does not match its destination")


async def _send_managed_email(*, to: str, subject: str, html: str) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as http_client:
            response = await http_client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        response.raise_for_status()
        return response.json().get("id")
    except Exception as error:
        logger.error("Managed email delivery failed: %s", error)
        raise RuntimeError("Email delivery could not be completed") from error


# ---------- Managed signature storage ----------
def _init_storage(force: bool = False) -> str:
    global storage_key
    if storage_key and not force:
        return storage_key
    response = requests.post(STORAGE_URL + "/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    response.raise_for_status()
    storage_key = response.json()["storage_key"]
    return storage_key


def _put_storage_object(path: str, data: bytes, content_type: str) -> dict:
    response = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": _init_storage(), "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    response.raise_for_status()
    return response.json()


def _get_storage_object(path: str) -> bytes:
    response = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": _init_storage()}, timeout=60)
    response.raise_for_status()
    return response.content


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
    intern_phone: Optional[str] = None
    whatsapp_shared: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CertificateIn(BaseModel):
    intern_name: str
    intern_email: EmailStr
    area: str
    start_date: str
    end_date: str
    issue_date: Optional[str] = None
    send_email: bool = True
    intern_phone: Optional[str] = None


class InternAccessRequest(BaseModel):
    email: EmailStr


class InternAccessVerify(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


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


def _create_intern_token(email: str) -> str:
    payload = {
        "sub": email.lower(),
        "role": "intern",
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def require_admin(request: Request, creds: HTTPAuthorizationCredentials = Depends(security)):
    token = creds.credentials if creds else request.cookies.get("zi_admin_access")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    email = payload.get("sub")
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin


async def require_intern(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Intern access is required")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired intern session")
    if payload.get("role") != "intern" or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Intern access is required")
    return payload["sub"].lower()


# ---------- Startup seeding ----------
@app.on_event("startup")
async def seed_data():
    await db.intern_access_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.admin_login_attempts.create_index("identifier", unique=True)
    existing = await db.admins.find_one({"email": ADMIN_EMAIL}, {"_id": 0})
    if not existing:
        await db.admins.insert_one({
            "email": ADMIN_EMAIL,
            "password_hash": _hash_password(ADMIN_PASSWORD),
            "name": CEO_NAME,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {ADMIN_EMAIL}")
    elif not _verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.admins.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": _hash_password(ADMIN_PASSWORD)}},
        )
        logger.info("Updated seeded admin password hash")

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
    return f"{os.environ['PUBLIC_BASE_URL'].rstrip('/')}/verify?id={cert_id}"


async def _signature_image_bytes() -> bytes | None:
    signature = await db.settings.find_one({"key": "ceo_signature"}, {"_id": 0})
    if not signature:
        return None
    try:
        return await asyncio.to_thread(_get_storage_object, signature["storage_path"])
    except Exception as error:
        logger.warning("Could not load uploaded signature: %s", error)
        return None


def _certificate_html(cert: Certificate) -> str:
    verify_url = _verify_url_for(cert.certificate_id)
    name, area = escape(cert.intern_name), escape(cert.area)
    certificate_id = escape(cert.certificate_id)
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#0b0d14;padding:24px;">
      <tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#12141d;border:1px solid #272b3c;padding:32px;">
        <tr><td style="font-size:22px;font-weight:800;color:#fbbf24;">ZoomIntern</td></tr>
        <tr><td style="padding-top:16px;font-size:20px;color:#f8fafc;">Congratulations, {name}!</td></tr>
        <tr><td style="padding-top:12px;font-size:14px;color:#94a3b8;line-height:1.6;">Your {area} internship certificate is ready. You can open and download its official PDF anytime.</td></tr>
        <tr><td style="padding-top:20px;"><a href="{verify_url}" style="background:#fbbf24;color:#090a0f;padding:12px 18px;text-decoration:none;font-weight:700;">View certificate PDF</a></td></tr>
        <tr><td style="padding-top:20px;font-size:12px;color:#94a3b8;">Certificate ID: <strong style="color:#34d399;">{certificate_id}</strong><br/>Sent by ZoomIntern.</td></tr>
      </table></td></tr>
    </table>
    """


async def _send_intern_access_code(email: str, code: str) -> None:
    subject = "Your ZoomIntern portal access code"
    html = f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;background:#0b0d14;padding:24px;">
      <tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#12141d;border:1px solid #272b3c;padding:32px;">
        <tr><td style="font-size:22px;font-weight:800;color:#fbbf24;">ZoomIntern</td></tr>
        <tr><td style="padding-top:18px;font-size:15px;color:#f8fafc;">Use this one-time code to open your certificate portal:</td></tr>
        <tr><td style="padding-top:16px;font-size:28px;letter-spacing:4px;font-weight:800;color:#34d399;">{escape(code)}</td></tr>
        <tr><td style="padding-top:18px;font-size:12px;color:#94a3b8;">This code expires in 10 minutes. Sent by ZoomIntern.</td></tr>
      </table></td></tr>
    </table>
    """
    await _send_managed_email(to=email, subject=subject, html=html)


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
    signature_image = await _signature_image_bytes()
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
        signature_image=signature_image,
    )
    filename = f"ZoomIntern-{doc['certificate_id']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ---------- Intern portal ----------
@api_router.post("/intern/access/request")
async def request_intern_access(body: InternAccessRequest):
    email = str(body.email).lower()
    certificate = await db.certificates.find_one({"intern_email": email}, {"_id": 0})
    # The response remains generic so this endpoint cannot be used to enumerate intern emails.
    if certificate:
        code = "".join(secrets.choice(string.digits) for _ in range(6))
        await db.intern_access_codes.delete_many({"email": email})
        await db.intern_access_codes.insert_one({
            "email": email,
            "code_hash": hashlib.sha256(code.encode("utf-8")).hexdigest(),
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        try:
            await _send_intern_access_code(email, code)
        except Exception as error:
            logger.warning("Intern access code could not be delivered: %s", error)
            await db.intern_access_codes.delete_many({"email": email})
    return {"status": "If a matching certificate exists, an access code has been sent."}


@api_router.post("/intern/access/verify", response_model=TokenOut)
async def verify_intern_access(body: InternAccessVerify):
    email = str(body.email).lower()
    record = await db.intern_access_codes.find_one({"email": email}, {"_id": 0})
    expires_at = record.get("expires_at") if record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    valid = record and expires_at and expires_at > datetime.now(timezone.utc)
    submitted_hash = hashlib.sha256(body.code.encode("utf-8")).hexdigest()
    if not valid or not secrets.compare_digest(record["code_hash"], submitted_hash):
        raise HTTPException(status_code=401, detail="This access code is invalid or expired")
    await db.intern_access_codes.delete_many({"email": email})
    return TokenOut(token=_create_intern_token(email), email=email)


@api_router.get("/intern/certificates", response_model=List[Certificate])
async def list_intern_certificates(email: str = Depends(require_intern)):
    return await db.certificates.find({"intern_email": email}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ---------- Admin routes ----------
@api_router.post("/admin/login", response_model=TokenOut)
async def admin_login(body: LoginIn, response: Response, request: Request):
    email = str(body.email).lower()
    identifier = email
    now = datetime.now(timezone.utc)
    attempt = await db.admin_login_attempts.find_one({"identifier": identifier}, {"_id": 0})
    locked_until = attempt.get("locked_until") if attempt else None
    if locked_until and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if locked_until and locked_until > now:
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again in 15 minutes.")

    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    if not admin or not _verify_password(body.password, admin["password_hash"]):
        failed_attempts = (attempt or {}).get("failed_attempts", 0) + 1
        updates = {
            "identifier": identifier,
            "failed_attempts": failed_attempts,
            "updated_at": now.isoformat(),
        }
        if failed_attempts >= 5:
            updates["locked_until"] = now + timedelta(minutes=15)
        await db.admin_login_attempts.update_one({"identifier": identifier}, {"$set": updates}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.admin_login_attempts.delete_many({"identifier": identifier})
    token = _create_token(admin["email"])
    response.set_cookie(
        key="zi_admin_access",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
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


@api_router.get("/admin/signature")
async def get_signature(admin=Depends(require_admin)):
    signature = await db.settings.find_one({"key": "ceo_signature"}, {"_id": 0})
    if not signature:
        return {"uploaded": False}
    return {
        "uploaded": True,
        "filename": signature["filename"],
        "uploaded_at": signature["uploaded_at"],
    }


@api_router.post("/admin/signature")
async def upload_signature(file: UploadFile = File(...), admin=Depends(require_admin)):
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Upload a PNG, JPEG, or WEBP signature image")
    data = await file.read()
    if not data or len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Signature image must be between 1 byte and 2 MB")
    extension = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}[file.content_type]
    storage_path = f"{APP_NAME}/uploads/signatures/{uuid.uuid4()}.{extension}"
    try:
        result = await asyncio.to_thread(_put_storage_object, storage_path, data, file.content_type)
    except Exception as error:
        logger.error("Signature upload failed: %s", error)
        raise HTTPException(status_code=502, detail="Signature upload could not be completed") from error
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"key": "ceo_signature"},
        {"$set": {
            "key": "ceo_signature",
            "storage_path": result["path"],
            "filename": file.filename or f"ceo-signature.{extension}",
            "content_type": file.content_type,
            "size": result["size"],
            "uploaded_at": now,
            "is_deleted": False,
        }},
        upsert=True,
    )
    return {"uploaded": True, "filename": file.filename or f"ceo-signature.{extension}", "uploaded_at": now}


@api_router.post("/admin/certificates", response_model=Certificate)
async def issue_certificate(body: CertificateIn, admin=Depends(require_admin)):
    if body.intern_phone and not re.fullmatch(r"\+[1-9]\d{7,14}", body.intern_phone.strip()):
        raise HTTPException(status_code=400, detail="WhatsApp number must use international format, for example +14155552671")
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
        intern_phone=body.intern_phone.strip() if body.intern_phone else None,
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


@api_router.post("/admin/certificates/{cert_id}/whatsapp")
async def share_certificate_whatsapp(cert_id: str, admin=Depends(require_admin)):
    doc = await db.certificates.find_one({"certificate_id": cert_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Certificate not found")
    phone = doc.get("intern_phone")
    if not phone:
        raise HTTPException(status_code=400, detail="Add the intern's WhatsApp number when issuing the certificate")
    number = re.sub(r"\D", "", phone)
    certificate_url = _verify_url_for(cert_id)
    message = (
        f"Congratulations {doc['intern_name']}! Your ZoomIntern certificate ({cert_id}) is ready. "
        f"Open and download the official PDF: {certificate_url}"
    )
    await db.certificates.update_one({"certificate_id": cert_id}, {"$set": {"whatsapp_shared": True}})
    return {"url": f"https://wa.me/{number}?text={quote(message)}"}


@api_router.delete("/admin/certificates/{cert_id}")
async def delete_certificate(cert_id: str, admin=Depends(require_admin)):
    res = await db.certificates.delete_one({"certificate_id": cert_id})
    return {"deleted": res.deleted_count}


async def _send_certificate_email(cert: Certificate):
    await _send_managed_email(
        to=str(cert.intern_email),
        subject=f"Your ZoomIntern certificate — {cert.certificate_id}",
        html=_certificate_html(cert),
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
