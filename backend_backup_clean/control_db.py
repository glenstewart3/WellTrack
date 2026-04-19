"""
control_db.py — Control plane database for the WellTrack multi-tenant platform.
Stores: super_admins, schools registry, super_admin_sessions, oauth_states, super_admin_audit.
"""
from motor.motor_asyncio import AsyncIOMotorClient
import os

_control_client = AsyncIOMotorClient(os.environ['MONGO_URL'])
control_db = _control_client["welltrack_control"]
