import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { BarChart2, TrendingDown, Users, Target, Download, Calendar, AlertTriangle, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const COLORS = ['#22c55e', '#f59e0b', '#ef4444'];
const TIER_LABELS = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3' };
const RISK_COLORS = { 'Low Risk': '#22c55e', 'Some Risk': '#f59e0b', 'High Risk': '#ef4444' };
const DOMAIN_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'];

function statCard(label, value, sub, color = 'text-slate-900') {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className={`text-3xl font-bold ${color}`} style={{fontFamily:'Manrope,sans-serif'}}>{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-slate-500" />
      <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{title}</h2>
    </div>
  );
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [schoolData, setSchoolData] = useState(null);
  const [attTrends, setAttTrends] = useState(null);
  const [intOutcomes, setIntOutcomes] = useState([]);
  const [cohortData, setCohortData] = useState([]);
  const [cohortGroupBy, setCohortGroupBy] = useState('year_level');
  const [loading, setLoading] = useState(true);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      try {
        const [sw, at, io] = await Promise.all([
          axios.get(`${API}/analytics/school-wide`, { withCredentials: true }),
          axios.get(`${API}/analytics/attendance-trends`, { withCredentials: true }),
          axios.get(`${API}/analytics/intervention-outcomes`, { withCredentials: true }),
        ]);
        setSchoolData(sw.data);
        setAttTrends(at.data);
        setIntOutcomes(io.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'cohort') return;
    const loadCohort = async () => {
      setCohortLoading(true);
      try {
        const res = await axios.get(`${API}/analytics/cohort-comparison?group_by=${cohortGroupBy}`, { withCredentials: true });
        setCohortData(res.data);
      } catch (e) { console.error(e); }
      finally { setCohortLoading(false); }
    };
    loadCohort();
  }, [activeTab, cohortGroupBy]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
          <div className="h-64 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const sd = schoolData;
  if (!sd) return <div className="p-8 text-slate-400">No analytics data available. Load demo data to get started.</div>;

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

  const domainData = sd.domain_averages ? Object.entries(sd.domain_averages).map(([k, v]) => ({
    domain: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
    score: typeof v === 'number' ? Math.round(v * 10) / 10 : 0,
  })) : [];

  const classTierData = Object.entries(sd.class_breakdown || {}).map(([cls, d]) => ({
    class: cls,
    tier1: d.tier1 || 0, tier2: d.tier2 || 0, tier3: d.tier3 || 0,
  }));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <BarChart2 size={28} className="text-slate-600" /> Analytics
          </h1>
          <p className="text-slate-500 mt-1">{sd.total_students} students · {sd.screened_students} screened</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 mb-6">
        {[
          { key: 'overview',       label: 'Overview',          short: 'Overview', Icon: BarChart2 },
          { key: 'attendance',     label: 'Attendance',        short: 'Attend.',  Icon: Calendar },
          { key: 'interventions',  label: 'Interventions',     short: 'Interv.',  Icon: Target },
          { key: 'cohort',         label: 'Cohort Comparison', short: 'Cohort',   Icon: Users },
        ].map(({ key, label, short, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} data-testid={`analytics-tab-${key}`}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statCard('Total Students', sd.total_students, 'All enrolled')}
            {statCard('Screened', sd.screened_students, `${sd.screening_rate}% of total`)}
            {statCard('Tier 2 & 3', (sd.tier_distribution?.[2] || 0) + (sd.tier_distribution?.[3] || 0), 'Require support', 'text-amber-600')}
            {statCard('High Risk', sd.risk_distribution?.high || 0, 'SAEBRS High Risk', 'text-rose-600')}
          </div>

          {/* Tier Distribution + Risk */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="MTSS Tier Distribution" />
              <div className="flex gap-6 items-center justify-center">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={tierPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                      {COLORS.map((color, i) => <Cell key={i} fill={color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {tierPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      <span className="text-sm text-slate-600">{d.name}</span>
                      <span className="text-sm font-bold text-slate-900 ml-auto pl-4">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Activity} title="SAEBRS Risk Distribution" />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={riskBarData} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="risk" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {riskBarData.map((d, i) => <Cell key={i} fill={Object.values(RISK_COLORS)[i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Domain Averages */}
          {domainData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={BarChart2} title="Average Domain Scores" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={domainData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {domainData.map((_, i) => <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Class Breakdown */}
          {classTierData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Users} title="Tier Distribution by Class" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classTierData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="class" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tier1" name="Tier 1" fill="#22c55e" stackId="a" />
                  <Bar dataKey="tier2" name="Tier 2" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="tier3" name="Tier 3" fill="#ef4444" stackId="a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Attendance summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCard('School Days', attTrends?.total_school_days ?? '—', 'Days with attendance data')}
            {statCard('Chronic Absentees', attTrends?.chronic_absentees?.length ?? 0, 'Below 90% attendance', 'text-amber-600')}
            {statCard('Critical Absentees', attTrends?.chronic_absentees?.filter(a => a.attendance_pct < 80).length ?? 0, 'Below 80% attendance', 'text-rose-600')}
          </div>

          {/* Monthly Attendance Rate Trend */}
          {attTrends?.monthly_trend?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={TrendingDown} title="Monthly Attendance Rate Trend" />
              <p className="text-xs text-slate-400 mb-4">Percentage of sessions attended each month across all students.</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={attTrends.monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} domain={[80, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                  <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "Tier 1 (95%)", position: "right", fontSize: 10, fill: "#22c55e" }} />
                  <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Tier 2 (90%)", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                  <Line type="monotone" dataKey="attendance_rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Day of Week Pattern */}
          {attTrends?.day_of_week?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Calendar} title="Attendance Rate by Day of Week" />
              <p className="text-xs text-slate-400 mb-4">Which days have the lowest attendance.</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={attTrends.day_of_week} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} domain={[85, 100]} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                  <Bar dataKey="attendance_rate" radius={[6, 6, 0, 0]}>
                    {attTrends.day_of_week.map((d, i) => (
                      <Cell key={i} fill={d.attendance_rate >= 95 ? '#22c55e' : d.attendance_rate >= 90 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Chronic Absentees List */}
          {attTrends?.chronic_absentees?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={AlertTriangle} title="Chronic Absentees" />
              <p className="text-xs text-slate-400 mb-4">Students with attendance below 90%.</p>
              <div className="space-y-2">
                {attTrends.chronic_absentees.map((ca, i) => {
                  const pct = ca.attendance_pct;
                  const color = pct < 80 ? 'text-rose-600' : 'text-amber-600';
                  const bg = pct < 80 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200';
                  const name = ca.student ? `${ca.student.first_name}${ca.student.preferred_name ? ` (${ca.student.preferred_name})` : ''} ${ca.student.last_name}` : '—';
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

          {(!attTrends?.monthly_trend?.length && !attTrends?.chronic_absentees?.length) && (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
              <Calendar size={40} className="mx-auto mb-3 opacity-30" />
              <p>No attendance data yet</p>
              <p className="text-sm mt-1">Upload attendance files in Settings → Imports</p>
            </div>
          )}
        </div>
      )}

      {/* INTERVENTIONS TAB */}
      {activeTab === 'interventions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {statCard('Total Interventions', intOutcomes.reduce((a, b) => a + b.total, 0), 'All time')}
            {statCard('Active', intOutcomes.reduce((a, b) => a + b.active, 0), 'Currently running', 'text-emerald-600')}
            {statCard('Completed', intOutcomes.reduce((a, b) => a + b.completed, 0), 'Finished', 'text-blue-600')}
          </div>

          {intOutcomes.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Target} title="Interventions by Type" />
              <ResponsiveContainer width="100%" height={Math.max(200, intOutcomes.length * 40)}>
                <BarChart data={intOutcomes} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="type" type="category" tick={{ fontSize: 11 }} width={150} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="active" name="Active" fill="#22c55e" stackId="a" />
                  <Bar dataKey="completed" name="Completed" fill="#3b82f6" stackId="a" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
              <Target size={40} className="mx-auto mb-3 opacity-30" />
              <p>No intervention data yet</p>
            </div>
          )}

          {/* Completion rates */}
          {intOutcomes.filter(i => i.total > 0).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <SectionHeader icon={Activity} title="Completion Rate by Type" />
              <div className="space-y-3">
                {intOutcomes.sort((a, b) => b.total - a.total).map(i => (
                  <div key={i.type} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-40 truncate">{i.type}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${i.completion_rate}%` }} />
                    </div>
                    <span className="text-xs text-slate-500 w-12 text-right">{i.completion_rate}%</span>
                    <span className="text-xs text-slate-400 w-16 text-right">{i.total} total</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COHORT COMPARISON TAB */}
      {activeTab === 'cohort' && (
        <div className="space-y-6">
          {/* Group-by selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Compare by:</span>
            <select
              data-testid="cohort-group-by-select"
              value={cohortGroupBy}
              onChange={e => setCohortGroupBy(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="year_level">Year Level</option>
              <option value="class_name">Class</option>
            </select>
          </div>

          {cohortLoading ? (
            <div className="animate-pulse space-y-4">
              {[1,2].map(i => <div key={i} className="h-48 bg-slate-100 rounded-xl" />)}
            </div>
          ) : cohortData.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>No cohort data available</p>
              <p className="text-sm mt-1">Load demo data to see cohort comparisons</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {cohortData.map(c => (
                  <div key={c.name} data-testid={`cohort-card-${c.name}`} className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{c.name}</p>
                    <p className="text-2xl font-bold text-slate-900">{c.total}</p>
                    <p className="text-xs text-slate-400">students</p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {c.tier1 > 0 && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">T1:{c.tier1}</span>}
                      {c.tier2 > 0 && <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">T2:{c.tier2}</span>}
                      {c.tier3 > 0 && <span className="text-xs px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-medium">T3:{c.tier3}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tier Distribution comparison */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
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
                    <Bar dataKey="tier3" name="Tier 3" fill="#ef4444" stackId="a" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Attendance comparison */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <SectionHeader icon={Calendar} title={`Average Attendance % by ${cohortGroupBy === 'year_level' ? 'Year Level' : 'Class'}`} />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cohortData} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" domain={[80, 100]} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Avg Attendance']} />
                    <Bar dataKey="avg_attendance" name="Avg Attendance" radius={[6,6,0,0]}>
                      {cohortData.map((c, i) => (
                        <Cell key={i} fill={c.avg_attendance >= 95 ? '#22c55e' : c.avg_attendance >= 90 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-3 justify-center">
                  <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-green-500"/>&ge;95% Tier 1</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-amber-500"/>90–95% Tier 2</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><span className="inline-block w-3 h-3 rounded-full bg-red-500"/>&lt;90% Tier 3</span>
                </div>
              </div>

              {/* Risk distribution comparison */}
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <SectionHeader icon={AlertTriangle} title={`SAEBRS Risk by ${cohortGroupBy === 'year_level' ? 'Year Level' : 'Class'}`} />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={cohortData} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="risk_low" name="Low Risk" fill="#22c55e" stackId="b" />
                    <Bar dataKey="risk_some" name="Some Risk" fill="#f59e0b" stackId="b" />
                    <Bar dataKey="risk_high" name="High Risk" fill="#ef4444" stackId="b" radius={[4,4,0,0]} />
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
