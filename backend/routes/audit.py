from fastapi import APIRouter, Depends
from database import db
from helpers import get_current_user

router = APIRouter()


@router.get("/audit")
async def get_audit_log(
    entity_type: str = None,
    action: str = None,
    user_id: str = None,
    date_from: str = None,
    date_to: str = None,
    page: int = 0,
    per_page: int = 50,
    current_user=Depends(get_current_user),
):
    """Admin-only: return paginated audit log with optional filters."""
    if current_user.get("role") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin only")

    query = {}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if user_id:
        query["user_id"] = user_id
    if date_from or date_to:
        ts_filter = {}
        if date_from:
            ts_filter["$gte"] = date_from
        if date_to:
            ts_filter["$lte"] = date_to + "T23:59:59"
        query["timestamp"] = ts_filter

    total = await db.audit_log.count_documents(query)
    docs = await db.audit_log.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(page * per_page).limit(per_page).to_list(None)

    return {"total": total, "page": page, "per_page": per_page, "entries": docs}
