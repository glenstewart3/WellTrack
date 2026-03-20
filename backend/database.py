from motor.motor_asyncio import AsyncIOMotorClient
import os

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

# Attendance status constants
PRESENT_STATUSES = {
    "Present", "Late arrival, approved", "Late arrival at School",
    "Early departure, approved", "Early departure from School",
}

FULL_PRESENT_STATUSES = {
    "Late arrival, approved", "Late arrival at School",
    "Early departure, approved", "Early departure from School",
}

DEFAULT_ABSENCE_TYPES = [
    "Present", "Medical/Illness", "Unexplained", "Family Holiday",
    "Parent Choice School Approved", "Healthcare Appoint, Offsite",
    "Late arrival, approved", "Late arrival at School",
    "Early departure, approved", "Early departure from School",
    "School refusal or school can't", "Social services or justice",
    "Suspension - External", "Suspension - Internal",
]

SETTINGS_DEFAULTS = {
    "school_name": "", "school_type": "both", "current_term": "Term 1", "current_year": 2025,
    "platform_name": "WellTrack", "logo_base64": "", "accent_color": "#0f172a", "welcome_message": "",
    "tier_thresholds": {"saebrs_some_risk": 37, "saebrs_high_risk": 24, "attendance_some_risk": 90.0, "attendance_high_risk": 80.0},
    "modules_enabled": {"saebrs_plus": True},
    "intervention_types": ["Counselling", "Behaviour Support", "Social Skills Groups", "Mentoring", "Academic Support",
                           "Attendance Intervention", "Check-In/Check-Out", "Parent Consultation", "Peer Mentoring",
                           "Referral – External Services"],
    "year_start_month": 2,
    "custom_student_fields": [],
    "risk_config": {"consecutive_absence_days": 3},
    "ollama_url": "http://localhost:11434",
    "ollama_model": "llama3.2",
    "ai_suggestions_enabled": True,
    "excluded_absence_types": [],
    "email_auth_enabled": False,
}
