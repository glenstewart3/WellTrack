from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from deps import get_tenant_db
from helpers import get_current_user

router = APIRouter()


@router.get("/alerts")
async def get_alerts(resolved: bool = False, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    return await db.alerts.find({"resolved": resolved}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.put("/alerts/read-all")
async def mark_all_read(user=Depends(get_current_user), db=Depends(get_tenant_db)):
    await db.alerts.update_many({"is_read": False, "resolved": False}, {"$set": {"is_read": True}})
    return {"message": "ok"}


@router.put("/alerts/{alert_id}/read")
async def mark_read(alert_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    await db.alerts.update_one({"alert_id": alert_id}, {"$set": {"is_read": True}})
    return {"message": "ok"}


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    await db.alerts.update_one({"alert_id": alert_id}, {"$set": {"resolved": True, "is_read": True}})
    return {"message": "ok"}


@router.put("/alerts/{alert_id}/approve")
async def approve_tier_change(alert_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")
    await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"pending_approval": False, "resolved": True, "is_read": True,
                  "approved_by": user.get("user_id"),
                  "approved_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Tier change approved"}


@router.put("/alerts/{alert_id}/reject")
async def reject_tier_change(alert_id: str, user=Depends(get_current_user), db=Depends(get_tenant_db)):
    if user.get("role") not in ["admin", "leadership", "wellbeing"]:
        raise HTTPException(403, "Access denied")
    await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"pending_approval": False, "rejected": True, "is_read": True}}
    )
    return {"message": "Tier change rejected"}
