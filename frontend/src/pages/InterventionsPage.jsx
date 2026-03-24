import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getTierColors, INTERVENTION_TYPES } from '../utils/tierUtils';
import { useSettings } from '../context/SettingsContext';
import { Plus, X, Target, ChevronRight, Calendar, User, FileText, ClipboardList } from 'lucide-react';
import { exportInterventionsReport } from '../utils/pdfExport';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function studentDisplayName(s) {
  if (!s) return '';
  const first = s.first_name || '';
  const pref = s.preferred_name && s.preferred_name !== s.first_name ? ` (${s.preferred_name})` : '';
  const last = s.last_name || '';
  return `${first}${pref} ${last}`.trim();
}

function InterventionDetailModal({ intv, students, onClose, onUpdated }) {
  const student = students.find(s => s.student_id === intv.student_id);
  const [status, setStatus] = useState(intv.status);
  const [notes, setNotes] = useState(intv.progress_notes || '');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API}/interventions/${intv.intervention_id}`, { status, progress_notes: notes }, { withCredentials: true });
      onUpdated(res.data);
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>{intv.intervention_type}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
            <User size={14} className="text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Student</p>
              <button onClick={() => { onClose(); navigate(`/students/${intv.student_id}`); }}
                className="text-sm font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                {student ? studentDisplayName(student) : intv.student_id}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Assigned Staff</p>
              <p className="text-sm font-medium text-slate-700">{intv.assigned_staff}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Frequency</p>
              <p className="text-sm font-medium text-slate-700">{intv.frequency || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Start Date</p>
              <p className="text-sm font-medium text-slate-700">{intv.start_date || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Review Date</p>
              <p className="text-sm font-medium text-slate-700">{intv.review_date || '—'}</p>
            </div>
          </div>

          {intv.rationale && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Reason</p>
              <p className="text-sm text-slate-700">{intv.rationale}</p>
            </div>
          )}

          {intv.goals && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 mb-0.5">Goals</p>
              <p className="text-sm text-slate-700">{intv.goals}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Progress Notes</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none"
              placeholder="Update progress notes..." />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Status</label>
            <div className="flex gap-2">
              {['active', 'completed', 'discontinued'].map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving} data-testid="save-intervention-detail-btn"
              className="flex-1 py-3 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterventionsPage() {
  const navigate = useNavigate();
  const [interventions, setInterventions] = useState([]);
  const { settings } = useSettings();
  const interventionTypes = (settings.intervention_types?.length ? settings.intervention_types : INTERVENTION_TYPES);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    student_id: '', intervention_type: '', assigned_staff: '',
    start_date: '', review_date: '', goals: '', rationale: '', frequency: '', status: 'active', progress_notes: ''
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [intRes, studRes] = await Promise.all([
          axios.get(`${API}/interventions`, { withCredentials: true }),
          axios.get(`${API}/students/summary`, { withCredentials: true }),
        ]);
        setInterventions(intRes.data);
        setStudents(studRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const getStudentName = (sid) => {
    const s = students.find(x => x.student_id === sid);
    return s ? studentDisplayName(s) : sid;
  };

  const getStudentTier = (sid) => students.find(x => x.student_id === sid)?.mtss_tier;

  const filtered = interventions.filter(i => {
    const matchStatus = !filterStatus || i.status === filterStatus;
    const matchType = !filterType || i.intervention_type === filterType;
    return matchStatus && matchType;
  });

  const saveIntervention = async () => {
    if (!form.student_id || !form.intervention_type || !form.assigned_staff) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API}/interventions`, form, { withCredentials: true });
      setInterventions(prev => [res.data, ...prev]);
      setShowAdd(false);
      setForm({ student_id: '', intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', rationale: '', frequency: '', status: 'active', progress_notes: '' });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdated = (updated) => {
    setInterventions(prev => prev.map(i => i.intervention_id === updated.intervention_id ? updated : i));
  };

  const intTypes = [...new Set(interventions.map(i => i.intervention_type))];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Target size={28} className="text-slate-600" /> Interventions
          </h1>
          <p className="text-slate-500 mt-1">{interventions.filter(i => i.status === 'active').length} active interventions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportInterventionsReport(interventions, students)} data-testid="export-interventions-btn"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Export PDF
          </button>
          <button onClick={() => setShowAdd(true)} data-testid="new-intervention-btn"
            className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
            <Plus size={16} /> New Intervention
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
          {[['', 'All'], ['active', 'Active'], ['completed', 'Completed']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filterStatus === val ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
          <option value="">All Types</option>
          {intTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">Click any row to view and edit details</p>

      {/* Interventions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Target size={40} className="mx-auto mb-3 opacity-30" />
            <p>No interventions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Student', 'Type', 'Staff', 'Start', 'Review', 'Status'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(intv => {
                  const tier = getStudentTier(intv.student_id);
                  const tc = getTierColors(tier);
                  return (
                    <tr key={intv.intervention_id}
                      data-testid={`intervention-row-${intv.intervention_id}`}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setDetailIntv(intv)}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {tier && <span className={`w-2 h-2 rounded-full ${tc.dot} shrink-0`} />}
                          <span className="font-medium text-slate-900">{getStudentName(intv.student_id)}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium">{intv.intervention_type}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">{intv.assigned_staff}</td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs">{intv.start_date}</td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs">{intv.review_date}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : intv.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                          {intv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailIntv && (
        <InterventionDetailModal
          intv={detailIntv}
          students={students}
          onClose={() => setDetailIntv(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>New Intervention</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Student</label>
                <select value={form.student_id} onChange={e => setForm(p => ({...p, student_id: e.target.value}))}
                  data-testid="intervention-student-select"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white">
                  <option value="">Select Student</option>
                  {students.map(s => <option key={s.student_id} value={s.student_id}>{studentDisplayName(s)} — {s.class_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Intervention Type</label>
                <input
                  list="intervention-type-options"
                  value={form.intervention_type}
                  onChange={e => setForm(p => ({...p, intervention_type: e.target.value}))}
                  placeholder="Select or type intervention type"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white"
                />
                <datalist id="intervention-type-options">
                  {interventionTypes.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <input placeholder="Assigned Staff" value={form.assigned_staff} onChange={e => setForm(p => ({...p, assigned_staff: e.target.value}))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none" />
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none" /></div>
                <div><label className="text-xs text-slate-400 block mb-1">Review Date</label>
                  <input type="date" value={form.review_date} onChange={e => setForm(p => ({...p, review_date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none" /></div>
              </div>
              <input placeholder="Frequency (e.g. Weekly, 3x per week)" value={form.frequency} onChange={e => setForm(p => ({...p, frequency: e.target.value}))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none" />
              <textarea placeholder="Reason for intervention" rows={2} value={form.rationale} onChange={e => setForm(p => ({...p, rationale: e.target.value}))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
              <textarea placeholder="Goals" rows={3} value={form.goals} onChange={e => setForm(p => ({...p, goals: e.target.value}))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
              <textarea placeholder="Initial progress notes (optional)" rows={2} value={form.progress_notes} onChange={e => setForm(p => ({...p, progress_notes: e.target.value}))}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveIntervention} disabled={saving} data-testid="save-intervention-btn"
                className="flex-1 py-3 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
                {saving ? 'Saving...' : 'Save Intervention'}
              </button>
              <button onClick={() => setShowAdd(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
