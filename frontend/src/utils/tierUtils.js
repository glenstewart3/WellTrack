export const getTierColors = (tier) => {
  switch (tier) {
    case 1: return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' };
    case 2: return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' };
    case 3: return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500' };
    default: return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  }
};

export const getRiskColors = (risk) => {
  if (risk === 'High Risk') return 'bg-rose-100 text-rose-800';
  if (risk === 'Some Risk') return 'bg-amber-100 text-amber-800';
  if (risk === 'Low Risk') return 'bg-emerald-100 text-emerald-800';
  return 'bg-slate-100 text-slate-600';
};

export const getTierLabel = (tier) => {
  const labels = { 1: 'Tier 1 — Low Risk', 2: 'Tier 2 — Emerging Risk', 3: 'Tier 3 — High Risk' };
  return labels[tier] || 'Not Screened';
};

export const RISK_INDICATOR_LABELS = {
  low_belonging: 'Low Belonging',
  emotional_distress: 'Emotional Distress',
  attendance_decline: 'Attendance Decline',
  rapid_score_drop: 'Rapid Score Drop',
  social_behaviour_risk: 'Social Risk',
  academic_engagement_risk: 'Academic Risk',
};

export const RISK_INDICATOR_COLORS = {
  low_belonging: 'bg-purple-100 text-purple-700',
  emotional_distress: 'bg-rose-100 text-rose-700',
  attendance_decline: 'bg-orange-100 text-orange-700',
  rapid_score_drop: 'bg-red-100 text-red-700',
  social_behaviour_risk: 'bg-amber-100 text-amber-700',
  academic_engagement_risk: 'bg-blue-100 text-blue-700',
};

export const INTERVENTION_TYPES = [
  'Social Skills Groups', 'Mentoring', 'Counselling',
  'Behaviour Support', 'Academic Support', 'Attendance Intervention',
  'Check-In Check-Out (CICO)', 'Small Group Support', 'Individual Support Plan'
];

export const NOTE_TYPES = ['General', 'Wellbeing', 'Incident', 'Academic', 'Attendance', 'Parent Contact'];

export const SCHOOL_YEARS_PRIMARY = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'];
export const SCHOOL_YEARS_SECONDARY = ['Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];
export const SCHOOL_YEARS_ALL = [...SCHOOL_YEARS_PRIMARY, ...SCHOOL_YEARS_SECONDARY];
