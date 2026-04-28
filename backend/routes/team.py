"""Team Collaboration Routes - Tasks, @mentions, and Notifications"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import re
import uuid

from deps import get_tenant_db
from helpers import get_current_user, get_school_settings_doc
from utils.audit import log_audit

router = APIRouter()


# ── Tasks ────────────────────────────────────────────────────────────────────

@router.get("/tasks")
async def get_tasks(
    assigned_to: Optional[str] = None,
    status: Optional[str] = None,
    student_id: Optional[str] = None,
    priority: Optional[str] = None,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Get tasks with optional filtering."""
    query = {}

    if assigned_to:
        query["assigned_to"] = assigned_to
    elif user.get("role") not in ["admin", "leadership"]:
        # Non-leaders can only see their own tasks
        query["assigned_to"] = user.get("user_id")

    if status:
        query["status"] = status
    if student_id:
        query["student_id"] = student_id
    if priority:
        query["priority"] = priority

    tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(200)
    return tasks


@router.post("/tasks")
async def create_task(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Create a new task."""
    assigned_to = data.get("assigned_to")
    if not assigned_to:
        raise HTTPException(400, "Task must be assigned to someone")

    # Get student name if student_id provided
    student_name = ""
    if data.get("student_id"):
        student = await db.students.find_one(
            {"student_id": data["student_id"]},
            {"_id": 0, "first_name": 1, "last_name": 1}
        )
        if student:
            student_name = f"{student.get('first_name','')} {student.get('last_name','')}".strip()

    task_id = f"task_{uuid.uuid4().hex[:8]}"
    task = {
        "task_id": task_id,
        "student_id": data.get("student_id"),
        "student_name": student_name,
        "assigned_to": assigned_to,
        "assigned_by": user.get("user_id"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "due_date": data.get("due_date"),
        "status": "pending",
        "priority": data.get("priority", "medium"),
        "related_intervention_id": data.get("related_intervention_id"),
        "related_case_note_id": data.get("related_case_note_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.tasks.insert_one({**task})

    # Create notification for assignee
    await db.notifications.insert_one({
        "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
        "user_id": assigned_to,
        "type": "task_assigned",
        "title": "New Task Assigned",
        "message": f"{user.get('name', 'Someone')} assigned you: {task['title']}",
        "related_student_id": data.get("student_id"),
        "related_task_id": task_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await log_audit(db, user, "created", "task", task_id,
                    f"Task: {task['title']}",
                    metadata={"assigned_to": assigned_to, "student_id": data.get("student_id")})

    return task


@router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Update a task."""
    existing = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Task not found")

    # Check permissions
    if existing["assigned_to"] != user.get("user_id") and existing["assigned_by"] != user.get("user_id"):
        if user.get("role") not in ["admin", "leadership"]:
            raise HTTPException(403, "Access denied")

    updates = {}
    allowed_fields = ["title", "description", "due_date", "status", "priority"]
    for field in allowed_fields:
        if field in data:
            updates[field] = data[field]

    # Handle status change to completed
    if data.get("status") == "completed" and existing.get("status") != "completed":
        updates["completed_at"] = datetime.now(timezone.utc).isoformat()
        updates["completed_by"] = user.get("user_id")

        # Notify the assigner that task is completed
        if existing["assigned_by"] != user.get("user_id"):
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                "user_id": existing["assigned_by"],
                "type": "task_completed",
                "title": "Task Completed",
                "message": f"{user.get('name', 'Someone')} completed: {existing['title']}",
                "related_student_id": existing.get("student_id"),
                "related_task_id": task_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.tasks.update_one({"task_id": task_id}, {"$set": updates})
    updated = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})

    await log_audit(db, user, "updated", "task", task_id,
                    f"Updated task: {existing['title']}",
                    metadata=updates)

    return updated


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Delete a task."""
    existing = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Task not found")

    # Only admin, leadership, or the creator can delete
    if existing["assigned_by"] != user.get("user_id"):
        if user.get("role") not in ["admin", "leadership"]:
            raise HTTPException(403, "Access denied")

    await db.tasks.delete_one({"task_id": task_id})

    await log_audit(db, user, "deleted", "task", task_id,
                    f"Deleted task: {existing['title']}")

    return {"message": "Task deleted"}


@router.get("/tasks/upcoming")
async def get_upcoming_tasks(days: int = 7, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Get tasks due within the next N days."""
    future = (datetime.now(timezone.utc) + timedelta(days=days)).date().isoformat()

    query = {
        "assigned_to": user.get("user_id"),
        "status": {"$nin": ["completed", "cancelled"]},
        "due_date": {"$lte": future}
    }

    tasks = await db.tasks.find(query, {"_id": 0}).sort("due_date", 1).to_list(50)
    return tasks


# ── Notifications ───────────────────────────────────────────────────────────

@router.get("/notifications")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    user=Depends(get_current_user),
    db=Depends(get_tenant_db)
):
    """Get notifications for the current user."""
    query = {"user_id": user.get("user_id")}
    if unread_only:
        query["is_read"] = False

    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    return notifications


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Mark a notification as read."""
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.get("user_id")},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Marked as read"}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Mark all notifications as read."""
    await db.notifications.update_many(
        {"user_id": user.get("user_id"), "is_read": False},
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "All marked as read"}


@router.get("/notifications/unread-count")
async def get_unread_notification_count(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Get count of unread notifications."""
    count = await db.notifications.count_documents(
        {"user_id": user.get("user_id"), "is_read": False}
    )
    return {"count": count}


@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Delete a notification."""
    await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": user.get("user_id")
    })
    return {"message": "Notification deleted"}


# ── Intervention Team Management ─────────────────────────────────────────────

@router.put("/interventions/{intervention_id}/team")
async def update_intervention_team(intervention_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Update the team members for an intervention."""
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")

    existing = await db.interventions.find_one({"intervention_id": intervention_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Intervention not found")

    team_members = data.get("team_members", [])

    # Validate that all team members exist
    for member_id in team_members:
        member = await db.users.find_one({"user_id": member_id}, {"_id": 0, "name": 1})
        if not member:
            raise HTTPException(400, f"User {member_id} not found")

    await db.interventions.update_one(
        {"intervention_id": intervention_id},
        {"$set": {"team_members": team_members, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Notify new team members
    old_team = set(existing.get("team_members", []))
    new_team = set(team_members)
    added = new_team - old_team

    for member_id in added:
        member = await db.users.find_one({"user_id": member_id}, {"_id": 0, "name": 1})
        if member:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:8]}",
                "user_id": member_id,
                "type": "intervention_assigned",
                "title": "Added to Intervention Team",
                "message": f"You were added to the intervention team for {existing.get('intervention_type', 'a student')}",
                "related_intervention_id": intervention_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    await log_audit(db, user, "updated", "intervention", intervention_id,
                    f"Updated intervention team",
                    metadata={"team_members": team_members})

    return {"message": "Team updated", "team_members": team_members}


@router.get("/interventions/{intervention_id}/team")
async def get_intervention_team(intervention_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Get the team members for an intervention."""
    intervention = await db.interventions.find_one({"intervention_id": intervention_id}, {"_id": 0})
    if not intervention:
        raise HTTPException(404, "Intervention not found")

    team_members = intervention.get("team_members", [])

    # Get user details for each team member
    team_details = []
    for member_id in team_members:
        member = await db.users.find_one({"user_id": member_id}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1})
        if member:
            team_details.append(member)

    # Get primary staff details
    primary_staff = await db.users.find_one(
        {"name": intervention.get("assigned_staff")},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1}
    )

    return {
        "intervention_id": intervention_id,
        "primary_staff": primary_staff or {"name": intervention.get("assigned_staff")},
        "team_members": team_details
    }
