from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import uuid
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import get_current_user
from utils.audit import log_audit

router = APIRouter()


# ── List all action plans (optionally filter by student/status) ──────────────

@router.get("/action-plans")
async def list_action_plans(
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db),
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if status:
        query["status"] = status
    plans = await db.action_plans.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return plans


# ── Get single plan ──────────────────────────────────────────────────────────

@router.get("/action-plans/{plan_id}")
async def get_action_plan(plan_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    plan = await db.action_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(404, "Action plan not found")
    return plan


# ── Create plan ──────────────────────────────────────────────────────────────

@router.post("/action-plans")
async def create_action_plan(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    student_id = data.get("student_id")
    if not student_id:
        raise HTTPException(400, "student_id is required")

    student = await db.students.find_one({"student_id": student_id}, {"_id": 0, "first_name": 1, "last_name": 1, "year_level": 1, "class_name": 1})
    if not student:
        raise HTTPException(404, "Student not found")

    plan_id = f"plan_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc).isoformat()

    plan = {
        "plan_id": plan_id,
        "student_id": student_id,
        "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
        "student_year_level": student.get("year_level", ""),
        "student_class": student.get("class_name", ""),
        "status": data.get("status", "draft"),
        "tier": data.get("tier"),
        "title": data.get("title", "Support Plan"),
        "strengths": data.get("strengths", ""),
        "concerns": data.get("concerns", ""),
        "goals": data.get("goals", []),
        "strategies": data.get("strategies", []),
        "responsible_staff": data.get("responsible_staff", []),
        "parent_involvement": data.get("parent_involvement", ""),
        "review_schedule": data.get("review_schedule", ""),
        "review_date": data.get("review_date"),
        "notes": data.get("notes", ""),
        "linked_intervention_ids": data.get("linked_intervention_ids", []),
        "created_by": user.get("user_id"),
        "created_by_name": user.get("name", ""),
        "created_at": now,
        "updated_at": now,
    }
    await db.action_plans.insert_one({**plan})

    sname = plan["student_name"]
    await log_audit(db, user, "created", "action_plan", plan_id, f"Action plan for {sname}")
    return plan


# ── Update plan ──────────────────────────────────────────────────────────────

@router.put("/action-plans/{plan_id}")
async def update_action_plan(plan_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.action_plans.find_one({"plan_id": plan_id})
    if not existing:
        raise HTTPException(404, "Action plan not found")

    allowed = {
        "status", "tier", "title", "strengths", "concerns", "goals",
        "strategies", "responsible_staff", "parent_involvement",
        "review_schedule", "review_date", "notes", "linked_intervention_ids",
    }
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "No valid fields to update")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.action_plans.update_one({"plan_id": plan_id}, {"$set": updates})

    await log_audit(db, user, "updated", "action_plan", plan_id,
                    f"Updated plan for {existing.get('student_name', '')}")
    updated = await db.action_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    return updated


# ── Delete plan ──────────────────────────────────────────────────────────────

@router.delete("/action-plans/{plan_id}")
async def delete_action_plan(plan_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.action_plans.find_one({"plan_id": plan_id})
    if not existing:
        raise HTTPException(404, "Action plan not found")

    await db.action_plans.delete_one({"plan_id": plan_id})
    await log_audit(db, user, "deleted", "action_plan", plan_id,
                    f"Deleted plan for {existing.get('student_name', '')}")
    return {"success": True}


# ── Add a review entry to a plan ─────────────────────────────────────────────

@router.post("/action-plans/{plan_id}/reviews")
async def add_plan_review(plan_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.action_plans.find_one({"plan_id": plan_id})
    if not existing:
        raise HTTPException(404, "Action plan not found")

    review = {
        "review_id": f"rev_{uuid.uuid4().hex[:8]}",
        "date": data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        "notes": data.get("notes", ""),
        "outcome": data.get("outcome", ""),
        "goals_progress": data.get("goals_progress", []),
        "next_review_date": data.get("next_review_date"),
        "reviewed_by": user.get("user_id"),
        "reviewed_by_name": user.get("name", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    updates = {"$push": {"reviews": review}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    if data.get("next_review_date"):
        updates["$set"]["review_date"] = data["next_review_date"]

    await db.action_plans.update_one({"plan_id": plan_id}, updates)
    await log_audit(db, user, "updated", "action_plan", plan_id,
                    f"Review added for {existing.get('student_name', '')}")
    return review
