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

/**
 * Derives the tier context (primary domain, risk flags, wellbeing label,
 * recommended pathway) from a student's screening data.
 *
 * @param {object} p
 * @param {number|null} p.mtss_tier         - Final MTSS tier (1, 2, 3)
 * @param {string|null} p.saebrs_risk       - "Low Risk" | "Some Risk" | "High Risk"
 * @param {number|null} p.wellbeing_tier    - 1, 2, or 3
 * @param {number|null} p.wellbeing_total   - 0–21
 * @param {number|null} p.attendance_pct    - percentage 0–100
 * @returns {{
 *   primaryDomain: string,
 *   domainShort: string,
 *   riskFlags: string[],
 *   wellbeingLabel: string,
 *   pathway: string,
 * }}
 */
export function computeTierContext({ mtss_tier, saebrs_risk, wellbeing_tier, wellbeing_total, attendance_pct }) {
  const saebrsHigh   = saebrs_risk === 'High Risk';
  const saebrsSome   = saebrs_risk === 'Some Risk';
  const wbHigh       = wellbeing_tier === 3;
  const wbSome       = wellbeing_tier === 2;
  const attSevere    = attendance_pct != null && attendance_pct < 75;
  const attSome      = attendance_pct != null && attendance_pct >= 75 && attendance_pct < 92;
  const attConcern   = attendance_pct != null && attendance_pct < 92;

  // --- Risk flags (plain-English list) ---
  const flags = [];
  if (saebrsHigh)   flags.push('High SAEBRS (behaviour)');
  if (saebrsSome)   flags.push('Some Risk SAEBRS (behaviour)');
  if (wbHigh)       flags.push('High wellbeing concern');
  if (wbSome)       flags.push('Emerging wellbeing concern');
  if (attSevere)    flags.push('Severely low attendance (<75%)');
  if (attSome)      flags.push('Attendance concern (75–91%)');

  // --- Primary domain ---
  let activeDomains = 0;
  if (saebrsHigh || saebrsSome) activeDomains++;
  if (wbHigh || wbSome) activeDomains++;
  if (attConcern) activeDomains++;

  let primaryDomain, domainShort;
  if (activeDomains >= 2) {
    primaryDomain = 'Multi-domain';
    domainShort   = 'Multi';
  } else if (saebrsHigh || saebrsSome) {
    primaryDomain = 'Behaviour';
    domainShort   = 'Behaviour';
  } else if (wbHigh || wbSome) {
    primaryDomain = 'Wellbeing';
    domainShort   = 'Wellbeing';
  } else if (attConcern) {
    primaryDomain = 'Attendance';
    domainShort   = 'Attendance';
  } else {
    primaryDomain = 'Universal';
    domainShort   = '';
  }

  // --- Staff-friendly wellbeing label ---
  const wellbeingLabel =
    wellbeing_tier === 3 ? 'High Concern'
    : wellbeing_tier === 2 ? 'Emerging Concern'
    : wellbeing_tier === 1 ? 'Low Concern'
    : null;

  // --- Recommended pathway ---
  let pathway = '';
  if (!mtss_tier || mtss_tier === 1) {
    pathway = 'Continue universal supports and monitor at next screening.';
  } else if (mtss_tier === 2) {
    if (saebrsHigh || saebrsSome) pathway = 'Consider targeted behaviour support or Check-In/Check-Out (CICO).';
    else if (wbHigh || wbSome)    pathway = 'Wellbeing check-in and consider small group social/emotional support.';
    else if (attConcern)           pathway = 'Attendance intervention — contact family to identify barriers.';
    else                           pathway = 'Targeted support; discuss with classroom teacher.';
  } else if (mtss_tier === 3) {
    if (activeDomains >= 2)        pathway = 'Urgent multi-domain review. Convene SSG and consider referral to external services.';
    else if (saebrsHigh)           pathway = 'Intensive behaviour support plan required. Refer to SENCO/counsellor.';
    else if (wbHigh)               pathway = 'Intensive wellbeing intervention. Counsellor involvement and parent contact recommended.';
    else if (attSevere)            pathway = 'Chronic absence — immediate family meeting and attendance plan required.';
    else                           pathway = 'Intensive support review recommended.';
  }

  return { primaryDomain, domainShort, riskFlags: flags, wellbeingLabel, pathway };
}
