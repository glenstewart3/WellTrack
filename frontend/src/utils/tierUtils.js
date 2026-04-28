export const getTierColors = (tier) => {
  switch (tier) {
    case 1: return { bg: 'wt-tier1-bg', text: 'wt-tier1-text', border: 'wt-tier1-border', badge: 'wt-tier1-badge', dot: 'wt-tier1-dot' };
    case 2: return { bg: 'wt-tier2-bg', text: 'wt-tier2-text', border: 'wt-tier2-border', badge: 'wt-tier2-badge', dot: 'wt-tier2-dot' };
    case 3: return { bg: 'wt-tier3-bg', text: 'wt-tier3-text', border: 'wt-tier3-border', badge: 'wt-tier3-badge', dot: 'wt-tier3-dot' };
    default: return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' };
  }
};

export const getRiskColors = (risk) => {
  if (risk === 'High Risk') return 'wt-tier3-badge';
  if (risk === 'Some Risk') return 'wt-tier2-badge';
  if (risk === 'Low Risk') return 'wt-tier1-badge';
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
