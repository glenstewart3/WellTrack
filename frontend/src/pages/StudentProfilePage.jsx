import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { getTierColors, getRiskColors, INTERVENTION_TYPES, NOTE_TYPES } from '../utils/tierUtils';
import { ArrowLeft, Plus, X, Loader, Edit2, Check, Sparkles, Trash2, AlertTriangle, Stethoscope } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine, Legend
} from 'recharts';
import { exportStudentProfile } from '../utils/pdfExport';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { todayLocal } from '../utils/dateFmt';

function TierBadge({ tier }) {
  const c = getTierColors(tier);
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${c.badge}`}>Tier {tier}</span>;
}

// Inline editable intervention card
function InlineEditIntervention({ intv, interventionTypes, onSave, onDelete, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...intv });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(intv.intervention_id, { progress_notes: form.progress_notes, status: form.status, goals: form.goals, rationale: form.rationale });
      setEditing(false);
    } catch (e) {
      console.error('Failed to save intervention:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-5 transition-all ${editing ? 'border-indigo-300 ring-2 ring-indigo-100' : intv.status === 'active' ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{intv.intervention_type}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : intv.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {form.status}
          </span>
          {!editing && canDelete && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} data-testid={`delete-intervention-${intv.intervention_id}`}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} data-testid={`edit-intervention-${intv.intervention_id}`}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-rose-700 flex-1">Delete this intervention?</span>
          <button onClick={() => onDelete(intv.intervention_id)} className="text-xs font-semibold text-rose-700 hover:text-rose-900">Delete</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600 mb-3">
        <div><span className="text-slate-400">Staff:</span> {intv.assigned_staff}</div>
        <div><span className="text-slate-400">Frequency:</span> {intv.frequency || '—'}</div>
        <div><span className="text-slate-400">Review:</span> {intv.review_date}</div>
      </div>
      {editing ? (
        <div className="space-y-3 mt-3">
          <textarea rows={2} value={form.rationale} onChange={e => setForm(p => ({...p, rationale: e.target.value}))}
            placeholder="Reason for intervention..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
          <textarea rows={3} value={form.goals} onChange={e => setForm(p => ({...p, goals: e.target.value}))}
            placeholder="Goals..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
          <textarea rows={3} value={form.progress_notes} onChange={e => setForm(p => ({...p, progress_notes: e.target.value}))}
            placeholder="Progress notes..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
          <div className="flex gap-2">
            {['active', 'completed', 'discontinued'].map(s => (
              <button key={s} onClick={() => setForm(p => ({...p, status: s}))}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${form.status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => { setEditing(false); setForm({...intv}); }}
              className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {form.rationale && <p className="text-sm text-slate-600 mb-1"><span className="font-medium">Reason:</span> {form.rationale}</p>}
          {form.goals && <p className="text-sm text-slate-600 mb-1"><span className="font-medium">Goals:</span> {form.goals}</p>}
          {form.progress_notes && <p className="text-sm text-slate-500 italic">{form.progress_notes}</p>}
          <p className="text-xs text-slate-300 mt-2">Click edit to update notes or status</p>
        </>
      )}
    </div>
  );
}

// Inline editable case note card
function InlineEditNote({ note, onSave, onDelete, canDelete }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(note.notes || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(note.case_id, { notes });
      setEditing(false);
    } catch (e) {
      console.error('Failed to save note:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-5 transition-all ${editing ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">{note.note_type}</span>
          <span className="text-sm font-medium text-slate-900">{note.staff_member}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{note.date}</span>
          {!editing && canDelete && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} data-testid={`delete-note-${note.case_id}`}
              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          {!editing && (
            <button onClick={() => setEditing(true)} data-testid={`edit-note-${note.case_id}`}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>
      {confirmDelete && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
          <span className="text-xs text-rose-700 flex-1">Delete this case note?</span>
          <button onClick={() => onDelete(note.case_id)} className="text-xs font-semibold text-rose-700 hover:text-rose-900">Delete</button>
          <button onClick={() => setConfirmDelete(false)} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      )}
      {editing ? (
        <div className="space-y-2">
          <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 py-2 text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {saving ? <Loader size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => { setEditing(false); setNotes(note.notes || ''); }}
              className="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-700 leading-relaxed">{notes}</p>
          <p className="text-xs text-slate-300 mt-2">Click edit to update this note</p>
        </>
      )}
    </div>
  );
}

export default function StudentProfilePage() {
  const { settings } = useSettings();
  const { canDo } = usePermissions();
  const customFields = settings.custom_student_fields || [];
  const interventionTypes = settings.intervention_types?.length ? settings.intervention_types : INTERVENTION_TYPES;
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  useDocumentTitle(profile?.student ? `${profile.student.first_name} ${profile.student.last_name}` : 'Student Profile');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [saebrsView, setSaebrsView] = useState('total'); // 'total' or 'domains'
  const [newIntervention, setNewIntervention] = useState({ intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', rationale: '', frequency: '', status: 'active' });
  const [newNote, setNewNote] = useState({ note_type: 'General', notes: '', staff_member: '', date: todayLocal() });
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [professionals, setProfessionals] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/students/${studentId}/profile`);
        setProfile(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [studentId]);

  const fetchAttendance = async () => {
    if (attendanceData || attendanceLoading) return;
    setAttendanceLoading(true);
    try {
      const res = await api.get(`/attendance/student/${studentId}?term=all`);
      setAttendanceData(res.data);
    } catch { /* no attendance data yet */ }
    finally { setAttendanceLoading(false); }
  };

  const fetchSessions = async () => {
    if (sessions || sessionsLoading) return;
    setSessionsLoading(true);
    try {
      const res = await api.get(`/appointments/student/${studentId}`);
      setSessions(res.data || []);
    } catch { setSessions([]); }
    finally { setSessionsLoading(false); }
  };

  const fetchProfessionals = async () => {
    if (professionals.length) return;
    try {
      const res = await api.get('/appointments/professionals');
      setProfessionals(res.data || []);
    } catch { /* not critical */ }
  };

  const getAiSuggestions = async () => {    setAiLoading(true);
    setAiError('');
    setAiSuggestions(null);
    setShowAiPanel(true);
    try {
      const res = await api.post(`/interventions/ai-suggest/${studentId}`, {});
      setAiSuggestions(res.data.recommendations || []);
    } catch (e) {
      setAiError(e.response?.data?.detail || 'Failed to get suggestions');
    } finally { setAiLoading(false); }
  };

  const editIntervention = async (id, patch) => {
    try {
      await api.put(`/interventions/${id}`, patch);
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const deleteIntervention = async (id) => {
    try {
      await api.delete(`/interventions/${id}`);
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const editCaseNote = async (id, patch) => {
    try {
      await api.put(`/case-notes/${id}`, patch);
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const deleteCaseNote = async (id) => {
    try {
      await api.delete(`/case-notes/${id}`);
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const addIntervention = async () => {
    if (!newIntervention.intervention_type || !newIntervention.assigned_staff) return;
    try {
      await api.post('/interventions', { ...newIntervention, student_id: studentId });
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
      setShowAddIntervention(false);
      setNewIntervention({ intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', frequency: '', status: 'active' });
    } catch (e) { console.error(e); }
  };

  const addNote = async () => {
    if (!newNote.notes || !newNote.staff_member) return;
    try {
      await api.post('/case-notes', { ...newNote, student_id: studentId });
      const res = await api.get(`/students/${studentId}/profile`);
      setProfile(res.data);
      setShowAddNote(false);
      setNewNote({ note_type: 'General', notes: '', staff_member: '', date: todayLocal() });
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8"><div className="h-64 bg-white rounded-xl animate-pulse border border-slate-200" /></div>;
  if (!profile) return <div className="p-8 text-slate-500">Student not found</div>;

  const { student, mtss_tier, attendance_pct, saebrs_results, self_report_results, interventions, case_notes, alerts } = profile;
  const tierColors = getTierColors(mtss_tier);
  const latestSaebrs = saebrs_results?.slice(-1)[0];
  const latestPlus = self_report_results?.slice(-1)[0];

  // Chart data
  const screeningChartData = saebrs_results?.map((r, i) => ({
    name: r.screening_period || `Term ${i + 1}`, total: r.total_score, social: r.social_score, academic: r.academic_score, emotional: r.emotional_score
  })) || [];

  const wellbeingChartData = self_report_results?.map((r, i) => ({
    name: r.screening_period || `Term ${i + 1}`, total: r.wellbeing_total, social: r.social_domain, academic: r.academic_domain
  })) || [];

  // Radar: include attendance domain
  // Attendance: 0-10 scale aligned with 3 tiers
  // Tier 1 (≥95%): 8-10 | Tier 2 (90-95%): 5-7 | Tier 3 (<90%): 0-4
  const attPct = attendance_pct || 0;
  const attScore = attPct >= 95
    ? Math.round(8 + (attPct - 95) / 5 * 2)
    : attPct >= 90
    ? Math.round(5 + (attPct - 90) / 5 * 2)
    : Math.round((attPct / 90) * 4);

  const radarUsingSaebrs = !latestPlus && !!latestSaebrs;

  const radarData = [
    {
      domain: 'Social',
      score: latestPlus?.social_domain ?? (latestSaebrs?.social_score ?? 0),
      max: 18,
    },
    {
      domain: 'Academic',
      score: latestPlus?.academic_domain ?? (latestSaebrs?.academic_score ?? 0),
      max: 18,
    },
    {
      domain: 'Emotional',
      score: latestPlus?.emotional_domain ?? (latestSaebrs?.emotional_score ?? 0),
      max: latestPlus ? 9 : (latestSaebrs ? 21 : 9),
    },
    { domain: 'Belonging', score: latestPlus?.belonging_domain ?? 0, max: 12 },
    { domain: 'Attendance', score: Math.min(10, attScore), max: 10 },
  ].map(d => ({ ...d, pct: Math.round((d.score / d.max) * 100) }));

  // Alert checks: use the active screening period so a student with old data
  // still gets flagged if they haven't been screened in the current period.
  const activePeriod = settings?.active_screening_period || '';
  const saebrsForPeriod = activePeriod
    ? (saebrs_results || []).find(r => r.screening_period === activePeriod)
    : latestSaebrs;
  const selfReportForPeriod = activePeriod
    ? (self_report_results || []).find(r => r.screening_period === activePeriod)
    : latestPlus;
  const periodLabel = activePeriod ? ` for ${activePeriod}` : '';

  const radarAlerts = [
    !saebrsForPeriod
      ? `SAEBRS Screener not yet completed${periodLabel}.`
      : null,
    !selfReportForPeriod
      ? (radarUsingSaebrs
          ? `Student Self-Report not yet completed${periodLabel} — showing most recent SAEBRS scores for Social, Academic & Emotional. Belonging shows as 0.`
          : `Student Self-Report not yet completed${periodLabel} — Social, Academic, Emotional & Belonging domains show as 0.`)
      : null,
    attendance_pct == null
      ? 'No attendance data recorded — Attendance domain shows as 0.'
      : null,
  ].filter(Boolean);

  // Display name with optional preferred name
  const displayName = `${student.first_name}${student.preferred_name && student.preferred_name !== student.first_name ? ` (${student.preferred_name})` : ''} ${student.last_name}`;

  return (
    <div className="p-6 lg:p-8 fade-in">
      {/* Header */}
      <button onClick={() => navigate('/students')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Students
      </button>

      <div className={`bg-white border ${tierColors.border} rounded-xl p-6 mb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className={`w-24 h-24 ${tierColors.bg} rounded-full flex items-center justify-center overflow-hidden shrink-0`}>
              {student.photo_url
                ? <img src={`${process.env.REACT_APP_BACKEND_URL}${student.photo_url}`} alt={displayName} className="w-full h-full object-cover rounded-full" />
                : <span className={`text-2xl font-bold ${tierColors.text}`}>{student.first_name[0]}{student.last_name[0]}</span>
              }
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{displayName}</h1>
              <p className="text-slate-500 text-sm">{student.year_level} · {student.class_name} · {student.teacher}{student.gender ? ` · ${student.gender}` : ''}</p>
              {/* EAL / Aboriginal / NCCD tags */}
              {(student.eal_status && student.eal_status !== 'Not EAL') || student.aboriginal_status === 'Aboriginal' || (student.nccd_disability && student.nccd_disability !== 'No') ? (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {student.eal_status && student.eal_status !== 'Not EAL' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                      {student.eal_status.includes('< 5') ? 'EAL <5yr' : student.eal_status.includes('>=5') ? 'EAL 5-7yr' : student.eal_status.includes('Fee') ? 'EAL Fee Paying' : student.eal_status}
                    </span>
                  )}
                  {student.aboriginal_status === 'Aboriginal' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">Aboriginal</span>
                  )}
                  {student.nccd_disability && student.nccd_disability !== 'No' && (() => {
                    const m = student.nccd_disability.match(/Yes.*?-\s*(.+)/);
                    if (!m) return null;
                    const parts = m[1].split(',').map(s => s.trim());
                    const level = parts[0], category = parts.slice(1).join(', ');
                    const color = level.includes('Extensive') ? 'bg-red-100 text-red-700' : level.includes('Substantial') ? 'bg-orange-100 text-orange-700' : level.includes('Supplementary') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
                    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>NCCD: {level}{category ? ` · ${category}` : ''}</span>;
                  })()}
                </div>
              ) : null}
              {alerts?.length > 0 && (
                <p className="text-xs text-rose-600 font-medium mt-1">{alerts.length} active alert{alerts.length > 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {mtss_tier && <TierBadge tier={mtss_tier} />}
            <div className="text-right">
              <p className={`text-lg font-bold ${attendance_pct < 80 ? 'text-rose-600' : attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{attendance_pct}%</p>
              <p className="text-xs text-slate-400">Attendance</p>
            </div>
            <button onClick={async () => { await exportStudentProfile(profile); }} data-testid="export-profile-pdf-btn"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors">
              Export PDF
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          {[
            { label: 'SAEBRS Total', value: latestSaebrs ? `${latestSaebrs.total_score}/57` : '—', sub: latestSaebrs?.risk_level },
            { label: 'Wellbeing Score', value: latestPlus ? `${latestPlus.wellbeing_total}/66` : '—', sub: latestPlus ? `Tier ${latestPlus.wellbeing_tier}` : '—' },
            { label: 'Active Interventions', value: interventions?.filter(i => i.status === 'active').length || 0 },
            { label: 'Case Notes', value: case_notes?.length || 0 },
          ].map(stat => (
            <div key={stat.label}>
              <p className="text-xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              {stat.sub && <p className="text-xs font-medium text-slate-500">{stat.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-6 overflow-x-auto">
        {[['overview', 'Overview'], ['attendance', 'Attendance'], ['screening', 'Screening History'], ['interventions', 'Interventions'], ['notes', 'Case Notes'], ['sessions', 'Sessions']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              if (key === 'attendance') fetchAttendance();
              if (key === 'sessions') fetchSessions();
              if (key === 'interventions') fetchProfessionals();
            }}
            data-testid={`tab-${key}`}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SAEBRS Trend */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>SAEBRS Score Trend</h3>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                <button onClick={() => setSaebrsView('total')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${saebrsView === 'total' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  Total
                </button>
                <button onClick={() => setSaebrsView('domains')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${saebrsView === 'domains' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  Domains
                </button>
              </div>
            </div>
            {screeningChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                {saebrsView === 'total' ? (
                  <LineChart data={screeningChartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 57]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <ReferenceArea y1={37} y2={57} fill="#10b981" fillOpacity={0.12} label={{ value: "Tier 1", position: "insideTopRight", fontSize: 9, fill: "#10b981" }} />
                    <ReferenceArea y1={24} y2={37} fill="#f59e0b" fillOpacity={0.12} label={{ value: "Tier 2", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }} />
                    <ReferenceArea y1={0} y2={24} fill="#ef4444" fillOpacity={0.12} label={{ value: "Tier 3", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }} />
                    <Line type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 5 }} name="Total (0–57)" />
                  </LineChart>
                ) : (
                  <LineChart data={screeningChartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 21]} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="social" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Social (0–18)" />
                    <Line type="monotone" dataKey="academic" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="Academic (0–18)" />
                    <Line type="monotone" dataKey="emotional" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="Emotional (0–21)" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : <p className="text-sm text-slate-400 py-8 text-center">No screening data available</p>}
          </div>

          {/* Wellbeing Radar */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-3" style={{fontFamily:'Manrope,sans-serif'}}>Wellbeing Domain Profile</h3>
            {radarAlerts.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-4">
                {radarAlerts.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="pct" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                <Tooltip formatter={(v) => [`${v}%`, 'Score']} contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {radarData.map(d => (
                <div key={d.domain} className="text-center">
                  <p className="text-sm font-bold text-slate-900">{d.score}<span className="text-xs text-slate-400">/{d.max}</span></p>
                  <p className="text-xs text-slate-400">{d.domain}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SAEBRS detail */}
          {latestSaebrs && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>Latest SAEBRS Results</h3>
              <div className="space-y-3">
                {[
                  { label: 'Social Behavior', score: latestSaebrs.social_score, max: 18, risk: latestSaebrs.social_risk },
                  { label: 'Academic Behavior', score: latestSaebrs.academic_score, max: 18, risk: latestSaebrs.academic_risk },
                  { label: 'Emotional Behavior', score: latestSaebrs.emotional_score, max: 21, risk: latestSaebrs.emotional_risk },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-slate-700">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.score}/{item.max}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskColors(item.risk)}`}>{item.risk}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${item.risk === 'High Risk' ? 'bg-rose-500' : item.risk === 'Some Risk' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${(item.score / item.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Total Score</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{latestSaebrs.total_score}/57</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskColors(latestSaebrs.risk_level)}`}>{latestSaebrs.risk_level}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Alerts */}
          {alerts?.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
              <h3 className="font-semibold text-rose-900 mb-3" style={{fontFamily:'Manrope,sans-serif'}}>Active Alerts</h3>
              <div className="space-y-2">
                {alerts.map(a => (
                  <div key={a.alert_id} className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                    <p className="text-sm text-rose-800">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Student Fields */}
          {customFields.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>Additional Information</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {customFields.map(f => (
                  <div key={f.id}>
                    <p className="text-xs text-slate-400 mb-0.5">{f.label}</p>
                    <p className="text-sm font-medium text-slate-700">
                      {profile?.student?.custom_fields?.[f.id] || <span className="text-slate-300 italic">Not set</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-5">
          {attendanceLoading && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader size={20} className="animate-spin mr-2" /> Loading attendance data…
            </div>
          )}
          {!attendanceLoading && !attendanceData && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <p>No attendance data recorded for this student.</p>
            </div>
          )}
          {attendanceData && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Attendance Rate', value: `${attendanceData.attendance_pct}%`, color: attendanceData.attendance_pct >= 95 ? 'text-emerald-600' : attendanceData.attendance_pct >= 90 ? 'text-amber-600' : 'text-rose-600' },
                  { label: 'Days Absent', value: attendanceData.absent_days },
                  { label: 'School Days', value: attendanceData.total_days },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${s.color || 'text-slate-900'}`}>{s.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Monthly trend chart */}
              {attendanceData.monthly_trend?.length > 1 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4">Monthly Attendance Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart
                      data={attendanceData.monthly_trend.map(d => ({ ...d, attendance_pct: Math.max(70, d.attendance_pct) }))}
                      margin={{ left: -10, right: 10 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} unit="%" tickCount={7} />
                      <Tooltip
                        formatter={(v, _, props) => {
                          const raw = attendanceData.monthly_trend.find(d => d.label === props?.payload?.label)?.attendance_pct;
                          return [`${raw != null ? raw : v}%`, 'Attendance'];
                        }}
                        contentStyle={{ borderRadius: '0.5rem', fontSize: '12px' }}
                      />
                      <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 2" label={{ value: '95%', position: 'insideTopRight', fontSize: 9, fill: '#10b981' }} />
                      <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '90%', position: 'insideTopRight', fontSize: 9, fill: '#f59e0b' }} />
                      <Line type="monotone" dataKey="attendance_pct" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Absence type breakdown */}
              {Object.keys(attendanceData.absence_types || {}).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Absence Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(attendanceData.absence_types).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-lg text-xs">
                        <span className="text-slate-600 truncate mr-2">{type}</span>
                        <span className="font-semibold text-slate-900 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual absence records */}
              {(() => {
                const excluded = new Set((attendanceData.excluded_absence_types || []).map(t => t.toLowerCase()));
                const absences = (attendanceData.records || []).filter(r => {
                  const am = (r.am_status || '').trim();
                  const pm = (r.pm_status || '').trim();
                  const amCounts = am && am.toLowerCase() !== 'present' && !excluded.has(am.toLowerCase());
                  const pmCounts = pm && pm.toLowerCase() !== 'present' && !excluded.has(pm.toLowerCase());
                  return amCounts || pmCounts;
                }).sort((a, b) => b.date.localeCompare(a.date));
                if (!absences.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Absence Records <span className="text-slate-400 font-normal">({absences.length})</span></h4>
                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                      {absences.map((r, i) => (
                        <div key={i} className="flex items-center gap-4 py-1.5 px-3 bg-slate-50 rounded-lg text-xs">
                          <span className="font-medium text-slate-700 w-24 shrink-0">{r.date}</span>
                          <span className="text-slate-500 flex-1">AM: <span className="font-medium text-slate-700">{r.am_status || '—'}</span></span>
                          <span className="text-slate-500 flex-1">PM: <span className="font-medium text-slate-700">{r.pm_status || '—'}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {activeTab === 'screening' && (
        <div className="space-y-6">
          {saebrs_results?.length === 0 && self_report_results?.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <p>No screening data recorded</p>
            </div>
          ) : (
            <>
              {/* SAEBRS Trend Chart */}
              {saebrs_results?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6" data-testid="saebrs-trend-chart">
                  <h3 className="font-semibold text-slate-900 mb-0.5" style={{fontFamily:'Manrope,sans-serif'}}>SAEBRS Score Trend</h3>
                  <p className="text-xs text-slate-400 mb-4">Green zone = Tier 1 (&gt;37) · Amber = Tier 2 (24–37) · Red = Tier 3 (&lt;24)</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={screeningChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 57]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <ReferenceArea y1={37} y2={57} fill="#10b981" fillOpacity={0.08} />
                      <ReferenceArea y1={24} y2={37} fill="#f59e0b" fillOpacity={0.08} />
                      <ReferenceArea y1={0} y2={24} fill="#ef4444" fillOpacity={0.08} />
                      <Line type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 5 }} name="Total (0–57)" />
                      <Line type="monotone" dataKey="social" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="Social (0–18)" />
                      <Line type="monotone" dataKey="academic" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="Academic (0–18)" />
                      <Line type="monotone" dataKey="emotional" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="Emotional (0–21)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Domain comparison across screenings — only if 2+ */}
              {saebrs_results?.length >= 2 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6" data-testid="domain-comparison-chart">
                  <h3 className="font-semibold text-slate-900 mb-0.5" style={{fontFamily:'Manrope,sans-serif'}}>Domain Comparison</h3>
                  <p className="text-xs text-slate-400 mb-4">Side-by-side domain scores across each screening</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart layout="vertical" data={[
                      { domain: 'Social (/18)', ...Object.fromEntries(saebrs_results.map((r, i) => [`S${i + 1}`, r.social_score])) },
                      { domain: 'Academic (/18)', ...Object.fromEntries(saebrs_results.map((r, i) => [`S${i + 1}`, r.academic_score])) },
                      { domain: 'Emotional (/21)', ...Object.fromEntries(saebrs_results.map((r, i) => [`S${i + 1}`, r.emotional_score])) },
                    ]} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="domain" type="category" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {saebrs_results.map((_, i) => (
                        <Bar key={i} dataKey={`S${i + 1}`} name={`Screening ${i + 1}`}
                          fill={['#6366f1', '#3b82f6', '#06b6d4', '#8b5cf6'][i % 4]}
                          radius={[0, 4, 4, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Wellbeing trend */}
              {self_report_results?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6" data-testid="wellbeing-trend-chart">
                  <h3 className="font-semibold text-slate-900 mb-0.5" style={{fontFamily:'Manrope,sans-serif'}}>Student Wellbeing Trend</h3>
                  <p className="text-xs text-slate-400 mb-4">Self-reported wellbeing over time — higher score = better wellbeing</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={wellbeingChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 66]} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 5 }} name="Total (0–66)" />
                      <Line type="monotone" dataKey="social" stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="Social (0–18)" />
                      <Line type="monotone" dataKey="academic" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 3 }} strokeDasharray="4 2" name="Academic (0–18)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Individual screening cards with change indicator */}
              {saebrs_results?.map((r, i) => {
                const plus = self_report_results?.[i];
                const prev = i > 0 ? saebrs_results[i - 1] : null;
                const change = prev !== null ? r.total_score - prev.total_score : null;
                return (
                  <div key={r.result_id || i} className="bg-white border border-slate-200 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Screening {i + 1}</h3>
                        <p className="text-xs text-slate-400">{r.created_at?.split('T')[0]}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {change !== null && (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${change > 0 ? 'bg-emerald-100 text-emerald-700' : change < 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                            {change > 0 ? '+' : ''}{change} pts
                          </span>
                        )}
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRiskColors(r.risk_level)}`}>{r.risk_level}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div><p className="font-bold text-slate-900">{r.total_score}/57</p><p className="text-slate-400 text-xs">Total SAEBRS</p></div>
                      <div><p className="font-bold text-slate-900">{r.social_score}/18</p><p className="text-slate-400 text-xs">Social</p></div>
                      <div><p className="font-bold text-slate-900">{r.academic_score}/18</p><p className="text-slate-400 text-xs">Academic</p></div>
                      <div><p className="font-bold text-slate-900">{r.emotional_score}/21</p><p className="text-slate-400 text-xs">Emotional</p></div>
                      {plus && <>
                        <div><p className="font-bold text-indigo-700">{plus.wellbeing_total}/66</p><p className="text-slate-400 text-xs">Wellbeing Total</p></div>
                        <div><p className="font-bold text-slate-900">{plus.social_domain}/18</p><p className="text-slate-400 text-xs">Social WB</p></div>
                        <div><p className="font-bold text-slate-900">{plus.belonging_domain}/12</p><p className="text-slate-400 text-xs">Belonging</p></div>
                        <div><p className="font-bold text-slate-900">{plus.emotional_domain}/9</p><p className="text-slate-400 text-xs">Emotional WB</p></div>
                      </>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {activeTab === 'interventions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{interventions?.length || 0} intervention{interventions?.length !== 1 ? 's' : ''} recorded</p>
            <div className="flex gap-2">
              {settings?.ai_suggestions_enabled !== false && canDo('interventions.ai_suggest') && (
                <button onClick={getAiSuggestions} disabled={aiLoading} data-testid="get-ai-suggestions-btn"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-60">
                  {aiLoading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {aiLoading ? 'Generating…' : 'AI Suggestions'}
                </button>
              )}
              {canDo('interventions.add_edit') && (
                <button onClick={() => { setShowAddIntervention(true); fetchProfessionals(); }} data-testid="add-intervention-btn"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                  <Plus size={14} /> Add Intervention
                </button>
              )}
            </div>
          </div>

          {/* AI Suggestions Panel */}
          {showAiPanel && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-sm font-semibold text-indigo-800">AI Intervention Suggestions</p>
                <button onClick={() => setShowAiPanel(false)} className="text-indigo-400 hover:text-indigo-600"><X size={15} /></button>
              </div>
              {aiLoading && <div className="flex flex-col items-center gap-2 text-sm text-indigo-600 py-6"><Loader size={16} className="animate-spin" /> <span>Generating suggestions...</span><span className="text-xs text-slate-400 font-normal">This may take 30 seconds to a minute</span></div>}
              {aiError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">{aiError}</p>}
              {aiSuggestions && (
                <div className="grid sm:grid-cols-3 gap-3">
                  {aiSuggestions.map((rec, i) => {
                    const title = rec.type || rec.intervention_type || rec.name || rec.title || `Suggestion ${i + 1}`;
                    const rationale = rec.rationale || rec.reason || rec.description || '';
                    const goals = rec.goals || rec.goal || rec.objectives || rec.objective || '';
                    const priority = rec.priority || 'medium';
                    return (
                    <div key={i} className="bg-white rounded-xl p-4 border border-indigo-100 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug pr-2">{title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${priority === 'high' ? 'bg-rose-100 text-rose-700' : priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {priority}
                        </span>
                      </div>
                      {rationale && <p className="text-xs text-slate-600 mb-2 leading-relaxed">{rationale}</p>}
                      {goals && (
                        <p className="text-xs text-slate-700 mb-2"><span className="font-semibold">Goal:</span> {goals}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-auto">{[rec.frequency, rec.timeline].filter(Boolean).join(' · ')}</p>
                      <button
                        onClick={() => {
                          setNewIntervention(p => ({
                            ...p,
                            intervention_type: title,
                            goals: goals,
                            rationale: rationale,
                            frequency: rec.frequency || '',
                          }));
                          setShowAddIntervention(true);
                        }}
                        className="mt-3 w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium text-left">
                        Use this recommendation →
                      </button>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {interventions?.map(intv => (
            <InlineEditIntervention key={intv.intervention_id} intv={intv} interventionTypes={interventionTypes} onSave={editIntervention} onDelete={deleteIntervention} canDelete={canDo('interventions.delete')} />
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canDo('case_notes.add_edit') && (
              <button onClick={() => setShowAddNote(true)} data-testid="add-note-btn"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                <Plus size={14} /> Add Case Note
              </button>
            )}
          </div>
          {case_notes?.map(note => (
            <InlineEditNote key={note.case_id} note={note} onSave={editCaseNote} onDelete={deleteCaseNote} canDelete={canDo('case_notes.delete')} />
          ))}
          {case_notes?.length === 0 && <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">No case notes recorded</div>}
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessionsLoading && (
            <div className="py-16 text-center text-slate-400">
              <Loader size={20} className="animate-spin mx-auto mb-2" />
              Loading sessions…
            </div>
          )}
          {!sessionsLoading && sessions !== null && sessions.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <Stethoscope size={28} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No appointment sessions recorded for this student</p>
              <p className="text-xs mt-1 text-slate-300">Sessions logged in Appointments will appear here</p>
            </div>
          )}
          {sessions?.map((s, idx) => {
            const statusColors = {
              completed: 'bg-emerald-100 text-emerald-700',
              dna: 'bg-rose-100 text-rose-700',
              scheduled: 'bg-blue-100 text-blue-700',
              cancelled: 'bg-slate-100 text-slate-500',
            };
            return (
              <div key={s.appointment_id || idx} className="bg-white border border-slate-200 rounded-xl p-5"
                data-testid={`session-entry-${s.appointment_id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{s.intervention_type}</span>
                      {s.session_type && <span className="text-xs text-slate-500">· {s.session_type}</span>}
                      {s.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status?.toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>
                          {s.status}
                        </span>
                      )}
                      {s.flags?.length > 0 && s.flags.map(f => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 font-medium">{f}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>{s.date}{s.time ? ` at ${s.time}` : ''}</span>
                      {s.room && <span>· {s.room}</span>}
                      {s.professional_name_fallback && <span>· {s.professional_name_fallback}</span>}
                    </div>
                    {s.reason_for_visit && (
                      <p className="text-sm text-slate-600 mt-2"><span className="font-medium">Reason:</span> {s.reason_for_visit}</p>
                    )}
                    {s.session_notes && (
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{s.session_notes}</p>
                    )}
                    {s.outcome_rating && (
                      <p className="text-xs text-slate-500 mt-2">Outcome: <span className="font-medium text-slate-700">{s.outcome_rating}</span></p>
                    )}
                    {s.follow_up_date && (
                      <p className="text-xs text-amber-600 mt-1">Follow-up: {s.follow_up_date}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">{idx === 0 ? 'Latest' : `#${sessions.length - idx}`}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Intervention Modal */}
      {showAddIntervention && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Add Intervention</h3>
              <button onClick={() => setShowAddIntervention(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                list="profile-intervention-types"
                value={newIntervention.intervention_type}
                onChange={e => setNewIntervention(p => ({...p, intervention_type: e.target.value}))}
                placeholder="Select or type intervention type"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
              <datalist id="profile-intervention-types">
                {INTERVENTION_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
              {professionals.length > 0 ? (
                <select value={newIntervention.assigned_staff} onChange={e => setNewIntervention(p => ({...p, assigned_staff: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white">
                  <option value="">Select Assigned Staff…</option>
                  {professionals.map(p => (
                    <option key={p.user_id} value={p.name}>{p.name}{p.professional_type ? ` — ${p.professional_type}` : ''}</option>
                  ))}
                </select>
              ) : (
                <input placeholder="Assigned Staff" value={newIntervention.assigned_staff} onChange={e => setNewIntervention(p => ({...p, assigned_staff: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 block mb-1">Start Date</label>
                  <input type="date" value={newIntervention.start_date} onChange={e => setNewIntervention(p => ({...p, start_date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" /></div>
                <div><label className="text-xs text-slate-400 block mb-1">Review Date</label>
                  <input type="date" value={newIntervention.review_date} onChange={e => setNewIntervention(p => ({...p, review_date: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" /></div>
              </div>
              <input placeholder="Frequency (e.g. Weekly)" value={newIntervention.frequency} onChange={e => setNewIntervention(p => ({...p, frequency: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              <textarea placeholder="Reason for intervention" rows={2} value={newIntervention.rationale} onChange={e => setNewIntervention(p => ({...p, rationale: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
              <textarea placeholder="Goals" rows={3} value={newIntervention.goals} onChange={e => setNewIntervention(p => ({...p, goals: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addIntervention} className="flex-1 bg-slate-900 text-white py-2 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">Save</button>
              <button onClick={() => setShowAddIntervention(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Add Case Note</h3>
              <button onClick={() => setShowAddNote(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={newNote.note_type} onChange={e => setNewNote(p => ({...p, note_type: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20">
                {NOTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Staff Member" value={newNote.staff_member} onChange={e => setNewNote(p => ({...p, staff_member: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              <input type="date" value={newNote.date} onChange={e => setNewNote(p => ({...p, date: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              <textarea placeholder="Note details..." rows={4} value={newNote.notes} onChange={e => setNewNote(p => ({...p, notes: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={addNote} className="flex-1 bg-slate-900 text-white py-2 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">Save</button>
              <button onClick={() => setShowAddNote(false)} className="flex-1 bg-slate-100 text-slate-700 py-2 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}