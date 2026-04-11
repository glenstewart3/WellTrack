"""
deps.py — FastAPI dependencies for multi-tenant WellTrack.
"""
from fastapi import Request, HTTPException


async def get_tenant_db(request: Request):
    """Extract the tenant database from request state (set by TenantMiddleware)."""
    db = getattr(request.state, "db", None)
    if db is None:
        raise HTTPException(status_code=400, detail="No tenant context for this request")
    return db
