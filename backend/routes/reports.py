from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import io
import csv
from typing import Optional

from database import db, PRESENT_STATUSES
from helpers import get_current_user, get_student_attendance_pct, compute_mtss_tier, get_school_settings_doc

router = APIRouter()


@router.get("/reports/students-csv")
async def students_csv(user=Depends(get_current_user)):
    students = await db.students.find({}, {"_id": 0}).to_list(500)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Student ID", "First Name", "Last Name", "Year Level", "Class", "Teacher", "Gender", "Status"])
    for s in students:
        w.writerow([s["student_id"], s["first_name"], s["last_name"], s["year_level"],
                    s["class_name"], s["teacher"], s.get("gender", ""), s.get("enrolment_status", "")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=students.csv"})


@router.get("/reports/tier-summary-csv")
async def tier_csv(user=Depends(get_current_user)):
    students = await db.students.find({}, {"_id": 0}).to_list(500)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Student ID", "First Name", "Last Name", "Class", "MTSS Tier", "SAEBRS Risk",
                "SAEBRS Total", "Wellbeing Tier", "Wellbeing Total", "Attendance %", "Active Interventions"])
    for s in students:
        sid = s["student_id"]
        saebrs = await db.saebrs_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        plus = await db.saebrs_plus_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        att_pct = await get_student_attendance_pct(sid)
        int_count = await db.interventions.count_documents({"student_id": sid, "status": "active"})
        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            tier = "N/A"
        w.writerow([sid, s["first_name"], s["last_name"], s["class_name"],
                    f"Tier {tier}" if isinstance(tier, int) else tier,
                    saebrs["risk_level"] if saebrs else "Not Screened",
                    saebrs["total_score"] if saebrs else "",
                    f"Tier {plus['wellbeing_tier']}" if plus else "",
                    plus["wellbeing_total"] if plus else "",
                    f"{att_pct:.1f}", int_count])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=tier_summary.csv"})


@router.get("/reports/screening-csv")
async def screening_csv(user=Depends(get_current_user)):
    results = await db.saebrs_results.find({}, {"_id": 0}).to_list(2000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Student ID", "Screening ID", "Social", "Academic", "Emotional",
                "Total", "Risk Level", "Social Risk", "Academic Risk", "Emotional Risk", "Date"])
    for r in results:
        w.writerow([r["student_id"], r["screening_id"], r["social_score"], r["academic_score"],
                    r["emotional_score"], r["total_score"], r["risk_level"],
                    r["social_risk"], r["academic_risk"], r["emotional_risk"], r.get("created_at", "")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=screening.csv"})


@router.get("/reports/interventions-csv")
async def interventions_csv(user=Depends(get_current_user)):
    items = await db.interventions.find({}, {"_id": 0}).to_list(500)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["ID", "Student ID", "Type", "Staff", "Start Date", "Review Date",
                "Status", "Goals", "Outcome Rating"])
    for i in items:
        w.writerow([i["intervention_id"], i["student_id"], i["intervention_type"], i["assigned_staff"],
                    i["start_date"], i["review_date"], i["status"], i.get("goals", ""), i.get("outcome_rating", "")])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=interventions.csv"})



@router.get("/reports/filter-options")
async def filter_options(user=Depends(get_current_user)):
    students = await db.students.find(
        {"enrolment_status": "active"},
        {"_id": 0, "year_level": 1, "class_name": 1}
    ).to_list(500)
    year_levels = sorted(set(s["year_level"] for s in students if s.get("year_level")))
    classes = sorted(set(s["class_name"] for s in students if s.get("class_name")))
    return {"year_levels": year_levels, "classes": classes}


@router.get("/reports/absence-types")
async def absence_types_report(
    year_level: Optional[str] = None,
    class_name: Optional[str] = None,
    user=Depends(get_current_user)
):
    sq = {"enrolment_status": "active"}
    if year_level:
        sq["year_level"] = year_level
    if class_name:
        sq["class_name"] = class_name
    students = await db.students.find(sq, {"_id": 0, "student_id": 1}).to_list(500)
    sids = [s["student_id"] for s in students]
    settings_doc = await get_school_settings_doc()
    excluded_types = set(settings_doc.get("excluded_absence_types", []))
    type_counts = {}
    if sids:
        records = await db.attendance_records.find(
            {"student_id": {"$in": sids}}, {"_id": 0}
        ).to_list(50000)
        for r in records:
            for status in [r.get("am_status", ""), r.get("pm_status", "")]:
                status = (status or "").strip()
                if not status or status in PRESENT_STATUSES:
                    continue
                if status not in type_counts:
                    type_counts[status] = {"type": status, "count": 0, "excluded": status in excluded_types}
                type_counts[status]["count"] += 1
    return sorted(type_counts.values(), key=lambda x: -x["count"])


@router.get("/reports/screening-coverage")
async def screening_coverage_report(
    year_level: Optional[str] = None,
    class_name: Optional[str] = None,
    user=Depends(get_current_user)
):
    sq = {"enrolment_status": "active"}
    if year_level:
        sq["year_level"] = year_level
    if class_name:
        sq["class_name"] = class_name
    students = await db.students.find(sq, {"_id": 0}).to_list(500)
    class_data = {}
    for s in students:
        cls = s["class_name"]
        if cls not in class_data:
            class_data[cls] = {"class": cls, "total": 0, "screened": 0}
        class_data[cls]["total"] += 1
        saebrs = await db.saebrs_results.find_one({"student_id": s["student_id"]}, {"_id": 0})
        if saebrs:
            class_data[cls]["screened"] += 1
    result = []
    for cls, d in sorted(class_data.items()):
        pct = round(d["screened"] / d["total"] * 100) if d["total"] > 0 else 0
        result.append({"class": cls, "total": d["total"], "screened": d["screened"], "coverage_pct": pct})
    return result


@router.get("/reports/support-gaps")
async def support_gaps_report(
    year_level: Optional[str] = None,
    class_name: Optional[str] = None,
    user=Depends(get_current_user)
):
    sq = {"enrolment_status": "active"}
    if year_level:
        sq["year_level"] = year_level
    if class_name:
        sq["class_name"] = class_name
    students = await db.students.find(sq, {"_id": 0}).to_list(500)
    gaps = []
    for s in students:
        sid = s["student_id"]
        saebrs = await db.saebrs_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        plus = await db.saebrs_plus_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        att_pct = await get_student_attendance_pct(sid)
        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            continue
        if tier >= 2:
            active_int = await db.interventions.count_documents({"student_id": sid, "status": "active"})
            if active_int == 0:
                gaps.append({
                    "student": s, "tier": tier,
                    "saebrs_risk": saebrs["risk_level"] if saebrs else "Not Screened",
                    "attendance_pct": round(att_pct, 1),
                })
    gaps.sort(key=lambda x: -x["tier"])
    return gaps


@router.get("/reports/staff-load")
async def staff_load_report(user=Depends(get_current_user)):
    interventions = await db.interventions.find(
        {"status": "active"}, {"_id": 0, "assigned_staff": 1}
    ).to_list(500)
    staff_counts = {}
    for i in interventions:
        staff = i.get("assigned_staff", "Unknown") or "Unknown"
        staff_counts[staff] = staff_counts.get(staff, 0) + 1
    return [{"staff": k, "count": v} for k, v in sorted(staff_counts.items(), key=lambda x: -x[1])]
