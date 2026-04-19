from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, date as date_type, timedelta
from typing import Optional
import json
import io
import csv
import uuid
import httpx

from database import SETTINGS_DEFAULTS
from deps import get_tenant_db
from helpers import get_current_user, get_student_attendance_pct
from utils.audit import log_audit

router = APIRouter()


@router.get("/public-settings")
async def public_settings(request: Request, db=Depends(get_tenant_db)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    base = {k: SETTINGS_DEFAULTS[k] for k in ("platform_name", "accent_color", "logo_base64", "logo_dark_base64", "welcome_message", "school_name", "email_auth_enabled", "google_auth_enabled")}
    if s:
        for k in base:
            if s.get(k) is not None:
                base[k] = s[k]

    # Inject school-level metadata from control DB (set by TenantMiddleware)
    school = getattr(request.state, "school", None)
    if school:
        base["feature_flags"] = school.get("feature_flags", {})
        base["school_status"] = school.get("status", "active")
        base["trial_expires_at"] = school.get("trial_expires_at")
    else:
        base["feature_flags"] = {}
        base["school_status"] = "active"
        base["trial_expires_at"] = None

    return base


@router.get("/school-days")
async def get_school_days(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    days = await db.school_days.distinct("date")
    return {"school_days": sorted(days), "total": len(days)}


@router.get("/settings")
async def get_settings(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    return {**SETTINGS_DEFAULTS, **(s or {})}


@router.put("/settings")
async def update_settings(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    data.pop("_id", None)
    data.pop("onboarding_complete", None)
    await db.school_settings.update_one({}, {"$set": data}, upsert=True)
    result = await db.school_settings.find_one({}, {"_id": 0})
    await log_audit(db, user, "updated", "setting", "school_settings", "School Settings",
                    metadata={"keys_changed": list(data.keys())})
    return {**SETTINGS_DEFAULTS, **(result or {})}


@router.get("/settings/test-ollama")
async def test_ollama_connection(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Test Ollama connectivity from the server (not the browser)."""
    s = await db.school_settings.find_one({}, {"_id": 0}) or {}
    ollama_url = s.get("ollama_url", "http://localhost:11434")
    ollama_model = s.get("ollama_model", "llama3.2")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            tags_resp = await client.get(f"{ollama_url}/api/tags")
            tags_resp.raise_for_status()
            models = [m["name"] for m in tags_resp.json().get("models", [])]
            model_available = any(m.split(":")[0] == ollama_model.split(":")[0] for m in models)
            return {
                "connected": True,
                "url": ollama_url,
                "models": models[:8],
                "model": ollama_model,
                "model_available": model_available,
                "message": f"Connected to Ollama. {len(models)} model(s) found." + (
                    f" Model '{ollama_model}' is ready." if model_available
                    else f" Warning: model '{ollama_model}' not found — run: ollama pull {ollama_model}"
                ),
            }
    except httpx.ConnectError:
        return {"connected": False, "url": ollama_url, "message": f"Cannot connect to Ollama at {ollama_url}. Is Ollama running on this server?"}
    except Exception as e:
        return {"connected": False, "url": ollama_url, "message": f"Error: {str(e)}"}


@router.delete("/settings/data")
async def wipe_data(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    for col in ["students", "attendance", "attendance_records", "school_days", "screening_sessions",
                "saebrs_results", "self_report_results", "interventions", "case_notes", "alerts"]:
        await db[col].delete_many({})
    await log_audit(db, user, "data_wipe", "setting", "all", "Full data wipe")
    return {"message": "All data wiped"}


@router.delete("/settings/data/students")
async def delete_student_data(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    for col in ["students", "screening_sessions", "saebrs_results", "self_report_results",
                "interventions", "case_notes", "alerts"]:
        await db[col].delete_many({})
    await log_audit(db, user, "data_wipe", "student", "all", "Student data wipe")
    return {"message": "Student data deleted"}


@router.delete("/settings/data/attendance")
async def delete_attendance_data(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    for col in ["attendance_records", "attendance"]:
        await db[col].delete_many({})
    await log_audit(db, user, "data_wipe", "attendance", "all", "Attendance data wipe")
    return {"message": "Attendance data deleted"}


@router.post("/settings/seed")
async def seed_data_endpoint(data: dict = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    from seed import seed_database
    student_count = int((data or {}).get("student_count", 32))
    return await seed_database(db, student_count=student_count)


@router.get("/settings/export-all")
async def export_all_data(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    from fastapi import HTTPException
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    backup = {}
    collections = [
        "students", "attendance_records", "school_days",
        "screening_sessions", "saebrs_results", "self_report_results",
        "interventions", "case_notes", "alerts", "school_settings",
    ]
    for col in collections:
        docs = await db[col].find({}, {"_id": 0}).to_list(50000)
        backup[col] = docs
    backup["exported_at"] = datetime.now(timezone.utc).isoformat()
    backup["version"] = "2.0"
    json_bytes = json.dumps(backup, default=str, indent=2).encode("utf-8")
    return StreamingResponse(
        iter([json_bytes]), media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=welltrack_backup.json"}
    )


@router.post("/settings/restore")
async def restore_all_data(request: Request, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    body = await request.json()
    restorable = [
        "students", "attendance_records", "school_days",
        "screening_sessions", "saebrs_results", "self_report_results",
        "interventions", "case_notes", "alerts", "school_settings",
    ]
    restored = {}
    for col in restorable:
        source_key = col
        if col == "attendance_records" and col not in body and "attendance" in body:
            source_key = "attendance"
        if source_key in body and isinstance(body[source_key], list):
            await db[col].delete_many({})
            if body[source_key]:
                await db[col].insert_many([{**doc} for doc in body[source_key]])
            restored[col] = len(body[source_key])
    return {"message": "Data restored successfully", "restored": restored}


@router.get("/classes")
async def get_classes(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    classes = await db.students.distinct("class_name")
    result = []
    for cls in sorted(classes):
        s = await db.students.find_one({"class_name": cls}, {"_id": 0})
        result.append({"class_name": cls, "teacher": s["teacher"] if s else ""})
    return result


# ── School Calendar (terms + non-school days) ─────────────────────────────────

def _generate_school_days(terms: list, non_school_days: list) -> list:
    excluded = {d["date"] for d in (non_school_days or [])}
    days: set = set()
    for t in (terms or []):
        try:
            start = date_type.fromisoformat(t["start_date"])
            end   = date_type.fromisoformat(t["end_date"])
        except Exception:
            continue
        cur = start
        while cur <= end:
            if cur.weekday() < 5 and cur.isoformat() not in excluded:
                days.add(cur.isoformat())
            cur += timedelta(days=1)
    return sorted(days)


def _day_year(d):
    if d.get("year"):
        return d["year"]
    date = d.get("date", "")
    try:
        return int(date[:4]) if len(date) >= 4 else None
    except (ValueError, TypeError):
        return None


@router.get("/settings/terms")
async def get_terms(year: Optional[int] = None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    all_terms = (s or {}).get("terms", [])
    all_nsd = (s or {}).get("non_school_days", [])

    term_years = {t["year"] for t in all_terms if t.get("year")}
    sd_years = set(await db.school_days.distinct("year"))
    att_dates = await db.attendance_records.distinct("date")
    att_years = {int(d[:4]) for d in att_dates if d and len(d) >= 4}
    all_years = term_years | sd_years | att_years

    current_year = (s or {}).get("current_year")
    if current_year:
        all_years.add(current_year)
    available_years = sorted(all_years, reverse=True) or [current_year or datetime.now(timezone.utc).year]

    active_year = year or current_year or (available_years[0] if available_years else None)
    filtered_terms = [t for t in all_terms if t.get("year") == active_year] if active_year else all_terms
    filtered_nsd = [d for d in all_nsd if _day_year(d) == active_year] if active_year else all_nsd
    count_filter = {"year": active_year} if active_year else {}
    count = await db.school_days.count_documents(count_filter)

    return {
        "terms": filtered_terms,
        "non_school_days": filtered_nsd,
        "school_days_count": count,
        "available_years": available_years,
        "active_year": active_year,
    }


@router.put("/settings/terms")
async def save_terms(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    terms = data.get("terms", [])
    non_school_days = data.get("non_school_days", [])
    save_year = data.get("year")

    for t in terms:
        if not t.get("id"):
            t["id"] = str(uuid.uuid4())[:8]
        if save_year and not t.get("year"):
            t["year"] = save_year

    for d in non_school_days:
        if save_year and not d.get("year"):
            d["year"] = save_year

    s = await db.school_settings.find_one({}, {"_id": 0}) or {}
    existing_terms = s.get("terms", [])
    existing_nsd = s.get("non_school_days", [])
    if save_year is not None:
        other_terms = [t for t in existing_terms if t.get("year") != save_year]
        merged_terms = other_terms + terms
        other_nsd = [d for d in existing_nsd if d.get("year") != save_year]
        merged_nsd = other_nsd + non_school_days
    else:
        merged_terms = terms
        merged_nsd = non_school_days

    await db.school_settings.update_one({}, {"$set": {
        "terms": merged_terms, "non_school_days": merged_nsd,
    }}, upsert=True)

    all_dates = _generate_school_days(terms, non_school_days)
    if save_year is not None:
        await db.school_days.delete_many({"year": save_year})
        if all_dates:
            await db.school_days.insert_many([{"date": d, "year": save_year} for d in all_dates])
    else:
        await db.school_days.delete_many({})
        if all_dates:
            await db.school_days.insert_many([{"date": d, "year": int(d[:4])} for d in all_dates])

    return {
        "message": f"{len(terms)} term(s) saved · {len(all_dates)} school days generated for {save_year or 'all'}",
        "school_days_count": len(all_dates),
        "year": save_year,
    }


@router.delete("/settings/terms")
async def delete_year(year: int, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Remove all terms and school days for a given year."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    s = await db.school_settings.find_one({}) or {}
    existing_terms = s.get("terms", [])
    kept = [t for t in existing_terms if t.get("year") != year]
    kept_nsd = [d for d in s.get("non_school_days", []) if _day_year(d) != year]
    await db.school_settings.update_one(
        {"_id": s["_id"]},
        {"$set": {"terms": kept, "non_school_days": kept_nsd}}
    )
    await db.school_days.delete_many({"year": year})
    return {"message": f"Year {year} deleted", "year": year}
