from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import uuid

from database import db
from helpers import get_current_user, get_student_attendance_pct, compute_mtss_tier
from models import Student

router = APIRouter()


@router.get("/students")
async def get_students(class_name: Optional[str] = None, year_level: Optional[str] = None,
                       user=Depends(get_current_user)):
    query = {"enrolment_status": "active"}
    if class_name:
        query["class_name"] = class_name
    if year_level:
        query["year_level"] = year_level
    return await db.students.find(query, {"_id": 0}).sort("last_name", 1).to_list(500)


@router.post("/students")
async def create_student(student: Student, user=Depends(get_current_user)):
    d = student.model_dump()
    await db.students.insert_one({**d})
    return d


@router.post("/students/import")
async def import_students(data: dict, user=Depends(get_current_user)):
    rows = data.get("students", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No student data provided")

    imported, updated, errors = [], [], []
    for i, row in enumerate(rows):
        base_role = str(row.get("Base Role") or row.get("base_role") or "Student").strip()
        user_status = str(row.get("User Status") or row.get("user_status") or "Active").strip()
        if base_role.lower() not in ("student", "") or user_status.lower() == "inactive":
            continue

        sussi_id = str(row.get("SussiId") or row.get("sussi_id") or row.get("Import Identifier") or "").strip()
        first_name = str(row.get("First Name") or row.get("first_name") or "").strip()
        preferred_name = str(row.get("Preferred Name") or row.get("preferred_name") or "").strip()
        last_name = str(row.get("Surname") or row.get("last_name") or "").strip()
        class_name = str(row.get("Form Group") or row.get("class_name") or "").strip()
        year_level = str(row.get("Year Level") or row.get("year_level") or "").strip()
        teacher = str(row.get("teacher") or "").strip()
        gender = str(row.get("gender") or "").strip()
        dob = str(row.get("date_of_birth") or "").strip()

        if not sussi_id and not first_name and not last_name:
            errors.append({"row": i + 1, "error": "Missing student identifier"})
            continue

        student_doc = {
            "first_name": first_name or sussi_id, "preferred_name": preferred_name or None,
            "last_name": last_name, "year_level": year_level, "class_name": class_name,
            "teacher": teacher, "gender": gender, "date_of_birth": dob,
            "enrolment_status": "active", "sussi_id": sussi_id, "external_id": sussi_id,
        }

        if sussi_id:
            existing = await db.students.find_one({"sussi_id": sussi_id})
            if existing:
                await db.students.update_one({"sussi_id": sussi_id}, {"$set": student_doc})
                updated.append(sussi_id)
            else:
                student_doc["student_id"] = f"stu_{uuid.uuid4().hex[:8]}"
                await db.students.insert_one({**student_doc})
                imported.append(student_doc)
        else:
            student_doc["student_id"] = f"stu_{uuid.uuid4().hex[:8]}"
            await db.students.insert_one({**student_doc})
            imported.append(student_doc)

    return {"imported": len(imported), "updated": len(updated), "errors": errors, "total": len(rows)}


@router.get("/students/summary")
async def get_students_summary(class_name: Optional[str] = None, year_level: Optional[str] = None,
                                user=Depends(get_current_user)):
    query = {"enrolment_status": "active"}
    if class_name:
        query["class_name"] = class_name
    if year_level:
        query["year_level"] = year_level
    students = await db.students.find(query, {"_id": 0}).sort("last_name", 1).to_list(500)

    result = []
    for s in students:
        sid = s["student_id"]
        saebrs = await db.saebrs_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        plus = await db.saebrs_plus_results.find_one({"student_id": sid}, {"_id": 0}, sort=[("created_at", -1)])
        att_pct = await get_student_attendance_pct(sid)
        active_interventions = await db.interventions.count_documents({"student_id": sid, "status": "active"})

        if saebrs and plus:
            tier = compute_mtss_tier(saebrs["risk_level"], plus["wellbeing_tier"], att_pct)
        elif saebrs:
            tier = 3 if saebrs["risk_level"] == "High Risk" else (2 if saebrs["risk_level"] == "Some Risk" else 1)
        else:
            tier = None

        result.append({
            **s,
            "mtss_tier": tier,
            "saebrs_risk": saebrs["risk_level"] if saebrs else "Not Screened",
            "saebrs_total": saebrs["total_score"] if saebrs else None,
            "wellbeing_tier": plus["wellbeing_tier"] if plus else None,
            "wellbeing_total": plus["wellbeing_total"] if plus else None,
            "attendance_pct": round(att_pct, 1),
            "active_interventions": active_interventions
        })
    return result


@router.get("/students/{student_id}")
async def get_student(student_id: str, user=Depends(get_current_user)):
    s = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Student not found")
    return s


@router.get("/students/{student_id}/profile")
async def get_student_profile(student_id: str, user=Depends(get_current_user)):
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    saebrs_results = await db.saebrs_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    saebrs_plus = await db.saebrs_plus_results.find({"student_id": student_id}, {"_id": 0}).sort("created_at", 1).to_list(20)
    interventions = await db.interventions.find({"student_id": student_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    case_notes = await db.case_notes.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(20)
    att_pct = await get_student_attendance_pct(student_id)
    # Use attendance_records (not the old attendance collection)
    attendance_records = await db.attendance_records.find({"student_id": student_id}, {"_id": 0}).sort("date", -1).to_list(50)
    alerts = await db.alerts.find({"student_id": student_id, "resolved": False}, {"_id": 0}).to_list(10)

    latest_saebrs = saebrs_results[-1] if saebrs_results else None
    latest_plus = saebrs_plus[-1] if saebrs_plus else None

    if latest_saebrs and latest_plus:
        tier = compute_mtss_tier(latest_saebrs["risk_level"], latest_plus["wellbeing_tier"], att_pct)
    elif latest_saebrs:
        tier = 3 if latest_saebrs["risk_level"] == "High Risk" else (2 if latest_saebrs["risk_level"] == "Some Risk" else 1)
    else:
        tier = None

    return {
        "student": student, "mtss_tier": tier,
        "attendance_pct": round(att_pct, 1),
        "saebrs_results": saebrs_results,
        "saebrs_plus_results": saebrs_plus,
        "interventions": interventions,
        "case_notes": case_notes,
        "attendance_records": attendance_records,
        "alerts": alerts
    }


@router.put("/students/{student_id}/external-id")
async def set_student_external_id(student_id: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")
    ext_id = data.get("external_id", "").strip().upper()
    await db.students.update_one({"student_id": student_id}, {"$set": {"external_id": ext_id}})
    return {"message": "External ID updated", "external_id": ext_id}
