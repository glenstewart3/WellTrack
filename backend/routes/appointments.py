from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Optional
import uuid

from database import db
from helpers import get_current_user, create_alert
from utils.audit import log_audit

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _gen_id():
    return "apt_" + uuid.uuid4().hex[:8]


def _norm_type(t):
    """Normalise a legacy string intervention type to a rich object."""
    if isinstance(t, str):
        return {
            "name": t,
            "appointment_scheduling_enabled": False,
            "appointment_config": {"session_types": [], "flags": [], "rooms": [],
                                   "outcome_ratings": [], "statuses": []},
        }
    return t


async def _get_apt_config(intervention_type_name: str) -> dict:
    s = await db.school_settings.find_one({}, {"_id": 0, "intervention_types": 1})
    for t in (s or {}).get("intervention_types", []):
        t = _norm_type(t)
        if t["name"] == intervention_type_name:
            return t.get("appointment_config", {})
    return {}


def _completed_values(cfg: dict):
    return {s["value"] for s in cfg.get("statuses", []) if s.get("is_completed_equivalent")}


def _improved_values(cfg: dict):
    return {o["value"] for o in cfg.get("outcome_ratings", []) if o.get("is_improved_equivalent")}


def _can_access_type(user: dict, itype: str) -> bool:
    if user.get("role") in ("admin", "professional"):
        return True
    if not user.get("appointment_access"):
        return False
    accessible = user.get("accessible_intervention_types") or []
    return not accessible or itype in accessible


def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    for k in ("professional_user_id", "created_by"):
        if k in doc and not isinstance(doc[k], str):
            doc[k] = str(doc[k])
    return doc


async def _log_audit(user: dict, appointment_id: str, action: str, changes: dict = None):
    await db.appointment_audit_log.insert_one({
        "appointment_id": appointment_id,
        "action": action,
        "user_id": user.get("user_id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "changes": changes or {},
    })


async def _update_intervention_on_completion(appointment: dict, cfg: dict):
    """Append session notes and write outcome_rating to the linked intervention."""
    completed = _completed_values(cfg)
    if appointment.get("status") not in completed:
        return
    intv_id = appointment.get("intervention_id")
    if not intv_id:
        return
    intv = await db.interventions.find_one({"intervention_id": intv_id})
    if not intv:
        return
    ts = datetime.now(timezone.utc).strftime("%d %b %Y %H:%M")
    prof = appointment.get("professional_name_fallback", "Unknown")
    header = f"\n\n[{ts} — {prof}]\n"
    new_notes = (intv.get("progress_notes") or "") + header + (appointment.get("session_notes") or "")
    update = {"progress_notes": new_notes.strip()}
    if appointment.get("outcome_rating"):
        update["outcome_rating"] = appointment["outcome_rating"]
    await db.interventions.update_one({"intervention_id": intv_id}, {"$set": update})


async def _generate_alerts(student_id: str, intervention_type: str, cfg: dict):
    """DNA and case-review alerts based on appointment history."""
    student = await db.students.find_one({"student_id": student_id}, {"_id": 0})
    if not student:
        return
    name = f"{student.get('first_name', '')} {student.get('last_name', '')}".strip()
    cls = student.get("class_name", "")

    # DNA: 2+ consecutive DNA-equivalent statuses
    dna_vals = {s["value"] for s in cfg.get("statuses", [])
                if "dna" in s["value"].lower() or "did not attend" in s["value"].lower()}
    if dna_vals:
        recent = await db.appointments.find(
            {"student_id": student_id, "intervention_type": intervention_type},
            {"status": 1, "_id": 0}
        ).sort("date", -1).limit(5).to_list(5)
        consecutive = 0
        for a in recent:
            if a.get("status") in dna_vals:
                consecutive += 1
            else:
                break
        if consecutive >= 2:
            await create_alert(student_id, name, cls,
                               "dna_consecutive", "medium",
                               f"Follow-up recommended — {name} has missed {consecutive} consecutive sessions ({intervention_type})")

    # Case review: 5+ completed sessions, no improved outcome
    improved = _improved_values(cfg)
    completed = _completed_values(cfg)
    if completed:
        all_sessions = await db.appointments.find(
            {"student_id": student_id, "intervention_type": intervention_type,
             "status": {"$in": list(completed)}},
            {"outcome_rating": 1, "_id": 0}
        ).to_list(None)
        if len(all_sessions) >= 5:
            has_improved = any(a.get("outcome_rating") in improved for a in all_sessions)
            if not has_improved:
                await create_alert(student_id, name, cls,
                                   "case_review_recommended", "medium",
                                   f"Case review recommended — {name} ({len(all_sessions)} sessions, no improvement recorded, {intervention_type})")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/appointments")
async def list_appointments(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    professional_id: Optional[str] = None,
    intervention_type: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled for this account")

    query = {}
    if from_date or to_date:
        query["date"] = {}
        if from_date:
            query["date"]["$gte"] = from_date
        if to_date:
            query["date"]["$lte"] = to_date
    if status:
        query["status"] = status
    if intervention_type:
        query["intervention_type"] = intervention_type

    if user.get("role") != "admin" and not user.get("cross_professional_view"):
        query["professional_user_id"] = user.get("user_id")
    elif professional_id:
        query["professional_user_id"] = professional_id

    if user.get("role") != "admin":
        accessible = user.get("accessible_intervention_types") or []
        if accessible:
            query["intervention_type"] = {"$in": accessible}

    docs = await db.appointments.find(query, {"_id": 0}).sort("date", -1).limit(500).to_list(None)
    return [_clean(d) for d in docs]


@router.get("/appointments/schedule")
async def get_schedule(
    week_start: Optional[str] = None,
    professional_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    if not week_start:
        today = datetime.now(timezone.utc)
        from datetime import timedelta
        week_start = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")

    from datetime import timedelta, date as dt_date
    ws = datetime.strptime(week_start, "%Y-%m-%d").date()
    we = ws + timedelta(days=6)
    week_end = we.strftime("%Y-%m-%d")

    query = {"date": {"$gte": week_start, "$lte": week_end}}
    if user.get("role") != "admin" and not user.get("cross_professional_view"):
        query["professional_user_id"] = user.get("user_id")
    elif professional_id:
        query["professional_user_id"] = professional_id

    if user.get("role") != "admin":
        accessible = user.get("accessible_intervention_types") or []
        if accessible:
            query["intervention_type"] = {"$in": accessible}

    docs = await db.appointments.find(query, {"_id": 0}).sort("time", 1).to_list(None)
    return {"week_start": week_start, "week_end": week_end, "appointments": [_clean(d) for d in docs]}


@router.get("/appointments/ongoing")
async def get_ongoing(user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    settings = await db.school_settings.find_one({}, {"_id": 0, "intervention_types": 1})
    enabled_types = {
        _norm_type(t)["name"]
        for t in (settings or {}).get("intervention_types", [])
        if _norm_type(t).get("appointment_scheduling_enabled")
    }

    if user.get("role") != "admin":
        accessible = set(user.get("accessible_intervention_types") or [])
        if accessible:
            enabled_types &= accessible

    if not enabled_types:
        return []

    query = {"status": "active", "intervention_type": {"$in": list(enabled_types)}}
    if user.get("role") != "admin" and not user.get("cross_professional_view"):
        query["assigned_professional_id"] = user.get("user_id")

    interventions = await db.interventions.find(query, {"_id": 0}).to_list(None)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    result = []
    for intv in interventions:
        sid = intv["student_id"]
        itype = intv["intervention_type"]
        student = await db.students.find_one({"student_id": sid}, {"_id": 0,
            "first_name": 1, "last_name": 1, "preferred_name": 1, "class_name": 1, "year_level": 1})
        if not student:
            continue

        cfg = await _get_apt_config(itype)
        improved = _improved_values(cfg)
        completed_s = _completed_values(cfg)

        sessions = await db.appointments.find(
            {"student_id": sid, "intervention_id": intv["intervention_id"]},
            {"_id": 0, "date": 1, "status": 1, "outcome_rating": 1}
        ).sort("date", -1).to_list(None)

        session_count = len(sessions)
        last_date = sessions[0]["date"] if sessions else None
        completed_sessions = [s for s in sessions if s.get("status") in completed_s] if completed_s else sessions
        case_review = (
            len(completed_sessions) >= 5 and
            not any(s.get("outcome_rating") in improved for s in completed_sessions)
        ) if improved else False

        review_overdue = intv.get("review_date", "") < today if intv.get("review_date") else False

        result.append({
            **intv,
            "student": student,
            "session_count": session_count,
            "last_session_date": last_date,
            "case_review_recommended": case_review,
            "review_overdue": review_overdue,
        })

    return result


@router.get("/appointments/completed")
async def get_completed(user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    settings = await db.school_settings.find_one({}, {"_id": 0, "intervention_types": 1})
    enabled_types = {
        _norm_type(t)["name"]
        for t in (settings or {}).get("intervention_types", [])
        if _norm_type(t).get("appointment_scheduling_enabled")
    }

    if user.get("role") != "admin":
        accessible = set(user.get("accessible_intervention_types") or [])
        if accessible:
            enabled_types &= accessible

    if not enabled_types:
        return []

    query = {"status": "completed", "intervention_type": {"$in": list(enabled_types)}}

    interventions = await db.interventions.find(query, {"_id": 0}).to_list(None)
    result = []
    for intv in interventions:
        sid = intv["student_id"]
        student = await db.students.find_one({"student_id": sid}, {"_id": 0,
            "first_name": 1, "last_name": 1, "preferred_name": 1, "class_name": 1, "year_level": 1})
        if not student:
            continue

        sessions = await db.appointments.find(
            {"student_id": sid, "intervention_id": intv["intervention_id"]},
            {"_id": 0, "date": 1, "status": 1}
        ).sort("date", -1).to_list(None)

        result.append({**intv, "student": student, "session_count": len(sessions),
                       "last_session_date": sessions[0]["date"] if sessions else None})
    return result


@router.get("/appointments/audit")
async def get_audit_log(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    professional_id: Optional[str] = None,
    page: int = 1,
    user=Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")

    query = {}
    if from_date or to_date:
        query["timestamp"] = {}
        if from_date:
            query["timestamp"]["$gte"] = from_date
        if to_date:
            query["timestamp"]["$lte"] = to_date + "T23:59:59"
    if professional_id:
        query["user_id"] = professional_id

    per_page = 50
    skip = (page - 1) * per_page
    total = await db.appointment_audit_log.count_documents(query)
    docs = await db.appointment_audit_log.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(per_page).to_list(None)
    return {"total": total, "page": page, "per_page": per_page, "entries": docs}


@router.get("/appointments/student/{student_id}")
async def get_student_appointments(student_id: str, user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    query = {"student_id": student_id}
    if user.get("role") != "admin" and not user.get("cross_professional_view"):
        query["professional_user_id"] = user.get("user_id")

    docs = await db.appointments.find(query, {"_id": 0}).sort("date", -1).to_list(None)
    return [_clean(d) for d in docs]


@router.get("/appointments/{appointment_id}")
async def get_appointment(appointment_id: str, user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")
    doc = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Appointment not found")
    return _clean(doc)


@router.post("/appointments")
async def create_appointment(data: dict, user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    itype = data.get("intervention_type", "")
    if not _can_access_type(user, itype):
        raise HTTPException(403, f"Access to intervention type '{itype}' not permitted")

    now = datetime.now(timezone.utc).isoformat()
    apt = {
        "appointment_id": _gen_id(),
        "intervention_id": data.get("intervention_id"),
        "student_id": data.get("student_id"),
        "professional_user_id": data.get("professional_user_id") or user.get("user_id"),
        "professional_name_fallback": data.get("professional_name_fallback") or user.get("name", ""),
        "intervention_type": itype,
        "session_type": data.get("session_type", ""),
        "date": data.get("date", ""),
        "time": data.get("time", ""),
        "room": data.get("room", ""),
        "reason_for_visit": data.get("reason_for_visit", ""),
        "session_notes": data.get("session_notes", ""),
        "outcome_rating": data.get("outcome_rating"),
        "status": data.get("status", ""),
        "flags": data.get("flags", []),
        "follow_up_date": data.get("follow_up_date"),
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("user_id"),
    }
    await db.appointments.insert_one(apt)
    apt.pop("_id", None)

    cfg = await _get_apt_config(itype)
    await _update_intervention_on_completion(apt, cfg)
    await _generate_alerts(apt["student_id"], itype, cfg)
    await _log_audit(user, apt["appointment_id"], "create", {"created": apt})
    await log_audit(user, "created", "appointment", apt["appointment_id"],
                    f"{apt.get('intervention_type','')} — {apt.get('student_id','')}",
                    metadata={"student_id": apt.get("student_id"), "date": apt.get("date")})

    return apt


@router.put("/appointments/{appointment_id}")
async def update_appointment(appointment_id: str, data: dict, user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    existing = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Appointment not found")

    allowed_fields = [
        "session_type", "date", "time", "room", "reason_for_visit",
        "session_notes", "outcome_rating", "status", "flags", "follow_up_date",
        "professional_user_id", "professional_name_fallback",
    ]
    update = {k: data[k] for k in allowed_fields if k in data}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    changes = {k: {"from": existing.get(k), "to": update[k]} for k in update if update[k] != existing.get(k)}

    await db.appointments.update_one({"appointment_id": appointment_id}, {"$set": update})
    updated = {**existing, **update}

    cfg = await _get_apt_config(existing.get("intervention_type", ""))
    prev_completed = existing.get("status") in _completed_values(cfg)
    now_completed = update.get("status", existing.get("status")) in _completed_values(cfg)
    if now_completed and not prev_completed:
        await _update_intervention_on_completion(updated, cfg)
    await _generate_alerts(existing["student_id"], existing.get("intervention_type", ""), cfg)
    await _log_audit(user, appointment_id, "update", changes)
    await log_audit(user, "updated", "appointment", appointment_id,
                    f"{existing.get('intervention_type','')} — {existing.get('student_id','')}", changes=changes)

    return _clean(updated)


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str, user=Depends(get_current_user)):
    if not user.get("appointment_access") and user.get("role") not in ("admin", "professional"):
        raise HTTPException(403, "Appointment access not enabled")

    existing = await db.appointments.find_one({"appointment_id": appointment_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Appointment not found")

    await db.appointments.delete_one({"appointment_id": appointment_id})
    await _log_audit(user, appointment_id, "delete", {"deleted": existing})
    return {"message": "Appointment deleted"}
    await log_audit(user, "deleted", "appointment", appointment_id,
                    f"{existing.get('intervention_type','')} — {existing.get('student_id','')}")


# ── Per-type appointment config ───────────────────────────────────────────────

@router.get("/settings/intervention-types/{type_name}/appointment-config")
async def get_apt_config_endpoint(type_name: str, user=Depends(get_current_user)):
    cfg = await _get_apt_config(type_name)
    return cfg


@router.put("/settings/intervention-types/{type_name}/appointment-config")
async def update_apt_config(type_name: str, data: dict, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")

    settings = await db.school_settings.find_one({}, {"_id": 0, "intervention_types": 1})
    types = [(settings or {}).get("intervention_types", [])]
    types = types[0]
    normalised = [_norm_type(t) for t in types]

    found = False
    for t in normalised:
        if t["name"] == type_name:
            t["appointment_scheduling_enabled"] = data.get(
                "appointment_scheduling_enabled", t.get("appointment_scheduling_enabled", False))
            t["appointment_config"] = data.get("appointment_config", t.get("appointment_config", {}))
            found = True
            break

    if not found:
        normalised.append({
            "name": type_name,
            "appointment_scheduling_enabled": data.get("appointment_scheduling_enabled", False),
            "appointment_config": data.get("appointment_config", {}),
        })

    await db.school_settings.update_one({}, {"$set": {"intervention_types": normalised}}, upsert=True)
    return {"message": "Config updated"}


# ── Professionals list for dropdowns ─────────────────────────────────────────

@router.get("/users/professionals")
async def list_professionals(
    intervention_type: Optional[str] = None,
    user=Depends(get_current_user),
):
    # Include users with appointment_access flag OR the professional role
    docs = await db.users.find(
        {"$or": [{"appointment_access": True}, {"role": "professional"}]},
        {"_id": 0, "hashed_password": 0}
    ).to_list(None)
    if intervention_type:
        docs = [d for d in docs if not d.get("accessible_intervention_types")
                or intervention_type in d.get("accessible_intervention_types", [])]
    return docs
