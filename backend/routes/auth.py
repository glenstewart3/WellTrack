from fastapi import APIRouter, Depends, Request, Response
from datetime import datetime, timezone, timedelta
import uuid
import os
import httpx
from passlib.context import CryptContext

from deps import get_tenant_db
from helpers import get_current_user, get_school_settings_doc
from utils.audit import log_audit

router = APIRouter()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Cookie security — set COOKIE_SECURE=false in .env for plain HTTP local servers
_COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true').lower() != 'false'
_COOKIE_SAMESITE = 'none' if _COOKIE_SECURE else 'lax'


async def _get_settings(db):
    """Return the canonical school settings doc, preferring the one with onboarding_complete=True."""
    s = await db.school_settings.find_one({"onboarding_complete": True}, {"_id": 0})
    return s or await db.school_settings.find_one({}, {"_id": 0})

def _set_session_cookie(response, token: str, cross_subdomain: bool = False):
    """Set session cookie. If cross_subdomain=True and in production, sets Domain for subdomain sharing."""
    cookie_kwargs = dict(
        key='session_token', value=token,
        httponly=True, secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE, path='/',
        max_age=7 * 24 * 3600,
    )
    # In production, set Domain=.welltrack.com.au so cookie works across subdomains
    if cross_subdomain and os.environ.get('APP_ENV', 'production') == 'production':
        base_domain = os.environ.get('BASE_DOMAIN', 'welltrack.com.au')
        cookie_kwargs['domain'] = f'.{base_domain}'
    response.set_cookie(**cookie_kwargs)


@router.post("/auth/login-email")
async def login_email(data: dict, response: Response, db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    settings = await _get_settings(db)
    # Default email_auth to True — if the field was never explicitly saved, allow login
    if not settings or settings.get("email_auth_enabled", True) is False:
        raise HTTPException(status_code=403, detail="Email login is not enabled. Go to Settings → Integrations to enable it.")

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not _pwd.verify(password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"], "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _set_session_cookie(response, session_token)
    # Determine where to send the user — always go to dashboard if setup is done
    is_complete = bool(settings and settings.get("onboarding_complete")) or \
                  await db.users.count_documents({}) > 1
    return {"message": "Login successful", "redirect": "dashboard" if is_complete else "onboarding"}


@router.put("/auth/change-password")
async def change_password(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    current_pw = data.get("current_password", "")
    new_pw = data.get("new_password", "")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    existing_hash = user_doc.get("password_hash") if user_doc else None
    if existing_hash and not _pwd.verify(current_pw, existing_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": _pwd.hash(new_pw)}})
    return {"message": "Password changed successfully"}


@router.post("/users/{user_id}/set-password")
async def set_user_password(user_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    password = data.get("password", "")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": _pwd.hash(password)}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Password set successfully"}


# ── Google OAuth (Multi-Tenant) ──────────────────────────────────────────────
# OAuth state is stored in control_db so the callback (which always hits the
# root domain) can resolve the tenant without needing middleware context.

@router.get("/auth/google")
async def google_login(request: Request, db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    settings = await _get_settings(db)
    if settings and not settings.get("google_auth_enabled", True):
        raise HTTPException(status_code=403, detail="Google login is not enabled")

    from urllib.parse import urlencode
    from control_db import control_db

    tenant_slug = getattr(request.state, "tenant_slug", None)
    state = uuid.uuid4().hex
    await control_db.oauth_states.insert_one({
        "state": state,
        "tenant_slug": tenant_slug,
        "is_super_admin": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    })
    params = urlencode({
        "response_type": "code",
        "client_id": os.environ['GOOGLE_CLIENT_ID'],
        "redirect_uri": os.environ['GOOGLE_REDIRECT_URI'],
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    })
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/auth/callback")
async def google_callback(request: Request):
    """
    Google OAuth callback — tenant-aware.
    Resolves the school from the state stored in control_db, NOT from middleware.
    This allows a single callback URL on the root domain for all schools.
    """
    from fastapi.responses import RedirectResponse
    from control_db import control_db
    from database import client

    frontend_url = os.environ['FRONTEND_URL']
    base_domain = os.environ.get("BASE_DOMAIN", "welltrack.com.au")
    app_env = os.environ.get("APP_ENV", "production")
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")
    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    # 1. Look up state in control_db (not tenant DB)
    state_doc = await control_db.oauth_states.find_one_and_delete({"state": state})
    if not state_doc:
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    expires_at_str = state_doc.get("expires_at", "")
    if expires_at_str:
        exp = datetime.fromisoformat(expires_at_str).replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    # 2. Extract tenant slug
    tenant_slug = state_doc.get("tenant_slug")

    # 3. Resolve the school DB
    if not tenant_slug:
        # No tenant → reject (SA OAuth is handled separately)
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    school = await control_db.schools.find_one({"slug": tenant_slug}, {"_id": 0})
    if not school or school.get("status") in ("suspended", "archived"):
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")

    # Check if Google auth is enabled for this school
    feature_flags = school.get("feature_flags", {})
    if feature_flags.get("google_auth") is False:
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")

    db = client[school["db_name"]]

    # 4. Exchange code for tokens
    try:
        async with httpx.AsyncClient() as hc:
            tok_resp = await hc.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": os.environ['GOOGLE_CLIENT_ID'],
                    "client_secret": os.environ['GOOGLE_CLIENT_SECRET'],
                    "redirect_uri": os.environ['GOOGLE_REDIRECT_URI'],
                    "grant_type": "authorization_code",
                },
            )
        if tok_resp.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")
        access_token = tok_resp.json().get("access_token")

        async with httpx.AsyncClient() as hc:
            ui_resp = await hc.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
        if ui_resp.status_code != 200:
            return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")
        user_info = ui_resp.json()
    except Exception:
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    email = user_info.get('email', '').lower().strip()
    name = user_info.get('name', '')
    picture = user_info.get('picture', '')

    if not email:
        return RedirectResponse(url=f"{frontend_url}/login?error=no_email")

    # 5. Look up user in the school's DB
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    user_count = await db.users.count_documents({})

    if user_count == 0:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {"user_id": user_id, "email": email, "name": name,
                    "picture": picture, "role": "admin",
                    "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one({**new_user})
        existing = new_user
    elif not existing:
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")
    else:
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
        existing = {**existing, "name": name, "picture": picture}

    # 6. Create session in school DB
    user_id = existing["user_id"]
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    settings_doc = await _get_settings(db)
    onboarding_complete = bool(settings_doc and settings_doc.get("onboarding_complete"))
    redirect_target = "dashboard" if onboarding_complete else "onboarding"

    # 7. Build redirect URL — in production, redirect to school subdomain
    if app_env == "production":
        redirect_url = f"https://{tenant_slug}.{base_domain}/{redirect_target}"
    else:
        redirect_url = f"{frontend_url}/{redirect_target}"

    redirect = RedirectResponse(url=redirect_url)
    _set_session_cookie(redirect, session_token, cross_subdomain=True)
    return redirect


@router.put("/auth/preferences")
async def update_preferences(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    allowed = {"default", "dark", "system"}
    theme = data.get("theme")
    if theme is not None and theme not in allowed:
        raise HTTPException(status_code=400, detail="Invalid theme")
    update = {}
    if theme is not None:
        update["theme"] = theme
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"message": "Preferences updated"}


@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    return user


@router.post("/auth/logout")
async def logout(request: Request, response: Response, db=Depends(get_tenant_db)):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite=_COOKIE_SAMESITE, secure=_COOKIE_SECURE)
    return {"message": "Logged out"}


@router.put("/auth/role")
async def update_role(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change user roles")
    target_user_id = data.get("user_id", user["user_id"])
    role = data.get("role")
    if role not in ["teacher", "wellbeing", "leadership", "admin", "screener", "professional"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": target_user_id}, {"$set": {"role": role}})
    return {"message": "Role updated", "role": role}



# ── Onboarding ──────────────────────────────────────────────────────────────

@router.get("/onboarding/status")
async def get_onboarding_status(db=Depends(get_tenant_db)):
    # Prefer a doc that explicitly has onboarding_complete=True, then fall back to any doc
    settings = await db.school_settings.find_one({"onboarding_complete": True}, {"_id": 0})
    if not settings:
        settings = await db.school_settings.find_one({}, {"_id": 0})
    user_count = await db.users.count_documents({})
    # Treat as complete if flag is set OR if users already exist (can't run onboarding twice)
    complete = bool(settings and settings.get("onboarding_complete", False)) or user_count > 0
    return {
        "complete": complete,
        "has_users": user_count > 0,
        "school_name": settings.get("school_name", "") if settings else "",
    }


@router.post("/onboarding/setup")
async def onboarding_setup(data: dict, db=Depends(get_tenant_db)):
    """Fresh-install setup: creates first admin account + saves school settings. No auth required."""
    from fastapi import HTTPException
    from fastapi.responses import JSONResponse
    user_count = await db.users.count_documents({})
    existing = await _get_settings(db)
    if user_count > 0 or (existing and existing.get("onboarding_complete")):
        raise HTTPException(status_code=400, detail="Setup has already been completed")

    name = data.get("admin_name", "").strip()
    email = data.get("admin_email", "").lower().strip()
    password = data.get("admin_password", "")
    if not name or not email or len(password) < 8:
        raise HTTPException(status_code=400, detail="Name, email and a password of at least 8 characters are required")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": name,
        "picture": "", "role": "admin",
        "password_hash": _pwd.hash(password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.school_settings.update_one({}, {"$set": {
        "school_name": data.get("school_name", "My School"),
        "school_type": data.get("school_type", "both"),
        "current_term": data.get("current_term", "Term 1"),
        "current_year": data.get("current_year", datetime.now(timezone.utc).year),
        "email_auth_enabled": True,
        "google_auth_enabled": data.get("google_auth_enabled", True),
        "onboarding_complete": True,
    }}, upsert=True)

    session_token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    resp = JSONResponse({"message": "Setup complete", "user_id": user_id})
    _set_session_cookie(resp, session_token)
    return resp


@router.post("/onboarding/complete")
async def complete_onboarding(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.school_settings.update_one(
        {},
        {"$set": {
            "school_name": data.get("school_name", "My School"),
            "school_type": data.get("school_type", "both"),
            "current_term": data.get("current_term", "Term 1"),
            "current_year": data.get("current_year", datetime.now(timezone.utc).year),
            "onboarding_complete": True,
        }},
        upsert=True
    )
    return {"message": "Onboarding complete"}


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.users.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/users")
async def create_user(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    email = data.get("email", "").lower().strip()
    name = data.get("name", "")
    role = data.get("role", "teacher")
    _valid_roles = {"teacher", "wellbeing", "leadership", "admin", "screener", "professional"}
    if role not in _valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(_valid_roles))}")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="User with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {"user_id": user_id, "email": email, "name": name,
                "picture": "", "role": role,
                "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one({**new_user})
    await log_audit(db, user, "created", "user", user_id, f"{name} ({email})", metadata={"role": role})
    return new_user


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    role = data.get("role")
    if role not in ["teacher", "wellbeing", "leadership", "admin", "screener", "professional"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": role}})
    target = await db.users.find_one({"user_id": user_id}, {"name": 1, "email": 1, "_id": 0})
    await log_audit(db, user, "updated", "user", user_id,
                    f"{target.get('name','?')} ({target.get('email','?')})" if target else user_id,
                    changes={"role": {"new": role}})
    return {"message": "Role updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = await db.users.find_one({"user_id": user_id}, {"name": 1, "email": 1, "_id": 0})
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await log_audit(db, user, "deleted", "user", user_id,
                    f"{target.get('name','?')} ({target.get('email','?')})" if target else user_id)
    return {"message": "User deleted"}


@router.put("/users/{user_id}/professional")
async def update_user_professional(user_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    allowed = {
        "professional_type", "appointment_access",
        "visit_days", "accessible_intervention_types", "cross_professional_view",
    }
    update = {k: v for k, v in data.items() if k in allowed}
    if not update:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"user_id": user_id}, {"$set": update})
    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "hashed_password": 0, "password_hash": 0})
    await log_audit(db, user, "updated", "user", user_id,
                    f"{updated.get('name','?')} — professional settings" if updated else user_id,
                    changes={k: v for k, v in update.items()})
    return updated
