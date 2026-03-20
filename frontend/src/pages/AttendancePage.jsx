import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Upload, CalendarDays, AlertTriangle, Users, TrendingDown, CheckCircle, Loader, X, Plus, Trash2, Settings2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function TierBadge({ tier }) {
  const c = tier === 1 ? 'bg-emerald-100 text-emerald-700' : tier === 2 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c}`}>Tier {tier}</span>;
}

function AttendancePctBar({ pct }) {
  const color = pct >= 95 ? '#10b981' : pct >= 90 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full" />
      </div>
      <span className="text-sm font-semibold" style={{ color, minWidth: 44 }}>{pct}%</span>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const role = user?.role || '';
  const canUpload = ['admin', 'leadership'].includes(role);

  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [newType, setNewType] = useState('');
  const [unmatchedIds, setUnmatchedIds] = useState([]);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const fileRef = useRef(null);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/attendance/summary`, { withCredentials: true });
      setSummary(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadTypes = async () => {
    try {
      const res = await axios.get(`${API}/attendance/types`, { withCredentials: true });
      setAbsenceTypes(res.data.types || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadSummary(); loadTypes(); }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true); setUploadError(''); setUploadResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await axios.post(`${API}/attendance/upload`, form, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult(res.data);
      if (res.data.unmatched_ids?.length) setUnmatchedIds(res.data.unmatched_ids);
      loadSummary();
    } catch (e) { setUploadError(e.response?.data?.detail || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const viewStudent = async (s) => {
    setSelectedStudent(s);
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/attendance/student/${s.student_id}`, { withCredentials: true });
      setStudentDetail(res.data);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const saveTypes = async () => {
    try {
      await axios.put(`${API}/attendance/types`, { types: absenceTypes }, { withCredentials: true });
      setShowTypes(false);
    } catch (e) { console.error(e); }
  };

  const addType = () => {
    const v = newType.trim();
    if (v && !absenceTypes.includes(v)) { setAbsenceTypes(p => [...p, v]); setNewType(''); }
  };

  const filtered = summary.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    if (search && !name.includes(search.toLowerCase())) return false;
    if (filterTier && String(s.attendance_tier) !== filterTier) return false;
    return true;
  }).sort((a, b) => (a.attendance_pct ?? 100) - (b.attendance_pct ?? 100));

  const withData = summary.filter(s => s.has_data);
  const concerns = withData.filter(s => s.attendance_pct < 90);
  const atRisk = withData.filter(s => s.attendance_pct >= 90 && s.attendance_pct < 95);
  const avgPct = withData.length ? (withData.reduce((a, s) => a + s.attendance_pct, 0) / withData.length).toFixed(1) : '—';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Attendance</h1>
          <p className="text-slate-500 mt-1">Student attendance tracking — upload files in <strong>Settings → Imports</strong></p>
        </div>
        <div className="flex gap-2">
          {role === 'admin' && (
            <button onClick={() => { setShowTypes(true); loadTypes(); }} data-testid="manage-absence-types-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
              <Settings2 size={15} /> Absence Types
            </button>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Students', value: summary.length, sub: 'with data: ' + withData.length, icon: <Users size={18} />, color: 'text-slate-700' },
          { label: 'School Average', value: withData.length ? `${avgPct}%` : '—', sub: 'attendance rate', icon: <CalendarDays size={18} />, color: 'text-slate-700' },
          { label: 'Tier 3 Concerns', value: concerns.length, sub: 'below 90%', icon: <TrendingDown size={18} />, color: 'text-rose-600' },
          { label: 'Tier 2 At Risk', value: atRisk.length, sub: '90–95%', icon: <AlertTriangle size={18} />, color: 'text-amber-600' },
        ].map(tile => (
          <div key={tile.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className={`${tile.color} mb-2`}>{tile.icon}</div>
            <p className={`text-2xl font-bold text-slate-900 ${tile.color}`} style={{ fontFamily: 'Manrope,sans-serif' }}>{tile.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{tile.label}</p>
            <p className="text-xs text-slate-300">{tile.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
          className="px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none flex-1 min-w-48" />
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
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
          <p className="text-slate-500 font-medium">No attendance data uploaded yet</p>
          {canUpload && <p className="text-sm text-slate-400 mt-1">Use "Upload Attendance" to import an XLSX or CSV file from your school system</p>}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-48">Attendance Rate</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Absences</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.student_id} onClick={() => viewStudent(s)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{s.first_name}{s.preferred_name ? ` (${s.preferred_name})` : ''} {s.last_name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{s.class_name}</td>
                  <td className="px-5 py-3.5">
                    {s.has_data ? <AttendancePctBar pct={s.attendance_pct} /> : <span className="text-slate-300 text-xs">No data</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{s.has_data ? (Number.isInteger(s.absent_days) ? s.absent_days : s.absent_days?.toFixed(1)) : '—'}</td>
                  <td className="px-5 py-3.5">{s.has_data && s.attendance_tier ? <TierBadge tier={s.attendance_tier} /> : <span className="text-slate-300 text-xs">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student detail modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>
                  {selectedStudent.first_name}{selectedStudent.preferred_name ? ` (${selectedStudent.preferred_name})` : ''} {selectedStudent.last_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedStudent.class_name} · {selectedStudent.year_level}</p>
              </div>
              <button onClick={() => { setSelectedStudent(null); setStudentDetail(null); }}><X size={18} className="text-slate-400" /></button>
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
                      <p className="text-xs text-slate-400 mt-0.5">Overall Attendance</p>
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

                  {/* Monthly trend chart */}
                  {studentDetail.monthly_trend?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">Monthly Attendance Trend</h4>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={studentDetail.monthly_trend}>
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <Tooltip formatter={(v) => [`${v}%`, 'Attendance']} contentStyle={{ borderRadius: '0.5rem', fontSize: '12px' }} />
                          <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 2" label={{ value: "Tier 1", position: "insideTopRight", fontSize: 9, fill: "#10b981" }} />
                          <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "Tier 2", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
                          <Line type="monotone" dataKey="attendance_pct" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Absence type breakdown */}
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
                                <span className="text-xs font-semibold text-slate-700">{Number.isInteger(count) ? count : count.toFixed(1)} day{count !== 1 ? 's' : ''}</span>
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
              ) : <p className="text-slate-400 text-sm text-center py-8">No attendance data for this student</p>}
            </div>
          </div>
        </div>
      )}

      {/* Absence Types Manager */}
      {showTypes && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Manage Absence Types</h3>
              <button onClick={() => setShowTypes(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <p className="text-xs text-slate-400 mb-4">New types are also added automatically when an upload contains unknown values.</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              {absenceTypes.map(t => (
                <div key={t} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                  <span className="text-sm text-slate-700">{t}</span>
                  <button onClick={() => setAbsenceTypes(p => p.filter(x => x !== t))}
                    className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input value={newType} onChange={e => setNewType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addType()}
                placeholder="Add new type…"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              <button onClick={addType} className="px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"><Plus size={15} /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={saveTypes} className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Save</button>
              <button onClick={() => setShowTypes(false)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
