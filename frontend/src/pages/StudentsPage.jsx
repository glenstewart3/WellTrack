import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getTierColors, getRiskColors } from '../utils/tierUtils';
import { Search, Filter, ChevronRight, Users } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTier, setFilterTier] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [studRes, clsRes] = await Promise.all([
          axios.get(`${API}/students/summary`, { withCredentials: true }),
          axios.get(`${API}/classes`, { withCredentials: true }),
        ]);
        setStudents(studRes.data);
        setClasses(clsRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchClass = !filterClass || s.class_name === filterClass;
    const matchTier = !filterTier || String(s.mtss_tier) === filterTier;
    return matchSearch && matchClass && matchTier;
  }).sort((a, b) => (b.mtss_tier || 0) - (a.mtss_tier || 0));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Students</h1>
          <p className="text-slate-500 mt-1">{students.length} enrolled students</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="student-search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
          />
        </div>
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          data-testid="filter-class"
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
        </select>
        <select
          value={filterTier}
          onChange={e => setFilterTier(e.target.value)}
          data-testid="filter-tier"
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1 (Low Risk)</option>
          <option value="2">Tier 2 (Emerging)</option>
          <option value="3">Tier 3 (High Risk)</option>
          <option value="">Not Screened</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={40} className="mb-3" />
            <p className="font-medium">No students found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Student', 'Class', 'Year', 'MTSS Tier', 'SAEBRS Risk', 'Wellbeing', 'Attendance', 'Interventions', ''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const colors = getTierColors(s.mtss_tier);
                  return (
                    <tr
                      key={s.student_id}
                      onClick={() => navigate(`/students/${s.student_id}`)}
                      className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                      data-testid={`student-row-${s.student_id}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-slate-600">{s.first_name[0]}{s.last_name[0]}</span>
                          </div>
                          <span className="font-medium text-slate-900">{s.first_name} {s.last_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{s.class_name}</td>
                      <td className="py-3.5 px-4 text-slate-600">{s.year_level}</td>
                      <td className="py-3.5 px-4">
                        {s.mtss_tier ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                            Tier {s.mtss_tier}
                          </span>
                        ) : <span className="text-xs text-slate-400">Not screened</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskColors(s.saebrs_risk)}`}>
                          {s.saebrs_risk || 'Not screened'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {s.wellbeing_tier ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColors(s.wellbeing_tier).badge}`}>
                            T{s.wellbeing_tier} ({s.wellbeing_total}/66)
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-sm font-medium ${s.attendance_pct < 80 ? 'text-rose-600' : s.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {s.attendance_pct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {s.active_interventions > 0 ? (
                          <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">{s.active_interventions} active</span>
                        ) : <span className="text-slate-400 text-xs">None</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <ChevronRight size={16} className="text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
