"""
server.py — WellTrack multi-tenant entry point.
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
import os, logging, uuid
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timezone, timedelta

from tenant_middleware import TenantMiddleware

from routes.auth import router as auth_router
from routes.students import router as students_router
from routes.interventions import router as interventions_router
from routes.backups import router as backups_router
from routes.alerts import router as alerts_router
from routes.reports import router as reports_router
from routes.analytics import router as analytics_router
from routes.attendance import router as attendance_router
from routes.settings import router as settings_router
from routes.screening import router as screening_router
from routes.appointments import router as appointments_router
from routes.audit import router as audit_router
from routes.superadmin import router as superadmin_router
from routes.classes import router as classes_router
from routes.team import router as team_router
from routes.data_quality import router as data_quality_router

app = FastAPI(title="WellTrack API")
scheduler = AsyncIOScheduler()

# ── Middleware ─────────────────────────────────────────────────────────────────
# Order matters: add_middleware wraps previous, so last added = outermost = first to execute.
# We want: CORS (outermost) → Tenant → Session (innermost)
app.add_middleware(SessionMiddleware, secret_key=os.environ['SESSION_SECRET'])
app.add_middleware(TenantMiddleware)

_cors_origins = [o.strip() for o in os.environ.get('ALLOWED_ORIGINS', '*').split(',') if o.strip()]
if '*' in _cors_origins:
    import logging as _log
    _log.warning(
        "CORS: ALLOWED_ORIGINS='*' with allow_credentials=True — Starlette will echo the "
        "request Origin header, which permits any origin to make credentialed requests. "
        "Set ALLOWED_ORIGINS to a comma-separated list of explicit origins in production."
    )
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=_cors_origins,
                   allow_methods=["*"], allow_headers=["*"])

# ── Routes ─────────────────────────────────────────────────────────────────────
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
api_router.include_router(appointments_router)
api_router.include_router(audit_router)
api_router.include_router(superadmin_router)
api_router.include_router(classes_router)
api_router.include_router(team_router)
api_router.include_router(data_quality_router)

app.include_router(api_router)

# Public school lookup for the landing page (no auth, no tenant context needed)
@app.get("/api/school-lookup")
async def school_lookup(slug: str = ""):
    """Check if a school exists by slug. Returns name if found."""
    from control_db import control_db as _cdb
    if not slug or len(slug) < 2:
        return {"exists": False}
    school = await _cdb.schools.find_one(
        {"slug": slug.lower().strip(), "status": {"$in": ["active", "trial"]}},
        {"_id": 0, "name": 1, "slug": 1}
    )
    if school:
        return {"exists": True, "name": school["name"], "slug": school["slug"]}
    return {"exists": False}


# Serve student photos dynamically per tenant slug
from fastapi.responses import FileResponse as _FileResponse


@app.get("/api/student-photos/{slug}/{filename}")
async def serve_student_photo(slug: str, filename: str):
    """Serve a student photo from the tenant-scoped uploads directory."""
    _uploads = Path(os.environ.get("UPLOADS_DIR", str(Path(__file__).resolve().parent / "uploads")))
    photo_path = _uploads / slug / "student_photos" / filename
    if not photo_path.exists() or not photo_path.is_file():
        from fastapi import HTTPException as _H
        raise _H(status_code=404, detail="Photo not found")
    return _FileResponse(photo_path)


@app.get("/api/staff-photos/{slug}/{filename}")
async def serve_staff_photo(slug: str, filename: str):
    """Serve a staff profile photo from the tenant-scoped uploads directory."""
    _uploads = Path(os.environ.get("UPLOADS_DIR", str(Path(__file__).resolve().parent / "uploads")))
    photo_path = _uploads / slug / "staff_photos" / filename
    if not photo_path.exists() or not photo_path.is_file():
        from fastapi import HTTPException as _H
        raise _H(status_code=404, detail="Photo not found")
    return _FileResponse(photo_path)

# Legacy: also serve from old flat path for backward compat
_default_photos = Path(__file__).resolve().parent / "uploads" / "student_photos"
_photos_dir = Path(os.environ.get("PHOTOS_DIR", str(_default_photos)))
_photos_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/student-photos-legacy", StaticFiles(directory=str(_photos_dir)), name="student_photos_legacy")

# Logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("server")


from server_utils import ensure_indexes


@app.on_event("startup")
async def startup():
    from control_db import control_db
    from database import client
    from datetime import datetime, timezone

    # ── Ensure control DB indexes ─────────────────────────────────────────────
    await control_db.schools.create_index("slug", unique=True)

    # ── Provision demo school if not exists ───────────────────────────────────
    demo = await control_db.schools.find_one({"slug": "demo"})
    if not demo:
        await control_db.schools.insert_one({
            "school_id": f"sch_{uuid.uuid4().hex[:12]}",
            "slug": "demo",
            "name": "Demo School",
            "db_name": "welltrack_demo",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "contact_name": "",
            "contact_email": "",
            "notes": "Auto-provisioned demo school",
            "feature_flags": {},
        })
        logger.info("Demo school created in control DB (slug='demo', db='welltrack_demo')")

        # ── Auto-seed demo data (250 students) for fresh install ──────────────
        try:
            from seed import seed_database
            demo_db = client["welltrack_demo"]
            # Initialize school_settings first (required for seeding)
            await demo_db.school_settings.update_one(
                {},
                {"$set": {
                    "school_name": "Demo School",
                    "current_year": datetime.now(timezone.utc).year,
                    "onboarding_complete": True,
                    "email_auth_enabled": True,
                    "google_auth_enabled": True,
                }},
                upsert=True
            )
            result = await seed_database(demo_db, 250)
            logger.info(f"Demo data seeded: {result.get('students', 0)} students, "
                       f"{result.get('interventions', 0)} interventions, "
                       f"{result.get('screening_events', 0)} screenings")
        except Exception as e:
            logger.warning(f"Could not auto-seed demo data: {e}")
    elif not demo.get("school_id"):
        # Backfill school_id for legacy demo record
        await control_db.schools.update_one(
            {"slug": "demo"},
            {"$set": {"school_id": f"sch_{uuid.uuid4().hex[:12]}"}}
        )

    # ── Ensure indexes on all active school databases ─────────────────────────
    schools = await control_db.schools.find(
        {"status": {"$in": ["active", "trial"]}}, {"_id": 0}
    ).to_list(100)
    for school in schools:
        school_db = client[school["db_name"]]
        await ensure_indexes(school_db)

        # Dedup school_settings
        all_settings = await school_db.school_settings.find({}).to_list(20)
        if len(all_settings) > 1:
            merged = {}
            for doc in all_settings:
                for k, v in doc.items():
                    if k == "_id":
                        continue
                    if k == "onboarding_complete" and v:
                        merged[k] = True
                    elif k not in merged or not merged[k]:
                        merged[k] = v
            keep_id = all_settings[0]["_id"]
            await school_db.school_settings.replace_one({"_id": keep_id}, merged)
            extra_ids = [d["_id"] for d in all_settings[1:]]
            await school_db.school_settings.delete_many({"_id": {"$in": extra_ids}})
            logger.info(f"[{school['slug']}] Merged {len(all_settings)} duplicate school_settings docs.")

        # school_days: add year field
        await school_db.school_days.update_many(
            {"year": {"$exists": False}},
            [{"$set": {"year": {"$toInt": {"$substr": ["$date", 0, 4]}}}}]
        )
        # Auto-stamp terms with year
        settings_doc = await school_db.school_settings.find_one({}, {"_id": 0})
        if settings_doc:
            current_year = settings_doc.get("current_year", datetime.now(timezone.utc).year)
            terms = settings_doc.get("terms", [])
            changed = False
            for t in terms:
                if not t.get("year"):
                    t["year"] = current_year
                    changed = True
            if changed:
                await school_db.school_settings.update_one({}, {"$set": {"terms": terms}})

        # Auto-generate school_days if terms exist
        if settings_doc and settings_doc.get("terms"):
            from routes.settings import _generate_school_days
            terms = settings_doc["terms"]
            non_school_days = settings_doc.get("non_school_days", [])
            years_with_terms = {t.get("year") for t in terms if t.get("year")}
            for yr in years_with_terms:
                count = await school_db.school_days.count_documents({"year": yr})
                if count == 0:
                    yr_terms = [t for t in terms if t.get("year") == yr]
                    dates = _generate_school_days(yr_terms, non_school_days)
                    if dates:
                        await school_db.school_days.insert_many([{"date": d, "year": yr} for d in dates])
                        logger.info(f"[{school['slug']}] Auto-generated {len(dates)} school_days for year {yr}")

    # ── Daily backup scheduler (backs up all schools) ─────────────────────────
    from routes.backups import run_backup
    async def backup_all_schools():
        """Run backup for all active schools."""
        active = await control_db.schools.find({"status": "active"}, {"_id": 0}).to_list(100)
        for s in active:
            try:
                school_db = client[s["db_name"]]
                await run_backup(school_db, s.get("slug", "default"))
                logger.info(f"Backup completed for school: {s['slug']}")
            except Exception as e:
                logger.error(f"Backup failed for school {s['slug']}: {e}")

    scheduler.add_job(backup_all_schools, CronTrigger(hour=0, minute=0), id="daily_backup", replace_existing=True)

    # ── Attendance stale upload reminder (emails tenant admins) ───────────────
    async def attendance_upload_reminders():
        """Email tenant admins when attendance uploads are stale."""
        from utils.emailer import send_email_smtp
        threshold_days = int(os.environ.get("ATTENDANCE_REMINDER_THRESHOLD_DAYS", "14"))
        cooldown_days = int(os.environ.get("ATTENDANCE_REMINDER_COOLDOWN_DAYS", "7"))
        now = datetime.now(timezone.utc)

        schools = await control_db.schools.find(
            {"status": {"$in": ["active", "trial"]}}, {"_id": 0, "slug": 1, "name": 1, "db_name": 1}
        ).to_list(200)
        for sch in schools:
            slug = sch.get("slug", "")
            name = sch.get("name", slug)
            db_name = sch.get("db_name")
            if not db_name:
                continue
            school_db = client[db_name]
            s = await school_db.school_settings.find_one({}, {"_id": 0}) or {}
            last_upload = s.get("attendance_last_upload_at")
            last_sent = s.get("attendance_reminder_last_sent_at")
            coverage_end = s.get("attendance_coverage_max_date")
            if not last_upload:
                continue
            try:
                lu = datetime.fromisoformat(str(last_upload).replace("Z", "+00:00"))
                if lu.tzinfo is None:
                    lu = lu.replace(tzinfo=timezone.utc)
            except Exception:
                continue

            if now - lu < timedelta(days=threshold_days):
                continue

            if last_sent:
                try:
                    ls = datetime.fromisoformat(str(last_sent).replace("Z", "+00:00"))
                    if ls.tzinfo is None:
                        ls = ls.replace(tzinfo=timezone.utc)
                    if now - ls < timedelta(days=cooldown_days):
                        continue
                except Exception:
                    pass

            admins = await school_db.users.find(
                {"role": "admin"}, {"_id": 0, "email": 1}
            ).to_list(200)
            emails = sorted({(u.get("email") or "").strip().lower() for u in admins if (u.get("email") or "").strip()})
            if not emails:
                continue

            subject = f"WellTrack Attendance Upload Reminder — {name}"
            body = (
                f"Hello,\n\n"
                f"This is a reminder to upload the latest attendance file for {name}.\n\n"
                f"Last upload: {last_upload}\n"
                f"Coverage through: {coverage_end or '—'}\n\n"
                f"To update: log in and go to Settings → Imports → Upload Attendance.\n\n"
                f"— WellTrack\n"
            )
            try:
                send_email_smtp(to_emails=emails, subject=subject, body_text=body)
                await school_db.school_settings.update_one(
                    {}, {"$set": {"attendance_reminder_last_sent_at": now.isoformat()}}, upsert=True
                )
                logger.info(f"[{slug}] Attendance reminder sent to {len(emails)} admin(s).")
            except Exception as e:
                logger.error(f"[{slug}] Attendance reminder failed: {e}")

    scheduler.add_job(
        attendance_upload_reminders,
        CronTrigger(hour=int(os.environ.get("ATTENDANCE_REMINDER_HOUR_UTC", "22")), minute=0),
        id="attendance_upload_reminders",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"WellTrack multi-tenant starting up. {len(schools)} school(s) indexed. Daily backup scheduler running.")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)
    from database import client
    client.close()
