import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getTierColors } from '../utils/tierUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DOMAIN_MAXES = { social: 18, academic: 18, emotional: 9, belonging: 12, attendance: 9 };
const DOMAIN_LABELS = { social: 'Social Behaviour', academic: 'Academic Engagement', emotional: 'Emotional Wellbeing', belonging: 'School Belonging', attendance: 'Attendance' };

export default function AnalyticsPage() {
  const [tierDist, setTierDist] = useState(null);
  const [schoolWide, setSchoolWide] = useState(null);
  const [cohort, setCohort] = useState(null);
  const [intOutcomes, setIntOutcomes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tdRes, swRes, clsRes, ioRes] = await Promise.all([
          axios.get(`${API}/analytics/tier-distribution`, { withCredentials: true }),
          axios.get(`${API}/analytics/school-wide`, { withCredentials: true }),
          axios.get(`${API}/classes`, { withCredentials: true }),
          axios.get(`${API}/analytics/intervention-outcomes`, { withCredentials: true }),
        ]);
        setTierDist(tdRes.data);
        setSchoolWide(swRes.data);
        setClasses(clsRes.data);
        setIntOutcomes(ioRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const url = selectedClass
      ? `${API}/analytics/cohort-comparison?class_name=${encodeURIComponent(selectedClass)}`
      : `${API}/analytics/cohort-comparison`;
    axios.get(url, { withCredentials: true })
      .then(r => setCohort(r.data))
      .catch(console.error);
  }, [selectedClass]);

  if (loading) return (
    <div className="p-8 space-y-4">{[1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-xl animate-pulse border border-slate-200" />)}</div>
  );

  // Tier by year chart data
  const tierByYearData = Object.entries(schoolWide?.tier_by_year || {}).map(([year, counts]) => ({
    year: year.replace('Year ', 'Yr '),
    Tier1: counts.tier1,
    Tier2: counts.tier2,
    Tier3: counts.tier3,
  })).sort((a, b) => a.year.localeCompare(b.year));

  // Class breakdown
  const classData = Object.entries(tierDist?.class_breakdown || {}).map(([cls, counts]) => ({
    class: cls.replace('Year ', 'Yr '),
    Tier1: counts.tier1,
    Tier2: counts.tier2,
    Tier3: counts.tier3,
  }));

  // Domain averages radar
  const domainAvgData = Object.entries(schoolWide?.domain_averages || {}).map(([key, val]) => ({
    domain: DOMAIN_LABELS[key] || key,
    school: val,
    max: DOMAIN_MAXES[key] || 18,
    pct: Math.round((val / (DOMAIN_MAXES[key] || 18)) * 100),
  }));

  // Cohort comparison
  const cohortCompData = cohort ? Object.keys(DOMAIN_MAXES).map(key => ({
    domain: DOMAIN_LABELS[key],
    School: cohort.school_averages?.[key] || 0,
    Class: cohort.cohort_averages?.[key] || 0,
    Max: DOMAIN_MAXES[key],
  })) : [];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>School Analytics</h1>
        <p className="text-slate-500 mt-1">School-wide MTSS data overview</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: tierDist?.total_students || 0, color: 'text-slate-900' },
          { label: 'Tier 1 (Low Risk)', value: tierDist?.tier_distribution?.tier1 || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Tier 2 (Emerging)', value: tierDist?.tier_distribution?.tier2 || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Tier 3 (High Risk)', value: tierDist?.tier_distribution?.tier3 || 0, color: 'text-rose-700', bg: 'bg-rose-50' },
        ].map(card => (
          <div key={card.label} className={`bg-white border border-slate-200 rounded-xl p-5`}>
            <p className={`text-3xl font-bold ${card.color}`} style={{fontFamily:'Manrope,sans-serif'}}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">{card.label}</p>
            {tierDist?.total_students > 0 && (
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1">
                <div className="h-1 rounded-full bg-current opacity-40" style={{ width: `${(card.value / tierDist.total_students) * 100}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier by Year Level */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>MTSS Tiers by Year Level</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tierByYearData} barSize={14}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Tier1" fill="#10b981" name="Tier 1" />
              <Bar dataKey="Tier2" fill="#f59e0b" name="Tier 2" />
              <Bar dataKey="Tier3" fill="#f43f5e" name="Tier 3" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Class Risk Heatmap */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>Class Risk Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classData} barSize={14}>
              <XAxis dataKey="class" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Tier1" fill="#10b981" name="Tier 1" />
              <Bar dataKey="Tier2" fill="#f59e0b" name="Tier 2" />
              <Bar dataKey="Tier3" fill="#f43f5e" name="Tier 3" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Domain Averages */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>School-Wide Wellbeing Domain Averages</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {domainAvgData.map(d => (
            <div key={d.domain} className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none"
                    stroke={d.pct >= 70 ? '#10b981' : d.pct >= 50 ? '#f59e0b' : '#f43f5e'}
                    strokeWidth="3.5" strokeDasharray={`${d.pct} ${100 - d.pct}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-900">{d.pct}%</span>
                </div>
              </div>
              <p className="text-xs font-medium text-slate-700">{d.domain}</p>
              <p className="text-xs text-slate-400">{d.school}/{d.max} avg</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort Comparison */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-base font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Cohort Comparison</h2>
          <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
            data-testid="cohort-class-selector"
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white">
            <option value="">School Average Only</option>
            {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
          </select>
        </div>
        {cohortCompData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={cohortCompData} barSize={18}>
              <XAxis dataKey="domain" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="School" fill="#64748b" name="School Average" />
              {selectedClass && <Bar dataKey="Class" fill="#6366f1" name={`${selectedClass} Average`} />}
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-slate-400 py-8 text-center">No data available</p>}
        {cohort && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(cohort.school_averages || {}).map(([key, val]) => {
              const classVal = cohort.cohort_averages?.[key];
              const diff = classVal !== undefined ? classVal - val : null;
              return (
                <div key={key} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-slate-600 mb-1">{DOMAIN_LABELS[key]}</p>
                  <p className="text-sm font-bold text-slate-900">{val} <span className="text-xs text-slate-400">school</span></p>
                  {diff !== null && (
                    <p className={`text-xs font-semibold mt-0.5 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)} class
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Intervention Outcomes */}
      {intOutcomes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>Intervention Outcomes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Intervention Type', 'Total', 'Active', 'Completed', 'Completion Rate', 'Avg Rating'].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {intOutcomes.map(io => (
                  <tr key={io.type} className="border-b border-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">{io.type}</td>
                    <td className="py-3 px-4 text-slate-600">{io.total}</td>
                    <td className="py-3 px-4"><span className="text-emerald-600 font-medium">{io.active}</span></td>
                    <td className="py-3 px-4 text-slate-600">{io.completed}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${io.completion_rate}%` }} />
                        </div>
                        <span className="text-xs text-slate-600">{io.completion_rate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{io.avg_rating ? `${io.avg_rating}/5` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
