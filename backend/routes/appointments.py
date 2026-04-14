from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from deps import get_tenant_db
from helpers import get_current_user
from utils.audit import log_audit

router = APIRouter()


def _filter_professional_student_ids(user: dict, all_ids: list) -> list:
    if user.get("role") != "professional":
        return all_ids
    access = user.get("appointment_access", "assigned_only")
    if access == "all":
        return all_ids
    return all_ids


@router.get("/appointments")
async def get_appointments(
    student_id: Optional[str] = None,
    professional_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    user=Depends(get_current_user), db=Depends(get_tenant_db),
):
    query = {}
    if student_id:
        query["student_id"] = student_id
    if professional_id:
        query["professional_id"] = professional_id
    if status:
        query["status"] = status
    if from_date or to_date:
        date_q = {}
        if from_date:
            date_q["$gte"] = from_date
        if to_date:
            date_q["$lte"] = to_date
        query["date"] = date_q

    if user.get("role") == "professional":
        access = user.get("appointment_access", "assigned_only")
        if access != "all":
            query["professional_id"] = user["user_id"]

    docs = await db.appointments.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


@router.post("/appointments")
async def create_appointment(data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    appointment = {
        "appointment_id": f"apt_{uuid.uuid4().hex[:8]}",
        "student_id": data.get("student_id"),
        "student_name": data.get("student_name", ""),
        "professional_id": data.get("professional_id") or user["user_id"],
        "professional_name": data.get("professional_name") or user.get("name", ""),
        "date": data.get("date"),
        "time": data.get("time", ""),
        "duration_minutes": data.get("duration_minutes", 30),
        "appointment_type": data.get("appointment_type", "Individual Session"),
        "location": data.get("location", ""),
        "notes": data.get("notes", ""),
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["user_id"],
        "intervention_id": data.get("intervention_id"),
        "recurrence": data.get("recurrence"),
    }
    if appointment.get("recurrence"):
        appointments = _generate_recurring(appointment)
        if appointments:
            for a in appointments:
                await db.appointments.insert_one({**a})
            await log_audit(db, user, "created", "appointment", appointment["appointment_id"],
                            f"Recurring appointment ({len(appointments)}) — {appointment['student_name']}",
                            bulk_count=len(appointments))
            return appointments
    await db.appointments.insert_one({**appointment})
    appointment.pop("recurrence", None)
    await log_audit(db, user, "created", "appointment", appointment["appointment_id"],
                    f"{appointment['appointment_type']} — {appointment['student_name']}")
    return appointment


def _generate_recurring(base: dict) -> list:
    recurrence = base.pop("recurrence", None)
    if not recurrence:
        return [base]
    freq = recurrence.get("frequency", "weekly")
    count = min(recurrence.get("count", 8), 52)
    days_map = {"weekly": 7, "fortnightly": 14, "monthly": 30}
    delta = days_map.get(freq, 7)
    try:
        start = datetime.fromisoformat(base["date"])
    except Exception:
        return [base]
    series_id = f"series_{uuid.uuid4().hex[:8]}"
    appointments = []
    for i in range(count):
        d = start + timedelta(days=delta * i)
        a = {**base}
        if i > 0:
            a["appointment_id"] = f"apt_{uuid.uuid4().hex[:8]}"
        a["date"] = d.strftime("%Y-%m-%d")
        a["series_id"] = series_id
        a["series_index"] = i + 1
        a["series_total"] = count
        appointments.append(a)
    return appointments


@router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: dict, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Appointment not found")
    data.pop("_id", None)
    data.pop("appointment_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["updated_by"] = user["user_id"]
    await db.appointments.update_one({"appointment_id": appointment_id}, {"$set": data})
    updated = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    changes = {k: {"old": existing.get(k), "new": v} for k, v in data.items() if existing.get(k) != v}
    await log_audit(db, user, "updated", "appointment", appointment_id,
                    f"{updated.get('appointment_type','')} — {updated.get('student_name','')}",
                    changes=changes)
    return updated


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    existing = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Appointment not found")
    await db.appointments.delete_one({"appointment_id": appointment_id})
    await log_audit(db, user, "deleted", "appointment", appointment_id,
                    f"{existing.get('appointment_type','')} — {existing.get('student_name','')}")
    return {"message": "Appointment deleted"}


@router.delete("/appointments/series/{series_id}")
async def delete_series(series_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    result = await db.appointments.delete_many({"series_id": series_id})
    await log_audit(db, user, "deleted", "appointment", series_id,
                    f"Appointment series", bulk_count=result.deleted_count)
    return {"message": f"Deleted {result.deleted_count} appointments in series"}


@router.get("/appointments/schedule")
async def get_schedule(week_start: str = "", user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Return appointments for a given week (Mon-Sun)."""
    if not week_start:
        week_start = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        start = datetime.fromisoformat(week_start)
    except ValueError:
        start = datetime.now(timezone.utc)
    end_str = (start + timedelta(days=6)).strftime("%Y-%m-%d")
    query = {"date": {"$gte": week_start, "$lte": end_str}}
    docs = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)
    return {"appointments": docs, "week_start": week_start}


@router.get("/appointments/ongoing")
async def get_ongoing_appointments(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Return appointments with status 'scheduled' (active/upcoming)."""
    docs = await db.appointments.find(
        {"status": "scheduled"}, {"_id": 0}
    ).sort([("date", 1), ("time", 1)]).to_list(500)
    return docs


@router.get("/appointments/completed")
async def get_completed_appointments(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """Return completed and cancelled appointments."""
    docs = await db.appointments.find(
        {"status": {"$in": ["completed", "cancelled"]}}, {"_id": 0}
    ).sort([("date", -1), ("time", -1)]).to_list(500)
    return docs



@router.get("/appointments/today")
async def get_todays_appointments(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"date": today}
    if user.get("role") == "professional":
        access = user.get("appointment_access", "assigned_only")
        if access != "all":
            query["professional_id"] = user["user_id"]
    docs = await db.appointments.find(query, {"_id": 0}).sort("time", 1).to_list(100)
    return docs


@router.get("/appointments/upcoming")
async def get_upcoming_appointments(days: int = 7, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end = (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")
    query = {"date": {"$gte": today, "$lte": end}, "status": "scheduled"}
    if user.get("role") == "professional":
        access = user.get("appointment_access", "assigned_only")
        if access != "all":
            query["professional_id"] = user["user_id"]
    docs = await db.appointments.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(200)
    return docs


@router.get("/appointments/types")
async def get_appointment_types(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    s = await db.school_settings.find_one({}, {"_id": 0})
    defaults = [
        "Individual Session", "Group Session", "Assessment", "Review Meeting",
        "Parent Consultation", "Observation", "Crisis Intervention"
    ]
    return (s or {}).get("appointment_types", defaults)


@router.get("/appointments/professionals")
async def get_professionals(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    docs = await db.users.find(
        {"role": "professional"}, {"_id": 0, "password_hash": 0, "hashed_password": 0}
    ).to_list(100)
    return docs


@router.get("/appointments/student-options")
async def student_options(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") == "professional":
        access = user.get("appointment_access", "assigned_only")
        if access == "all":
            students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
        else:
            int_docs = await db.interventions.find(
                {"assigned_staff": {"$regex": user.get("name", ""), "$options": "i"}, "status": "active"},
                {"student_id": 1, "_id": 0}
            ).to_list(200)
            sids = list({i["student_id"] for i in int_docs})
            students = await db.students.find(
                {"student_id": {"$in": sids}, "enrolment_status": "active"}, {"_id": 0}
            ).to_list(500) if sids else []
    else:
        students = await db.students.find({"enrolment_status": "active"}, {"_id": 0}).to_list(500)
    return students


@router.get("/appointments/intervention-options/{student_id}")
async def intervention_options(student_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    interventions = await db.interventions.find(
        {"student_id": student_id, "status": "active"}, {"_id": 0}
    ).to_list(50)

    if user.get("role") == "professional":
        allowed_types = user.get("accessible_intervention_types", [])
        if allowed_types:
            interventions = [i for i in interventions if i.get("intervention_type") in allowed_types]

    cross_view = user.get("cross_professional_view", True) if user.get("role") == "professional" else True
    if not cross_view:
        user_name = user.get("name", "")
        interventions = [i for i in interventions if user_name.lower() in (i.get("assigned_staff") or "").lower()]

    return interventions


@router.get("/appointments/intervention-types")
async def accessible_intervention_types(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    """For professional users, return intervention types they have access to."""
    if user.get("role") == "professional":
        return user.get("accessible_intervention_types", [])
    docs = await db.users.find(
        {"role": "professional"}, {"_id": 0, "password_hash": 0}
    ).to_list(100)
    all_types = set()
    for d in docs:
        all_types.update(d.get("accessible_intervention_types", []))
    return list(all_types)
