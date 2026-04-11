"""
routes/superadmin.py — Super Admin portal endpoints.
All endpoints are prefixed with /superadmin by the router.
Auth is separate from school auth — uses control_db.super_admins + control_db.super_admin_sessions.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from datetime import datetime, timezone, timedelta
from pathlib import Path
import uuid
import os
import re
import logging

from passlib.context import CryptContext

from control_db import control_db
from database import client, SETTINGS_DEFAULTS
from server_utils import ensure_indexes

router = APIRouter()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger("superadmin")

_COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true').lower() != 'false'
_COOKIE_SAMESITE = 'none' if _COOKIE_SECURE else 'lax'

RESERVED_SLUGS = {"www", "api", "admin", "superadmin", "app", "mail", "ftp", "test", "demo", "staging", "dev"}


# ── Super Admin Auth Dependency ──────────────────────────────────────────────

async def get_super_admin(request: Request):
    """Validate super admin session from sa_session_token cookie."""
    token = request.cookies.get("sa_session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await control_db.super_admin_sessions.find_one(
        {"session_token": token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    admin = await control_db.super_admins.find_one(
        {"super_admin_id": session["super_admin_id"]}, {"_id": 0, "password_hash": 0}
    )
    if not admin:
        raise HTTPException(status_code=401, detail="Super admin not found")
    return admin


def _set_sa_cookie(response, token: str):
    response.set_cookie(
        key="sa_session_token", value=token,
        httponly=True, secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE, path="/",
        max_age=7 * 24 * 3600,
    )


async def _log_sa_audit(admin, action: str, entity_type: str, entity_id: str = "",
                         entity_name: str = "", details: dict = None):
    try:
        await control_db.super_admin_audit.insert_one({
            "audit_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "super_admin_id": admin.get("super_admin_id", "system"),
            "super_admin_name": admin.get("name", "Unknown"),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "details": details or {},
        })
    except Exception as exc:
        logger.warning("SA audit log write failed: %s", exc)


# ── Bootstrap ────────────────────────────────────────────────────────────────

@router.post("/superadmin/auth/bootstrap")
async def bootstrap_super_admin(data: dict):
    """One-time bootstrap: creates the first super admin. Rejects if any super admin already exists."""
    count = await control_db.super_admins.count_documents({})
    if count > 0:
        raise HTTPException(status_code=403, detail="Bootstrap already complete. Super admin(s) already exist.")
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    if not name or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Name, email, and password (min 8 chars) are required")
    sa_id = f"sa_{uuid.uuid4().hex[:12]}"
    await control_db.super_admins.insert_one({
        "super_admin_id": sa_id,
        "name": name,
        "email": email,
        "password_hash": _pwd.hash(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"Bootstrap: first super admin created — {email}")
    return {"message": "Super admin created successfully", "super_admin_id": sa_id}


# ── Auth ─────────────────────────────────────────────────────────────────────

@router.post("/superadmin/auth/login-email")
async def sa_login(data: dict, response: Response):
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    admin = await control_db.super_admins.find_one({"email": email}, {"_id": 0})
    if not admin or not admin.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _pwd.verify(password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = f"sa_sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await control_db.super_admin_sessions.insert_one({
        "super_admin_id": admin["super_admin_id"],
        "session_token": token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _set_sa_cookie(response, token)
    await _log_sa_audit(admin, "login", "super_admin", admin["super_admin_id"], admin["name"])
    return {"message": "Login successful"}


@router.get("/superadmin/auth/me")
async def sa_me(admin=Depends(get_super_admin)):
    return admin


@router.post("/superadmin/auth/logout")
async def sa_logout(request: Request, response: Response):
    token = request.cookies.get("sa_session_token")
    if token:
        await control_db.super_admin_sessions.delete_one({"session_token": token})
    response.delete_cookie("sa_session_token", path="/", samesite=_COOKIE_SAMESITE, secure=_COOKIE_SECURE)
    return {"message": "Logged out"}


@router.put("/superadmin/auth/change-password")
async def sa_change_password(data: dict, admin=Depends(get_super_admin)):
    current = data.get("current_password", "")
    new_pw = data.get("new_password", "")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    full_admin = await control_db.super_admins.find_one(
        {"super_admin_id": admin["super_admin_id"]}, {"_id": 0}
    )
    if full_admin.get("password_hash") and not _pwd.verify(current, full_admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await control_db.super_admins.update_one(
        {"super_admin_id": admin["super_admin_id"]},
        {"$set": {"password_hash": _pwd.hash(new_pw)}}
    )
    return {"message": "Password changed"}


# ── Platform Stats ───────────────────────────────────────────────────────────

@router.get("/superadmin/stats")
async def platform_stats(admin=Depends(get_super_admin)):
    schools = await control_db.schools.find({}, {"_id": 0}).to_list(500)
    total = len(schools)
    active = sum(1 for s in schools if s.get("status") == "active")
    trial = sum(1 for s in schools if s.get("status") == "trial")
    suspended = sum(1 for s in schools if s.get("status") == "suspended")
    archived = sum(1 for s in schools if s.get("status") == "archived")

    total_students = 0
    for school in schools:
        if school.get("status") in ("active", "trial"):
            try:
                school_db = client[school["db_name"]]
                count = await school_db.students.count_documents({"enrolment_status": "active"})
                total_students += count
            except Exception:
                pass

    return {
        "total_schools": total, "active_schools": active, "trial_schools": trial,
        "suspended_schools": suspended, "archived_schools": archived,
        "total_students": total_students,
    }


# ── Schools CRUD ─────────────────────────────────────────────────────────────

@router.get("/superadmin/schools")
async def list_schools(admin=Depends(get_super_admin)):
    schools = await control_db.schools.find({}, {"_id": 0}).to_list(500)
    enriched = []
    for s in schools:
        info = {**s}
        if s.get("status") in ("active", "trial"):
            try:
                school_db = client[s["db_name"]]
                student_count = await school_db.students.count_documents({"enrolment_status": "active"})
                admin_count = await school_db.users.count_documents({"role": "admin"})
                user_count = await school_db.users.count_documents({})
                last_session = await school_db.user_sessions.find_one(
                    {}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)]
                )
                info["student_count"] = student_count
                info["admin_count"] = admin_count
                info["user_count"] = user_count
                info["last_active"] = last_session.get("created_at") if last_session else None
            except Exception:
                info["student_count"] = 0
                info["admin_count"] = 0
                info["user_count"] = 0
                info["last_active"] = None
        else:
            info["student_count"] = 0
            info["admin_count"] = 0
            info["user_count"] = 0
            info["last_active"] = None
        enriched.append(info)
    return enriched


@router.post("/superadmin/schools")
async def create_school(data: dict, admin=Depends(get_super_admin)):
    """Provision a new school: create control record, DB, first admin, indexes, settings."""
    name = data.get("name", "").strip()
    slug = data.get("slug", "").strip().lower()
    contact_name = data.get("contact_name", "").strip()
    contact_email = data.get("contact_email", "").lower().strip()
    admin_name = data.get("admin_name", "").strip()
    admin_email = data.get("admin_email", "").lower().strip()
    admin_password = data.get("admin_password", "")
    status = data.get("status", "active")
    trial_days = int(data.get("trial_days", 30))
    notes = data.get("notes", "")
    feature_flags = data.get("feature_flags", {})

    if not name:
        raise HTTPException(400, "School name is required")
    if not slug:
        raise HTTPException(400, "Slug is required")
    if not re.match(r'^[a-z0-9][a-z0-9\-]*[a-z0-9]$', slug) and len(slug) > 1:
        raise HTTPException(400, "Slug must be lowercase alphanumeric with hyphens, start/end with a letter or number")
    if len(slug) == 1 and not slug.isalnum():
        raise HTTPException(400, "Single-character slug must be alphanumeric")
    if slug in RESERVED_SLUGS:
        raise HTTPException(400, f"Slug '{slug}' is reserved")
    if not admin_name or not admin_email or len(admin_password) < 8:
        raise HTTPException(400, "Admin name, email, and password (min 8 chars) are required")
    if status not in ("active", "trial"):
        raise HTTPException(400, "Status must be 'active' or 'trial'")

    existing = await control_db.schools.find_one({"slug": slug})
    if existing:
        raise HTTPException(409, f"A school with slug '{slug}' already exists")

    now = datetime.now(timezone.utc)
    db_name = f"welltrack_{slug.replace('-', '_')}"
    school_id = f"sch_{uuid.uuid4().hex[:12]}"

    school_record = {
        "school_id": school_id,
        "name": name,
        "slug": slug,
        "db_name": db_name,
        "status": status,
        "trial_expires_at": (now + timedelta(days=trial_days)).isoformat() if status == "trial" else None,
        "contact_name": contact_name,
        "contact_email": contact_email,
        "created_at": now.isoformat(),
        "created_by": admin["super_admin_id"],
        "notes": notes,
        "feature_flags": feature_flags,
    }

    # 1. Create school record in control DB
    await control_db.schools.insert_one({**school_record})

    # 2. Set up the school's database
    school_db = client[db_name]

    # 3. Create first admin user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await school_db.users.insert_one({
        "user_id": user_id,
        "email": admin_email,
        "name": admin_name,
        "password_hash": _pwd.hash(admin_password),
        "picture": "",
        "role": "admin",
        "created_at": now.isoformat(),
    })

    # 4. Seed initial school settings
    initial_settings = {k: v for k, v in SETTINGS_DEFAULTS.items()}
    initial_settings.update({
        "school_name": name,
        "onboarding_complete": False,
        "email_auth_enabled": True,
        "google_auth_enabled": True,
    })
    await school_db.school_settings.insert_one({**initial_settings})

    # 5. Create uploads directory
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads" / slug / "student_photos"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # 6. Ensure indexes
    await ensure_indexes(school_db)

    # 7. Audit log
    await _log_sa_audit(admin, "created_school", "school", school_id, name,
                        {"slug": slug, "admin_email": admin_email, "status": status})

    logger.info(f"School provisioned: {name} (slug={slug}, db={db_name})")

    return {
        **school_record,
        "admin_user_id": user_id,
        "admin_email": admin_email,
        "db_name": db_name,
    }


@router.get("/superadmin/schools/{school_id}")
async def get_school(school_id: str, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    # Enrich with live stats
    try:
        school_db = client[school["db_name"]]
        school["student_count"] = await school_db.students.count_documents({"enrolment_status": "active"})
        school["admin_count"] = await school_db.users.count_documents({"role": "admin"})
        school["user_count"] = await school_db.users.count_documents({})
        last_session = await school_db.user_sessions.find_one(
            {}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)]
        )
        school["last_active"] = last_session.get("created_at") if last_session else None
        settings = await school_db.school_settings.find_one({}, {"_id": 0})
        school["onboarding_complete"] = (settings or {}).get("onboarding_complete", False)
    except Exception:
        school["student_count"] = 0
        school["admin_count"] = 0
        school["user_count"] = 0
        school["last_active"] = None
        school["onboarding_complete"] = False
    return school


@router.put("/superadmin/schools/{school_id}")
async def update_school(school_id: str, data: dict, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    allowed = {"name", "contact_name", "contact_email", "notes", "status", "feature_flags", "trial_expires_at"}
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(400, "No valid fields to update")
    if "status" in update and update["status"] not in ("active", "trial", "suspended", "archived"):
        raise HTTPException(400, "Invalid status")
    await control_db.schools.update_one({"school_id": school_id}, {"$set": update})
    await _log_sa_audit(admin, "updated_school", "school", school_id, school["name"],
                        {"changes": update})
    updated = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    return updated


@router.delete("/superadmin/schools/{school_id}")
async def archive_school(school_id: str, admin=Depends(get_super_admin)):
    """Archive a school (never deletes the DB)."""
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    await control_db.schools.update_one(
        {"school_id": school_id},
        {"$set": {"status": "archived", "archived_at": datetime.now(timezone.utc).isoformat()}}
    )
    await _log_sa_audit(admin, "archived_school", "school", school_id, school["name"])
    return {"message": f"School '{school['name']}' archived"}


# ── School Admins ────────────────────────────────────────────────────────────

@router.get("/superadmin/schools/{school_id}/admins")
async def list_school_admins(school_id: str, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    school_db = client[school["db_name"]]
    users = await school_db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(200)
    return users


@router.post("/superadmin/schools/{school_id}/admins")
async def add_school_admin(school_id: str, data: dict, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    role = data.get("role", "admin")
    if not name or not email or len(password) < 8:
        raise HTTPException(400, "Name, email, and password (min 8 chars) are required")
    school_db = client[school["db_name"]]
    existing = await school_db.users.find_one({"email": email})
    if existing:
        raise HTTPException(409, f"A user with email '{email}' already exists in this school")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "password_hash": _pwd.hash(password),
        "picture": "",
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await school_db.users.insert_one({**new_user})
    await _log_sa_audit(admin, "added_school_admin", "school", school_id, school["name"],
                        {"user_email": email, "role": role})
    return {"user_id": user_id, "email": email, "name": name, "role": role}


@router.delete("/superadmin/schools/{school_id}/admins/{user_id}")
async def remove_school_admin(school_id: str, user_id: str, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    school_db = client[school["db_name"]]
    target = await school_db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not target:
        raise HTTPException(404, "User not found in this school")
    await school_db.users.delete_one({"user_id": user_id})
    await school_db.user_sessions.delete_many({"user_id": user_id})
    await _log_sa_audit(admin, "removed_school_admin", "school", school_id, school["name"],
                        {"user_id": user_id, "user_email": target.get("email", "")})
    return {"message": "User removed"}


@router.put("/superadmin/schools/{school_id}/admins/{user_id}/reset-password")
async def reset_school_admin_password(school_id: str, user_id: str, data: dict, admin=Depends(get_super_admin)):
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    password = data.get("password", "")
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    school_db = client[school["db_name"]]
    result = await school_db.users.update_one(
        {"user_id": user_id}, {"$set": {"password_hash": _pwd.hash(password)}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    await _log_sa_audit(admin, "reset_password", "school", school_id, school["name"],
                        {"user_id": user_id})
    return {"message": "Password reset successfully"}


# ── Impersonation ────────────────────────────────────────────────────────────

@router.post("/superadmin/schools/{school_id}/impersonate")
async def impersonate_school(school_id: str, admin=Depends(get_super_admin)):
    """Generate a one-time impersonation token for a school (30-min expiry)."""
    school = await control_db.schools.find_one({"school_id": school_id}, {"_id": 0})
    if not school:
        raise HTTPException(404, "School not found")
    if school.get("status") not in ("active", "trial"):
        raise HTTPException(400, "Cannot impersonate an inactive school")
    school_db = client[school["db_name"]]
    token = f"imp_{uuid.uuid4().hex}"
    await school_db.impersonation_tokens.insert_one({
        "token": token,
        "super_admin_id": admin["super_admin_id"],
        "super_admin_name": admin.get("name", ""),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat(),
        "used": False,
    })
    await _log_sa_audit(admin, "impersonated", "school", school_id, school["name"])
    return {"token": token, "school_slug": school["slug"], "school_name": school["name"]}


# ── Super Admin Audit Log ────────────────────────────────────────────────────

@router.get("/superadmin/audit")
async def sa_audit_log(
    page: int = 0, per_page: int = 50,
    admin=Depends(get_super_admin),
):
    total = await control_db.super_admin_audit.count_documents({})
    entries = await control_db.super_admin_audit.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).skip(page * per_page).limit(per_page).to_list(None)
    return {"total": total, "page": page, "per_page": per_page, "entries": entries}


# ── Super Admins CRUD ────────────────────────────────────────────────────────

@router.get("/superadmin/super-admins")
async def list_super_admins(admin=Depends(get_super_admin)):
    admins = await control_db.super_admins.find({}, {"_id": 0, "password_hash": 0}).to_list(50)
    return admins


@router.post("/superadmin/super-admins")
async def create_super_admin(data: dict, admin=Depends(get_super_admin)):
    name = data.get("name", "").strip()
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    if not name or not email or len(password) < 8:
        raise HTTPException(400, "Name, email, and password (min 8 chars) are required")
    existing = await control_db.super_admins.find_one({"email": email})
    if existing:
        raise HTTPException(409, "A super admin with this email already exists")
    sa_id = f"sa_{uuid.uuid4().hex[:12]}"
    await control_db.super_admins.insert_one({
        "super_admin_id": sa_id,
        "name": name,
        "email": email,
        "password_hash": _pwd.hash(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await _log_sa_audit(admin, "created_super_admin", "super_admin", sa_id, name)
    return {"super_admin_id": sa_id, "name": name, "email": email}


@router.delete("/superadmin/super-admins/{sa_id}")
async def delete_super_admin(sa_id: str, admin=Depends(get_super_admin)):
    if sa_id == admin["super_admin_id"]:
        raise HTTPException(400, "Cannot delete your own account")
    target = await control_db.super_admins.find_one({"super_admin_id": sa_id}, {"_id": 0})
    if not target:
        raise HTTPException(404, "Super admin not found")
    await control_db.super_admins.delete_one({"super_admin_id": sa_id})
    await control_db.super_admin_sessions.delete_many({"super_admin_id": sa_id})
    await _log_sa_audit(admin, "deleted_super_admin", "super_admin", sa_id, target.get("name", ""))
    return {"message": "Super admin deleted"}
