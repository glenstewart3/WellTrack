from fastapi import APIRouter, Depends, Request, Response
from datetime import datetime, timezone, timedelta
import uuid
import os
import httpx
from passlib.context import CryptContext

from database import db
from helpers import get_current_user, get_school_settings_doc

router = APIRouter()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Cookie security — set COOKIE_SECURE=false in .env for plain HTTP local servers
_COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true').lower() != 'false'
_COOKIE_SAMESITE = 'none' if _COOKIE_SECURE else 'lax'

def _set_session_cookie(response, token: str):
    response.set_cookie(
        key='session_token', value=token,
        httponly=True, secure=_COOKIE_SECURE,
        samesite=_COOKIE_SAMESITE, path='/',
        max_age=7 * 24 * 3600,
    )


@router.post("/auth/login-email")
async def login_email(data: dict, response: Response):
    from fastapi import HTTPException
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    settings = await db.school_settings.find_one({}, {"_id": 0})
    if not settings or not settings.get("email_auth_enabled", False):
        raise HTTPException(status_code=403, detail="Email login is not enabled for this school")

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
    onboarding_complete = bool(settings and settings.get("onboarding_complete"))
    return {"message": "Login successful", "redirect": "dashboard" if onboarding_complete else "onboarding"}


@router.put("/auth/change-password")
async def change_password(data: dict, user=Depends(get_current_user)):
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
async def set_user_password(user_id: str, data: dict, user=Depends(get_current_user)):
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


# ── Google OAuth ─────────────────────────────────────────────────────────────
@router.get("/auth/google")
async def google_login(request: Request):
    from fastapi import HTTPException
    settings = await db.school_settings.find_one({}, {"_id": 0})
    if settings and not settings.get("google_auth_enabled", True):
        raise HTTPException(status_code=403, detail="Google login is not enabled")
    from urllib.parse import urlencode
    state = uuid.uuid4().hex
    await db.oauth_states.insert_one({
        "state": state,
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
    from fastapi.responses import RedirectResponse
    frontend_url = os.environ['FRONTEND_URL']
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        return RedirectResponse(url=f"{frontend_url}/login?error=access_denied")
    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    state_doc = await db.oauth_states.find_one_and_delete({"state": state})
    if not state_doc:
        return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

    expires_at_str = state_doc.get("expires_at", "")
    if expires_at_str:
        exp = datetime.fromisoformat(expires_at_str).replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            return RedirectResponse(url=f"{frontend_url}/login?error=auth_failed")

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

    user_id = existing["user_id"]
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    onboarding_complete = bool(settings_doc and settings_doc.get("onboarding_complete"))
    redirect_target = "dashboard" if onboarding_complete else "onboarding"

    redirect = RedirectResponse(url=f"{frontend_url}/{redirect_target}")
    _set_session_cookie(redirect, session_token)
    return redirect


@router.put("/auth/preferences")
async def update_preferences(data: dict, user=Depends(get_current_user)):
    from fastapi import HTTPException
    allowed = {"default", "dark", "midnight", "ocean", "forest", "warm"}
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
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/", samesite="none", secure=True)
    return {"message": "Logged out"}


@router.put("/auth/role")
async def update_role(data: dict, user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change user roles")
    target_user_id = data.get("user_id", user["user_id"])
    role = data.get("role")
    if role not in ["teacher", "wellbeing", "leadership", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": target_user_id}, {"$set": {"role": role}})
    return {"message": "Role updated", "role": role}


# ── Onboarding ──────────────────────────────────────────────────────────────

@router.get("/onboarding/status")
async def get_onboarding_status():
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
async def onboarding_setup(data: dict):
    """Fresh-install setup: creates first admin account + saves school settings. No auth required."""
    from fastapi import HTTPException
    from fastapi.responses import JSONResponse
    user_count = await db.users.count_documents({})
    existing = await db.school_settings.find_one({}, {"_id": 0})
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
async def complete_onboarding(data: dict, user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await db.school_settings.update_one(
        {},
        {"$set": {
            "school_name": data.get("school_name", "My School"),
            "school_type": data.get("school_type", "both"),
            "current_term": data.get("current_term", "Term 1"),
            "current_year": data.get("current_year", 2025),
            "onboarding_complete": True,
        }},
        upsert=True
    )
    return {"message": "Onboarding complete"}


# ── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_users(user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await db.users.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/users")
async def create_user(data: dict, user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    email = data.get("email", "").lower().strip()
    name = data.get("name", "")
    role = data.get("role", "teacher")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="User with this email already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    new_user = {"user_id": user_id, "email": email, "name": name,
                "picture": "", "role": role,
                "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one({**new_user})
    return new_user


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, data: dict, user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    role = data.get("role")
    if role not in ["teacher", "wellbeing", "leadership", "admin", "screener"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": role}})
    return {"message": "Role updated"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    return {"message": "User deleted"}
