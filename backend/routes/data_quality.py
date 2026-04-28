"""Data Quality Routes - Validation, duplicate detection, and cleanup tools."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

from deps import get_tenant_db
from helpers import get_current_user
from utils.audit import log_audit

router = APIRouter()


# ── Data Validation ─────────────────────────────────────────────────────────

@router.get("/data-quality/validate")
async def validate_data(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Run comprehensive data validation checks."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    issues = []

    # 1. Validate attendance percentages
    pipeline = [
        {"$group": {
            "_id": "$student_id",
            "attendance_rate": {
                "$avg": {
                    "$cond": [
                        {"$in": ["$attendance_status", ["present", "late"]]},
                        1, 0
                    ]
                }
            }
        }},
        {"$match": {"attendance_rate": {"$gt": 1}}}
    ]
    invalid_attendance = await db.attendance_records.aggregate(pipeline).to_list(10)
    if invalid_attendance:
        issues.append({
            "type": "invalid_attendance_rate",
            "severity": "error",
            "count": len(invalid_attendance),
            "description": "Students with attendance rates > 100% detected",
            "examples": invalid_attendance[:5]
        })

    # 2. Find future dates in records
    today = datetime.now(timezone.utc).date().isoformat()

    future_screenings = await db.saebrs_results.count_documents({
        "created_at": {"$gt": today}
    })
    if future_screenings > 0:
        issues.append({
            "type": "future_dates",
            "severity": "warning",
            "count": future_screenings,
            "description": f"{future_screenings} screening records with future dates"
        })

    # 3. Check for negative attendance counts
    negative_attendance = await db.attendance_records.count_documents({
        "$or": [
            {"late_minutes": {"$lt": 0}},
            {"absence_count": {"$lt": 0}}
        ]
    })
    if negative_attendance > 0:
        issues.append({
            "type": "negative_values",
            "severity": "error",
            "count": negative_attendance,
            "description": "Records with negative attendance values"
        })

    # 4. Check SAEBRS score ranges
    invalid_scores = await db.saebrs_results.count_documents({
        "$or": [
            {"total_score": {"$lt": 0}},
            {"total_score": {"$gt": 57}},
            {"social_score": {"$lt": 0}},
            {"social_score": {"$gt": 18}},
            {"academic_score": {"$lt": 0}},
            {"academic_score": {"$gt": 18}},
            {"emotional_score": {"$lt": 0}},
            {"emotional_score": {"$gt": 21}}
        ]
    })
    if invalid_scores > 0:
        issues.append({
            "type": "invalid_saebrs_scores",
            "severity": "error",
            "count": invalid_scores,
            "description": "SAEBRS scores outside valid ranges"
        })

    # 5. Check for orphaned interventions (students no longer exist)
    orphaned_interventions = await db.interventions.count_documents({
        "student_id": {"$nin": await db.students.distinct("student_id")}
    })
    if orphaned_interventions > 0:
        issues.append({
            "type": "orphaned_interventions",
            "severity": "warning",
            "count": orphaned_interventions,
            "description": "Interventions for non-existent students"
        })

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_issues": len(issues),
        "critical_count": sum(1 for i in issues if i["severity"] == "error"),
        "warning_count": sum(1 for i in issues if i["severity"] == "warning"),
        "issues": issues
    }


# ── Duplicate Detection ───────────────────────────────────────────────────────

@router.get("/data-quality/duplicates")
async def find_duplicates(
    threshold: float = 0.85,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Find potential duplicate students using name similarity."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    students = await db.students.find(
        {"enrolment_status": "active"},
        {"_id": 0, "student_id": 1, "first_name": 1, "last_name": 1, "date_of_birth": 1, "class_name": 1}
    ).to_list(500)

    duplicates = []

    # Simple name-based duplicate detection
    for i, s1 in enumerate(students):
        for s2 in students[i+1:]:
            name1 = f"{s1.get('first_name', '')} {s1.get('last_name', '')}".lower().strip()
            name2 = f"{s2.get('first_name', '')} {s2.get('last_name', '')}".lower().strip()

            # Exact name match = definite duplicate
            if name1 == name2:
                duplicates.append({
                    "type": "exact_name_match",
                    "confidence": 1.0,
                    "student_a": s1,
                    "student_b": s2,
                    "suggestion": "Likely duplicate - same name"
                })
                continue

            # Same first and last name (case insensitive)
            if s1.get('first_name', '').lower() == s2.get('first_name', '').lower() and \
               s1.get('last_name', '').lower() == s2.get('last_name', '').lower():
                duplicates.append({
                    "type": "case_insensitive_match",
                    "confidence": 0.95,
                    "student_a": s1,
                    "student_b": s2,
                    "suggestion": "Likely duplicate - same name (case difference)"
                })
                continue

            # Same DOB + similar name
            if s1.get('date_of_birth') and s1.get('date_of_birth') == s2.get('date_of_birth'):
                if name1.split()[0] == name2.split()[0] or name1.split()[-1] == name2.split()[-1]:
                    duplicates.append({
                        "type": "dob_and_partial_name_match",
                        "confidence": 0.8,
                        "student_a": s1,
                        "student_b": s2,
                        "suggestion": "Possible duplicate - same DOB, similar name"
                    })

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_students_checked": len(students),
        "potential_duplicates": len(duplicates),
        "duplicates": duplicates
    }


# ── Orphaned Record Cleanup ───────────────────────────────────────────────────

@router.get("/data-quality/orphans")
async def find_orphaned_records(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Find orphaned records (references to non-existent entities)."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    active_student_ids = await db.students.distinct("student_id")
    active_user_ids = await db.users.distinct("user_id")
    active_intervention_ids = await db.interventions.distinct("intervention_id")

    orphaned = []

    # 1. Interventions for non-existent students
    orphaned_interventions = await db.interventions.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "intervention_id": 1, "student_id": 1, "intervention_type": 1}
    ).to_list(100)
    if orphaned_interventions:
        orphaned.append({
            "type": "interventions",
            "count": len(orphaned_interventions),
            "records": orphaned_interventions[:20],
            "description": "Interventions referencing non-existent students"
        })

    # 2. Case notes for non-existent students
    orphaned_case_notes = await db.case_notes.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "case_id": 1, "student_id": 1, "note_type": 1}
    ).to_list(100)
    if orphaned_case_notes:
        orphaned.append({
            "type": "case_notes",
            "count": len(orphaned_case_notes),
            "records": orphaned_case_notes[:20],
            "description": "Case notes referencing non-existent students"
        })

    # 3. Attendance records for non-existent students
    orphaned_attendance = await db.attendance_records.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "attendance_id": 1, "student_id": 1, "date": 1}
    ).to_list(100)
    if orphaned_attendance:
        orphaned.append({
            "type": "attendance",
            "count": len(orphaned_attendance),
            "records": orphaned_attendance[:20],
            "description": "Attendance records for non-existent students"
        })

    # 4. Appointments for non-existent students
    orphaned_appointments = await db.appointments.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "appointment_id": 1, "student_id": 1, "student_name": 1}
    ).to_list(100)
    if orphaned_appointments:
        orphaned.append({
            "type": "appointments",
            "count": len(orphaned_appointments),
            "records": orphaned_appointments[:20],
            "description": "Appointments for non-existent students"
        })

    # 5. Alerts for non-existent students
    orphaned_alerts = await db.alerts.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "alert_id": 1, "student_id": 1, "alert_type": 1}
    ).to_list(100)
    if orphaned_alerts:
        orphaned.append({
            "type": "alerts",
            "count": len(orphaned_alerts),
            "records": orphaned_alerts[:20],
            "description": "Alerts for non-existent students"
        })

    # 6. Screening results for non-existent students
    orphaned_screenings = await db.saebrs_results.find(
        {"student_id": {"$nin": active_student_ids}},
        {"_id": 0, "result_id": 1, "student_id": 1, "screening_period": 1}
    ).to_list(100)
    if orphaned_screenings:
        orphaned.append({
            "type": "screenings",
            "count": len(orphaned_screenings),
            "records": orphaned_screenings[:20],
            "description": "SAEBRS results for non-existent students"
        })

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_orphaned_categories": len(orphaned),
        "total_orphaned_records": sum(o["count"] for o in orphaned),
        "orphaned": orphaned
    }


@router.post("/data-quality/cleanup")
async def cleanup_orphaned_records(
    record_type: str,
    dry_run: bool = True,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Clean up orphaned records of a specific type."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    active_student_ids = await db.students.distinct("student_id")

    # Map record types to collections
    collection_map = {
        "interventions": db.interventions,
        "case_notes": db.case_notes,
        "attendance": db.attendance_records,
        "appointments": db.appointments,
        "alerts": db.alerts,
        "screenings": db.saebrs_results,
    }

    if record_type not in collection_map:
        raise HTTPException(400, f"Unknown record type. Valid: {list(collection_map.keys())}")

    collection = collection_map[record_type]

    # Count orphaned records
    query = {"student_id": {"$nin": active_student_ids}}
    orphaned_count = await collection.count_documents(query)

    if orphaned_count == 0:
        return {"message": "No orphaned records found", "deleted": 0, "dry_run": dry_run}

    if dry_run:
        return {
            "message": f"Would delete {orphaned_count} orphaned {record_type} records",
            "would_delete": orphaned_count,
            "dry_run": True,
            "query": query
        }

    # Actually delete
    result = await collection.delete_many(query)

    await log_audit(db, user, "cleanup", "data_quality", "",
                    f"Cleaned up {result.deleted_count} orphaned {record_type} records",
                    metadata={"record_type": record_type, "deleted_count": result.deleted_count})

    return {
        "message": f"Deleted {result.deleted_count} orphaned {record_type} records",
        "deleted": result.deleted_count,
        "dry_run": False
    }


# ── Data Statistics ───────────────────────────────────────────────────────────

@router.get("/data-quality/stats")
async def get_data_stats(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Get statistics about the data quality and coverage."""
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Access denied")

    stats = {}

    # Student counts
    stats["students"] = {
        "total": await db.students.count_documents({}),
        "active": await db.students.count_documents({"enrolment_status": "active"}),
        "archived": await db.students.count_documents({"enrolment_status": "archived"}),
    }

    # Screening coverage
    total_students = stats["students"]["active"]
    screened_students = len(await db.saebrs_results.distinct("student_id"))
    stats["screening_coverage"] = {
        "total_students": total_students,
        "screened_students": screened_students,
        "coverage_pct": round(screened_students / total_students * 100, 1) if total_students > 0 else 0
    }

    # Intervention stats
    active_interventions = await db.interventions.count_documents({"status": "active"})
    completed_interventions = await db.interventions.count_documents({"status": "completed"})
    interventions_with_outcomes = await db.interventions.count_documents({
        "status": "completed",
        "outcome_rating": {"$exists": True}
    })

    stats["interventions"] = {
        "active": active_interventions,
        "completed": completed_interventions,
        "with_outcomes": interventions_with_outcomes,
        "outcome_rate": round(interventions_with_outcomes / completed_interventions * 100, 1) if completed_interventions > 0 else 0
    }

    # Attendance coverage
    attendance_dates = await db.attendance_records.distinct("date")
    if attendance_dates:
        stats["attendance"] = {
            "total_records": await db.attendance_records.count_documents({}),
            "unique_dates": len(attendance_dates),
            "date_range": {
                "earliest": min(attendance_dates),
                "latest": max(attendance_dates)
            } if attendance_dates else None
        }

    # Case note activity
    recent_notes = await db.case_notes.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()}
    })
    stats["case_notes"] = {
        "total": await db.case_notes.count_documents({}),
        "last_30_days": recent_notes
    }

    # Data freshness
    latest_screening = await db.saebrs_results.find_one(
        {}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)]
    )
    stats["data_freshness"] = {
        "latest_screening": latest_screening.get("created_at") if latest_screening else None
    }

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": stats
    }
