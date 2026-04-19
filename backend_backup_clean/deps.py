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


def require_feature(flag_name: str):
    """Return a dependency that checks a school-level feature flag.
    Usage: Depends(require_feature("appointments"))
    """
    async def _check(request: Request):
        school = getattr(request.state, "school", None)
        if school:
            flags = school.get("feature_flags", {})
            if flags.get(flag_name) is False:
                raise HTTPException(
                    status_code=403,
                    detail=f"The {flag_name.replace('_', ' ')} module is not enabled for this school",
                )
    return _check
