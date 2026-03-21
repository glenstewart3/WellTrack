import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getTierColors, getRiskColors, INTERVENTION_TYPES, NOTE_TYPES } from '../utils/tierUtils';
import { ArrowLeft, Plus, X, Loader, Edit2, Check } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, Legend
} from 'recharts';
import { exportStudentProfile } from '../utils/pdfExport';

function TierBadge({ tier }) {
  const c = getTierColors(tier);
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${c.badge}`}>Tier {tier}</span>;
}

// Inline editable intervention card
function InlineEditIntervention({ intv, interventionTypes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...intv });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(intv.intervention_id, { progress_notes: form.progress_notes, status: form.status, goals: form.goals });
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className={`bg-white border rounded-xl p-5 transition-all ${editing ? 'border-indigo-300 ring-2 ring-indigo-100' : intv.status === 'active' ? 'border-slate-200' : 'border-slate-100 opacity-70'}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{intv.intervention_type}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : intv.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
            {form.status}
          </span>
          {!editing && (
            <button onClick={() => setEditing(true)} data-testid={`edit-intervention-${intv.intervention_id}`}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-600 mb-3">
        <div><span className="text-slate-400">Staff:</span> {intv.assigned_staff}</div>
        <div><span className="text-slate-400">Frequency:</span> {intv.frequency || '—'}</div>
        <div><span className="text-slate-400">Review:</span> {intv.review_date}</div>
      </div>
      {editing ? (
        <div className="space-y-3 mt-3">
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
          {form.goals && <p className="text-sm text-slate-600 mb-1"><span className="font-medium">Goals:</span> {form.goals}</p>}
          {form.progress_notes && <p className="text-sm text-slate-500 italic">{form.progress_notes}</p>}
          <p className="text-xs text-slate-300 mt-2">Click edit to update notes or status</p>
        </>
      )}
    </div>
  );
}

// Inline editable case note card
function InlineEditNote({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(note.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(note.case_id, { notes });
    setSaving(false);
    setEditing(false);
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
          {!editing && (
            <button onClick={() => setEditing(true)} data-testid={`edit-note-${note.case_id}`}
              className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StudentProfilePage() {
  const { settings } = useSettings();
  const customFields = settings.custom_student_fields || [];
  const interventionTypes = settings.intervention_types?.length ? settings.intervention_types : INTERVENTION_TYPES;
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [saebrsView, setSaebrsView] = useState('total'); // 'total' or 'domains'
  const [newIntervention, setNewIntervention] = useState({ intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', frequency: '', status: 'active' });
  const [newNote, setNewNote] = useState({ note_type: 'General', notes: '', staff_member: '', date: new Date().toISOString().split('T')[0] });
  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/students/${studentId}/profile`, { withCredentials: true });
        setProfile(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [studentId]);

  const getAiSuggestions = null; // AI suggestions available on the Interventions page

  const editIntervention = async (id, patch) => {
    try {
      await axios.put(`${API}/interventions/${id}`, patch, { withCredentials: true });
      const res = await axios.get(`${API}/students/${studentId}/profile`, { withCredentials: true });
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const editCaseNote = async (id, patch) => {
    try {
      await axios.put(`${API}/case-notes/${id}`, patch, { withCredentials: true });
      const res = await axios.get(`${API}/students/${studentId}/profile`, { withCredentials: true });
      setProfile(res.data);
    } catch (e) { console.error(e); }
  };

  const addIntervention = async () => {
    if (!newIntervention.intervention_type || !newIntervention.assigned_staff) return;
    try {
      await axios.post(`${API}/interventions`, { ...newIntervention, student_id: studentId }, { withCredentials: true });
      const res = await axios.get(`${API}/students/${studentId}/profile`, { withCredentials: true });
      setProfile(res.data);
      setShowAddIntervention(false);
      setNewIntervention({ intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', frequency: '', status: 'active' });
    } catch (e) { console.error(e); }
  };

  const addNote = async () => {
    if (!newNote.notes || !newNote.staff_member) return;
    try {
      await axios.post(`${API}/case-notes`, { ...newNote, student_id: studentId }, { withCredentials: true });
      const res = await axios.get(`${API}/students/${studentId}/profile`, { withCredentials: true });
      setProfile(res.data);
      setShowAddNote(false);
      setNewNote({ note_type: 'General', notes: '', staff_member: '', date: new Date().toISOString().split('T')[0] });
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8"><div className="h-64 bg-white rounded-xl animate-pulse border border-slate-200" /></div>;
  if (!profile) return <div className="p-8 text-slate-500">Student not found</div>;

  const { student, mtss_tier, attendance_pct, saebrs_results, saebrs_plus_results, interventions, case_notes, alerts } = profile;
  const tierColors = getTierColors(mtss_tier);
  const latestSaebrs = saebrs_results?.slice(-1)[0];
  const latestPlus = saebrs_plus_results?.slice(-1)[0];

  // Chart data
  const screeningChartData = saebrs_results?.map((r, i) => ({
    name: `Term ${i + 1}`, total: r.total_score, social: r.social_score, academic: r.academic_score, emotional: r.emotional_score
  })) || [];

  const wellbeingChartData = saebrs_plus_results?.map((r, i) => ({
    name: `Term ${i + 1}`, total: r.wellbeing_total, social: r.social_domain, academic: r.academic_domain
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

  const radarData = latestPlus ? [
    { domain: 'Social', score: latestPlus.social_domain, max: 18 },
    { domain: 'Academic', score: latestPlus.academic_domain, max: 18 },
    { domain: 'Emotional', score: latestPlus.emotional_domain, max: 9 },
    { domain: 'Belonging', score: latestPlus.belonging_domain, max: 12 },
    { domain: 'Attendance', score: Math.min(10, attScore), max: 10 },
  ].map(d => ({ ...d, pct: Math.round((d.score / d.max) * 100) })) : [];

  // Display name with optional preferred name
  const displayName = `${student.first_name}${student.preferred_name && student.preferred_name !== student.first_name ? ` (${student.preferred_name})` : ''} ${student.last_name}`;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      {/* Header */}
      <button onClick={() => navigate('/students')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Students
      </button>

      <div className={`bg-white border ${tierColors.border} rounded-xl p-6 mb-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${tierColors.bg} rounded-xl flex items-center justify-center`}>
              <span className={`text-xl font-bold ${tierColors.text}`}>{student.first_name[0]}{student.last_name[0]}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{displayName}</h1>
              <p className="text-slate-500 text-sm">{student.year_level} · {student.class_name} · {student.teacher}</p>
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
            <button onClick={() => exportStudentProfile(profile)} data-testid="export-profile-pdf-btn"
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
        {[['overview', 'Overview'], ['screening', 'Screening History'], ['interventions', 'Interventions'], ['notes', 'Case Notes']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
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
                    <YAxis tick={{ fontSize: 11 }} />
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
            <h3 className="font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>Wellbeing Domain Profile</h3>
            {radarData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="domain" tick={{ fontSize: 12 }} />
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
              </>
            ) : <p className="text-sm text-slate-400 py-8 text-center">No wellbeing data available</p>}
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

      {activeTab === 'screening' && (
        <div className="space-y-6">
          {saebrs_results?.length === 0 && saebrs_plus_results?.length === 0 ? (
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
              {saebrs_plus_results?.length > 0 && (
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
                const plus = saebrs_plus_results?.[i];
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
              <button onClick={() => setShowAddIntervention(true)} data-testid="add-intervention-btn"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                <Plus size={14} /> Add Intervention
              </button>
            </div>
          </div>

          {interventions?.map(intv => (
            <InlineEditIntervention key={intv.intervention_id} intv={intv} interventionTypes={interventionTypes} onSave={editIntervention} />
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddNote(true)} data-testid="add-note-btn"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
              <Plus size={14} /> Add Case Note
            </button>
          </div>
          {case_notes?.map(note => (
            <InlineEditNote key={note.case_id} note={note} onSave={editCaseNote} />
          ))}
          {case_notes?.length === 0 && <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">No case notes recorded</div>}
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
              <select value={newIntervention.intervention_type} onChange={e => setNewIntervention(p => ({...p, intervention_type: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20">
                <option value="">Select Intervention Type</option>
                {INTERVENTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input placeholder="Assigned Staff" value={newIntervention.assigned_staff} onChange={e => setNewIntervention(p => ({...p, assigned_staff: e.target.value}))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
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
