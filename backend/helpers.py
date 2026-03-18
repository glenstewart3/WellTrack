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

async def get_student_attendance_pct(student_id: str) -> float:
    stats = await get_student_attendance_stats(student_id)
    return stats["pct"]


async def get_student_attendance_stats(student_id: str) -> dict:
    """Returns {pct, total_sessions, absent_sessions} for a student."""
    school_days_list = await db.school_days.distinct("date")

    if school_days_list:
        exc_records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).to_list(5000)
        exc_by_date = {r["date"]: r for r in exc_records}
        settings_doc = await get_school_settings_doc()
        excluded_types = set(settings_doc.get("excluded_absence_types", []))

        total_sessions = 0
        present_sessions = 0.0
        absent_sessions = 0

        for day in school_days_list:
            if day not in exc_by_date:
                total_sessions += 2
                present_sessions += 2.0
            else:
                rec = exc_by_date[day]
                for sess in [rec.get("am_status", ""), rec.get("pm_status", "")]:
                    s = (sess or "").strip()
                    if not s:
                        total_sessions += 1
                        present_sessions += 1.0
                    elif s in excluded_types:
                        pass  # excluded — neutral
                    elif s == "Present":
                        total_sessions += 1
                        present_sessions += 1.0  # "Present" in an exception file = fully present for this session
                    elif s in FULL_PRESENT_STATUSES:
                        total_sessions += 1
                        present_sessions += 1.0
                    else:
                        total_sessions += 1
                        present_sessions += 0.0
                        absent_sessions += 1

        if total_sessions == 0:
            return {"pct": 100.0, "total_sessions": 0, "absent_sessions": 0}
        pct = (present_sessions / total_sessions) * 100.0
        return {"pct": pct, "total_sessions": total_sessions, "absent_sessions": absent_sessions}
    else:
        records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).to_list(5000)
        if not records:
            return {"pct": 100.0, "total_sessions": 0, "absent_sessions": 0}
        total_sessions = 0
        absent_sessions = 0
        for r in records:
            am = (r.get("am_status") or "").strip()
            pm = (r.get("pm_status") or "").strip()
            if am:
                total_sessions += 1
                if am not in PRESENT_STATUSES:
                    absent_sessions += 1
            if pm:
                total_sessions += 1
                if pm not in PRESENT_STATUSES:
                    absent_sessions += 1
        if total_sessions == 0:
            return {"pct": 100.0, "total_sessions": 0, "absent_sessions": 0}
        pct = ((total_sessions - absent_sessions) / total_sessions) * 100
        return {"pct": pct, "total_sessions": total_sessions, "absent_sessions": absent_sessions}
