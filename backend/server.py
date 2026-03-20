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
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
import os, logging
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

# Logging
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("server")


@app.on_event("startup")
async def startup():
    from routes.backups import run_backup
    scheduler.add_job(run_backup, CronTrigger(hour=0, minute=0), id="daily_backup", replace_existing=True)
    scheduler.start()
    logger.info("WellTrack starting up. Daily backup scheduler running (midnight UTC).")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)
    from database import client
    client.close()
