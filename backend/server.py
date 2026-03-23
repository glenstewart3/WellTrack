"""
server.py — WellTrack entry point.
All route logic lives in routes/*.py
Run with: uvicorn server:app --reload --port 8001
"""
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

from fastapi import FastAPI
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os, logging
from pathlib import Path
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from routes.auth import router as auth_router
from routes.students import router as students_router
from routes.screening import router as screening_router
from routes.interventions import router as interventions_router
from routes.alerts import router as alerts_router
from routes.analytics import router as analytics_router
from routes.attendance import router as attendance_router
from routes.settings import router as settings_router
from routes.reports import router as reports_router
from routes.backups import router as backups_router

app = FastAPI(title="WellTrack API")
scheduler = AsyncIOScheduler()

# Middleware
_cors_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '*').split(',') if o.strip()]
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=_cors_origins,
                   allow_methods=["*"], allow_headers=["*"])
app.add_middleware(SessionMiddleware, secret_key=os.environ['SESSION_SECRET'])

# Mount all routers under /api
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(students_router)
api_router.include_router(screening_router)
api_router.include_router(interventions_router)
api_router.include_router(alerts_router)
api_router.include_router(analytics_router)
api_router.include_router(attendance_router)
api_router.include_router(settings_router)
api_router.include_router(reports_router)
api_router.include_router(backups_router)

app.include_router(api_router)

# Serve student photos as static files under /api/student-photos/
_photos_dir = Path("/app/uploads/student_photos")
_photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/student-photos", StaticFiles(directory=str(_photos_dir)), name="student_photos")

# Logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("server")


@app.on_event("startup")
async def startup():
    from routes.backups import run_backup
    from database import db
    from datetime import datetime, timezone

    # Create indexes
    await db.attendance_records.create_index("student_id")
    await db.attendance_records.create_index("date")
    await db.saebrs_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.saebrs_plus_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.interventions.create_index([("student_id", 1), ("status", 1)])
    await db.user_sessions.create_index("session_token")
    await db.school_days.create_index("year")

    # ── Dedup school_settings ─────────────────────────────────────────────────
    # If multiple settings docs exist (e.g. from a botched migration), merge them
    # into one, preserving onboarding_complete and all non-empty fields.
    all_settings = await db.school_settings.find({}).to_list(20)
    if len(all_settings) > 1:
        merged = {}
        for doc in all_settings:
            for k, v in doc.items():
                if k == "_id":
                    continue
                # Prefer truthy values; always keep onboarding_complete=True once set
                if k == "onboarding_complete" and v:
                    merged[k] = True
                elif k not in merged or not merged[k]:
                    merged[k] = v
        keep_id = all_settings[0]["_id"]
        await db.school_settings.replace_one({"_id": keep_id}, merged)
        extra_ids = [d["_id"] for d in all_settings[1:]]
        await db.school_settings.delete_many({"_id": {"$in": extra_ids}})
        logger.info(f"Merged {len(all_settings)} duplicate school_settings docs into one.")


    # 1. school_days: add year field derived from date string (e.g. "2025-02-03" → 2025)
    await db.school_days.update_many(
        {"year": {"$exists": False}},
        [{"$set": {"year": {"$toInt": {"$substr": ["$date", 0, 4]}}}}]
    )
    # 2. school_settings.terms: stamp each term with current_year if missing
    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    if settings_doc:
        current_year = settings_doc.get("current_year", datetime.now(timezone.utc).year)
        terms = settings_doc.get("terms", [])
        changed = False
        for t in terms:
            if not t.get("year"):
                t["year"] = current_year
                changed = True
        if changed:
            await db.school_settings.update_one({}, {"$set": {"terms": terms}})

    # 3. Auto-generate school_days if terms exist but collection is empty for that year
    settings_doc = await db.school_settings.find_one({}, {"_id": 0})
    if settings_doc and settings_doc.get("terms"):
        from routes.settings import _generate_school_days
        terms = settings_doc["terms"]
        non_school_days = settings_doc.get("non_school_days", [])
        years_with_terms = {t.get("year") for t in terms if t.get("year")}
        for yr in years_with_terms:
            count = await db.school_days.count_documents({"year": yr})
            if count == 0:
                yr_terms = [t for t in terms if t.get("year") == yr]
                dates = _generate_school_days(yr_terms, non_school_days)
                if dates:
                    await db.school_days.insert_many([{"date": d, "year": yr} for d in dates])
                    logger.info(f"Auto-generated {len(dates)} school_days for year {yr}")

    scheduler.add_job(run_backup, CronTrigger(hour=0, minute=0), id="daily_backup", replace_existing=True)
    scheduler.start()
    logger.info("WellTrack starting up. MongoDB indexes ensured. Daily backup scheduler running (midnight UTC).")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)
    from database import client
    client.close()
