import React, { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, TrendingDown, Users, Target, Download, Calendar,
  AlertTriangle, Activity, UserCheck, FileText, Loader
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { exportAnalyticsReport } from '../utils/pdfExport';
import { usePermissions } from '../hooks/usePermissions';

const COLORS = ['#14b8a6', '#f59e0b', '#ef4444'];
const DOMAIN_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#3b82f6', '#ec4899'];
const RISK_COLORS = { 'Low Risk': '#14b8a6', 'Some Risk': '#f59e0b', 'High Risk': '#ef4444' };

function statCard(label, value, sub, color = 'text-stone-900') {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <p className={`text-3xl font-bold ${color}`} style={{ fontFamily: 'Manrope,sans-serif' }}>{value}</p>
      <p className="text-sm font-medium text-stone-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start gap-2 mb-4">
      <Icon size={18} className="text-stone-500 mt-0.5 shrink-0" />
      <div>
        <h2 className="text-lg font-bold text-stone-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{title}</h2>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { canDo } = usePermissions();
  const [schoolData, setSchoolData] = useState(null);
  const [attTrends, setAttTrends] = useState(null);
  const [intOutcomes, setIntOutcomes] = useState([]);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [supportGaps, setSupportGaps] = useState([]);
  const [staffLoad, setStaffLoad] = useState([]);
  const [cohortData, setCohortData] = useState([]);
  const [cohortGroupBy, setCohortGroupBy] = useState('year_level');
  const [filterOptions, setFilterOptions] = useState({ year_levels: [], classes: [] });
  const [filterType, setFilterType] = useState('school');
  const [filterValue, setFilterValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const filterParams = filterType === 'school' ? {}
    : filterType === 'year_level' ? { year_level: filterValue }
      : { class_name: filterValue };

  const filterLabel = filterType === 'school' ? 'Whole School'
    : filterType === 'year_level' ? filterValue
      : filterValue;

  const qs = (params) => {
    const q = new URLSearchParams(params).toString();
    return q ? `?${q}` : '';
  };

  // Load filter options once
  useEffect(() => {
    api.get('/reports/filter-options')
      .then(r => setFilterOptions(r.data))
      .catch(console.error);
  }, []);

  // Staff load (whole-school, not filtered)
  useEffect(() => {
    api.get('/reports/staff-load')
      .then(r => setStaffLoad(r.data))
      .catch(console.error);
  }, []);

  // Main data load — re-runs on filter change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const q = qs(filterParams);
      try {
        const [sw, at, io, abs, cov, gaps] = await Promise.all([
          api.get(`/analytics/school-wide${q}`),
          api.get(`/analytics/attendance-trends${q}`),
          api.get(`/analytics/intervention-outcomes${q}`),
          api.get(`/reports/absence-types${q}`),
          api.get(`/reports/screening-coverage${q}`),
          api.get(`/reports/support-gaps${q}`),
        ]);
        setSchoolData(sw.data);
        setAttTrends(at.data);
        setIntOutcomes(io.data);
        setAbsenceTypes(abs.data);
        setCoverage(cov.data);
        setSupportGaps(gaps.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [filterType, filterValue]);

  // Cohort comparison — lazy load on tab open
  useEffect(() => {
    if (activeTab !== 'cohort') return;
    setCohortLoading(true);
    api.get(`/analytics/cohort-comparison?group_by=${cohortGroupBy}`)
      .then(r => { setCohortData(r.data); setCohortLoading(false); })
      .catch(e => { console.error(e); setCohortLoading(false); });
  }, [activeTab, cohortGroupBy]);

  const handleFilterMode = (mode) => {
    setFilterType(mode);
    if (mode === 'year_level') setFilterValue(filterOptions.year_levels[0] || '');
    else if (mode === 'class') setFilterValue(filterOptions.classes[0] || '');
    else setFilterValue('');
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    const originalTab = activeTab;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const capturedImages = {};
      for (const tab of ['overview', 'attendance', 'wellbeing', 'interventions', 'support']) {
        setActiveTab(tab);
        await new Promise(r => setTimeout(r, 400));
        const el = document.getElementById(`pdf-section-${tab}`);
        if (el) {
          const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: '#f8fafc' });
          capturedImages[tab] = canvas.toDataURL('image/jpeg', 0.85);
        }
      }
      setActiveTab(originalTab);
      exportAnalyticsReport({ schoolData, attTrends, intOutcomes, absenceTypes, supportGaps, capturedImages }, filterLabel);
    } catch (e) {
      console.error(e);
      setActiveTab(originalTab);
      exportAnalyticsReport({ schoolData, attTrends, intOutcomes, absenceTypes, supportGaps }, filterLabel);
    } finally { setPdfLoading(false); }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-stone-100 rounded-xl" />)}</div>
          <div className="h-64 bg-stone-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const sd = schoolData;
  if (!sd) return <div className="p-8 text-stone-400">No analytics data available. Load demo data to get started.</div>;

  const tierPieData = [
    { name: 'Tier 1', value: sd.tier_distribution?.[1] || 0 },
    { name: 'Tier 2', value: sd.tier_distribution?.[2] || 0 },
    { name: 'Tier 3', value: sd.tier_distribution?.[3] || 0 },
  ];
  const riskBarData = [
    { risk: 'Low Risk', count: sd.risk_distribution?.low || 0 },
    { risk: 'Some Risk', count: sd.risk_distribution?.some || 0 },
    { risk: 'High Risk', count: sd.risk_distribution?.high || 0 },
  ];
  const domainData = sd.domain_averages ? Object.entries(sd.domain_averages).map(([k, v], i) => ({
    domain: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
    score: typeof v === 'number' ? Math.round(v * 10) / 10 : 0,
    color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
  })) : [];
  const classTierData = Object.entries(sd.class_breakdown || {}).map(([cls, d]) => ({
    class: cls, tier1: d.tier1 || 0, tier2: d.tier2 || 0, tier3: d.tier3 || 0,
  }));
  const riskPieData = [
    { risk: 'Low Risk', count: sd.risk_distribution?.low || 0, color: '#14b8a6' },
    { risk: 'Some Risk', count: sd.risk_distribution?.some || 0, color: '#f59e0b' },
    { risk: 'High Risk', count: sd.risk_distribution?.high || 0, color: '#ef4444' },
  ];
  const totalRisk = riskPieData.reduce((a, b) => a + b.count, 0);
  const domainRisk = sd.domain_risk || {};

  const TABS = [
    { key: 'overview', label: 'Overview', short: 'Overview', Icon: BarChart2 },
    { key: 'attendance', label: 'Attendance', short: 'Attend.', Icon: Calendar },
    { key: 'wellbeing', label: 'Wellbeing & SEL', short: 'Wellbeing', Icon: Activity },
    { key: 'interventions', label: 'Interventions', short: 'Interv.', Icon: Target },
    { key: 'support', label: 'Support & Gaps', short: 'Support', Icon: AlertTriangle },
    { key: 'cohort', label: 'Cohort', short: 'Cohort', Icon: Users },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <BarChart2 size={28} className="text-stone-600" /> Analytics & Reports
          </h1>
          <p className="text-stone-500 mt-1">{sd.total_students} students · {sd.screened_students} screened · {filterLabel}</p>
        </div>
        {canDo('analytics.export') && (
        <button
          onClick={handleExportPdf}
          disabled={pdfLoading}
          data-testid="analytics-export-pdf"
          className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 active:scale-95 transition-all disabled:opacity-60"
        >
          {pdfLoading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
          Export PDF
        </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white border border-stone-200 rounded-xl" data-testid="analytics-filter-bar">
        <span className="text-sm font-medium text-stone-600 shrink-0">Viewing:</span>
        <div className="flex flex-wrap gap-2">
          {[
            { mode: 'school', label: 'Whole School' },
            { mode: 'year_level', label: 'Year Level' },
            { mode: 'class', label: 'Class' },
          ].map(({ mode, label }) => (
            <button key={mode} onClick={() => handleFilterMode(mode)} data-testid={`filter-mode-${mode}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === mode ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {filterType === 'year_level' && (
          <select data-testid="filter-year-select" value={filterValue} onChange={e => setFilterValue(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300">
            {filterOptions.year_levels.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {filterType === 'class' && (
          <select data-testid="filter-class-select" value={filterValue} onChange={e => setFilterValue(e.target.value)}
            className="text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300">
            {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden border-b border-stone-200 mb-6">
        {TABS.map(({ key, label, short, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} data-testid={`analytics-tab-${key}`}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div id="pdf-section-overview" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCard('Total Students', sd.total_students, 'All enrolled')}
            {statCard('Screened', sd.screened_students, `${sd.screening_rate}% of total`)}
            {statCard('Tier 2 & 3', (sd.tier_distribution?.[2] || 0) + (sd.tier_distribution?.[3] || 0), 'Require support', 'text-amber-600')}
            {statCard('High Risk', sd.risk_distribution?.high || 0, 'SAEBRS High Risk', 'text-red-600')}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="MTSS Tier Distribution" />
              <div className="flex gap-6 items-center justify-center">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={tierPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3} isAnimationActive={!pdfLoading}>
                      {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {tierPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-sm text-stone-600">{d.name}</span>
                      <span className="text-sm font-bold text-stone-900 ml-auto pl-4">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Activity} title="SAEBRS Risk Distribution" />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={riskBarData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="risk" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={!pdfLoading}>
                    {riskBarData.map((d, i) => <Cell key={i} fill={Object.values(RISK_COLORS)[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {domainData.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={BarChart2} title="Average Domain Scores" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={domainData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} isAnimationActive={!pdfLoading}>
                    {domainData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {classTierData.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="Tier Distribution by Class" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classTierData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tier1" name="Tier 1" fill="#22c55e" stackId="a" isAnimationActive={!pdfLoading} />
                  <Bar dataKey="tier2" name="Tier 2" fill="#f59e0b" stackId="a" isAnimationActive={!pdfLoading} />
                  <Bar dataKey="tier3" name="Tier 3" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} isAnimationActive={!pdfLoading} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── ATTENDANCE TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'attendance' && (
        <div id="pdf-section-attendance" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCard('School Days', attTrends?.total_school_days ?? '—', 'Days with attendance data')}
            {statCard('Chronic Absentees', attTrends?.chronic_absentees?.length ?? 0, 'Below 90% attendance', 'text-amber-600')}
            {statCard('Critical Absentees', attTrends?.chronic_absentees?.filter(a => a.attendance_pct < 80).length ?? 0, 'Below 80% attendance', 'text-red-600')}
          </div>

          {attTrends?.day_of_week?.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Calendar} title="Attendance Rate by Day of Week" sub="Which days have the lowest attendance?" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={attTrends.day_of_week} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} domain={[85, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                  <Bar dataKey="attendance_rate" radius={[6, 6, 0, 0]} isAnimationActive={!pdfLoading}>
                    {attTrends.day_of_week.map((d, i) => (
                      <Cell key={i} fill={d.attendance_rate >= 95 ? '#14b8a6' : d.attendance_rate >= 90 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 justify-center">
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-green-500" />≥95%</span>
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" />90–95%</span>
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-red-500" />&lt;90%</span>
              </div>
            </div>
          )}

          {attTrends?.monthly_trend?.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={TrendingDown} title="Monthly Attendance Rate Trend" sub="Percentage of sessions attended each month" />
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={attTrends.monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} domain={[80, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                  <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '95%', position: 'right', fontSize: 10, fill: '#14b8a6' }} />
                  <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '90%', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="attendance_rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={!pdfLoading} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {absenceTypes.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={AlertTriangle} title="Absence Type Breakdown" sub="Most common reasons for absence — grey = excluded from attendance calculation" />
              <ResponsiveContainer width="100%" height={Math.max(180, absenceTypes.length * 38)}>
                <BarChart data={absenceTypes.slice(0, 12)} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} isAnimationActive={!pdfLoading}>
                    {absenceTypes.slice(0, 12).map((d, i) => (
                      <Cell key={i} fill={d.excluded ? '#94a3b8' : DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {attTrends?.chronic_absentees?.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={AlertTriangle} title="Chronic Absentees" sub="Students with attendance below 90% — click to view profile" />
              <div className="space-y-2">
                {attTrends.chronic_absentees.map((ca, i) => {
                  const pct = ca.attendance_pct;
                  const color = pct < 80 ? 'text-red-600' : 'text-amber-600';
                  const bg = pct < 80 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
                  const name = ca.student ? `${ca.student.first_name}${ca.student.preferred_name && ca.student.preferred_name !== ca.student.first_name ? ` (${ca.student.preferred_name})` : ''} ${ca.student.last_name}` : '—';
                  return (
                    <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${bg} cursor-pointer hover:opacity-90`}
                      onClick={() => navigate(`/students/${ca.student?.student_id}`)}>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{name}</p>
                        <p className="text-xs text-stone-500">{ca.student?.class_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${color}`}>{pct}%</p>
                        <p className="text-xs text-stone-400">attendance</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(!attTrends?.monthly_trend?.length && !attTrends?.chronic_absentees?.length) && (
            <div className="bg-white border border-stone-200 rounded-xl p-16 text-center text-stone-400">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>No attendance data yet</p>
              <p className="text-sm mt-1">Upload attendance files in Settings → Imports</p>
            </div>
          )}
        </div>
      )}

      {/* ── WELLBEING & SEL TAB ─────────────────────────────────────────────── */}
      {activeTab === 'wellbeing' && (
        <div id="pdf-section-wellbeing" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCard('Total Students', sd.total_students, 'Active students')}
            {statCard('Screened', `${sd.screening_rate}%`, `${sd.screened_students} students`)}
            {statCard('High Risk', sd.risk_distribution?.high || 0, 'SAEBRS High Risk', 'text-red-600')}
            {statCard('Tier 2 & 3', (sd.tier_distribution?.[2] || 0) + (sd.tier_distribution?.[3] || 0), 'Require support', 'text-amber-600')}
          </div>

          {domainData.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Activity} title="Average Wellbeing Domain Scores" sub="Student self-report scores — higher score = better wellbeing" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={domainData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} isAnimationActive={!pdfLoading}>
                    {domainData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="SAEBRS Risk Distribution" sub="Behavioural risk across screened students" />
              {totalRisk > 0 ? (
                <div className="flex gap-6 items-center justify-center">
                  <ResponsiveContainer width={150} height={150}>
                    <PieChart>
                      <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count" paddingAngle={3} isAnimationActive={!pdfLoading}>
                        {riskPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {riskPieData.map((d) => (
                      <div key={d.risk} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-sm text-stone-600 w-20">{d.risk}</span>
                        <span className="text-sm font-bold text-stone-900 ml-auto pl-2">{d.count}</span>
                        <span className="text-xs text-stone-400 w-10">({totalRisk > 0 ? Math.round(d.count / totalRisk * 100) : 0}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-stone-400 py-8 text-sm">No screening data yet</p>
              )}
            </div>

            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={AlertTriangle} title="At-Risk Students by Domain" sub="How many students are flagged in each SAEBRS domain?" />
              <div className="space-y-4 mt-2">
                {[{ label: 'Social', key: 'social' }, { label: 'Academic', key: 'academic' }, { label: 'Emotional', key: 'emotional' }].map(({ label, key }) => {
                  const d = domainRisk[key] || { low: 0, some: 0, high: 0 };
                  const total = d.low + d.some + d.high || 1;
                  return (
                    <div key={key}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-stone-700">{label}</span>
                        <span className="text-xs text-stone-400">{d.some + d.high} at risk</span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden">
                        <div className="bg-green-400" style={{ width: `${d.low / total * 100}%` }} />
                        <div className="bg-amber-400" style={{ width: `${d.some / total * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${d.high / total * 100}%` }} />
                      </div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-stone-400">Low: {d.low}</span>
                        <span className="text-xs text-amber-600">Some: {d.some}</span>
                        <span className="text-xs text-red-600">High: {d.high}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {coverage.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={UserCheck} title="Screening Coverage by Class" sub="Which classes still need to complete screenings?" />
              <ResponsiveContainer width="100%" height={Math.max(160, coverage.length * 36)}>
                <BarChart data={coverage} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <YAxis dataKey="class" type="category" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Coverage']} />
                  <Bar dataKey="coverage_pct" radius={[0, 6, 6, 0]} isAnimationActive={!pdfLoading}>
                    {coverage.map((d, i) => (
                      <Cell key={i} fill={d.coverage_pct === 100 ? '#14b8a6' : d.coverage_pct >= 75 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 justify-center">
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-green-500" />100% complete</span>
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" />75–99%</span>
                <span className="flex items-center gap-1 text-xs text-stone-500"><span className="inline-block w-3 h-3 rounded-full bg-red-500" />&lt;75%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INTERVENTIONS TAB ────────────────────────────────────────────────── */}
      {activeTab === 'interventions' && (
        <div id="pdf-section-interventions" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCard('Total Interventions', intOutcomes.reduce((a, b) => a + b.total, 0), 'All time')}
            {statCard('Active', intOutcomes.reduce((a, b) => a + b.active, 0), 'Currently running', 'text-teal-600')}
            {statCard('Completed', intOutcomes.reduce((a, b) => a + b.completed, 0), 'Finished', 'text-blue-600')}
          </div>

          {intOutcomes.length > 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Target} title="Interventions by Type" />
              <ResponsiveContainer width="100%" height={Math.max(200, intOutcomes.length * 40)}>
                <BarChart data={intOutcomes} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="active" name="Active" fill="#22c55e" stackId="a" isAnimationActive={!pdfLoading} />
                  <Bar dataKey="completed" name="Completed" fill="#3b82f6" stackId="a" radius={[0, 4, 4, 0]} isAnimationActive={!pdfLoading} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl p-16 text-center text-stone-400">
              <Target size={40} className="mx-auto mb-3 opacity-30" />
              <p>No intervention data yet</p>
            </div>
          )}

          {intOutcomes.filter(i => i.total > 0).length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Activity} title="Completion Rate by Type" />
              <div className="space-y-3">
                {intOutcomes.sort((a, b) => b.total - a.total).map(i => (
                  <div key={i.type} className="flex items-center gap-3">
                    <span className="text-sm text-stone-600 w-40 truncate">{i.type}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${i.completion_rate}%` }} />
                    </div>
                    <span className="text-xs text-stone-500 w-12 text-right">{i.completion_rate}%</span>
                    <span className="text-xs text-stone-400 w-16 text-right">{i.total} total</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SUPPORT & GAPS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'support' && (
        <div id="pdf-section-support" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCard('Support Gaps', supportGaps.length, 'Tier 2/3, no active intervention', 'text-red-600')}
            {statCard('Active Interventions', intOutcomes.reduce((a, b) => a + b.active, 0), 'Currently running', 'text-teal-600')}
            {statCard('Staff Members', staffLoad.length, 'With active caseloads')}
          </div>

          {supportGaps.length > 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={AlertTriangle} title="Students Needing Support" sub="Tier 2 or 3 students with no active intervention — click to assign one" />
              <div className="space-y-2">
                {supportGaps.map((g, i) => {
                  const name = `${g.student.first_name}${g.student.preferred_name && g.student.preferred_name !== g.student.first_name ? ` (${g.student.preferred_name})` : ''} ${g.student.last_name}`;
                  const bg = g.tier === 3 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
                  const badge = g.tier === 3 ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100';
                  return (
                    <div key={i} data-testid={`support-gap-row-${i}`}
                      className={`flex items-center justify-between p-3 rounded-xl border ${bg} cursor-pointer hover:opacity-90`}
                      onClick={() => navigate(`/students/${g.student.student_id}`)}>
                      <div>
                        <p className="text-sm font-semibold text-stone-900">{name}</p>
                        <p className="text-xs text-stone-500">{g.student.class_name} · {g.saebrs_risk}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>Tier {g.tier}</span>
                        <span className="text-xs text-stone-400">{g.attendance_pct}% att.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-teal-200 rounded-xl p-8 text-center">
              <Target size={36} className="mx-auto mb-2 text-teal-500 opacity-60" />
              <p className="text-sm font-semibold text-stone-700">No support gaps</p>
              <p className="text-xs text-stone-400 mt-1">All Tier 2/3 students have active interventions assigned</p>
            </div>
          )}

          {staffLoad.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="Active Interventions by Staff Member" sub="Workload distribution across support staff" />
              <div className="space-y-3 mt-2">
                {staffLoad.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-stone-600 w-44 truncate">{s.staff}</span>
                    <div className="flex-1 bg-stone-100 rounded-full h-2.5">
                      <div className="bg-indigo-500 h-2.5 rounded-full transition-all"
                        style={{ width: `${Math.min((s.count / (staffLoad[0]?.count || 1)) * 100, 100)}%` }} />
                    </div>
                    <span className="text-sm font-bold text-stone-700 w-6 text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COHORT COMPARISON TAB ────────────────────────────────────────────── */}
      {activeTab === 'cohort' && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-stone-700">Compare by:</span>
            <select data-testid="cohort-group-by-select" value={cohortGroupBy} onChange={e => setCohortGroupBy(e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-stone-300">
              <option value="year_level">Year Level</option>
              <option value="class_name">Class</option>
            </select>
          </div>

          {cohortLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map(i => <div key={i} className="h-48 bg-stone-100 rounded-xl" />)}
            </div>
          ) : cohortData.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-16 text-center text-stone-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>No cohort data available</p>
              <p className="text-sm mt-1">Load demo data to see cohort comparisons</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {cohortData.map(c => (
                  <div key={c.name} data-testid={`cohort-card-${c.name}`} className="bg-white border border-stone-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{c.name}</p>
                    <p className="text-2xl font-bold text-stone-900">{c.total}</p>
                    <p className="text-xs text-stone-400">students</p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {c.tier1 > 0 && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">T1:{c.tier1}</span>}
                      {c.tier2 > 0 && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">T2:{c.tier2}</span>}
                      {c.tier3 > 0 && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">T3:{c.tier3}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6">
                <SectionHeader icon={BarChart2} title={`MTSS Tier Distribution by ${cohortGroupBy === 'year_level' ? 'Year Level' : 'Class'}`} />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cohortData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="tier1" name="Tier 1" fill="#22c55e" stackId="a" />
                    <Bar dataKey="tier2" name="Tier 2" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="tier3" name="Tier 3" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6">
                <SectionHeader icon={Calendar} title={`Average Attendance % by ${cohortGroupBy === 'year_level' ? 'Year Level' : 'Class'}`} />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cohortData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" domain={[80, 100]} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Avg Attendance']} />
                    <Bar dataKey="avg_attendance" name="Avg Attendance" radius={[6, 6, 0, 0]} isAnimationActive={!pdfLoading}>
                      {cohortData.map((c, i) => (
                        <Cell key={i} fill={c.avg_attendance >= 95 ? '#14b8a6' : c.avg_attendance >= 90 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-6">
                <SectionHeader icon={AlertTriangle} title={`SAEBRS Risk by ${cohortGroupBy === 'year_level' ? 'Year Level' : 'Class'}`} />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cohortData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="risk_low" name="Low Risk" fill="#22c55e" stackId="b" isAnimationActive={!pdfLoading} />
                    <Bar dataKey="risk_some" name="Some Risk" fill="#f59e0b" stackId="b" isAnimationActive={!pdfLoading} />
                    <Bar dataKey="risk_high" name="High Risk" fill="#ef4444" stackId="b" radius={[4, 4, 0, 0]} isAnimationActive={!pdfLoading} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
