import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getTierColors, getRiskColors } from '../utils/tierUtils';
import { Users2, Download, ChevronRight, TrendingUp, TrendingDown, ArrowRight, FileText } from 'lucide-react';
import { exportMeetingReport } from '../utils/pdfExport';

function studentDisplayName(s) {
  if (!s) return '';
  const first = s.first_name || '';
  const pref = s.preferred_name && s.preferred_name !== s.first_name ? ` (${s.preferred_name})` : '';
  const last = s.last_name || '';
  return `${first}${pref} ${last}`.trim();
}

export default function MeetingPrepPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ students: [], tier_changes: [] });
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState('');
  const [activeTab, setActiveTab] = useState('students');

  useEffect(() => {
    api.get('/meeting-prep')
      .then(r => {
        // Handle both old (array) and new (object with students + tier_changes)
        if (Array.isArray(r.data)) {
          setData({ students: r.data, tier_changes: [] });
        } else {
          setData({ students: r.data.students || [], tier_changes: r.data.tier_changes || [] });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const { students, tier_changes } = data;
  const tier3 = students.filter(s => s.mtss_tier === 3);
  const tier2 = students.filter(s => s.mtss_tier === 2);
  const filtered = filterTier ? students.filter(s => s.mtss_tier === parseInt(filterTier)) : students;

  const exportMeetingPDF = () => {
    const lines = ['MTSS MEETING REPORT', `Generated: ${new Date().toLocaleString()}`, '='.repeat(50), ''];
    lines.push(`STUDENTS REQUIRING DISCUSSION: ${students.length}`);
    lines.push(`Tier 3 (Priority): ${tier3.length}   Tier 2 (Monitor): ${tier2.length}`);
    lines.push('');

    if (tier_changes.length > 0) {
      lines.push('TIER CHANGES SINCE LAST SCREENING:', '─'.repeat(40));
      tier_changes.forEach(tc => {
        const dir = tc.direction === 'improved' ? '↑ Improved' : '↓ Declined';
        lines.push(`  ${studentDisplayName(tc.student)} — Tier ${tc.previous_tier} → Tier ${tc.current_tier} (${dir})`);
      });
      lines.push('');
    }

    lines.push('STUDENT DETAILS:', '─'.repeat(40));
    students.forEach(s => {
      lines.push('');
      lines.push(`${studentDisplayName(s.student)} (${s.student.class_name})`);
      lines.push(`  MTSS Tier: ${s.mtss_tier}`);
      lines.push(`  SAEBRS: ${s.saebrs?.total_score || '—'}/57 (${s.saebrs?.risk_level || '—'})`);
      lines.push(`  Wellbeing: ${s.saebrs_plus?.wellbeing_total || '—'}/66`);
      lines.push(`  Attendance: ${s.attendance_pct}%`);
      lines.push(`  Active Interventions: ${s.active_interventions.length}`);
      if (s.active_interventions.length > 0) {
        s.active_interventions.forEach(i => lines.push(`    - ${i.intervention_type}: ${i.goals || ''}`));
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `mtss_meeting_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Users2 size={28} className="text-slate-600" /> MTSS Meeting Prep
          </h1>
          <p className="text-slate-500 mt-1">Students requiring discussion at your next MTSS meeting</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportMeetingReport(students, tier_changes)} data-testid="export-meeting-pdf-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Priority', sub: 'Tier 3', count: tier3.length, color: 'border-rose-200 bg-rose-50', text: 'text-rose-700' },
          { label: 'Monitor', sub: 'Tier 2', count: tier2.length, color: 'border-amber-200 bg-amber-50', text: 'text-amber-700' },
          { label: 'Changes', sub: 'Tier', count: tier_changes.length, color: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-700' },
        ].map(card => (
          <div key={card.label} className={`border ${card.color} rounded-xl p-3 sm:p-4`}>
            <p className={`text-2xl font-bold ${card.text}`}>{card.count}</p>
            <p className={`text-xs font-semibold ${card.text} leading-tight`}>{card.sub}</p>
            <p className={`text-xs ${card.text} opacity-70 hidden sm:block`}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden border-b border-slate-200 mb-5 -mx-6 px-6 sm:mx-0 sm:px-0">
        {[
          { key: 'students', label: `Students (${students.length})`, short: `Students` },
          { key: 'tier_changes', label: `Tier Changes (${tier_changes.length})`, short: `Changes`, highlight: tier_changes.some(tc => tc.direction === 'declined') },
        ].map(({ key, label, short, highlight }) => (
          <button key={key} onClick={() => setActiveTab(key)} data-testid={`meeting-tab-${key}`}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            {highlight && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
          </button>
        ))}

        {activeTab === 'students' && (
          <div className="ml-auto flex items-center gap-1.5 pb-2 shrink-0">
            {[['', 'All'], ['3', 'T3'], ['2', 'T2']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterTier(val)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${filterTier === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tier Changes Tab */}
      {activeTab === 'tier_changes' && (
        loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
        ) : tier_changes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
            <p>No tier changes detected</p>
            <p className="text-sm mt-1">Tier changes appear when students are screened more than once</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tier_changes.map((tc, idx) => {
              const improved = tc.direction === 'improved';
              return (
                <div key={idx} className={`bg-white border rounded-xl p-4 ${improved ? 'border-emerald-200' : 'border-rose-200'}`}
                  data-testid={`tier-change-${tc.student?.student_id}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${improved ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                      {improved ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-rose-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => navigate(`/students/${tc.student?.student_id}`)}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                          {studentDisplayName(tc.student)}
                        </button>
                        <span className="text-xs text-slate-400">{tc.student?.class_name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className={`px-2.5 py-1 rounded-full font-semibold text-xs ${getTierColors(tc.previous_tier).badge}`}>Tier {tc.previous_tier}</span>
                          <ArrowRight size={14} className="text-slate-400" />
                          <span className={`px-2.5 py-1 rounded-full font-semibold text-xs ${getTierColors(tc.current_tier).badge}`}>Tier {tc.current_tier}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${improved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {improved ? 'Improved' : 'Declined'}
                        </span>
                        <button onClick={() => navigate(`/students/${tc.student?.student_id}`)}
                          className="text-xs text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-0.5">
                          Profile <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {tc.saebrs && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
                      <span>Latest SAEBRS: <strong>{tc.saebrs.total_score}/57</strong> ({tc.saebrs.risk_level})</span>
                      <span>Screened: {tc.current_screening?.split('T')[0]}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
            No students currently in Tier 2 or Tier 3
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const tc = getTierColors(item.mtss_tier);
              const sName = studentDisplayName(item.student);
              return (
                <div key={item.student.student_id}
                  className={`bg-white border ${tc.border} rounded-xl p-4 sm:p-5 hover:shadow-sm transition-all`}
                  data-testid={`meeting-student-${item.student.student_id}`}>
                  {/* Header: name + tier badge on same row, profile link below on mobile */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 shrink-0 ${tc.bg} rounded-xl flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${tc.text}`}>{(item.student.first_name||'?')[0]}{(item.student.last_name||'?')[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900 truncate" style={{fontFamily:'Manrope,sans-serif'}}>{sName}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${tc.badge}`}>Tier {item.mtss_tier}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-slate-400">{item.student.class_name} · {item.student.teacher}</p>
                        <button onClick={() => navigate(`/students/${item.student.student_id}`)}
                          className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors flex items-center gap-0.5 font-medium">
                          Profile <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-slate-400 mb-1">SAEBRS</p>
                      <p className="font-bold text-slate-900">{item.saebrs?.total_score || '—'}/57</p>
                      {item.saebrs && <span className={`px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(item.saebrs.risk_level)}`}>{item.saebrs.risk_level}</span>}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-slate-400 mb-1">Wellbeing</p>
                      <p className="font-bold text-slate-900">{item.saebrs_plus?.wellbeing_total || '—'}/66</p>
                      {item.saebrs_plus && <span className={`px-1.5 py-0.5 rounded-full font-medium ${getTierColors(item.saebrs_plus.wellbeing_tier).badge}`}>Tier {item.saebrs_plus.wellbeing_tier}</span>}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-slate-400 mb-1">Attendance</p>
                      <p className={`font-bold ${item.attendance_pct < 80 ? 'text-rose-600' : item.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{item.attendance_pct}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-slate-400 mb-1">Interventions</p>
                      <p className="font-bold text-slate-900">{item.active_interventions.length} active</p>
                    </div>
                  </div>

                  {item.active_interventions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Active Interventions:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.active_interventions.map(i => (
                          <span key={i.intervention_id} className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">
                            {i.intervention_type}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
