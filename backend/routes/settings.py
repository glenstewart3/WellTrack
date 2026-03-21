from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone, date as date_type, timedelta
import json, io, csv, uuid

from database import db, SETTINGS_DEFAULTS
from helpers import get_current_user, get_student_attendance_pct

router = APIRouter()


@router.get("/public-settings")
async def public_settings():
    s = await db.school_settings.find_one({}, {"_id": 0})
    base = {k: SETTINGS_DEFAULTS[k] for k in ("platform_name", "accent_color", "logo_base64", "welcome_message", "school_name", "email_auth_enabled", "google_auth_enabled")}
    if s:
        for k in base:
            if s.get(k) is not None:
                base[k] = s[k]
    return base


@router.get("/school-days")
async def get_school_days(user=Depends(get_current_user)):
    days = await db.school_days.distinct("date")
    return {"school_days": sorted(days), "total": len(days)}


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    return {**SETTINGS_DEFAULTS, **(s or {})}


@router.put("/settings")
async def update_settings(data: dict, user=Depends(get_current_user)):
    data.pop("_id", None)
    data.pop("onboarding_complete", None)
    await db.school_settings.update_one({}, {"$set": data}, upsert=True)
    result = await db.school_settings.find_one({}, {"_id": 0})
    return {**SETTINGS_DEFAULTS, **(result or {})}


@router.delete("/settings/data")
async def wipe_data(user=Depends(get_current_user)):
    for col in ["students", "attendance", "attendance_records", "school_days", "screening_sessions",
                "saebrs_results", "saebrs_plus_results", "interventions", "case_notes", "alerts"]:
        await db[col].delete_many({})
    return {"message": "All data wiped"}


@router.post("/settings/seed")
async def seed_data_endpoint(data: dict = None, user=Depends(get_current_user)):
    from seed import seed_database
    student_count = int((data or {}).get("student_count", 32))
    return await seed_database(student_count=student_count)


@router.get("/settings/export-all")
async def export_all_data(user=Depends(get_current_user)):
    backup = {}
    collections = [
        "students", "attendance_records", "school_days",
        "screening_sessions", "saebrs_results", "saebrs_plus_results",
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
async def restore_all_data(request: Request, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    body = await request.json()
    restorable = [
        "students", "attendance_records", "school_days",
        "screening_sessions", "saebrs_results", "saebrs_plus_results",
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
async def get_classes(user=Depends(get_current_user)):
    classes = await db.students.distinct("class_name")
    result = []
    for cls in sorted(classes):
        s = await db.students.find_one({"class_name": cls}, {"_id": 0})
        result.append({"class_name": cls, "teacher": s["teacher"] if s else ""})
    return result


# ── School Calendar (terms + non-school days) ─────────────────────────────────

def _generate_school_days(terms: list, non_school_days: list) -> list:
    """Return sorted list of ISO date strings for all weekday school days across terms,
    excluding non_school_days (public holidays, curriculum days, etc.)."""
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
            if cur.weekday() < 5 and cur.isoformat() not in excluded:  # Mon–Fri
                days.add(cur.isoformat())
            cur += timedelta(days=1)
    return sorted(days)


@router.get("/settings/terms")
async def get_terms(user=Depends(get_current_user)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    count = await db.school_days.count_documents({})
    return {
        "terms": (s or {}).get("terms", []),
        "non_school_days": (s or {}).get("non_school_days", []),
        "school_days_count": count,
    }


@router.put("/settings/terms")
async def save_terms(data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    terms = data.get("terms", [])
    non_school_days = data.get("non_school_days", [])
    # Ensure every term has an id
    for t in terms:
        if not t.get("id"):
            t["id"] = str(uuid.uuid4())[:8]
    await db.school_settings.update_one({}, {"$set": {
        "terms": terms, "non_school_days": non_school_days,
    }}, upsert=True)
    all_dates = _generate_school_days(terms, non_school_days)
    await db.school_days.delete_many({})
    if all_dates:
        await db.school_days.insert_many([{"date": d} for d in all_dates])
    return {"message": f"{len(terms)} term(s) saved · {len(all_dates)} school days generated",
            "school_days_count": len(all_dates)}
