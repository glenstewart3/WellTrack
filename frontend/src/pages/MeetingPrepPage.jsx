import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getTierColors, getRiskColors } from '../utils/tierUtils';
import { Users2, Download, ChevronRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MeetingPrepPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTier, setFilterTier] = useState('');

  useEffect(() => {
    axios.get(`${API}/meeting-prep`, { withCredentials: true })
      .then(r => setStudents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tier3 = students.filter(s => s.mtss_tier === 3);
  const tier2 = students.filter(s => s.mtss_tier === 2);
  const filtered = filterTier ? students.filter(s => s.mtss_tier === parseInt(filterTier)) : students;

  const exportMeeting = () => {
    const lines = ['MTSS Meeting Report', `Generated: ${new Date().toLocaleDateString()}`, ''];
    students.forEach(s => {
      lines.push(`${s.student.first_name} ${s.student.last_name} (${s.student.class_name})`);
      lines.push(`  MTSS Tier: ${s.mtss_tier}`);
      lines.push(`  SAEBRS: ${s.saebrs?.total_score || '—'}/57 (${s.saebrs?.risk_level || '—'})`);
      lines.push(`  Wellbeing: ${s.saebrs_plus?.wellbeing_total || '—'}/66`);
      lines.push(`  Attendance: ${s.attendance_pct}%`);
      lines.push(`  Active Interventions: ${s.active_interventions.length}`);
      if (s.active_interventions.length > 0) {
        s.active_interventions.forEach(i => lines.push(`    - ${i.intervention_type}: ${i.goals}`));
      }
      lines.push('');
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mtss_meeting_report.txt'; a.click();
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
        <button onClick={exportMeeting} data-testid="export-meeting-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Tier 3 — Priority', count: tier3.length, color: 'border-rose-200 bg-rose-50', text: 'text-rose-700' },
          { label: 'Tier 2 — Monitor', count: tier2.length, color: 'border-amber-200 bg-amber-50', text: 'text-amber-700' },
          { label: 'With Active Support', count: students.filter(s => s.active_interventions.length > 0).length, color: 'border-indigo-200 bg-indigo-50', text: 'text-indigo-700' },
        ].map(card => (
          <div key={card.label} className={`border ${card.color} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${card.text}`} style={{fontFamily:'Manrope,sans-serif'}}>{card.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {[['', 'All Students'], ['3', 'Tier 3 Only'], ['2', 'Tier 2 Only']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterTier(val)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${filterTier === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Students list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-xl border border-slate-200 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
          No students currently in Tier 2 or Tier 3
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const tc = getTierColors(item.mtss_tier);
            return (
              <div key={item.student.student_id}
                className={`bg-white border ${tc.border} rounded-xl p-5 hover:shadow-sm transition-all`}
                data-testid={`meeting-student-${item.student.student_id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${tc.bg} rounded-xl flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${tc.text}`}>{item.student.first_name[0]}{item.student.last_name[0]}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{item.student.first_name} {item.student.last_name}</h3>
                      <p className="text-xs text-slate-400">{item.student.class_name} · {item.student.teacher}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${tc.badge}`}>Tier {item.mtss_tier}</span>
                    <button onClick={() => navigate(`/students/${item.student.student_id}`)}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                      Profile <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-slate-400 mb-1">SAEBRS</p>
                    <p className="font-bold text-slate-900">{item.saebrs?.total_score || '—'}/57</p>
                    {item.saebrs && <span className={`px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(item.saebrs.risk_level)}`}>{item.saebrs.risk_level}</span>}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-slate-400 mb-1">Wellbeing</p>
                    <p className="font-bold text-slate-900">{item.saebrs_plus?.wellbeing_total || '—'}/66</p>
                    {item.saebrs_plus && <span className={`px-1.5 py-0.5 rounded-full font-medium ${getTierColors(item.saebrs_plus.wellbeing_tier).badge}`}>Tier {item.saebrs_plus.wellbeing_tier}</span>}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-slate-400 mb-1">Attendance</p>
                    <p className={`font-bold ${item.attendance_pct < 80 ? 'text-rose-600' : item.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{item.attendance_pct}%</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
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
      )}
    </div>
  );
}
