from fastapi import APIRouter, Depends, HTTPException
import uuid
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import (get_current_user, get_school_settings_doc, get_student_attendance_pct,
                     compute_saebrs_risk, compute_wellbeing_tier, compute_mtss_tier, create_alert)
from models import SAEBRSResult, SAEBRSPlusResult, ScreeningSession

router = APIRouter()


@router.get("/screening/sessions")
async def get_sessions(class_name=None, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    query = {}
    if class_name:
        query["class_name"] = {"$in": [class_name, "all"]}
    return await db.screening_sessions.find(query, {"_id": 0}).sort("date", -1).to_list(100)


@router.post("/screening/sessions")
async def create_session(session: ScreeningSession, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    d = session.model_dump()
    await db.screening_sessions.insert_one({**d})
    return d


@router.post("/screening/saebrs")
async def submit_saebrs(result: SAEBRSResult, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    s = sum(result.social_items) if result.social_items else result.social_score
    a = sum(result.academic_items) if result.academic_items else result.academic_score
    e = sum(result.emotional_items) if result.emotional_items else result.emotional_score
    t = s + a + e
    school_s = await get_school_settings_doc(db)
    thresholds = school_s.get("tier_thresholds", {})
    r, sr, ar, er = compute_saebrs_risk(t, s, a, e, thresholds)
    d = result.model_dump()
    d.update({"social_score": s, "academic_score": a, "emotional_score": e,
               "total_score": t, "risk_level": r, "social_risk": sr, "academic_risk": ar, "emotional_risk": er})

    prev_saebrs = await db.saebrs_results.find_one({"student_id": result.student_id}, {"_id": 0}, sort=[("created_at", -1)])
    prev_plus = await db.self_report_results.find_one({"student_id": result.student_id}, {"_id": 0}, sort=[("created_at", -1)])
    att_pct = await get_student_attendance_pct(db, result.student_id)

    if prev_saebrs:
        old_tier = compute_mtss_tier(prev_saebrs["risk_level"], prev_plus["wellbeing_tier"] if prev_plus else 1, att_pct, thresholds)
        new_tier = compute_mtss_tier(r, prev_plus["wellbeing_tier"] if prev_plus else 1, att_pct, thresholds)
        if old_tier != new_tier:
            student = await db.students.find_one({"student_id": result.student_id}, {"_id": 0})
            if student:
                name = f"{student['first_name']} {student['last_name']}"
                severity = "high" if new_tier == 3 else "medium"
                await db.alerts.insert_one({
                    "alert_id": f"alrt_{uuid.uuid4().hex[:8]}",
                    "student_id": result.student_id, "student_name": name, "class_name": student["class_name"],
                    "alert_type": "tier_change", "severity": severity,
                    "message": f"{name} moved from Tier {old_tier} to Tier {new_tier} — pending approval",
                    "previous_tier": old_tier, "new_tier": new_tier, "pending_approval": True,
                    "created_at": datetime.now(timezone.utc).isoformat(), "is_read": False, "resolved": False
                })

    await db.saebrs_results.insert_one({**d})
    student = await db.students.find_one({"student_id": result.student_id}, {"_id": 0})
    if student and r == "High Risk":
        name = f"{student['first_name']} {student['last_name']}"
        await create_alert(db, result.student_id, name, student["class_name"], "high_risk_saebrs", "high",
                           f"{name} screened as High Risk (SAEBRS total: {t}/57)")
    return d


@router.post("/screening/saebrs-plus")
async def submit_saebrs_plus(result: SAEBRSPlusResult, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    saebrs = await db.saebrs_results.find_one(
        {"student_id": result.student_id, "screening_id": result.screening_id}, {"_id": 0}, sort=[("created_at", -1)])
    soc = saebrs["social_score"] if saebrs else result.social_domain
    aca = saebrs["academic_score"] if saebrs else result.academic_domain
    items = result.self_report_items
    if len(items) >= 7:
        item0_rev = 3 - items[0]
        emo = item0_rev + items[1] + items[2]
        bel = items[3] + items[4] + items[5] + items[6]
        if items[0] >= 2:
            student = await db.students.find_one({"student_id": result.student_id}, {"_id": 0})
            if student:
                name = f"{student['first_name']} {student['last_name']}"
                await create_alert(db, result.student_id, name, student["class_name"], "emotional_distress", "high",
                                   f"{name} reported high emotional distress in self-assessment")
    else:
        emo = result.emotional_domain
        bel = result.belonging_domain
    total = soc + aca + emo + bel
    school_s_plus = await get_school_settings_doc(db)
    thresholds_plus = school_s_plus.get("tier_thresholds", {})
    tier = compute_wellbeing_tier(total, thresholds_plus)
    d = result.model_dump()
    d.update({"social_domain": soc, "academic_domain": aca, "emotional_domain": emo,
               "belonging_domain": bel, "wellbeing_total": total, "wellbeing_tier": tier})
    await db.self_report_results.insert_one({**d})
    return d


@router.get("/screening/results/{student_id}")
async def get_screening_results(student_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    saebrs = await db.saebrs_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    plus = await db.self_report_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    return {"saebrs": saebrs, "saebrs_plus": plus}


@router.get("/screening/completed")
async def get_completed_students(class_name: str, period: str, type: str = "saebrs", user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Return student_ids that already have a result for this class+period."""
    students = await db.students.find(
        {"class_name": class_name, "enrolment_status": "active"}, {"student_id": 1, "_id": 0}
    ).to_list(500)
    student_ids = [s["student_id"] for s in students]
    collection = db.saebrs_results if type == "saebrs" else db.self_report_results
    completed = await collection.distinct("student_id", {
        "student_id": {"$in": student_ids},
        "screening_period": period,
    })
    return {"completed": completed}


# ── Screening Period Management ───────────────────────────────────────────────

from models import ScreeningPeriod
from database import get_current_term, generate_screening_period_name
from datetime import datetime, date
from pydantic import BaseModel

class CreatePeriodRequest(BaseModel):
    term: str
    year: int
    period_number: int
    week: int = 1
    start_date: str
    end_date: str


class UpdatePeriodRequest(BaseModel):
    week: int = None
    start_date: str = None
    end_date: str = None
    status: str = None
    is_active: bool = None


@router.get("/screening/periods")
async def list_screening_periods(
    year: int = None,
    term: str = None,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """List all screening periods, optionally filtered by year and term."""
    query = {}
    if year:
        query["year"] = year
    if term:
        query["term"] = term
    
    periods = await db.screening_periods.find(query, {"_id": 0}).sort([("year", -1), ("term", -1), ("period_number", 1)]).to_list(100)
    return {"periods": periods}


@router.post("/screening/periods")
async def create_screening_period(
    req: CreatePeriodRequest,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Create a new screening period. Auto-generates name from term and period number."""
    # Check for existing period with same term/year/number
    existing = await db.screening_periods.find_one({
        "term": req.term,
        "year": req.year,
        "period_number": req.period_number
    })
    if existing:
        raise HTTPException(status_code=400, detail=f"Period {req.term} - P{req.period_number} already exists for {req.year}")
    
    name = generate_screening_period_name(req.term, req.period_number)
    
    period = ScreeningPeriod(
        name=name,
        term=req.term,
        year=req.year,
        period_number=req.period_number,
        week=req.week,
        start_date=req.start_date,
        end_date=req.end_date
    )
    
    await db.screening_periods.insert_one(period.model_dump())
    return {"success": True, "period": period}


@router.get("/screening/periods/{period_id}")
async def get_screening_period(
    period_id: str,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Get a specific screening period by ID."""
    period = await db.screening_periods.find_one({"period_id": period_id}, {"_id": 0})
    if not period:
        raise HTTPException(status_code=404, detail="Screening period not found")
    return period


@router.put("/screening/periods/{period_id}")
async def update_screening_period(
    period_id: str,
    req: UpdatePeriodRequest,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Update a screening period."""
    period = await db.screening_periods.find_one({"period_id": period_id})
    if not period:
        raise HTTPException(status_code=404, detail="Screening period not found")
    
    updates = {}
    if req.week is not None:
        updates["week"] = req.week
    if req.start_date is not None:
        updates["start_date"] = req.start_date
    if req.end_date is not None:
        updates["end_date"] = req.end_date
    if req.status is not None:
        updates["status"] = req.status
        if req.status == "active" and not period.get("is_active"):
            updates["is_active"] = True
            updates["activated_at"] = datetime.now(timezone.utc).isoformat()
        elif req.status == "completed":
            updates["is_active"] = False
            updates["completed_at"] = datetime.now(timezone.utc).isoformat()
    if req.is_active is not None:
        updates["is_active"] = req.is_active
        if req.is_active and not period.get("activated_at"):
            updates["activated_at"] = datetime.now(timezone.utc).isoformat()
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.screening_periods.update_one({"period_id": period_id}, {"$set": updates})
    return {"success": True}


@router.delete("/screening/periods/{period_id}")
async def delete_screening_period(
    period_id: str,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Delete a screening period."""
    result = await db.screening_periods.delete_one({"period_id": period_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Screening period not found")
    return {"success": True}


@router.get("/screening/periods/current/status")
async def get_current_screening_period_status(
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Get the currently active screening period and upcoming periods."""
    today = date.today().isoformat()
    
    # Get active period
    active = await db.screening_periods.find_one(
        {"is_active": True, "status": "active"},
        {"_id": 0}
    )
    
    # Get current period based on date (if no active period)
    current = None
    if not active:
        current = await db.screening_periods.find_one(
            {"start_date": {"$lte": today}, "end_date": {"$gte": today}},
            {"_id": 0}
        )
    
    # Get upcoming periods (within next 14 days)
    from datetime import timedelta
    upcoming_threshold = (date.today() + timedelta(days=14)).isoformat()
    upcoming = await db.screening_periods.find(
        {"start_date": {"$gt": today, "$lte": upcoming_threshold}, "status": "upcoming"},
        {"_id": 0}
    ).sort("start_date", 1).to_list(5)
    
    # Get current year periods for history
    current_year = date.today().year
    current_year_periods = await db.screening_periods.find(
        {"year": current_year},
        {"_id": 0}
    ).sort("start_date", -1).to_list(20)
    
    return {
        "active": active,
        "current": current,
        "upcoming": upcoming,
        "current_year_periods": current_year_periods,
        "today": today
    }


@router.post("/screening/periods/{period_id}/activate")
async def activate_screening_period(
    period_id: str,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Activate a screening period and deactivate any currently active."""
    # Deactivate current active period
    await db.screening_periods.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "status": "completed"}}
    )
    
    # Activate the new period
    now = datetime.now(timezone.utc).isoformat()
    result = await db.screening_periods.update_one(
        {"period_id": period_id},
        {"$set": {"is_active": True, "status": "active", "activated_at": now}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Screening period not found")
    
    return {"success": True}


@router.post("/screening/periods/{period_id}/deactivate")
async def deactivate_screening_period(
    period_id: str,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Deactivate a screening period without marking it completed."""
    result = await db.screening_periods.update_one(
        {"period_id": period_id, "is_active": True},
        {"$set": {"is_active": False, "status": "upcoming", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Active screening period not found")
    return {"success": True}


@router.get("/screening/terms/current")
async def get_current_term_info(
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Get the current term based on today's date using calendar settings."""
    # Get term dates from settings
    settings = await db.school_settings.find_one({}, {"term_dates": 1})
    term_dates = settings.get("term_dates", {}) if settings else {}
    
    current_term = get_current_term(term_dates)
    
    # Get periods for current term
    current_year = date.today().year
    if current_term:
        periods = await db.screening_periods.find(
            {"term": current_term, "year": current_year},
            {"_id": 0}
        ).sort("period_number", 1).to_list(10)
    else:
        periods = []
    
    return {
        "current_term": current_term,
        "current_year": current_year,
        "today": date.today().isoformat(),
        "term_dates": term_dates,
        "periods": periods
    }
