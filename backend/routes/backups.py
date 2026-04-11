"""
backups.py — Scheduled daily JSON backups stored on the server.
Backups are saved per-tenant to /app/uploads/{slug}/backups/ and retained for 30 days.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from datetime import datetime, timezone
import json, logging, os
from pathlib import Path

from deps import get_tenant_db
from helpers import get_current_user

router = APIRouter()
logger = logging.getLogger("backups")

_UPLOADS_BASE = Path(os.environ.get("UPLOADS_DIR", str(Path(__file__).resolve().parent.parent / "uploads")))
RETENTION_DAYS = 30
COLLECTIONS = [
    "students", "attendance_records", "school_days",
    "screening_sessions", "saebrs_results", "self_report_results",
    "interventions", "case_notes", "alerts", "school_settings", "users",
]


def _get_backup_dir(slug: str = "default") -> Path:
    """Return tenant-scoped backup directory."""
    path = _UPLOADS_BASE / slug / "backups"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def run_backup(db, slug: str = "default") -> str:
    """Export all collections to a timestamped JSON file. Returns the file path."""
    backup_dir = _get_backup_dir(slug)

    backup = {"exported_at": datetime.now(timezone.utc).isoformat(), "version": "2.0"}
    for col in COLLECTIONS:
        docs = await db[col].find({}, {"_id": 0}).to_list(100000)
        backup[col] = docs

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"welltrack_backup_{timestamp}.json"
    filepath = backup_dir / filename

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(backup, f, default=str, indent=2)

    logger.info(f"Backup created: {slug}/{filename} ({filepath.stat().st_size / 1024:.1f} KB)")

    _prune_old_backups(slug)

    return str(filepath)


def _prune_old_backups(slug: str = "default"):
    """Delete backup files older than RETENTION_DAYS."""
    backup_dir = _get_backup_dir(slug)
    now = datetime.now(timezone.utc).timestamp()
    cutoff = RETENTION_DAYS * 86400
    for f in backup_dir.glob("welltrack_backup_*.json"):
        age = now - f.stat().st_mtime
        if age > cutoff:
            f.unlink()
            logger.info(f"Pruned old backup: {slug}/{f.name}")


def _backup_list(slug: str = "default"):
    """Return sorted list of backup file metadata."""
    backup_dir = _get_backup_dir(slug)
    files = sorted(backup_dir.glob("welltrack_backup_*.json"), reverse=True)
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
async def list_backups(request: Request, user=Depends(get_current_user)):
    slug = getattr(request.state, "tenant_slug", None) or "default"
    return {"backups": _backup_list(slug)}


@router.post("/backups/trigger")
async def trigger_backup(request: Request, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    slug = getattr(request.state, "tenant_slug", None) or "default"
    filepath = await run_backup(db, slug)
    filename = Path(filepath).name
    stat = Path(filepath).stat()
    return {
        "message": "Backup created successfully",
        "filename": filename,
        "size_kb": round(stat.st_size / 1024, 1),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/backups/download/{filename}")
async def download_backup(request: Request, filename: str, user=Depends(get_current_user)):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    slug = getattr(request.state, "tenant_slug", None) or "default"
    filepath = _get_backup_dir(slug) / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(
        path=str(filepath),
        media_type="application/json",
        filename=filename,
    )


@router.delete("/backups/{filename}")
async def delete_backup(request: Request, filename: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    slug = getattr(request.state, "tenant_slug", None) or "default"
    filepath = _get_backup_dir(slug) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")
    filepath.unlink()
    return {"message": f"Backup {filename} deleted"}
