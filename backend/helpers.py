import asyncio
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import HTTPException, Request

from database import PRESENT_STATUSES, FULL_PRESENT_STATUSES, SETTINGS_DEFAULTS


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


def compute_wellbeing_tier(total: int, thresholds: dict = None) -> int:
    t = thresholds or {}
    tier1_min = t.get("self_report_tier1_min", 16)
    tier2_min = t.get("self_report_tier2_min", 11)
    if total >= tier1_min:
        return 1
    elif total >= tier2_min:
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
    """
    Three independent domains — attendance alone cannot trigger Tier 3.

    Attendance bands (configurable):
      Low Risk   : >= attendance_low_threshold      (default 92%)
      Some Risk  : >= attendance_some_threshold     (default 85%)
      High Risk  : >= attendance_severe_threshold   (default 75%)
      Severe Risk: <  attendance_severe_threshold   (default 75%)

    Tier 3:
      SAEBRS = High Risk
      OR Self-Report = Tier 3 (score <= tier2_min - 1)
      OR (attendance severely low AND (SAEBRS >= Some Risk OR Self-Report >= Tier 2))

    Tier 2:
      SAEBRS = Some Risk
      OR Self-Report = Tier 2
      OR attendance in some-risk band (85–91% by default)

    Tier 1: none of the above.
    """
    t = thresholds or {}
    att_low      = t.get("attendance_low_threshold",    92.0)
    att_some     = t.get("attendance_some_threshold",   85.0)
    att_severe   = t.get("attendance_severe_threshold", 75.0)

    att_severe_risk   = attendance_pct < att_severe
    att_some_risk     = att_severe <= attendance_pct < att_some
    att_any_risk      = attendance_pct < att_low

    saebrs_high = saebrs_risk == "High Risk"
    saebrs_some = saebrs_risk == "Some Risk"
    sr_high     = wellbeing_tier == 3
    sr_some     = wellbeing_tier == 2

    # Tier 3: behavioural/emotional high risk, OR severe attendance combined with another domain
    if saebrs_high or sr_high:
        return 3
    if att_severe_risk and (saebrs_some or sr_some):
        return 3

    # Tier 2: some risk in behavioural/emotional domain, or any attendance concern
    if saebrs_some or sr_some or att_any_risk:
        return 2

    return 1


# ── Settings ─────────────────────────────────────────────────────────────────

async def get_school_settings_doc(db) -> dict:
    s = await db.school_settings.find_one({}, {"_id": 0})
    return s or {}


# ── Auth ─────────────────────────────────────────────────────────────────────

async def get_current_user(request: Request):
    db = getattr(request.state, "db", None)
    if db is None:
        raise HTTPException(status_code=400, detail="No tenant context for this request")
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
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return user_doc


# ── Alerts ───────────────────────────────────────────────────────────────────

async def create_alert(db, student_id: str, student_name: str, class_name: str,
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


# ── Attendance calc (single-student) ─────────────────────────────────────────

def compute_att_stats(school_days_list, exc_by_date: dict, excluded_types: set,
                      entry_date: str = None) -> dict:
    """Pure-Python computation (no DB calls) — accepts pre-fetched data.
    exc_by_date: {date_str: record_dict} for this student's absence records.
    school_days_list:
      - list (even empty []): normal mode. Empty list → no data (total_days=0).
      - None: legacy fallback only — derives denominator from exception records.
    entry_date: ISO date string ("YYYY-MM-DD"). If provided, school days earlier
      than the student's enrolment date are ignored so late-enrolled students
      aren't penalised for days prior to their start.
    Records may include a pre-computed `present_pct` (0.0–1.0, new time-based
    schema); otherwise AM/PM status classification is used (half-day absences).
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

    def _day_absent_fraction(rec) -> float:
        """Return how much of the day the student was absent (0.0–1.0).
        Returns None if the record is fully excluded (day should be skipped)."""
        am = (rec.get("am_status") or "").strip()
        pm = (rec.get("pm_status") or "").strip()
        am_cls = _classify(am)
        pm_cls = _classify(pm)
        if am_cls == "excluded" and pm_cls == "excluded":
            return None
        # Prefer time-based `present_pct` when available (new schema)
        ppct = rec.get("present_pct")
        if ppct is not None:
            try:
                ppct = float(ppct)
                return max(0.0, min(1.0, 1.0 - ppct))
            except (TypeError, ValueError):
                pass
        # Fall back to AM/PM classification (legacy half-day model)
        if am_cls == "absent" and pm_cls == "absent":
            return 1.0
        if am_cls == "absent" or pm_cls == "absent":
            return 0.5
        return 0.0

    if school_days_list is not None:
        days_iter = school_days_list
        if entry_date:
            days_iter = [d for d in school_days_list if d >= entry_date]
        total_days = 0
        absent_days = 0.0
        for day in days_iter:
            rec = exc_by_date.get(day)
            if rec is None:
                total_days += 1
                continue
            frac = _day_absent_fraction(rec)
            if frac is None:
                continue  # fully excluded
            total_days += 1
            absent_days += frac
        if total_days == 0:
            return {"pct": 100.0, "total_days": 0, "absent_days": 0.0}
        pct = max(0.0, min(100.0, ((total_days - absent_days) / total_days) * 100.0))
        return {"pct": round(pct, 1), "total_days": total_days, "absent_days": round(absent_days, 1)}

    # Legacy fallback: derive denominator from exception records only
    total_days = 0
    absent_days = 0.0
    for day, rec in exc_by_date.items():
        if entry_date and day < entry_date:
            continue
        am = (rec.get("am_status") or "").strip()
        pm = (rec.get("pm_status") or "").strip()
        if not (am or pm or rec.get("present_pct") is not None):
            continue
        frac = _day_absent_fraction(rec)
        if frac is None:
            continue
        total_days += 1
        absent_days += frac
    if total_days == 0:
        return {"pct": 100.0, "total_days": 0, "absent_days": 0.0}
    pct = ((total_days - absent_days) / total_days) * 100
    return {"pct": round(pct, 1), "total_days": total_days, "absent_days": round(absent_days, 1)}


async def get_student_attendance_pct(db, student_id: str) -> float:
    stats = await get_student_attendance_stats(db, student_id)
    return stats["pct"]


async def get_student_attendance_stats(db, student_id: str) -> dict:
    """Single-student lookup. Scoped to the current school year from settings."""
    settings_doc, exc_records, student_doc = await asyncio.gather(
        db.school_settings.find_one({}, {"_id": 0}),
        db.attendance_records.find({"student_id": student_id}, {"_id": 0}).to_list(5000),
        db.students.find_one({"student_id": student_id}, {"_id": 0, "entry_date": 1}),
    )
    year = (settings_doc or {}).get("current_year")
    today_str = datetime.now(timezone.utc).date().isoformat()
    # Cap attendance to the last uploaded coverage end date (manual uploads are not daily).
    coverage_end = (settings_doc or {}).get("attendance_coverage_max_date")
    effective_to = min(today_str, coverage_end) if coverage_end else today_str
    year_filter = {"year": year, "date": {"$lte": effective_to}} if year else {"date": {"$lte": effective_to}}
    school_days_list = await db.school_days.distinct("date", year_filter)
    if not school_days_list:
        total_sd = await db.school_days.count_documents({})
        if total_sd == 0:
            school_days_list = sorted(await db.attendance_records.distinct(
                "date", {"date": {"$lte": effective_to}}
            )) or None
    excluded_types = set((settings_doc or {}).get("excluded_absence_types", []))
    exc_by_date = {r["date"]: r for r in exc_records}
    entry_date = (student_doc or {}).get("entry_date")
    return compute_att_stats(school_days_list, exc_by_date, excluded_types, entry_date=entry_date)


# ── Batch attendance helpers ──────────────────────────────────────────────────

async def get_bulk_attendance_records(db, student_ids: list) -> dict:
    """Returns {student_id: [records]} for all student_ids (raw, no computation)."""
    if not student_ids:
        return {}
    all_records = await db.attendance_records.find(
        {"student_id": {"$in": student_ids}}, {"_id": 0}
    ).to_list(100000)
    result: dict = defaultdict(list)
    for r in all_records:
        result[r["student_id"]].append(r)
    return dict(result)


async def get_bulk_attendance_stats(db, student_ids: list, school_days_list=None, excluded_types=None) -> dict:
    """Batch version of get_student_attendance_stats.

    Always respects each student's `entry_date` (from the students collection)
    so late enrolees aren't penalised for days prior to their start.
    """
    if not student_ids:
        return {}

    # Always fetch entry_date for every student in the batch
    entry_docs = await db.students.find(
        {"student_id": {"$in": student_ids}},
        {"_id": 0, "student_id": 1, "entry_date": 1},
    ).to_list(len(student_ids))
    entry_by_sid = {d["student_id"]: d.get("entry_date") for d in entry_docs}

    if excluded_types is None or school_days_list is None:
        settings_doc = await db.school_settings.find_one({}, {"_id": 0})
        if excluded_types is None:
            excluded_types = set((settings_doc or {}).get("excluded_absence_types", []))
        if school_days_list is None:
            year = (settings_doc or {}).get("current_year")
            today_str = datetime.now(timezone.utc).date().isoformat()
            coverage_end = (settings_doc or {}).get("attendance_coverage_max_date")
            effective_to = min(today_str, coverage_end) if coverage_end else today_str
            year_filter = {"year": year, "date": {"$lte": effective_to}} if year else {"date": {"$lte": effective_to}}
            db_days, records_by_student = await asyncio.gather(
                db.school_days.distinct("date", year_filter),
                get_bulk_attendance_records(db, student_ids),
            )
            if db_days:
                school_days_list = db_days
            else:
                total_sd = await db.school_days.count_documents({})
                if total_sd == 0:
                    all_att_dates = await db.attendance_records.distinct(
                        "date", {"date": {"$lte": effective_to}}
                    )
                    school_days_list = sorted(all_att_dates) if all_att_dates else None
            return {
                sid: compute_att_stats(
                    school_days_list,
                    {r["date"]: r for r in records_by_student.get(sid, [])},
                    excluded_types,
                    entry_date=entry_by_sid.get(sid),
                )
                for sid in student_ids
            }

    records_by_student = await get_bulk_attendance_records(db, student_ids)
    return {
        sid: compute_att_stats(
            school_days_list,
            {r["date"]: r for r in records_by_student.get(sid, [])},
            excluded_types,
            entry_date=entry_by_sid.get(sid),
        )
        for sid in student_ids
    }


# ── Batch SAEBRS helpers ──────────────────────────────────────────────────────

async def get_latest_saebrs_bulk(db, student_ids: list) -> dict:
    """Returns {student_id: latest_saebrs_doc} for all student_ids using a single aggregation."""
    if not student_ids:
        return {}
    pipeline = [
        {"$match": {"student_id": {"$in": student_ids}}},
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$student_id", "doc": {"$last": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$project": {"_id": 0}},
    ]
    results = await db.saebrs_results.aggregate(pipeline).to_list(500)
    return {r["student_id"]: r for r in results}


async def get_latest_saebrs_plus_bulk(db, student_ids: list) -> dict:
    """Returns {student_id: latest_saebrs_plus_doc} for all student_ids using a single aggregation."""
    if not student_ids:
        return {}
    pipeline = [
        {"$match": {"student_id": {"$in": student_ids}}},
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$student_id", "doc": {"$last": "$$ROOT"}}},
        {"$replaceRoot": {"newRoot": "$doc"}},
        {"$project": {"_id": 0}},
    ]
    results = await db.self_report_results.aggregate(pipeline).to_list(500)
    return {r["student_id"]: r for r in results}


async def get_all_saebrs_bulk(db, student_ids: list) -> dict:
    """Returns {student_id: [saebrs docs sorted by created_at asc]} for all student_ids."""
    if not student_ids:
        return {}
    pipeline = [
        {"$match": {"student_id": {"$in": student_ids}}},
        {"$sort": {"created_at": 1}},
        {"$group": {"_id": "$student_id", "docs": {"$push": "$$ROOT"}}},
    ]
    results = await db.saebrs_results.aggregate(pipeline).to_list(500)
    return {
        r["_id"]: [{k: v for k, v in d.items() if k != "_id"} for d in r["docs"]]
        for r in results
    }
