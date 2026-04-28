from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class SessionRequest(BaseModel):
    session_id: str


class Student(BaseModel):
    student_id: str = Field(default_factory=lambda: f"stu_{uuid.uuid4().hex[:8]}")
    first_name: str
    preferred_name: Optional[str] = None
    last_name: str
    year_level: str
    class_name: str
    teacher: str = ""
    date_of_birth: Optional[str] = None
    gender: str = ""
    enrolment_status: str = "active"
    external_id: Optional[str] = None
    sussi_id: Optional[str] = None


class AttendanceRecord(BaseModel):
    attendance_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    date: str
    attendance_status: str
    late_arrival: bool = False
    early_departure: bool = False


class ScreeningSession(BaseModel):
    screening_id: str = Field(default_factory=lambda: f"scr_{uuid.uuid4().hex[:8]}")
    screening_period: str
    year: int = 2025
    date: str
    teacher_id: str
    class_name: str
    status: str = "active"


class SAEBRSResult(BaseModel):
    result_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    screening_id: str
    screening_period: str = ""
    social_items: List[int] = []
    academic_items: List[int] = []
    emotional_items: List[int] = []
    social_score: int = 0
    academic_score: int = 0
    emotional_score: int = 0
    total_score: int = 0
    risk_level: str = "Low Risk"
    social_risk: str = "Low Risk"
    academic_risk: str = "Low Risk"
    emotional_risk: str = "Low Risk"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SAEBRSPlusResult(BaseModel):
    result_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    screening_id: str
    screening_period: str = ""
    self_report_items: List[int] = []
    attendance_pct: float = 100.0
    social_domain: int = 0
    academic_domain: int = 0
    emotional_domain: int = 0
    belonging_domain: int = 0
    wellbeing_total: int = 0
    wellbeing_tier: int = 1
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Intervention(BaseModel):
    intervention_id: str = Field(default_factory=lambda: f"int_{uuid.uuid4().hex[:8]}")
    student_id: str
    intervention_type: str
    assigned_staff: str  # Primary staff member (kept for backward compatibility)
    team_members: List[str] = []  # Additional team member user_ids
    start_date: str
    review_date: str
    status: str = "active"
    goals: str = ""
    rationale: str = ""
    progress_notes: str = ""
    frequency: str = ""
    outcome_rating: Optional[int] = None
    effectiveness_notes: str = ""  # Review notes on intervention effectiveness
    reviewed_at: Optional[str] = None  # When the intervention was reviewed
    reviewed_by: Optional[str] = None  # User ID who reviewed the intervention
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CaseNote(BaseModel):
    case_id: str = Field(default_factory=lambda: f"case_{uuid.uuid4().hex[:8]}")
    student_id: str
    staff_member: str
    date: str
    note_type: str
    notes: str
    mentions: List[str] = []  # user_ids of mentioned staff
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Task(BaseModel):
    """Tasks assigned to staff members related to student support."""
    task_id: str = Field(default_factory=lambda: f"task_{uuid.uuid4().hex[:8]}")
    student_id: Optional[str] = None
    student_name: str = ""
    assigned_to: str  # user_id of assigned staff
    assigned_by: str  # user_id of assigner
    title: str
    description: str = ""
    due_date: Optional[str] = None
    status: str = "pending"  # pending, in_progress, completed, cancelled
    priority: str = "medium"  # low, medium, high, urgent
    related_intervention_id: Optional[str] = None
    related_case_note_id: Optional[str] = None


class ScreeningPeriod(BaseModel):
    """Dynamic screening periods for SAEBRS data collection."""
    period_id: str = Field(default_factory=lambda: f"sp_{uuid.uuid4().hex[:8]}")
    name: str  # e.g., "Term 1 - P1"
    term: str  # e.g., "Term 1"
    year: int
    period_number: int  # P1, P2, P3, etc.
    week: int = 1  # Week within the screening period (1-4 typical)
    start_date: str  # ISO date string
    end_date: str  # ISO date string
    is_active: bool = False
    status: str = "upcoming"  # upcoming, active, completed, cancelled
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    activated_at: Optional[str] = None
    completed_at: Optional[str] = None
    completed_by: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Notification(BaseModel):
    """In-app notifications for mentions, task assignments, and updates."""
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:8]}")
    user_id: str  # recipient
    type: str  # mention, task_assigned, task_completed, intervention_assigned, alert
    title: str
    message: str
    related_student_id: Optional[str] = None
    related_task_id: Optional[str] = None
    related_case_note_id: Optional[str] = None
    related_intervention_id: Optional[str] = None
    is_read: bool = False
    read_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InterventionTemplate(BaseModel):
    template_id: str = Field(default_factory=lambda: f"template_{uuid.uuid4().hex[:8]}")
    name: str
    intervention_type: str
    description: str = ""
    goals: str = ""
    rationale: str = ""
    frequency: str = ""
    default_duration_weeks: int = 8
    recommended_tiers: List[int] = []
    applicable_risk_profiles: List[str] = []  # behavioral, social, emotional, attendance, academic, belonging
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SchoolSettings(BaseModel):
    school_name: str = "Demo School"
    school_type: str = "both"
    current_term: str = "Term 1"
    current_year: int = 2025
