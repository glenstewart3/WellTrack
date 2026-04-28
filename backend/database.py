from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date
import os

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


# ── Screening Period Helpers ─────────────────────────────────────────────────
def get_term_for_date(target_date: date, term_dates: dict) -> str:
    """
    Determine which term a date falls into based on term date ranges.
    term_dates format: {"Term 1": {"start": "2025-01-27", "end": "2025-04-04"}, ...}
    Returns term name or None if no match.
    """
    if not term_dates:
        # Default Australian school terms (approximate)
        year = target_date.year
        term_dates = {
            f"Term 1": {"start": f"{year}-01-27", "end": f"{year}-04-04"},
            f"Term 2": {"start": f"{year}-04-22", "end": f"{year}-06-27"},
            f"Term 3": {"start": f"{year}-07-14", "end": f"{year}-09-19"},
            f"Term 4": {"start": f"{year}-10-06", "end": f"{year}-12-12"},
        }
    
    for term_name, dates in term_dates.items():
        try:
            start = datetime.strptime(dates["start"], "%Y-%m-%d").date()
            end = datetime.strptime(dates["end"], "%Y-%m-%d").date()
            if start <= target_date <= end:
                return term_name
        except (ValueError, KeyError):
            continue
    return None


def get_current_term(term_dates: dict = None) -> str:
    """Get the current term based on today's date."""
    return get_term_for_date(date.today(), term_dates)


def generate_screening_period_name(term: str, period_number: int) -> str:
    """Generate screening period name like 'Term 1 - P1'."""
    return f"{term} - P{period_number}"

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
    "platform_name": "WellTrack", "logo_base64": "", "logo_dark_base64": "", "accent_color": "#0f172a", "welcome_message": "",
    "tier_thresholds": {"saebrs_some_risk": 37, "saebrs_high_risk": 24, "attendance_some_risk": 90.0, "attendance_high_risk": 80.0},
    "modules_enabled": {"saebrs_plus": True},
    "intervention_types": ["Counselling", "Behaviour Support", "Social Skills Groups", "Mentoring", "Academic Support",
                           "Attendance Intervention", "Check-In/Check-Out", "Parent Consultation", "Peer Mentoring",
                           "Referral – External Services"],
    "intervention_templates": [
        {
            "template_id": "template_cico",
            "name": "Check-In/Check-Out (CICO)",
            "intervention_type": "Check-In/Check-Out",
            "description": "Daily structured check-in with mentor teacher and end-of-day check-out to review goals.",
            "goals": "1. Improve daily behavior ratings to 80% positive. 2. Increase student self-monitoring and self-regulation. 3. Strengthen relationship with adult mentor.",
            "rationale": "Evidence-based Tier 2 intervention for students showing emerging behavioral concerns. Provides consistent adult connection and immediate feedback loop.",
            "frequency": "Daily - 5 min morning check-in, 3 min afternoon check-out",
            "default_duration_weeks": 8,
            "recommended_tiers": [2, 3],
            "applicable_risk_profiles": ["behavioral", "social", "attendance"],
            "is_default": True
        },
        {
            "template_id": "template_social_skills",
            "name": "Social Skills Group",
            "intervention_type": "Social Skills Groups",
            "description": "Small group sessions focused on developing friendship skills, conflict resolution, and emotional literacy.",
            "goals": "1. Initiate and maintain positive peer interactions. 2. Use appropriate conflict resolution strategies. 3. Identify and communicate emotions effectively.",
            "rationale": "Targeted intervention for students with social skill gaps identified through SAEBRS social domain concerns or teacher referral.",
            "frequency": "Weekly 45-minute sessions",
            "default_duration_weeks": 10,
            "recommended_tiers": [2, 3],
            "applicable_risk_profiles": ["social", "emotional"],
            "is_default": True
        },
        {
            "template_id": "template_checkin_mentoring",
            "name": "Weekly Mentoring Check-In",
            "intervention_type": "Mentoring",
            "description": "One-on-one mentoring relationship with regular check-ins focused on student wellbeing and goal setting.",
            "goals": "1. Establish trusting relationship with adult mentor. 2. Set and monitor personal goals. 3. Increase sense of school belonging.",
            "rationale": "Relationship-based intervention effective for students showing emotional distress, belonging concerns, or mild disengagement.",
            "frequency": "Weekly 20-30 minute sessions",
            "default_duration_weeks": 12,
            "recommended_tiers": [1, 2],
            "applicable_risk_profiles": ["emotional", "belonging", "academic"],
            "is_default": True
        },
        {
            "template_id": "template_attendance_support",
            "name": "Attendance Support Plan",
            "intervention_type": "Attendance Intervention",
            "description": "Structured attendance monitoring with daily tracking, family engagement, and barrier identification.",
            "goals": "1. Increase attendance to 90% or above. 2. Identify and address attendance barriers. 3. Establish family-school partnership.",
            "rationale": "Comprehensive attendance intervention triggered when attendance falls below 90%, with escalating support based on severity.",
            "frequency": "Daily attendance check + weekly family contact",
            "default_duration_weeks": 6,
            "recommended_tiers": [2, 3],
            "applicable_risk_profiles": ["attendance"],
            "is_default": True
        },
        {
            "template_id": "template_academic_support",
            "name": "Academic Skills Support",
            "intervention_type": "Academic Support",
            "description": "Targeted academic intervention focused on organization, study skills, and task completion.",
            "goals": "1. Improve assignment completion rate to 80%. 2. Develop organizational systems. 3. Increase academic engagement and self-efficacy.",
            "rationale": "Academic domain intervention for students with SAEBRS academic engagement concerns or declining academic performance.",
            "frequency": "2-3x per week 30-minute sessions",
            "default_duration_weeks": 8,
            "recommended_tiers": [2, 3],
            "applicable_risk_profiles": ["academic"],
            "is_default": True
        },
        {
            "template_id": "template_cbt_counselling",
            "name": "Counselling - CBT-Based",
            "intervention_type": "Counselling",
            "description": "Individual counselling using CBT techniques to address anxiety, negative thought patterns, and coping strategies.",
            "goals": "1. Learn and use 3+ coping strategies. 2. Reduce anxiety indicators. 3. Improve emotional regulation in challenging situations.",
            "rationale": "Clinical intervention for Tier 3 students with significant emotional/behavioral concerns requiring specialized support.",
            "frequency": "Weekly 45-minute sessions",
            "default_duration_weeks": 10,
            "recommended_tiers": [3],
            "applicable_risk_profiles": ["emotional", "behavioral"],
            "is_default": True
        },
        {
            "template_id": "template_peer_mentoring",
            "name": "Peer Mentoring Program",
            "intervention_type": "Peer Mentoring",
            "description": "Structured pairing with trained older student mentor for friendship, support, and positive modeling.",
            "goals": "1. Develop positive peer relationship with older student. 2. Increase sense of connection to school community. 3. Learn prosocial behaviors through modeling.",
            "rationale": "Peer-based intervention effective for social connection, belonging concerns, and mild behavioral issues.",
            "frequency": "Weekly 30-45 minute sessions",
            "default_duration_weeks": 8,
            "recommended_tiers": [1, 2],
            "applicable_risk_profiles": ["social", "belonging"],
            "is_default": True
        },
        {
            "template_id": "template_parent_consult",
            "name": "Parent/Guardian Consultation",
            "intervention_type": "Parent Consultation",
            "description": "Regular structured meetings with parents to align home-school strategies and share progress updates.",
            "goals": "1. Establish consistent home-school communication. 2. Align support strategies across contexts. 3. Engage family as active support partner.",
            "rationale": "Family engagement intervention critical for Tier 2/3 students to ensure consistency and shared understanding of needs.",
            "frequency": "Fortnightly 20-minute meetings",
            "default_duration_weeks": 6,
            "recommended_tiers": [2, 3],
            "applicable_risk_profiles": ["behavioral", "attendance", "academic"],
            "is_default": True
        }
    ],
    "year_start_month": 2,
    "custom_student_fields": [],
    "risk_config": {"consecutive_absence_days": 3},
    "ollama_url": "http://localhost:11434",
    "ollama_model": "llama3.2",
    "ai_suggestions_enabled": True,
    "excluded_absence_types": [],
    "email_auth_enabled": True,
    "google_auth_enabled": True,
    "timezone": "Australia/Melbourne",
    "school_day_start": "08:50",
    "school_day_end": "15:20",
    # Attendance upload metadata (used to cap reporting to uploaded coverage)
    "attendance_last_upload_at": None,
    "attendance_last_upload_filename": None,
    "attendance_coverage_min_date": None,
    "attendance_coverage_max_date": None,
    "attendance_reminder_last_sent_at": None,
}
