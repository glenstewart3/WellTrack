"""
Centralised audit logging for all WellTrack write operations.
Call log_audit() from any router after a successful mutation.
It is fire-and-forget safe — errors are silently ignored so they
never break the primary operation.
"""
import uuid
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def log_audit(
    db,
    user: dict,
    action: str,          # created | updated | deleted | bulk_import | bulk_archive | bulk_reactivate | uploaded | data_wipe
    entity_type: str,     # student | intervention | case_note | appointment | user | setting | attendance
    entity_id: str = "",
    entity_name: str = "",
    changes: dict = None,
    bulk_count: int = None,
    metadata: dict = None,
):
    """Insert one audit entry. Silently swallows any DB error."""
    try:
        entry = {
            "audit_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
