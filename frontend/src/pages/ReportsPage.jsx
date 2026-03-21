import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, Calendar, Target, Users, FileText, Download,
  AlertTriangle, Activity, Loader, TrendingDown, UserCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ReferenceLine, Legend
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DOMAIN_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'];

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-start gap-2 mb-4">
      <Icon size={18} className="text-slate-500 mt-0.5 shrink-0" />
      <div>
        <h2 className="text-base font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{title}</h2>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className={`text-2xl font-bold ${color}`} style={{ fontFamily: 'Manrope,sans-serif' }}>{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
      <Icon size={40} className="mx-auto mb-3 opacity-30" />
      <p className="font-medium">{message}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}

// ── Attendance Tab ─────────────────────────────────────────────────────────

function AttendanceTab({ data, absenceTypes, navigate }) {
  if (!data) return <EmptyState icon={Calendar} message="No attendance data yet" sub="Upload attendance files in Settings → Imports" />;
  const chronic = data.chronic_absentees || [];
  const critical = chronic.filter(a => a.attendance_pct < 80).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="School Days Tracked" value={data.total_school_days ?? '—'} sub="Days with attendance data" />
        <StatCard label="Chronic Absentees" value={chronic.length} sub="Below 90%" color="text-amber-600" />
        <StatCard label="Critical Absentees" value={critical} sub="Below 80%" color="text-rose-600" />
      </div>

      {data.day_of_week?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={Calendar} title="Attendance Rate by Day of Week" sub="Which days have the lowest attendance?" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.day_of_week} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} domain={[85, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
              <Bar dataKey="attendance_rate" radius={[6, 6, 0, 0]}>
                {data.day_of_week.map((d, i) => (
                  <Cell key={i} fill={d.attendance_rate >= 95 ? '#22c55e' : d.attendance_rate >= 90 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 justify-center">
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /> ≥95%</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" />90–95%</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-red-500" />&lt;90%</span>
          </div>
        </div>
      )}

      {data.monthly_trend?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={TrendingDown} title="Monthly Attendance Trend" sub="Percentage of sessions attended per month across the filtered cohort" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis unit="%" tick={{ fontSize: 11 }} domain={[80, 100]} />
              <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
              <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 2" label={{ value: '95%', position: 'right', fontSize: 10, fill: '#22c55e' }} />
              <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '90%', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="attendance_rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {absenceTypes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={AlertTriangle} title="Absence Type Breakdown" sub="Most common reasons for absence (grey = excluded from attendance calculation)" />
          <ResponsiveContainer width="100%" height={Math.max(180, absenceTypes.length * 38)}>
            <BarChart data={absenceTypes.slice(0, 12)} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={140} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {absenceTypes.slice(0, 12).map((d, i) => (
                  <Cell key={i} fill={d.excluded ? '#94a3b8' : DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chronic.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={AlertTriangle} title="Students with Low Attendance" sub="Students below 90% — click to view profile" />
          <div className="space-y-2">
            {chronic.map((ca, i) => {
              const pct = ca.attendance_pct;
              const color = pct < 80 ? 'text-rose-600' : 'text-amber-600';
              const bg = pct < 80 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200';
              const name = ca.student
                ? `${ca.student.first_name}${ca.student.preferred_name && ca.student.preferred_name !== ca.student.first_name ? ` (${ca.student.preferred_name})` : ''} ${ca.student.last_name}`
                : '—';
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${bg} cursor-pointer hover:opacity-90`}
                  onClick={() => navigate(`/students/${ca.student?.student_id}`)}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">{ca.student?.class_name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${color}`}>{pct}%</p>
                    <p className="text-xs text-slate-400">attendance</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!data.day_of_week?.length && !chronic.length && (
        <EmptyState icon={Calendar} message="No attendance data yet" sub="Upload attendance files in Settings → Imports" />
      )}
    </div>
  );
}

// ── Wellbeing & SEL Tab ────────────────────────────────────────────────────

function WellbeingTab({ data, coverage }) {
  if (!data) return <EmptyState icon={Activity} message="No wellbeing data available" sub="Load demo data to see wellbeing insights" />;

  const domainData = data.domain_averages
    ? Object.entries(data.domain_averages).map(([k, v], i) => ({
        domain: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
        score: typeof v === 'number' ? Math.round(v * 10) / 10 : 0,
        color: DOMAIN_COLORS[i % DOMAIN_COLORS.length],
      }))
    : [];

  const riskData = [
    { risk: 'Low Risk', count: data.risk_distribution?.low || 0, color: '#22c55e' },
    { risk: 'Some Risk', count: data.risk_distribution?.some || 0, color: '#f59e0b' },
    { risk: 'High Risk', count: data.risk_distribution?.high || 0, color: '#ef4444' },
  ];
  const totalRisk = riskData.reduce((a, b) => a + b.count, 0);

  const domainRisk = data.domain_risk || {};
  const domainRiskRows = [
    { label: 'Social', key: 'social' },
    { label: 'Academic', key: 'academic' },
    { label: 'Emotional', key: 'emotional' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={data.total_students} sub="Active students" />
        <StatCard label="Screened" value={`${data.screening_rate}%`} sub={`${data.screened_students} students`} />
        <StatCard label="High Risk" value={data.risk_distribution?.high || 0} sub="SAEBRS High Risk" color="text-rose-600" />
        <StatCard label="Tier 2 & 3" value={(data.tier_distribution?.[2] || 0) + (data.tier_distribution?.[3] || 0)} sub="Require support" color="text-amber-600" />
      </div>

      {domainData.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={Activity} title="Average Wellbeing Domain Scores" sub="Student self-report scores by domain — higher score = better wellbeing" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={domainData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                {domainData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={Users} title="SAEBRS Risk Distribution" sub="Behavioural risk across screened students" />
          {totalRisk > 0 ? (
            <div className="flex gap-6 items-center justify-center">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie data={riskData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="count" paddingAngle={3}>
                    {riskData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {riskData.map((d) => (
                  <div key={d.risk} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-slate-600 w-20">{d.risk}</span>
                    <span className="text-sm font-bold text-slate-900 ml-auto pl-2">{d.count}</span>
                    <span className="text-xs text-slate-400 w-10">({totalRisk > 0 ? Math.round(d.count / totalRisk * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8 text-sm">No screening data yet</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={AlertTriangle} title="At-Risk Students by Domain" sub="How many students are flagged in each SAEBRS domain?" />
          <div className="space-y-4 mt-2">
            {domainRiskRows.map(({ label, key }) => {
              const d = domainRisk[key] || { low: 0, some: 0, high: 0 };
              const total = d.low + d.some + d.high || 1;
              return (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                    <span className="text-xs text-slate-400">{d.some + d.high} at risk</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden">
                    <div className="bg-green-400" style={{ width: `${d.low / total * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${d.some / total * 100}%` }} />
                    <div className="bg-rose-500" style={{ width: `${d.high / total * 100}%` }} />
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs text-slate-400">Low: {d.low}</span>
                    <span className="text-xs text-amber-600">Some: {d.some}</span>
                    <span className="text-xs text-rose-600">High: {d.high}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {coverage.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={UserCheck} title="Screening Coverage by Class" sub="Which classes still need to complete screenings?" />
          <ResponsiveContainer width="100%" height={Math.max(160, coverage.length * 36)}>
            <BarChart data={coverage} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis dataKey="class" type="category" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => [`${v}%`, 'Coverage']} />
              <Bar dataKey="coverage_pct" radius={[0, 6, 6, 0]}>
                {coverage.map((d, i) => (
                  <Cell key={i} fill={d.coverage_pct === 100 ? '#22c55e' : d.coverage_pct >= 75 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 justify-center">
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-green-500" />100% complete</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" />75–99%</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-red-500" />&lt;75%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Support & Gaps Tab ─────────────────────────────────────────────────────

function SupportTab({ intOutcomes, supportGaps, staffLoad, navigate }) {
  const TIER_BG = { 2: 'bg-amber-50 border-amber-200', 3: 'bg-rose-50 border-rose-200' };
  const TIER_BADGE = { 2: 'text-amber-700 bg-amber-100', 3: 'text-rose-700 bg-rose-100' };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Support Gaps" value={supportGaps.length} sub="Tier 2/3, no active intervention" color="text-rose-600" />
        <StatCard label="Active Interventions" value={intOutcomes.reduce((a, b) => a + b.active, 0)} sub="Currently running" color="text-emerald-600" />
        <StatCard label="Completed" value={intOutcomes.reduce((a, b) => a + b.completed, 0)} sub="All time" color="text-blue-600" />
      </div>

      {supportGaps.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={AlertTriangle} title="Students Needing Support" sub="Tier 2 or 3 students with no active intervention assigned — click to add one" />
          <div className="space-y-2">
            {supportGaps.map((g, i) => {
              const name = `${g.student.first_name}${g.student.preferred_name && g.student.preferred_name !== g.student.first_name ? ` (${g.student.preferred_name})` : ''} ${g.student.last_name}`;
              return (
                <div key={i}
                  data-testid={`support-gap-row-${i}`}
                  className={`flex items-center justify-between p-3 rounded-xl border ${TIER_BG[g.tier] || 'bg-slate-50 border-slate-200'} cursor-pointer hover:opacity-90`}
                  onClick={() => navigate(`/students/${g.student.student_id}`)}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{name}</p>
                    <p className="text-xs text-slate-500">{g.student.class_name} · {g.saebrs_risk}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_BADGE[g.tier]}`}>Tier {g.tier}</span>
                    <span className="text-xs text-slate-400">{g.attendance_pct}% att.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
          <Target size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
          <p className="text-sm font-semibold text-slate-700">No support gaps!</p>
          <p className="text-xs text-slate-400 mt-1">All Tier 2/3 students have active interventions assigned</p>
        </div>
      )}

      {intOutcomes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={Target} title="Interventions by Type" sub="Active and completed interventions across this cohort" />
          <ResponsiveContainer width="100%" height={Math.max(200, intOutcomes.length * 42)}>
            <BarChart data={intOutcomes} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="active" name="Active" fill="#22c55e" stackId="a" />
              <Bar dataKey="completed" name="Completed" fill="#3b82f6" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {staffLoad.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <SectionHeader icon={Users} title="Active Interventions by Staff Member" sub="Workload distribution — helps ensure equitable assignment" />
          <div className="space-y-3 mt-2">
            {staffLoad.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 w-44 truncate">{s.staff}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                  <div className="bg-indigo-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${Math.min((s.count / (staffLoad[0]?.count || 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-sm font-bold text-slate-700 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {intOutcomes.length === 0 && (
        <EmptyState icon={Target} message="No intervention data yet" sub="Add interventions from the Interventions page" />
      )}
    </div>
  );
}

// ── Data Exports Tab ───────────────────────────────────────────────────────

const CSV_REPORTS = [
  { id: 'tier-summary', title: 'MTSS Tier Summary', description: 'All students with MTSS tier, SAEBRS risk, wellbeing score, and attendance rate', endpoint: '/reports/tier-summary-csv', filename: 'tier_summary.csv', badge: 'Core Report', badgeColor: 'bg-slate-900 text-white' },
  { id: 'students', title: 'Student Roster', description: 'Complete student list with enrolment details, year levels, and class assignments', endpoint: '/reports/students-csv', filename: 'students.csv', badge: 'Roster', badgeColor: 'bg-blue-100 text-blue-700' },
  { id: 'screening', title: 'Screening Results', description: 'All SAEBRS screening results across all students and screening periods', endpoint: '/reports/screening-csv', filename: 'screening_results.csv', badge: 'Screening', badgeColor: 'bg-indigo-100 text-indigo-700' },
  { id: 'interventions', title: 'Intervention Outcomes', description: 'All interventions with assigned staff, goals, status, and outcome ratings', endpoint: '/reports/interventions-csv', filename: 'interventions.csv', badge: 'Interventions', badgeColor: 'bg-emerald-100 text-emerald-700' },
];

function ExportsTab() {
  const [downloading, setDownloading] = useState({});
  const [downloaded, setDownloaded] = useState({});

  const downloadCSV = async (report) => {
    setDownloading(prev => ({ ...prev, [report.id]: true }));
    try {
      const res = await axios.get(`${API}${report.endpoint}`, { withCredentials: true, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = report.filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setDownloaded(prev => ({ ...prev, [report.id]: true }));
      setTimeout(() => setDownloaded(prev => ({ ...prev, [report.id]: false })), 3000);
    } catch (e) { console.error(e); }
    finally { setDownloading(prev => ({ ...prev, [report.id]: false })); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-slate-700">CSV Export Format</p>
          <p className="text-xs text-slate-500 mt-0.5">All reports export as comma-separated values. Open in Excel, Google Sheets, or any data analysis tool.</p>
        </div>
      </div>
      {CSV_REPORTS.map(report => (
        <div key={report.id} className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between gap-4 hover:border-slate-300 transition-all">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <FileText size={18} className="text-slate-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{report.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.badgeColor}`}>{report.badge}</span>
              </div>
              <p className="text-sm text-slate-500">{report.description}</p>
            </div>
          </div>
          <button onClick={() => downloadCSV(report)} disabled={downloading[report.id]}
            data-testid={`download-${report.id}`}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all ${downloaded[report.id] ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'} disabled:opacity-60`}>
            {downloading[report.id] ? <><Loader size={14} className="animate-spin" />Exporting...</>
              : downloaded[report.id] ? <><FileText size={14} />Downloaded</>
                : <><Download size={14} />Export CSV</>}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main Reports Page ──────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('attendance');
  const [filterType, setFilterType] = useState('school');
  const [filterValue, setFilterValue] = useState('');
  const [filterOptions, setFilterOptions] = useState({ year_levels: [], classes: [] });

  const [attData, setAttData] = useState(null);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [schoolData, setSchoolData] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [intOutcomes, setIntOutcomes] = useState([]);
  const [supportGaps, setSupportGaps] = useState([]);
  const [staffLoad, setStaffLoad] = useState([]);
  const [loading, setLoading] = useState(false);

  const filterParams = filterType === 'school' ? {}
    : filterType === 'year_level' ? { year_level: filterValue }
      : { class_name: filterValue };

  const filterLabel = filterType === 'school' ? 'Whole School'
    : filterType === 'year_level' ? `Year ${filterValue}`
      : filterValue;

  useEffect(() => {
    axios.get(`${API}/reports/filter-options`, { withCredentials: true })
      .then(r => setFilterOptions(r.data))
      .catch(console.error);
  }, []);

  const buildQS = (params) => {
    const q = new URLSearchParams(params).toString();
    return q ? `?${q}` : '';
  };

  const loadTabData = useCallback(async (tab) => {
    if (tab === 'exports') return;
    setLoading(true);
    const qs = buildQS(filterParams);
    try {
      if (tab === 'attendance') {
        const [att, abs] = await Promise.all([
          axios.get(`${API}/analytics/attendance-trends${qs}`, { withCredentials: true }),
          axios.get(`${API}/reports/absence-types${qs}`, { withCredentials: true }),
        ]);
        setAttData(att.data);
        setAbsenceTypes(abs.data);
      } else if (tab === 'wellbeing') {
        const [sw, cov] = await Promise.all([
          axios.get(`${API}/analytics/school-wide${qs}`, { withCredentials: true }),
          axios.get(`${API}/reports/screening-coverage${qs}`, { withCredentials: true }),
        ]);
        setSchoolData(sw.data);
        setCoverage(cov.data);
      } else if (tab === 'support') {
        const [intO, gaps, staff] = await Promise.all([
          axios.get(`${API}/analytics/intervention-outcomes${qs}`, { withCredentials: true }),
          axios.get(`${API}/reports/support-gaps${qs}`, { withCredentials: true }),
          axios.get(`${API}/reports/staff-load`, { withCredentials: true }),
        ]);
        setIntOutcomes(intO.data);
        setSupportGaps(gaps.data);
        setStaffLoad(staff.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterParams]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, filterType, filterValue]);

  const handleFilterMode = (mode) => {
    setFilterType(mode);
    if (mode === 'year_level') setFilterValue(filterOptions.year_levels[0] || '');
    else if (mode === 'class') setFilterValue(filterOptions.classes[0] || '');
    else setFilterValue('');
  };

  const TABS = [
    { key: 'attendance', label: 'Attendance', short: 'Attend.', Icon: Calendar },
    { key: 'wellbeing', label: 'Wellbeing & SEL', short: 'Wellbeing', Icon: Activity },
    { key: 'support', label: 'Support & Gaps', short: 'Support', Icon: Target },
    { key: 'exports', label: 'Data Exports', short: 'Exports', Icon: FileText },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
          <BarChart2 size={28} className="text-slate-600" /> Reports & Insights
        </h1>
        <p className="text-slate-500 mt-1">Explore your school's social-emotional, wellbeing, and attendance data</p>
      </div>

      {activeTab !== 'exports' && (
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white border border-slate-200 rounded-xl" data-testid="reports-filter-bar">
          <span className="text-sm font-medium text-slate-600 shrink-0">Viewing:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { mode: 'school', label: 'Whole School' },
              { mode: 'year_level', label: 'Year Level' },
              { mode: 'class', label: 'Class' },
            ].map(({ mode, label }) => (
              <button key={mode} onClick={() => handleFilterMode(mode)} data-testid={`filter-mode-${mode}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === mode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {filterType === 'year_level' && (
            <select data-testid="filter-year-select" value={filterValue} onChange={e => setFilterValue(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              {filterOptions.year_levels.map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          )}
          {filterType === 'class' && (
            <select data-testid="filter-class-select" value={filterValue} onChange={e => setFilterValue(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300">
              {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {filterType !== 'school' && filterValue && (
            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              {filterLabel}
            </span>
          )}
        </div>
      )}

      <div className="flex overflow-x-auto overflow-y-hidden border-b border-slate-200 mb-6">
        {TABS.map(({ key, label, short, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} data-testid={`reports-tab-${key}`}
            className={`flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader size={24} className="animate-spin mr-2" /> Loading insights...
        </div>
      )}

      {!loading && activeTab === 'attendance' && (
        <AttendanceTab data={attData} absenceTypes={absenceTypes} navigate={navigate} />
      )}
      {!loading && activeTab === 'wellbeing' && (
        <WellbeingTab data={schoolData} coverage={coverage} />
      )}
      {!loading && activeTab === 'support' && (
        <SupportTab intOutcomes={intOutcomes} supportGaps={supportGaps} staffLoad={staffLoad} navigate={navigate} />
      )}
      {activeTab === 'exports' && <ExportsTab />}
    </div>
  );
}
