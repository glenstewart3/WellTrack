from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from deps import get_tenant_db
from helpers import get_current_user
from bson.regex import Regex

router = APIRouter()

# Icon mapping for frontend
ICON_MAP = {
    "student": "User",
    "intervention": "Target",
    "action_plan": "ClipboardList",
    "appointment": "CalendarClock",
    "screening": "ClipboardCheck",
    "alert": "Bell",
    "case_note": "FileText",
}


@router.get("/search")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=20),
    db=Depends(get_tenant_db),
    user=Depends(get_current_user),
):
    """
    Global search across students, interventions, support plans, and appointments.
    Returns results with title, type, path, and icon for navigation.
    """
    if not q or len(q) < 2:
        return []

    results = []
    regex_query = Regex(q, "i")  # case-insensitive regex
    user_role = user.get("role", "teacher")

    # ── Search Students ──────────────────────────────────────────────────────
    # All roles can search students (with some restrictions for screeners)
    student_filter = {
        "$or": [
            {"first_name": regex_query},
            {"last_name": regex_query},
            {"preferred_name": regex_query},
            {"student_id": regex_query},
        ]
    }
    
    # Screener only sees students in their assigned classes
    if user_role == "screener":
        teacher_name = user.get("name", "")
        student_filter["teacher"] = teacher_name

    students = await db.students.find(student_filter, {"_id": 0}).limit(limit).to_list(None)
    
    for s in students:
        display_name = f"{s.get('first_name', '')} {s.get('last_name', '')}"
        if s.get("preferred_name") and s["preferred_name"] != s.get("first_name"):
            display_name += f" ({s['preferred_name']})"
        
        results.append({
            "id": s["student_id"],
            "title": display_name.strip(),
            "subtitle": f"{s.get('year_level', '')} · {s.get('class_name', '')}",
            "type": "Student",
            "path": f"/students/{s['student_id']}",
            "icon": ICON_MAP["student"],
        })

    # ── Search Interventions ─────────────────────────────────────────────────
    # Check permission for interventions
    role_perms = await db.school_settings.find_one({}, {"role_permissions": 1})
    can_view_interventions = (
        user_role == "admin" or 
        not role_perms or 
        not role_perms.get("role_permissions") or
        "interventions" in role_perms.get("role_permissions", {}).get(user_role, [])
    )
    
    if can_view_interventions:
        interventions = await db.interventions.find({
            "$or": [
                {"intervention_type": regex_query},
                {"notes": regex_query},
            ]
        }, {"_id": 0}).limit(limit).to_list(None)
        
        for i in interventions:
            # Get student name for context
            student = await db.students.find_one({"student_id": i.get("student_id")}, {"first_name": 1, "last_name": 1})
            student_name = f"{student.get('first_name', '')} {student.get('last_name', '')}" if student else "Unknown"
            
            results.append({
                "id": i.get("intervention_id", str(i.get("_id"))),
                "title": i.get("intervention_type", "Intervention"),
                "subtitle": student_name.strip(),
                "type": "Intervention",
                "path": f"/interventions",
                "icon": ICON_MAP["intervention"],
            })

    # ── Search Support Plans (Action Plans) ──────────────────────────────────
    can_view_plans = (
        user_role == "admin" or 
        not role_perms or 
        not role_perms.get("role_permissions") or
        "action-plans" in role_perms.get("role_permissions", {}).get(user_role, [])
    )
    
    if can_view_plans:
        plans = await db.action_plans.find({
            "$or": [
                {"title": regex_query},
                {"description": regex_query},
                {"student_name": regex_query},
            ]
        }, {"_id": 0}).limit(limit).to_list(None)
        
        for p in plans:
            results.append({
                "id": p.get("plan_id", str(p.get("_id"))),
                "title": p.get("title", "Support Plan"),
                "subtitle": p.get("student_name", ""),
                "type": "Support Plan",
                "path": f"/students/{p.get('student_id')}?tab=support-plan",
                "icon": ICON_MAP["action_plan"],
            })

    # ── Search Appointments ──────────────────────────────────────────────────
    # Check if appointments feature is enabled
    settings_doc = await db.school_settings.find_one({}, {"feature_flags": 1})
    appointments_enabled = settings_doc.get("feature_flags", {}).get("appointments", True)
    
    can_view_appointments = (
        appointments_enabled and
        (user_role == "admin" or 
         not role_perms or 
         not role_perms.get("role_permissions") or
         "appointments" in role_perms.get("role_permissions", {}).get(user_role, []))
    )
    
    if can_view_appointments:
        appointments = await db.appointments.find({
            "$or": [
                {"appointment_type": regex_query},
                {"student_name": regex_query},
                {"notes": regex_query},
            ]
        }, {"_id": 0}).limit(limit).to_list(None)
        
        for a in appointments:
            results.append({
                "id": a.get("appointment_id", str(a.get("_id"))),
                "title": a.get("appointment_type", "Appointment"),
                "subtitle": f"{a.get('student_name', '')} · {a.get('date', '')}",
                "type": "Appointment",
                "path": f"/appointments",
                "icon": ICON_MAP["appointment"],
            })

    # ── Search Case Notes ────────────────────────────────────────────────────
    case_notes = await db.case_notes.find({
        "$or": [
            {"content": regex_query},
            {"student_name": regex_query},
        ]
    }, {"_id": 0}).limit(limit).to_list(None)
    
    for note in case_notes:
        # Only show case notes if user has permission to view the student
        student_id = note.get("student_id")
        student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "student_id": 1})
        if student:
            results.append({
                "id": note.get("note_id", str(note.get("_id"))),
                "title": f"Case Note",
                "subtitle": note.get("student_name", ""),
                "type": "Case Note",
                "path": f"/students/{student_id}?tab=case-notes",
                "icon": ICON_MAP["case_note"],
            })

    # Sort results by relevance (exact matches first, then partial)
    # Simple scoring: title starts with query = highest, contains = medium, subtitle match = lowest
    def score_result(r):
        title_lower = r.get("title", "").lower()
        subtitle_lower = r.get("subtitle", "").lower()
        query_lower = q.lower()
        
        if title_lower.startswith(query_lower):
            return 3
        elif query_lower in title_lower:
            return 2
        elif query_lower in subtitle_lower:
            return 1
        return 0
    
    results.sort(key=score_result, reverse=True)
    
    # Limit total results
    return results[:limit]
