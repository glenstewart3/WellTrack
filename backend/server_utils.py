"""
server_utils.py — Shared server utilities (avoids circular imports between server.py and routes).
"""


async def ensure_indexes(db):
    """Create required indexes on a given database. Called on startup and school provisioning."""
    await db.attendance_records.create_index("student_id")
    await db.attendance_records.create_index("date")
    await db.saebrs_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.self_report_results.create_index([("student_id", 1), ("created_at", 1)])
    await db.interventions.create_index([("student_id", 1), ("status", 1)])
    await db.user_sessions.create_index("session_token")
    await db.school_days.create_index("year")
