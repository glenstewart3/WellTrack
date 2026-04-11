"""
tenant_middleware.py — Subdomain-based tenant resolution for WellTrack multi-tenant.
Sets request.state.db, request.state.tenant_slug, request.state.school, request.state.is_super_admin.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from control_db import control_db
from database import client
import os


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        host = request.headers.get("host", "").split(":")[0]  # strip port
        base_domain = os.environ.get("BASE_DOMAIN", "welltrack.com.au")
        app_env = os.environ.get("APP_ENV", "production")
        is_dev = app_env == "development"

        slug = None

        # 1. In dev mode, check X-Tenant-Slug header first
        if is_dev:
            slug = request.headers.get("X-Tenant-Slug")

        # 2. Try to extract slug from host (subdomain of base_domain)
        if not slug:
            if host == base_domain or host == f"www.{base_domain}":
                slug = None  # root domain = super admin
            elif host.endswith(f".{base_domain}"):
                slug = host[: -(len(base_domain) + 1)]
            elif is_dev and host in ("localhost", "127.0.0.1"):
                slug = None  # localhost = super admin in dev
            elif is_dev:
                # Dev fallback: host doesn't match base domain at all (e.g., preview env)
                # Use DEFAULT_TENANT_SLUG env var
                slug = os.environ.get("DEFAULT_TENANT_SLUG")

        if slug:
            school = await control_db.schools.find_one(
                {"slug": slug}, {"_id": 0}
            )
            if not school:
                return JSONResponse({"detail": "School not found"}, status_code=404)
            if school.get("status") == "suspended":
                return JSONResponse(
                    {"detail": "School access suspended. Contact your WellTrack administrator."},
                    status_code=403,
                )
            if school.get("status") == "archived":
                return JSONResponse(
                    {"detail": "This school has been archived."},
                    status_code=410,
                )
            request.state.db = client[school["db_name"]]
            request.state.tenant_slug = slug
            request.state.school = school
            request.state.is_super_admin = False
        else:
            request.state.db = None
            request.state.tenant_slug = None
            request.state.school = None
            request.state.is_super_admin = True

        return await call_next(request)
