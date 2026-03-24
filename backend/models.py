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
    assigned_staff: str
    start_date: str
    review_date: str
    status: str = "active"
    goals: str = ""
    rationale: str = ""
    progress_notes: str = ""
    frequency: str = ""
    outcome_rating: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CaseNote(BaseModel):
    case_id: str = Field(default_factory=lambda: f"case_{uuid.uuid4().hex[:8]}")
    student_id: str
    staff_member: str
    date: str
    note_type: str
    notes: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SchoolSettings(BaseModel):
    school_name: str = "Demo School"
    school_type: str = "both"
    current_term: str = "Term 1"
    current_year: int = 2025
