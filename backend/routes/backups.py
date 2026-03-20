"""
backups.py — Scheduled daily JSON backups stored on the server.
Backups are saved to /app/backend/backups/ and retained for 30 days.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime, timezone
import json, os, logging
from pathlib import Path

from database import db
from helpers import get_current_user

router = APIRouter()
logger = logging.getLogger("backups")

BACKUP_DIR = Path(__file__).parent.parent / "backups"
RETENTION_DAYS = 30
COLLECTIONS = [
    "students", "attendance_records", "school_days",
    "screening_sessions", "saebrs_results", "saebrs_plus_results",
    "interventions", "case_notes", "alerts", "school_settings", "users",
]


async def run_backup() -> str:
    """Export all collections to a timestamped JSON file. Returns the file path."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    backup = {"exported_at": datetime.now(timezone.utc).isoformat(), "version": "2.0"}
    for col in COLLECTIONS:
        docs = await db[col].find({}, {"_id": 0}).to_list(100000)
        backup[col] = docs

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"welltrack_backup_{timestamp}.json"
    filepath = BACKUP_DIR / filename

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(backup, f, default=str, indent=2)

    logger.info(f"Backup created: {filename} ({filepath.stat().st_size / 1024:.1f} KB)")

    # Prune old backups beyond retention limit
    _prune_old_backups()

    return str(filepath)


def _prune_old_backups():
    """Delete backup files older than RETENTION_DAYS."""
    now = datetime.now(timezone.utc).timestamp()
    cutoff = RETENTION_DAYS * 86400
    for f in BACKUP_DIR.glob("welltrack_backup_*.json"):
        age = now - f.stat().st_mtime
        if age > cutoff:
            f.unlink()
            logger.info(f"Pruned old backup: {f.name}")


def _backup_list():
    """Return sorted list of backup file metadata."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(BACKUP_DIR.glob("welltrack_backup_*.json"), reverse=True)
    result = []
    for f in files:
        stat = f.stat()
        result.append({
            "filename": f.name,
            "size_kb": round(stat.st_size / 1024, 1),
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return result


@router.get("/backups")
async def list_backups(user=Depends(get_current_user)):
    return {"backups": _backup_list()}


@router.post("/backups/trigger")
async def trigger_backup(user=Depends(get_current_user)):
    filepath = await run_backup()
    filename = Path(filepath).name
    stat = Path(filepath).stat()
    return {
        "message": "Backup created successfully",
        "filename": filename,
        "size_kb": round(stat.st_size / 1024, 1),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/backups/download/{filename}")
async def download_backup(filename: str, user=Depends(get_current_user)):
    # Prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = BACKUP_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(
        path=str(filepath),
        media_type="application/json",
        filename=filename,
    )


@router.delete("/backups/{filename}")
async def delete_backup(filename: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = BACKUP_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")
    filepath.unlink()
    return {"message": f"Backup {filename} deleted"}
