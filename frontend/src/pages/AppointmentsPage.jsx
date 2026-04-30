import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api';
import {
  Plus, X, Eye, EyeOff, ChevronLeft, ChevronRight, Loader,
  CheckCircle, RefreshCw, Target, AlertTriangle, Users2,
  User, ExternalLink, Trash2, CalendarClock,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

// ── Date helpers ─────────────────────────────────────────────────────────────

const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  // Always format in the LOCAL timezone (not UTC). Using toISOString drops the
  // date to UTC which, combined with getDay() using local time, produces an
  // off-by-one day mismatch (today highlighted on wrong cell).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// ── Next-session-due estimator ────────────────────────────────────────────────
// Given a frequency string (as produced by AddInterventionModal) and the date
// of the most recent session (or start_date fallback), return a reasonable
// ISO date for when the next session should happen, plus a friendly status
// bucket: 'overdue' | 'today' | 'upcoming'. Returns null if no sensible
// cadence can be inferred.
function parseCadenceDays(freq) {
  if (!freq) return null;
  const f = freq.toLowerCase();
  if (/\bdaily\b/.test(f) || /\b5\s*[x×]\s*(per\s*)?week\b/.test(f)) return 1;
  // N×/per week — take the most frequent qualifier present in the string
  const perWeek = f.match(/(\d+)\s*[x×]\s*(?:per\s*)?week/);
  if (perWeek) {
    const n = Math.max(1, Math.min(7, parseInt(perWeek[1], 10)));
    return Math.max(1, Math.round(7 / n));
  }
  if (/\bfortnightly\b/.test(f) || /\bevery\s+2\s+weeks?\b/.test(f)) return 14;
  if (/\bweekly\b/.test(f) || /\bonce\s+a\s+week\b/.test(f)) return 7;
  if (/\bmonthly\b/.test(f)) return 30;
  return null;
}

function computeNextSessionDue(intv) {
  const days = parseCadenceDays(intv?.frequency);
  if (!days) return null;
  const basisStr = intv.last_session_date || intv.start_date;
  if (!basisStr) return null;
  const basis = new Date(basisStr);
  if (Number.isNaN(basis.getTime())) return null;
  const due = addDays(basis, days);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueMid = new Date(due); dueMid.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueMid - today) / 86400000);
  let status = 'upcoming';
  if (diffDays < 0) status = 'overdue';
  else if (diffDays === 0) status = 'today';
  return { iso: formatDate(due), diffDays, status };
}

// ── Tab Nav ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'schedule',     label: 'Schedule' },
  { key: 'ongoing',      label: 'Ongoing' },
  { key: 'completed',    label: 'Completed' },
  { key: 'availability', label: 'Availability' },
];

function TabNav({ active, onChange }) {
  return (
    <div className="flex gap-1 p-1.5 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar max-w-full mb-6">
      {TABS.map(({ key, label }) => (
        <button key={key} onClick={() => onChange(key)} data-testid={`appointments-tab-${key}`}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            active === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Session Modal ─────────────────────────────────────────────────────────────

function SessionModal({ initial, students, interventionTypes, onClose, onSaved, canDelete = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState({});
  const [interventions, setInterventions] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    student_id: '', intervention_id: '', intervention_type: '',
    session_type: '', date: formatDate(new Date()), time: '', room: '',
    reason_for_visit: '', session_notes: '', outcome_rating: '',
    status: '', flags: [],
    ...(initial || {}),
  });

  // Resolve student name for pre-filled student_id
  const [prefilledName, setPrefilledName] = useState('');
  useEffect(() => {
    if (form.student_id) {
      const s = students.find(s => s.student_id === form.student_id);
      if (s) setPrefilledName(`${s.first_name} ${s.last_name}`);
    }
  }, [form.student_id, students]);

  useEffect(() => {
    if (!form.intervention_type) { setConfig({}); return; }
    api.get(`/settings/intervention-types/${encodeURIComponent(form.intervention_type)}/appointment-config`)
      .then(r => setConfig(r.data))
      .catch(() => setConfig({}));
  }, [form.intervention_type]);

  // Also fetch config on initial load if editing an existing appointment
  useEffect(() => {
    if (initial?.intervention_type && !config.statuses) {
      api.get(`/settings/intervention-types/${encodeURIComponent(initial.intervention_type)}/appointment-config`)
        .then(r => setConfig(r.data))
        .catch(() => setConfig({}));
    }
  }, [initial]);

  useEffect(() => {
    if (!form.student_id || !form.intervention_type) { setInterventions([]); return; }
    api.get(`/interventions?student_id=${form.student_id}`)
      .then(r => {
        const list = (r.data || []).filter(i =>
          i.intervention_type === form.intervention_type && i.status === 'active'
        );
        setInterventions(list);
        if (list.length === 1 && !form.intervention_id)
          setForm(p => ({ ...p, intervention_id: list[0].intervention_id }));
      })
      .catch(() => setInterventions([]));
  }, [form.student_id, form.intervention_type]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleFlag = flag =>
    setForm(p => ({
      ...p,
      flags: p.flags.includes(flag) ? p.flags.filter(f => f !== flag) : [...p.flags, flag],
    }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        professional_user_id: user.user_id,
        professional_name_fallback: user.name,
      };
      if (form.appointment_id) await api.put(`/appointments/${form.appointment_id}`, payload);
      else await api.post('/appointments', payload);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteAppointment = async () => {
    if (!form.appointment_id) return;
    setDeleting(true);
    try {
      await api.delete(`/appointments/${form.appointment_id}`);
      onSaved();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const filteredStudents = studentSearch
    ? students.filter(s => {
        const q = studentSearch.toLowerCase();
        return `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
               (s.preferred_name || '').toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  const optVal = o => typeof o === 'string' ? o : (o?.value || o);
  const optLabel = o => typeof o === 'string' ? o.charAt(0).toUpperCase() + o.slice(1) : (o?.label || o?.value || String(o));

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[85dvh] md:max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>
            {form.appointment_id ? 'Edit Session' : 'Log Session'}
          </h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Student Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Student</label>
            {form.student_id ? (
              <div className="flex items-center justify-between px-3 py-2.5 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-800">{prefilledName || form.student_id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => navigate(`/students/${form.student_id}`)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    title="View student profile"
                  >
                    <ExternalLink size={12} />
                  </button>
                  {!initial?.student_id && (
                    <button onClick={() => { set('student_id', ''); setPrefilledName(''); }} className="p-1 text-slate-400 hover:text-slate-600">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="relative">
                <input placeholder="Search student..." value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  data-testid="student-search-input"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
                {filteredStudents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white z-10">
                    {filteredStudents.map(s => (
                      <button key={s.student_id}
                        onClick={() => { set('student_id', s.student_id); setPrefilledName(`${s.first_name} ${s.last_name}`); setStudentSearch(''); }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-b-0">
                        <span className="font-medium text-slate-800">{s.first_name} {s.last_name}</span>
                        <span className="text-xs text-slate-400">{s.class_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Intervention Type */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Intervention Type</label>
            {initial?.intervention_type ? (
              <div className="px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm text-slate-700">{form.intervention_type}</div>
            ) : (
              <select value={form.intervention_type} onChange={e => set('intervention_type', e.target.value)}
                data-testid="intervention-type-select"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">Select type...</option>
                {interventionTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            )}
          </div>

          {/* Linked Intervention */}
          {interventions.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Linked Intervention (optional)</label>
              <select value={form.intervention_id} onChange={e => set('intervention_id', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">None — standalone session</option>
                {interventions.map(i => (
                  <option key={i.intervention_id} value={i.intervention_id}>
                    {i.intervention_type} — started {i.start_date || i.created_at?.split('T')[0] || 'unknown'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Time */}
          <div className="flex gap-3 overflow-hidden">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                data-testid="session-date-input"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none min-w-0"
                style={{ WebkitAppearance: 'none', boxSizing: 'border-box' }} />
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Time</label>
              <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none min-w-0"
                style={{ WebkitAppearance: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Dynamic: Session Type */}
          {config.session_types?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Session Type</label>
              <select value={form.session_type} onChange={e => set('session_type', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">Select...</option>
                {config.session_types.map(o => <option key={optVal(o)} value={optVal(o)}>{optLabel(o)}</option>)}
              </select>
            </div>
          )}

          {/* Dynamic: Room */}
          {config.rooms?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Room / Location</label>
              <select value={form.room} onChange={e => set('room', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">Select...</option>
                {config.rooms.map(o => <option key={optVal(o)} value={optVal(o)}>{optLabel(o)}</option>)}
              </select>
            </div>
          )}

          {/* Dynamic: Status */}
          {config.statuses?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Session Status</label>
              <select value={form.status || ''} onChange={e => set('status', e.target.value)}
                data-testid="session-status-select"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">Select status...</option>
                {config.statuses.map((o, idx) => (
                  <option key={`${optVal(o)}-${idx}`} value={optVal(o)}>
                    {optLabel(o) || optVal(o)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dynamic: Outcome Rating */}
          {config.outcome_ratings?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Outcome Rating</label>
              <select value={form.outcome_rating} onChange={e => set('outcome_rating', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none bg-white">
                <option value="">Select...</option>
                {config.outcome_ratings.map(o => <option key={optVal(o)} value={optVal(o)}>{optLabel(o)}</option>)}
              </select>
            </div>
          )}

          {/* Reason for Visit */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Reason for Visit</label>
            <input value={form.reason_for_visit} onChange={e => set('reason_for_visit', e.target.value)}
              placeholder="Brief reason for this visit..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none" />
          </div>

          {/* Session Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Session Notes</label>
            <textarea value={form.session_notes} onChange={e => set('session_notes', e.target.value)}
              rows={3} placeholder="Notes from this session..."
              data-testid="session-notes-input"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none resize-none" />
          </div>

          {/* Dynamic: Flags */}
          {config.flags?.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Flags</label>
              <div className="flex flex-wrap gap-2">
                {config.flags.map(f => {
                  const val = optVal(f); const label = optLabel(f);
                  const active = form.flags.includes(val);
                  return (
                    <button key={val} onClick={() => toggleFlag(val)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                        active ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
          {/* Delete button - only shown when editing existing appointment and user has permission */}
          {form.appointment_id && canDelete && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-3 text-rose-600 bg-rose-50 rounded-xl text-sm font-medium hover:bg-rose-100 transition-colors"
              title="Delete appointment"
            >
              <Trash2 size={16} />
            </button>
          )}

          {/* Confirm delete */}
          {form.appointment_id && canDelete && confirmDelete && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 rounded-xl">
              <span className="text-xs text-rose-700">Delete?</span>
              <button
                onClick={deleteAppointment}
                disabled={deleting}
                className="px-2 py-1 text-xs font-semibold text-white bg-rose-600 rounded hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800"
              >
                No
              </button>
            </div>
          )}

          <button onClick={save}
            disabled={saving || !form.student_id || !form.intervention_type}
            data-testid="save-session-btn"
            className="flex-1 text-white py-3 text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
            style={{ backgroundColor: 'var(--wt-accent)' }}>
            {saving ? <Loader size={14} className="animate-spin" /> : null}
            {saving ? 'Saving…' : (form.appointment_id ? 'Update Session' : 'Save Session')}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────

function ScheduleTab({ students, confidential, onAddSession }) {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [schedule, setSchedule] = useState({ appointments: [] });
  const [loading, setLoading] = useState(true);
  const [viewDays, setViewDays] = useState(() => {
    // Default view based on screen width
    const width = window.innerWidth;
    if (width < 768) return 1; // Mobile
    if (width < 1500) return 3; // Tablet
    return 5; // Desktop
  });

  // Update viewDays on window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) setViewDays(1);
      else if (width < 1500) setViewDays(3);
      else setViewDays(5);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const visitDays = user?.visit_days?.length ? user.visit_days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/appointments/schedule?week_start=${formatDate(weekStart)}`);
      setSchedule(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  // Build week days starting from weekStart (which may be any day, not just Monday)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayIndex = (date.getDay() + 6) % 7; // Convert Sun=0,Mon=1... to Mon=0,Tue=1...Sun=6
    return {
      key: DAY_KEYS[dayIndex],
      label: DAY_FULL[dayIndex],
      date,
      dateStr: formatDate(date),
    };
  }).filter(d => visitDays.includes(d.key));

  const studentName = (studentId) => {
    const s = students.find(s => s.student_id === studentId);
    return s ? `${s.first_name} ${s.last_name}` : studentId;
  };

  const getStudent = (studentId) => students.find(s => s.student_id === studentId);
  const getInitials = (firstName) => firstName?.[0]?.toUpperCase() || '?';

  const StudentAvatar = ({ student, size = 'md' }) => {
    if (!student) return null;
    const s = student;
    const sizeClass = size === 'md' ? 'w-10 h-10' : 'w-5 h-5';
    const textClass = size === 'md' ? 'text-sm' : 'text-[9px]';

    if (!confidential && s.photo_url) {
      return (
        <img
          src={s.photo_url}
          alt={`${s.first_name} ${s.last_name}`}
          className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 ${textClass} font-bold`}>
        {confidential ? '?' : getInitials(s.first_name)}
      </div>
    );
  };

  const getApts = dateStr => (schedule.appointments || []).filter(a => a.date === dateStr);

  const formatWeekRange = () => {
    const opts = { month: 'short', day: 'numeric' };
    const endDate = addDays(weekStart, viewDays - 1);
    const startStr = weekStart.toLocaleDateString('en-AU', opts);
    const endStr = endDate.toLocaleDateString('en-AU', { ...opts, year: 'numeric' });
    return viewDays === 1 ? startStr : `${startStr} – ${endStr}`;
  };

  const colCount = Math.min(weekDays.length, viewDays);

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => setWeekStart(d => addDays(d, -viewDays))}
          className="p-2 wt-hover rounded-lg">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <label className="text-sm font-semibold text-slate-700 min-w-[120px] text-center hover:text-indigo-600 transition-colors cursor-pointer bg-transparent border-0 p-0 relative">
          {formatWeekRange()}
          <input
            type="date"
            value={formatDate(weekStart)}
            onChange={(e) => {
              if (e.target.value) {
                const selectedDate = new Date(e.target.value);
                selectedDate.setHours(0, 0, 0, 0);
                setWeekStart(selectedDate);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
        <button onClick={() => setWeekStart(d => addDays(d, viewDays))}
          className="p-2 wt-hover rounded-lg">
          <ChevronRight size={16} className="text-slate-600" />
        </button>

        {/* View mode toggle buttons */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {[1, 3, 5].map(n => (
            <button
              key={n}
              onClick={() => setViewDays(n)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewDays === n
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {n}d
            </button>
          ))}
        </div>

        <button onClick={load} className="ml-auto p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
          <RefreshCw size={14} className="text-slate-400" />
        </button>
      </div>

      {loading ? (
        <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
          {weekDays.slice(0, viewDays).map(d => <div key={d.key} className="h-52 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
          {weekDays.slice(0, viewDays).map(d => {
            const apts = getApts(d.dateStr);
            const isToday = d.dateStr === formatDate(new Date());
            return (
              <div key={d.key}
                className={`bg-white border rounded-xl overflow-hidden ${isToday ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-200'}`}>
                <div className={`px-3 py-2.5 flex items-center justify-between border-b ${isToday ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d.key}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-indigo-800' : 'text-slate-700'}`}>
                      {d.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <button onClick={() => onAddSession({ date: d.dateStr })}
                    data-testid={`add-session-${d.key}`}
                    className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors shrink-0">
                    <Plus size={12} className="text-slate-600" />
                  </button>
                </div>
                <div className="p-2 space-y-2 min-h-[110px]">
                  {apts.length === 0
                    ? <p className="text-xs text-slate-300 text-center mt-6">No sessions</p>
                    : apts.map(apt => {
                      const student = getStudent(apt.student_id);
                      return (
                        <button key={apt.appointment_id} onClick={() => onAddSession(apt)}
                          className="w-full text-left p-3 rounded-xl bg-white hover:bg-slate-50 transition-all border border-slate-200 hover:border-slate-300 hover:shadow-sm">
                          <div className="flex items-start gap-3">
                            <StudentAvatar student={student} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {confidential ? '••••••' : studentName(apt.student_id)}
                              </p>
                              {student && !confidential && student.class_name && (
                                <p className="text-xs text-slate-400">{student.class_name}</p>
                              )}
                              {apt.reason_for_visit && (
                                <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                                  <span className="font-medium text-slate-500">Reason:</span> {apt.reason_for_visit}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                {apt.time && (
                                  <span className="text-xs text-slate-500">{apt.time}</span>
                                )}
                                {apt.status && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Ongoing Tab ───────────────────────────────────────────────────────────────

function OngoingTab({ confidential, onAddSession, navigate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments/ongoing')
      .then(r => setItems(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-slate-100" />)}
    </div>
  );

  if (!items.length) return (
    <div className="py-20 text-center text-slate-400">
      <Target size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No ongoing interventions with appointment scheduling enabled</p>
      <p className="text-xs mt-1 text-slate-300">Enable scheduling in Settings → Interventions for each type</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map(item => {
        const student = item.student || {};
        const displayName = confidential ? '••••••' : `${student.first_name || ''} ${student.last_name || ''}`.trim();
        return (
          <div key={item.intervention_id}
            className={`bg-white border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow ${
              item.review_overdue ? 'border-rose-200 bg-rose-50/30' :
              item.case_review_recommended ? 'border-amber-200 bg-amber-50/30' :
              'border-slate-200'
            }`}
            data-testid={`ongoing-item-${item.intervention_id}`}>
            <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center shrink-0" data-testid={`ongoing-avatar-${item.intervention_id}`}>
              {!confidential && student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'flex'); }}
                />
              ) : null}
              <span
                className="text-sm font-bold text-slate-600 w-full h-full flex items-center justify-center"
                style={{ display: (!confidential && student.photo_url) ? 'none' : 'flex' }}
              >
                {confidential ? '?' : (student.first_name?.[0] || '?')}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900 text-sm">{displayName}</span>
                {!confidential && student.class_name && (
                  <span className="text-xs text-slate-400">{student.class_name}</span>
                )}
                {item.review_overdue && (
                  <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium">Review Overdue</span>
                )}
                {item.case_review_recommended && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Case Review</span>
                )}
              </div>
              {item.rationale && (
                <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                  <span className="font-medium text-slate-500">Reason:</span> {item.rationale}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{item.intervention_type}</span>
                {item.frequency && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" data-testid={`frequency-${item.intervention_id}`}>
                    {item.frequency}
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500">{item.session_count || 0} sessions</span>
                {item.last_session_date && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">Last: {item.last_session_date}</span>
                )}
                {(() => {
                  // "Next due" badge — derived from frequency + last_session_date.
                  // Overdue = red, due today = amber, upcoming = slate. Silent when
                  // cadence can't be parsed (bespoke free-text frequencies).
                  const due = computeNextSessionDue(item);
                  if (!due) return null;
                  const cls = due.status === 'overdue'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    : due.status === 'today'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  const label = due.status === 'overdue'
                    ? `Next due ${due.iso} (${Math.abs(due.diffDays)}d overdue)`
                    : due.status === 'today'
                    ? 'Next due today'
                    : `Next due ${due.iso} (in ${due.diffDays}d)`;
                  return (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}
                      data-testid={`next-due-${item.intervention_id}`}
                      data-status={due.status}
                    >
                      {label}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => onAddSession({
                  student_id: item.student_id,
                  intervention_id: item.intervention_id,
                  intervention_type: item.intervention_type,
                })}
                data-testid={`add-session-ongoing-${item.intervention_id}`}
                className="flex items-center gap-1.5 px-3 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--wt-accent)' }}>
                <Plus size={13} /> Session
              </button>
              <button
                onClick={() => navigate(`/students/${item.student_id}`)}
                data-testid={`profile-btn-ongoing-${item.intervention_id}`}
                title="View student profile"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Completed Tab ─────────────────────────────────────────────────────────────

function CompletedTab({ confidential }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments/completed')
      .then(r => setItems(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse border border-slate-100" />)}
    </div>
  );

  if (!items.length) return (
    <div className="py-20 text-center text-slate-400">
      <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">No completed interventions yet</p>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {['Student', 'Type', 'Sessions', 'Last Session'].map(h => (
              <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const student = item.student || {};
            const displayName = confidential ? '••••••' : `${student.first_name || ''} ${student.last_name || ''}`.trim();
            return (
              <tr key={item.intervention_id}
                className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx === items.length - 1 ? 'border-b-0' : ''}`}
                data-testid={`completed-item-${item.intervention_id}`}>
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900">{displayName}</p>
                  {!confidential && student.class_name && <p className="text-xs text-slate-400">{student.class_name}</p>}
                </td>
                <td className="py-3 px-4 text-slate-600">{item.intervention_type}</td>
                <td className="py-3 px-4">
                  <span className="text-sm font-semibold text-slate-700">{item.session_count || 0}</span>
                </td>
                <td className="py-3 px-4 text-slate-400 text-xs">{item.last_session_date || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Availability Tab ──────────────────────────────────────────────────────────

function AvailabilityTab({ students, onAddSession }) {
  const [professionals, setProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [loading, setLoading] = useState(true);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((key, i) => ({
    key, label: DAY_FULL[i],
    date: addDays(weekStart, i),
    dateStr: formatDate(addDays(weekStart, i)),
  }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profsRes, schedRes] = await Promise.all([
        api.get('/users/professionals'),
        api.get(`/appointments/schedule?week_start=${formatDate(weekStart)}`),
      ]);
      setProfessionals(profsRes.data || []);
      setAppointments((schedRes.data.appointments) || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const formatWeekRange = () => {
    const opts = { month: 'short', day: 'numeric' };
    return `${weekStart.toLocaleDateString('en-AU', opts)} – ${addDays(weekStart, 6).toLocaleDateString('en-AU', { ...opts, year: 'numeric' })}`;
  };

  const getProApts = (profId, dateStr) =>
    appointments.filter(a => a.professional_user_id === profId && a.date === dateStr);

  const studentName = (studentId) => {
    const s = students.find(s => s.student_id === studentId);
    return s ? `${s.first_name} ${s.last_name}` : studentId;
  };

  if (!loading && !professionals.length) return (
    <div className="py-20 text-center text-slate-400">
      <Users2 size={32} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium">No professional staff configured yet</p>
      <p className="text-xs mt-1 text-slate-300">Add users with the Professional role in Administration to see their availability here</p>
    </div>
  );

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setWeekStart(d => addDays(d, -7))}
          className="p-2 wt-hover rounded-lg">
          <ChevronLeft size={16} className="text-slate-600" />
        </button>
        <span className="text-sm font-semibold text-slate-700 min-w-[190px] text-center">{formatWeekRange()}</span>
        <button onClick={() => setWeekStart(d => addDays(d, 7))}
          className="p-2 wt-hover rounded-lg">
          <ChevronRight size={16} className="text-slate-600" />
        </button>
        <button onClick={load} className="ml-auto p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
          <RefreshCw size={14} className="text-slate-400" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl animate-pulse border border-slate-100" />)}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: '210px repeat(5, 1fr)' }}>
            <div className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider border-r border-slate-200">
              Professional
            </div>
            {weekDays.map(d => {
              const isToday = d.dateStr === formatDate(new Date());
              return (
                <div key={d.key} className={`px-3 py-3 text-center border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-indigo-50' : ''}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-600' : 'text-slate-400'}`}>{d.key}</p>
                  <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-indigo-800' : 'text-slate-600'}`}>
                    {d.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Professional rows */}
          {professionals.map((prof) => (
            <div key={prof.user_id}
              className="grid border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40 transition-colors"
              style={{ gridTemplateColumns: '210px repeat(5, 1fr)' }}
              data-testid={`availability-row-${prof.user_id}`}>

              {/* Name + type */}
              <div className="px-4 py-4 flex items-center gap-3 border-r border-slate-100">
                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-violet-700">{prof.name?.[0] || '?'}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{prof.name}</p>
                  {prof.professional_type && (
                    <p className="text-xs text-slate-400 truncate">{prof.professional_type}</p>
                  )}
                </div>
              </div>

              {/* Day cells */}
              {weekDays.map(d => {
                const isVisitDay = (prof.visit_days || []).length === 0 || (prof.visit_days || []).includes(d.key);
                const apts = getProApts(prof.user_id, d.dateStr);
                const isToday = d.dateStr === formatDate(new Date());
                return (
                  <div key={d.key}
                    className={`px-2 py-2.5 flex flex-col gap-1 min-h-[68px] border-r border-slate-50 last:border-r-0 ${
                      !isVisitDay ? 'bg-slate-50/70' : isToday ? 'bg-indigo-50/30' : ''
                    }`}>
                    {isVisitDay ? (
                      <>
                        {apts.map(apt => (
                          <button key={apt.appointment_id} onClick={() => onAddSession(apt)}
                            className="w-full text-left px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-100 transition-colors">
                            <p className="text-[10px] font-semibold text-slate-700 truncate leading-tight">
                              {studentName(apt.student_id)}
                            </p>
                            {apt.time && <p className="text-[9px] text-slate-400">{apt.time}</p>}
                          </button>
                        ))}
                        <button
                          onClick={() => onAddSession({ date: d.dateStr })}
                          data-testid={`availability-add-${prof.user_id}-${d.key}`}
                          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-dashed border-slate-200 hover:border-slate-400 transition-all mt-auto">
                          <Plus size={9} /> Add
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-center flex-1">
                        <span className="text-[10px] text-slate-300 select-none">—</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  useDocumentTitle('Appointments');
  const { user } = useAuth();
  const { canDo } = usePermissions();
  const [tab, setTab] = useState('schedule');
  const [confidential, setConfidential] = useState(false);
  const [sessionModal, setSessionModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [students, setStudents] = useState([]);
  const [interventionTypes, setInterventionTypes] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/students/summary'),
      api.get('/settings'),
    ]).then(([sRes, settRes]) => {
      setStudents(sRes.data || []);
      const types = (settRes.data.intervention_types || [])
        .map(t => typeof t === 'string' ? { name: t, appointment_scheduling_enabled: false } : t)
        .filter(t => t.appointment_scheduling_enabled);
      setInterventionTypes(types);
    }).catch(console.error);
  }, []);

  if (user && user.role !== 'admin' && user.role !== 'professional' && !user.appointment_access) {
    return (
      <div className="p-8 text-center text-slate-400 fade-in">
        <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-medium text-slate-600">Appointment access not enabled</p>
        <p className="text-sm mt-1">Contact your administrator to enable appointment access for your account.</p>
      </div>
    );
  }

  const handleSaved = () => { setSessionModal(null); setRefreshKey(k => k + 1); };

  return (
    <div className="p-6 lg:p-8 fade-in">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}><CalendarClock size={28} className="text-slate-600" /> Appointments</h1>
          <p className="text-slate-500 mt-1">Manage wellbeing sessions and track student support.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setConfidential(p => !p)}
            data-testid="confidentiality-toggle"
            title={confidential ? 'Show student names' : 'Hide student names (confidentiality mode)'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
              confidential ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {confidential ? <EyeOff size={15} /> : <Eye size={15} />}
            <span className="hidden sm:inline">{confidential ? 'Names hidden' : 'Hide names'}</span>
          </button>
          <button onClick={() => setSessionModal({})}
            data-testid="add-appointment-btn"
            className="flex items-center gap-2 px-4 py-2 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: 'var(--wt-accent)' }}>
            <Plus size={15} /> New Session
          </button>
        </div>
      </div>

      <TabNav active={tab} onChange={setTab} />

      {tab === 'schedule' && (
        <ScheduleTab key={`sch-${refreshKey}`} students={students} confidential={confidential} onAddSession={setSessionModal} />
      )}
      {tab === 'ongoing' && (
        <OngoingTab key={`ong-${refreshKey}`} confidential={confidential} onAddSession={setSessionModal} navigate={navigate} />
      )}
      {tab === 'completed' && (
        <CompletedTab key={`cmp-${refreshKey}`} confidential={confidential} />
      )}
      {tab === 'availability' && (
        <AvailabilityTab key={`avl-${refreshKey}`} students={students} onAddSession={setSessionModal} />
      )}

      {sessionModal !== null && (
        <SessionModal
          initial={sessionModal}
          students={students}
          interventionTypes={interventionTypes}
          onClose={() => setSessionModal(null)}
          onSaved={handleSaved}
          canDelete={canDo('appointments.delete')}
        />
      )}
    </div>
  );
}
