from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import json, io, csv

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
async def seed_data_endpoint(user=Depends(get_current_user)):
    from seed import seed_database
    return await seed_database()


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
