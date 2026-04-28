"""
Centralised audit logging for all WellTrack write operations.
Call log_audit() from any router after a successful mutation.
It is fire-and-forget safe — errors are silently ignored so they
never break the primary operation.

For changes that affect school-wide settings or administration
(users, roles, classes, backups, data wipe, etc.), pass
mirror_to_sa=True so the entry is ALSO written to the control-plane
super_admin_audit collection. When a FastAPI `request` is passed in,
tenant_slug and school_name are auto-extracted from request.state.
"""
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def log_audit(
    db,
    user: dict,
    action: str,          # created | updated | deleted | bulk_import | bulk_archive | bulk_reactivate | uploaded | data_wipe
    entity_type: str,     # student | intervention | case_note | appointment | user | setting | attendance | class | photo
    entity_id: str = "",
    entity_name: str = "",
    changes: dict = None,
    bulk_count: int = None,
    metadata: dict = None,
    mirror_to_sa: bool = False,
    tenant_slug: str = None,
    school_name: str = None,
    request=None,
):
    """Insert one audit entry. Silently swallows any DB error.

    When mirror_to_sa=True the same entry is additionally copied into the
    control-plane super_admin_audit collection so super admins have a central
    view of every settings/administration change across all tenants. If a
    FastAPI `request` is provided, tenant_slug + school_name are auto-filled
    from request.state so callers don't need to pass them manually.
    """
    now = datetime.now(timezone.utc).isoformat()
    try:
        entry = {
            "audit_id": str(uuid.uuid4()),
            "timestamp": now,
            "user_id": user.get("user_id", "system"),
            "user_name": user.get("name") or user.get("email", "Unknown"),
            "user_role": user.get("role", "unknown"),
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "changes": changes or {},
            "bulk_count": bulk_count,
            "metadata": metadata or {},
        }
        await db.audit_log.insert_one(entry)
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)

    if not mirror_to_sa:
        return

    # Auto-extract tenant context from the FastAPI request if available
    if request is not None:
        if not tenant_slug:
            tenant_slug = getattr(request.state, "tenant_slug", None)
        if not school_name:
            school = getattr(request.state, "school", None) or {}
            school_name = school.get("name") or school.get("school_name")

    try:
        from control_db import control_db
        sa_entry = {
            "audit_id": str(uuid.uuid4()),
            "timestamp": now,
            "super_admin_id": "school_admin",
            "super_admin_name": user.get("name") or user.get("email", "Unknown"),
            "action": f"tenant_{action}",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name,
            "tenant_slug": tenant_slug,
            "school_name": school_name,
            "details": {
                "user_role": user.get("role", "unknown"),
                "changes": changes or {},
                "bulk_count": bulk_count,
                "metadata": metadata or {},
            },
        }
        await control_db.super_admin_audit.insert_one(sa_entry)
    except Exception as exc:
        logger.warning("SA mirror audit log write failed: %s", exc)
