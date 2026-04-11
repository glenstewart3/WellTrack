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
    tier = compute_wellbeing_tier(total)
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
