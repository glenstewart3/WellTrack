import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getTierColors, getRiskColors, RISK_INDICATOR_LABELS, RISK_INDICATOR_COLORS } from '../utils/tierUtils';
import { Radar, ChevronUp, ChevronDown } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function ClassroomRadarPage() {
  useDocumentTitle('Class Risk Radar');
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [radarData, setRadarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('tier');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    api.get('/classes').then(r => {
      setClasses(r.data);
      if (r.data.length > 0) setSelectedClass(r.data[0].class_name);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoading(true);
    api.get(`/analytics/classroom-radar/${encodeURIComponent(selectedClass)}`)
      .then(r => setRadarData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedClass]);

  const tierCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  radarData.forEach(s => { tierCounts[s.mtss_tier || 0]++; });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedData = useMemo(() => {
    return [...radarData].sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'tier': aVal = a.mtss_tier || 0; bVal = b.mtss_tier || 0; break;
        case 'saebrs': aVal = a.saebrs_total ?? 999; bVal = b.saebrs_total ?? 999; break;
        case 'attendance': aVal = a.attendance_pct; bVal = b.attendance_pct; break;
        case 'indicators': aVal = a.risk_indicators.length; bVal = b.risk_indicators.length; break;
        case 'name': aVal = a.student.last_name; bVal = b.student.last_name; return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        default: aVal = a.mtss_tier || 0; bVal = b.mtss_tier || 0;
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [radarData, sortField, sortDir]);

  const SortHeader = ({ field, label }) => (
    <th
      onClick={() => handleSort(field)}
      className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        {sortField === field ? (
          sortDir === 'desc' ? <ChevronDown size={12} className="text-slate-700" /> : <ChevronUp size={12} className="text-slate-700" />
        ) : <ChevronDown size={12} className="opacity-30" />}
      </span>
    </th>
  );

  const getRiskLevel = (tier) => {
    if (tier === 3) return 'high';
    if (tier === 2) return 'emerging';
    if (tier === 1) return 'low';
    return 'unscreened';
  };

  const tierRowColors = { 3: 'border-l-4 border-l-rose-400 bg-rose-50', 2: 'border-l-4 border-l-amber-400 bg-amber-50', 1: '', 0: 'opacity-60' };

  return (
    <div className="p-6 lg:p-8 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Radar size={28} className="text-slate-600" /> Class Risk Radar
          </h1>
          <p className="text-slate-500 mt-1">Identify students who may need support. Click column headers to sort.</p>
        </div>
        <select
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
          data-testid="class-selector"
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white font-medium"
        >
          {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name} — {c.teacher}</option>)}
        </select>
      </div>

      {/* Summary bar */}
      {radarData.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Tier 3 Students', count: tierCounts[3], color: 'border-rose-200 bg-rose-50', text: 'text-rose-700' },
            { label: 'Tier 2 Students', count: tierCounts[2], color: 'border-amber-200 bg-amber-50', text: 'text-amber-700' },
            { label: 'Tier 1 Students', count: tierCounts[1], color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700' },
            { label: 'Not Screened', count: tierCounts[0], color: 'border-slate-200 bg-slate-50', text: 'text-slate-500' },
          ].map(item => (
            <div key={item.label} className={`border ${item.color} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${item.text}`} style={{fontFamily:'Manrope,sans-serif'}}>{item.count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Radar Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : radarData.length === 0 ? (
          <div className="p-16 text-center text-slate-400">No students found in this class.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortHeader field="name" label="Student" />
                  <SortHeader field="tier" label="MTSS Tier" />
                  <SortHeader field="saebrs" label="SAEBRS Risk" />
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Wellbeing</th>
                  <SortHeader field="attendance" label="Attendance" />
                  <SortHeader field="indicators" label="Indicators" />
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Intervention</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map(item => {
                  const tierColors = getTierColors(item.mtss_tier);
                  return (
                    <tr
                      key={item.student.student_id}
                      onClick={() => navigate(`/students/${item.student.student_id}`)}
                      className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${tierRowColors[item.mtss_tier] || ''}`}
                      data-testid={`radar-row-${item.student.student_id}`}
                    >
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-medium text-slate-900">{item.student.first_name} {item.student.last_name}</p>
                          {item.score_trend !== null && item.score_trend !== undefined && (
                            <p className={`text-xs ${item.score_trend > 0 ? 'text-emerald-600' : item.score_trend < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              {item.score_trend > 0 ? '+' : ''}{item.score_trend} from last screening
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.mtss_tier ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${tierColors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${tierColors.dot}`} />
                            Tier {item.mtss_tier}
                          </span>
                        ) : <span className="text-xs text-slate-400">Not Screened</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getRiskColors(item.saebrs_risk)}`}>
                          {item.saebrs_risk}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.wellbeing_tier ? (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getTierColors(item.wellbeing_tier).badge}`}>
                            Tier {item.wellbeing_tier} ({item.wellbeing_total}/66)
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-slate-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${item.attendance_pct < 80 ? 'bg-rose-500' : item.attendance_pct < 90 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(item.attendance_pct, 100)}%` }} />
                          </div>
                          <span className={`text-xs font-medium ${item.attendance_pct < 80 ? 'text-rose-600' : item.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {item.attendance_pct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-48">
                          {item.risk_indicators.slice(0, 3).map(ind => (
                            <span key={ind} className={`text-xs px-1.5 py-0.5 rounded-full ${RISK_INDICATOR_COLORS[ind]}`}>
                              {RISK_INDICATOR_LABELS[ind]}
                            </span>
                          ))}
                          {item.risk_indicators.length > 3 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">+{item.risk_indicators.length - 3}</span>
                          )}
                          {item.risk_indicators.length === 0 && <span className="text-xs text-slate-300">None</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.has_active_intervention ? (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                        ) : item.mtss_tier >= 2 ? (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Needed</span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-xs">View →</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">Risk Indicators:</span>
        {Object.entries(RISK_INDICATOR_LABELS).map(([key, label]) => (
          <span key={key} className={`px-2 py-0.5 rounded-full ${RISK_INDICATOR_COLORS[key]}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}
