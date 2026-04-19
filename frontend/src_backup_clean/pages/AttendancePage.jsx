import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { CalendarDays, AlertTriangle, Users, TrendingDown, Loader, X, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function TierBadge({ tier }) {
  const c = tier === 1
    ? 'bg-emerald-100 text-emerald-700'
    : tier === 2 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${c}`}>
      Tier {tier}
    </span>
  );
}

function AttendancePctBar({ pct }) {
  const color = pct >= 95 ? '#10b981' : pct >= 90 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </div>
      <span className="text-sm font-semibold shrink-0" style={{ color, minWidth: 44 }}>{pct}%</span>
    </div>
  );
}

function buildQS(year, period, month, week, termsArr) {
  const today = new Date().toISOString().split('T')[0];
  const p = {};
  if (year) p.year = year;
  if (period === 'ytd') {
    p.to_date = today;
  } else if (period === 'full') {
    p.to_date = `${year}-12-31`;
  } else if (period.startsWith('term')) {
    const idx = parseInt(period.replace('term', '')) - 1;
    const t = termsArr[idx];
    if (t?.start_date) p.from_date = t.start_date;
    if (t?.end_date) p.to_date = t.end_date;
  } else if (period === 'month' && month) {
    const [ym, mm] = month.split('-').map(Number);
    p.from_date = `${month}-01`;
    p.to_date = new Date(ym, mm, 0).toISOString().split('T')[0];
  } else if (period === 'week' && week) {
    const [yr, wkStr] = week.split('-W');
    const wk = parseInt(wkStr);
    const jan4 = new Date(parseInt(yr), 0, 4);
    const dow = jan4.getDay() || 7;
    const mon = new Date(jan4);
    mon.setDate(jan4.getDate() - (dow - 1) + (wk - 1) * 7);
    const fri = new Date(mon);
    fri.setDate(mon.getDate() + 4);
    p.from_date = mon.toISOString().split('T')[0];
    p.to_date = fri.toISOString().split('T')[0];
  } else {
    p.to_date = today;
  }
  return new URLSearchParams(p).toString();
}

function getPeriodLabel(period, year, month, week, termsArr) {
  if (period === 'ytd') return 'Year to Date';
  if (period === 'full') return `Full ${year}`;
  if (period.startsWith('term')) {
    const idx = parseInt(period.replace('term', '')) - 1;
    return termsArr[idx]?.name || `Term ${idx + 1}`;
  }
  if (period === 'month' && month) {
    const [y, m] = month.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(m) - 1]} ${y}`;
  }
  if (period === 'week' && week) {
    const [yr, wk] = week.split('-W');
    return `Week ${wk}, ${yr}`;
  }
  return 'Year to Date';
}

export default function AttendancePage() {
  const { user } = useAuth();

  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [viewYear, setViewYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [periodType, setPeriodType] = useState('ytd');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [terms, setTerms] = useState([]);
  const [cohortType, setCohortType] = useState('school'); // school | year | class
  const [cohortValue, setCohortValue] = useState('');
  const [schoolDaysCount, setSchoolDaysCount] = useState(null); // null = loading, 0 = no calendar

  const fetchSummary = async (year, period, month, week, termsArr) => {
    setLoading(true);
    const qs = buildQS(year, period, month, week, termsArr);
    try {
      const res = await api.get(`/attendance/summary?${qs}`);
      setSummary(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchTermsForYear = async (year) => {
    try {
      const r = await api.get(`/settings/terms?year=${year}`);
      const t = r.data.terms || [];
      setTerms(t);
      setSchoolDaysCount(r.data.school_days_count ?? 0);
      return t;
    } catch (e) { console.error(e); return []; }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const r = await api.get('/settings/terms');
        const yrs = (r.data.available_years || [r.data.active_year]).filter(Boolean).sort((a, b) => b - a);
        const activeYear = r.data.active_year || yrs[0];
        const loadedTerms = r.data.terms || [];
        setAvailableYears(yrs);
        setViewYear(activeYear);
        setTerms(loadedTerms);
        setSchoolDaysCount(r.data.school_days_count ?? 0);
        await fetchSummary(activeYear, 'ytd', '', '', loadedTerms);
      } catch (e) { setLoading(false); }
    };
    init();
  }, []);

  const handleYearChange = async (y) => {
    setViewYear(y);
    setPeriodType('ytd');
    setFilterMonth('');
    setFilterWeek('');
    const t = await fetchTermsForYear(y);
    await fetchSummary(y, 'ytd', '', '', t);
  };

  const handlePeriodChange = (p) => {
    setPeriodType(p);
    if (p !== 'month') setFilterMonth('');
    if (p !== 'week') setFilterWeek('');
    if (p !== 'month' && p !== 'week') {
      fetchSummary(viewYear, p, '', '', terms);
    }
  };

  const handleMonthChange = (m) => {
    setFilterMonth(m);
    if (m) fetchSummary(viewYear, 'month', m, '', terms);
  };

  const handleWeekChange = (w) => {
    setFilterWeek(w);
    if (w) fetchSummary(viewYear, 'week', '', w, terms);
  };

  const viewStudent = async (s) => {
    setSelectedStudent(s);
    setDetailLoading(true);
    const qs = buildQS(viewYear, periodType, filterMonth, filterWeek, terms);
    try {
      const res = await api.get(`/attendance/student/${s.student_id}?${qs}`);
      setStudentDetail(res.data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const yearLevels = [...new Set(summary.map(s => s.year_level).filter(Boolean))].sort((a, b) => {
    const na = parseInt((a || '').replace(/\D/g, '') || '0');
    const nb = parseInt((b || '').replace(/\D/g, '') || '0');
    return na - nb;
  });
  const classNames = [...new Set(summary.map(s => s.class_name).filter(Boolean))].sort();

  const filtered = summary
    .filter(s => {
      if (search && !`${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTier && String(s.attendance_tier) !== filterTier) return false;
      if (cohortType === 'year' && cohortValue && s.year_level !== cohortValue) return false;
      if (cohortType === 'class' && cohortValue && s.class_name !== cohortValue) return false;
      return true;
    })
    .sort((a, b) => (a.attendance_pct ?? 100) - (b.attendance_pct ?? 100));

  const withData = summary.filter(s => s.has_data);
  const concerns = withData.filter(s => s.attendance_pct < 90);
  const atRisk = withData.filter(s => s.attendance_pct >= 90 && s.attendance_pct < 95);
  const avgPct = withData.length
    ? (withData.reduce((a, s) => a + s.attendance_pct, 0) / withData.length).toFixed(1)
    : '—';

  const curLabel = getPeriodLabel(periodType, viewYear, filterMonth, filterWeek, terms);

  // Period dropdown options
  const periodOptions = [
    { value: 'ytd', label: 'Year to Date' },
    { value: 'full', label: 'Full Year' },
    ...terms.map((t, i) => ({ value: `term${i + 1}`, label: t.name || `Term ${i + 1}` })),
    { value: 'month', label: 'By Month…' },
    { value: 'week', label: 'By Week…' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Attendance</h1>
        <p className="text-slate-500 mt-1 text-sm">Student attendance tracking — upload files in <strong>Settings → Imports</strong></p>
      </div>

      {/* No calendar configured banner */}
      {schoolDaysCount === 0 && (
        <div className="flex items-start gap-3 mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm" data-testid="no-calendar-banner">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-amber-800">Calendar not configured</span>
            <span className="text-amber-700"> — attendance percentages are approximate (using uploaded attendance dates as school days). </span>
            <a href="/settings" className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
              Set up Terms in Settings → Calendar
            </a>
            <span className="text-amber-700"> for exact calculations.</span>
          </div>
        </div>
      )}

      {/* Period filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-6" data-testid="period-filter-row">
        {/* Year pills */}
        {availableYears.length > 0 && (
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl" data-testid="year-selector">
            {availableYears.map(y => (
              <button key={y} onClick={() => handleYearChange(y)} data-testid={`year-btn-${y}`}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-all ${
                  viewYear === y ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>{y}</button>
            ))}
          </div>
        )}

        {/* Period dropdown */}
        <select
          value={periodType}
          onChange={e => handlePeriodChange(e.target.value)}
          data-testid="period-dropdown"
          className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20 cursor-pointer"
        >
          {periodOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Month picker — shown after selecting month */}
        {periodType === 'month' && (
          <input type="month" value={filterMonth} onChange={e => handleMonthChange(e.target.value)}
            data-testid="month-picker"
            className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        )}

        {/* Week picker — shown after selecting week */}
        {periodType === 'week' && (
          <input type="week" value={filterWeek} onChange={e => handleWeekChange(e.target.value)}
            data-testid="week-picker"
            className="px-3 py-1.5 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        )}

        <span className="text-xs text-slate-400 font-medium">{curLabel}</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Students', value: summary.length, sub: `with data: ${withData.length}`, icon: <Users size={18} />, color: 'text-slate-700' },
          { label: 'School Average', value: withData.length ? `${avgPct}%` : '—', sub: curLabel, icon: <CalendarDays size={18} />, color: 'text-slate-700' },
          { label: 'Tier 3 Concerns', value: concerns.length, sub: 'below 90%', icon: <TrendingDown size={18} />, color: 'text-rose-600' },
          { label: 'Tier 2 At Risk', value: atRisk.length, sub: '90–95%', icon: <AlertTriangle size={18} />, color: 'text-amber-600' },
        ].map(tile => (
          <div key={tile.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`${tile.color} mb-2`}>{tile.icon}</div>
            <p className={`text-2xl font-bold ${tile.color}`} style={{ fontFamily: 'Manrope,sans-serif' }}>{tile.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{tile.label}</p>
            <p className="text-xs text-slate-300 hidden sm:block">{tile.sub}</p>
          </div>
        ))}
      </div>

      {/* Cohort filter */}
      <div className="flex flex-wrap items-center gap-2 mb-5" data-testid="cohort-filter-row">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {[
            { key: 'school', label: 'Whole School' },
            { key: 'year', label: 'Year Level' },
            { key: 'class', label: 'Class' },
          ].map(c => (
            <button key={c.key}
              onClick={() => { setCohortType(c.key); setCohortValue(''); }}
              data-testid={`cohort-btn-${c.key}`}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                cohortType === c.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>{c.label}</button>
          ))}
        </div>

        {cohortType === 'year' && (
          <select value={cohortValue} onChange={e => setCohortValue(e.target.value)}
            data-testid="cohort-year-select"
            className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20">
            <option value="">All Year Levels</option>
            {yearLevels.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}

        {cohortType === 'class' && (
          <select value={cohortValue} onChange={e => setCohortValue(e.target.value)}
            data-testid="cohort-class-select"
            className="px-3 py-2 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/20">
            <option value="">All Classes</option>
            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {(cohortType !== 'school' && cohortValue) && (
          <span className="text-xs text-slate-500 font-medium">{cohortValue}</span>
        )}
      </div>

      {/* Search + tier filter */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
          data-testid="search-input"
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none flex-1 min-w-36" />
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          data-testid="tier-filter"
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none">
          <option value="">All Tiers</option>
          <option value="1">Tier 1 (≥95%)</option>
          <option value="2">Tier 2 (90–95%)</option>
          <option value="3">Tier 3 (&lt;90%)</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader size={24} className="animate-spin text-slate-400" /></div>
      ) : withData.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <CalendarDays size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No attendance data for this period</p>
          <p className="text-sm text-slate-400 mt-1">Try a different period or upload data in Settings → Imports</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm" data-testid="attendance-table">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                {/* Hide class on mobile */}
                <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Class</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</th>
                {/* Hide absences on mobile */}
                <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Absent</th>
                <th className="px-4 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.student_id} onClick={() => viewStudent(s)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors" data-testid={`student-row-${s.student_id}`}>
                  <td className="px-4 py-3 font-medium text-slate-900 max-w-[140px] sm:max-w-none">
                    <div className="truncate">
                      {s.first_name}{s.preferred_name && s.preferred_name !== s.first_name ? ` (${s.preferred_name})` : ''} {s.last_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{s.class_name}</td>
                  <td className="px-4 py-3 min-w-[100px]">
                    {s.has_data ? <AttendancePctBar pct={s.attendance_pct} /> : <span className="text-slate-300 text-xs">No data</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                    {s.has_data ? (Number.isInteger(s.absent_days) ? s.absent_days : s.absent_days?.toFixed(1)) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.has_data && s.attendance_tier
                      ? <TierBadge tier={s.attendance_tier} />
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student detail modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col" data-testid="student-modal">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>
                  {selectedStudent.first_name}{selectedStudent.preferred_name && selectedStudent.preferred_name !== selectedStudent.first_name
                    ? ` (${selectedStudent.preferred_name})` : ''} {selectedStudent.last_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  {selectedStudent.class_name} · {selectedStudent.year_level}
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium text-xs">{curLabel}</span>
                </p>
              </div>
              <button onClick={() => { setSelectedStudent(null); setStudentDetail(null); }} data-testid="close-student-modal">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              {detailLoading ? (
                <div className="flex justify-center py-12"><Loader size={22} className="animate-spin text-slate-400" /></div>
              ) : studentDetail ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className={`text-2xl font-bold ${studentDetail.attendance_pct < 90 ? 'text-rose-600' : studentDetail.attendance_pct < 95 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {studentDetail.attendance_pct}%
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Attendance</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900">
                        {Number.isInteger(studentDetail.absent_days) ? studentDetail.absent_days : studentDetail.absent_days?.toFixed(1)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">Absent Days</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-slate-900">{studentDetail.total_days}</p>
                      <p className="text-xs text-slate-400 mt-0.5">School Days</p>
                    </div>
                  </div>

                  {/* Bi-weekly trend chart */}
                  {studentDetail.monthly_trend?.length > 1 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Monthly Attendance Trend</h4>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={studentDetail.monthly_trend.map(d => ({ ...d, attendance_pct: Math.max(70, d.attendance_pct) }))}
                          margin={{ left: -10, right: 10 }}>
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                          <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} unit="%" tickCount={7} />
                          <Tooltip
                            formatter={(v, _, props) => {
                              const raw = studentDetail.monthly_trend.find(d => d.label === props.payload?.label)?.attendance_pct;
                              return [`${raw != null ? raw : v}%`, 'Attendance'];
                            }}
                            contentStyle={{ borderRadius: '0.5rem', fontSize: '12px' }}
                          />
                          <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 2"
                            label={{ value: "95%", position: "insideTopRight", fontSize: 9, fill: "#10b981" }} />
                          <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2"
                            label={{ value: "90%", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
                          <Line type="monotone" dataKey="attendance_pct" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Individual absence records */}
                  {(() => {
                    const excluded = new Set((studentDetail.excluded_absence_types || []).map(t => t.toLowerCase()));
                    const absences = (studentDetail.records || []).filter(r => {
                      const am = (r.am_status || '').trim();
                      const pm = (r.pm_status || '').trim();
                      const amCounts = am && am.toLowerCase() !== 'present' && !excluded.has(am.toLowerCase());
                      const pmCounts = pm && pm.toLowerCase() !== 'present' && !excluded.has(pm.toLowerCase());
                      return amCounts || pmCounts;
                    }).sort((a, b) => b.date.localeCompare(a.date));
                    if (!absences.length) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Absence Records ({absences.length})</h4>
                        <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                          {absences.map((r, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg text-xs">
                              <span className="font-medium text-slate-700 w-24 shrink-0">{r.date}</span>
                              <span className="text-slate-500 flex-1">AM: <span className="font-medium text-slate-700">{r.am_status || '—'}</span></span>
                              <span className="text-slate-500 flex-1">PM: <span className="font-medium text-slate-700">{r.pm_status || '—'}</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {Object.keys(studentDetail.absence_types || {}).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Absence Patterns</h4>
                      <div className="space-y-2">
                        {Object.entries(studentDetail.absence_types)
                          .sort(([, a], [, b]) => b - a)
                          .map(([type, count]) => (
                            <div key={type} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-xs text-slate-600">{type}</span>
                                  <span className="text-xs font-semibold text-slate-700">
                                    {Number.isInteger(count) ? count : count.toFixed(1)} day{count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-slate-400 rounded-full"
                                    style={{ width: `${Math.min(100, (count / (studentDetail.absent_days || 1)) * 100)}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-8">No attendance data for this student in this period</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
