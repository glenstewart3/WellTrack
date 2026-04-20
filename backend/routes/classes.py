"""Class / Home-Group → Teacher assignments.

Each school has a list of classes (derived from the distinct `class_name` /
`HOME_GROUP` values on active students). Admins can assign one teacher per
class. The assignment is stored in the tenant DB collection
`class_assignments` as {class_name, teacher_user_id, teacher_name, ...} and is
also denormalised onto each student doc (`teacher` field) so existing filters
keep working.
"""
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import get_current_user
from utils.audit import log_audit

router = APIRouter()


@router.get("/classes")
async def list_classes(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """List every class with its student count and assigned teacher (if any)."""
    # Distinct class_name among active students → preserves natural order via sort
    pipeline = [
        {"$match": {"enrolment_status": "active", "class_name": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$class_name", "student_count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    groups = await db.students.aggregate(pipeline).to_list(500)
    assignments = await db.class_assignments.find({}, {"_id": 0}).to_list(500)
    assign_map = {a["class_name"]: a for a in assignments}

    # Fallback: derive teacher name from any student in the class (legacy data
    # imported before class_assignments existed)
    classes = []
    for g in groups:
        name = g["_id"]
        a = assign_map.get(name, {})
        teacher_name = a.get("teacher_name")
        if not teacher_name:
            any_student = await db.students.find_one(
                {"class_name": name, "teacher": {"$nin": [None, ""]}},
                {"_id": 0, "teacher": 1}
            )
            if any_student:
                teacher_name = any_student.get("teacher")
        classes.append({
            "class_name": name,
            "student_count": g["student_count"],
            "teacher": teacher_name or "",          # legacy field (ClassroomRadar, Screening)
            "teacher_name": teacher_name,
            "teacher_user_id": a.get("teacher_user_id"),
            "updated_at": a.get("updated_at"),
        })
    return classes


@router.put("/classes/{class_name:path}/teacher")
async def assign_teacher(class_name: str, data: dict,
                         user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Assign (or clear) the teacher for a class.

    Body: { teacher_user_id: str | null }
    Passing null (or an empty string) clears the assignment.
    """
    if user.get("role") not in ["admin", "leadership"]:
        raise HTTPException(403, "Admin or leadership access required")

    class_name = (class_name or "").strip()
    if not class_name:
        raise HTTPException(400, "class_name is required")

    teacher_user_id = (data or {}).get("teacher_user_id")
    if teacher_user_id:
        teacher_user_id = str(teacher_user_id).strip()

    if not teacher_user_id:
        # Clear assignment
        await db.class_assignments.delete_one({"class_name": class_name})
        await db.students.update_many(
            {"class_name": class_name},
            {"$unset": {"teacher": ""}}
        )
        await log_audit(db, user, "updated", "class", class_name,
                        f"Cleared teacher for {class_name}")
        return {"class_name": class_name, "teacher_user_id": None, "teacher_name": None}

    teacher_doc = await db.users.find_one(
        {"user_id": teacher_user_id},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "role": 1}
    )
    if not teacher_doc:
        raise HTTPException(404, "Teacher user not found")

    teacher_name = teacher_doc.get("name") or teacher_doc.get("email") or teacher_user_id
    now = datetime.now(timezone.utc).isoformat()

    await db.class_assignments.update_one(
        {"class_name": class_name},
        {"$set": {
            "class_name": class_name,
            "teacher_user_id": teacher_user_id,
            "teacher_name": teacher_name,
            "updated_at": now,
        }},
        upsert=True,
    )
    # Denormalise onto students so existing class/teacher filters just work
    await db.students.update_many(
        {"class_name": class_name},
        {"$set": {"teacher": teacher_name}},
    )
    await log_audit(db, user, "updated", "class", class_name,
                    f"{class_name} → {teacher_name}",
                    changes={"teacher": {"new": teacher_name}})

    return {
        "class_name": class_name,
        "teacher_user_id": teacher_user_id,
        "teacher_name": teacher_name,
        "updated_at": now,
    }
