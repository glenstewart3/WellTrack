from fastapi import HTTPException, Request
from datetime import datetime, timezone
import uuid

from database import db, PRESENT_STATUSES, FULL_PRESENT_STATUSES, SETTINGS_DEFAULTS


# ── Scoring helpers ──────────────────────────────────────────────────────────

def compute_saebrs_risk(total: int, social: int, academic: int, emotional: int, thresholds: dict = None):
    t = thresholds or {}
    t_some = t.get("saebrs_some_risk", 37)
    t_high = t.get("saebrs_high_risk", 24)
    total_risk = "Low Risk" if total >= t_some else ("Some Risk" if total >= t_high else "High Risk")
    social_risk = "Low Risk" if social >= 13 else ("Some Risk" if social >= 8 else "High Risk")
    academic_risk = "Low Risk" if academic >= 10 else ("Some Risk" if academic >= 6 else "High Risk")
    emotional_risk = "Low Risk" if emotional >= 16 else ("Some Risk" if emotional >= 12 else "High Risk")
    return total_risk, social_risk, academic_risk, emotional_risk


def compute_wellbeing_tier(total: int) -> int:
    if total >= 50:
        return 1
    elif total >= 35:
        return 2
    return 3


def compute_attendance_score(pct: float) -> int:
    if pct >= 95:
        return 3
    elif pct >= 90:
        return 2
    elif pct >= 80:
        return 1
    return 0


def compute_mtss_tier(saebrs_risk: str, wellbeing_tier: int, attendance_pct: float, thresholds: dict = None) -> int:
    t = thresholds or {}
    att_high = t.get("attendance_high_risk", 80.0)
    att_some = t.get("attendance_some_risk", 90.0)
    if saebrs_risk == "High Risk" or wellbeing_tier == 3 or attendance_pct < att_high:
        return 3
    elif saebrs_risk == "Some Risk" or wellbeing_tier == 2 or attendance_pct < att_some:
        return 2
    return 1


# ── Settings ─────────────────────────────────────────────────────────────────

async def get_school_settings_doc() -> dict:
    s = await db.school_settings.find_one({}, {"_id": 0})
    return s or {}


# ── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


# ── Alerts ───────────────────────────────────────────────────────────────────

async def create_alert(student_id: str, student_name: str, class_name: str,
                       alert_type: str, severity: str, message: str):
    existing = await db.alerts.find_one({"student_id": student_id, "alert_type": alert_type, "resolved": False})
    if existing:
        return
    await db.alerts.insert_one({
        "alert_id": f"alrt_{uuid.uuid4().hex[:8]}",
        "student_id": student_id, "student_name": student_name, "class_name": class_name,
        "alert_type": alert_type, "severity": severity, "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(), "is_read": False, "resolved": False
    })


# ── Attendance calc ───────────────────────────────────────────────────────────

def _compute_att_stats(school_days_list: list, exc_by_date: dict, excluded_types: set) -> dict:
    """Pure-Python computation (no DB calls) — accepts pre-fetched data.
    exc_by_date: {date_str: record_dict} for this student's absence records.
    Returns {pct, total_days, absent_days}.
    """
    def _classify(s: str) -> str:
        if not s:
            return "present"
        if s in excluded_types:
            return "excluded"
        if s == "Present" or s in FULL_PRESENT_STATUSES:
            return "present"
        return "absent"

    if school_days_list:
        total_days = 0
        absent_days = 0.0
        for day in school_days_list:
            if day not in exc_by_date:
                total_days += 1
            else:
                rec = exc_by_date[day]
                am_cls = _classify((rec.get("am_status") or "").strip())
                pm_cls = _classify((rec.get("pm_status") or "").strip())
                if am_cls == "excluded" and pm_cls == "excluded":
                    continue
                total_days += 1
                if am_cls == "absent" and pm_cls == "absent":
                    absent_days += 1.0
                elif am_cls == "absent" or pm_cls == "absent":
                    absent_days += 0.5
        if total_days == 0:
            return {"pct": 100.0, "total_days": 0, "absent_days": 0.0}
        pct = max(0.0, min(100.0, ((total_days - absent_days) / total_days) * 100.0))
        return {"pct": pct, "total_days": total_days, "absent_days": absent_days}
    else:
        # No school days defined — derive from exception records
        total_days = 0
        absent_days = 0.0
        for rec in exc_by_date.values():
            am = (rec.get("am_status") or "").strip()
            pm = (rec.get("pm_status") or "").strip()
            if am or pm:
                total_days += 1
                am_abs = am and am not in PRESENT_STATUSES
                pm_abs = pm and pm not in PRESENT_STATUSES
                if am_abs and pm_abs:
                    absent_days += 1.0
                elif am_abs or pm_abs:
                    absent_days += 0.5
        if total_days == 0:
            return {"pct": 100.0, "total_days": 0, "absent_days": 0.0}
        pct = ((total_days - absent_days) / total_days) * 100
        return {"pct": pct, "total_days": total_days, "absent_days": absent_days}


async def get_student_attendance_pct(student_id: str) -> float:
    stats = await get_student_attendance_stats(student_id)
    return stats["pct"]


async def get_student_attendance_stats(student_id: str) -> dict:
    """Single-student lookup — fetches its own data. Use _compute_att_stats for batch operations."""
    school_days_list, exc_records, settings_doc = await asyncio.gather(
        db.school_days.distinct("date"),
        db.attendance_records.find({"student_id": student_id}, {"_id": 0}).to_list(5000),
        db.school_settings.find_one({}, {"_id": 0}),
    )
    exc_by_date = {r["date"]: r for r in exc_records}
    excluded_types = set((settings_doc or {}).get("excluded_absence_types", []))
    return _compute_att_stats(school_days_list, exc_by_date, excluded_types)
