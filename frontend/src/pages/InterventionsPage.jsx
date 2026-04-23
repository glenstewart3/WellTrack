import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getTierColors, INTERVENTION_TYPES } from '../utils/tierUtils';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  Plus, X, Target, ArrowUpRight, Search,
  ChevronUp, ChevronDown, Clock, AlertTriangle,
  LayoutList, Users, CheckCircle, User,
} from 'lucide-react';
import { exportInterventionsReport } from '../utils/pdfExport';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { todayLocal } from '../utils/dateFmt';
import AddInterventionModal from '../components/AddInterventionModal';

const BURL = process.env.REACT_APP_BACKEND_URL;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function studentDisplayName(s) {
  if (!s) return '';
  const pref = s.preferred_name && s.preferred_name !== s.first_name ? ` (${s.preferred_name})` : '';
  return `${s.first_name || ''}${pref} ${s.last_name || ''}`.trim();
}

function getToday() { return todayLocal(); }
function getInDays(n) { return todayLocal(new Date(Date.now() + n * 86400000)); }

function isOverdue(intv) {
  return intv.status === 'active' && !!intv.review_date && intv.review_date < getToday();
}
function isDueThisWeek(intv) {
  const today = getToday(); const week = getInDays(7);
  return intv.status === 'active' && !!intv.review_date && intv.review_date >= today && intv.review_date <= week;
}
function daysActive(intv) {
  if (!intv.start_date) return null;
  return Math.floor((Date.now() - new Date(intv.start_date)) / 86400000);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const PROGRESS_OPTS = [
  { value: 'on_track',    label: 'On Track',      cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' },
  { value: 'needs_review',label: 'Needs Review',  cls: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' },
  { value: 'at_risk',     label: 'At Risk',       cls: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
  { value: 'goal_met',    label: 'Goal Met',      cls: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' },
];

function TierBadge({ tier }) {
  if (!tier) return null;
  const cls = ['','bg-emerald-100 text-emerald-700','bg-amber-100 text-amber-700','bg-red-100 text-red-700'];
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls[tier]}`}>T{tier}</span>;
}

function StudentAvatar({ student, size = 'sm' }) {
  const dim = size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';
  if (!student) return (
    <div className={`${dim} rounded-full bg-slate-100 flex items-center justify-center shrink-0`}>
      <User size={14} className="text-slate-400" />
    </div>
  );
  if (student.photo_url) return (
    <div className={`${dim} rounded-full overflow-hidden shrink-0`}>
      <img src={`${BURL}${student.photo_url}`} alt={student.first_name} className="w-full h-full object-cover" />
    </div>
  );
  const tc = getTierColors(student.mtss_tier);
  return (
    <div className={`${dim} rounded-full ${tc.bg} flex items-center justify-center ${textSize} font-bold ${tc.text} shrink-0`}>
      {student.first_name?.[0]}{student.last_name?.[0]}
    </div>
  );
}

function SortTh({ col, label, sortBy, sortDir, onSort }) {
  const active = sortBy === col;
  return (
    <th onClick={() => onSort(col)}
      className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-slate-700 select-none transition-colors">
      <span className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
          : <span className="w-3 opacity-0"><ChevronUp size={11} /></span>}
      </span>
    </th>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function InterventionDetailModal({ intv, students, onClose, onUpdated, canEdit }) {
  const navigate = useNavigate();
  const student = students.find(s => s.student_id === intv.student_id);
  const [status, setStatus]               = useState(intv.status);
  const [notes, setNotes]                 = useState(intv.progress_notes || '');
  const [progressStatus, setProgressStatus] = useState(intv.progress_status || '');
  const [saving, setSaving]               = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/interventions/${intv.intervention_id}`,
        { status, progress_notes: notes, progress_status: progressStatus });
      onUpdated(res.data);
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const overdue = isOverdue({ ...intv, status });
  const days = daysActive(intv);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <StudentAvatar student={student} size="lg" />
            <div>
              <p className="font-bold text-slate-900 text-base">{student ? studentDisplayName(student) : intv.student_id}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <TierBadge tier={student?.mtss_tier} />
                {student && <span className="text-xs text-slate-400">{student.class_name}</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-700" /></button>
        </div>

        {/* Overdue warning */}
        {overdue && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg mb-4 text-xs text-red-700">
            <AlertTriangle size={13} />
            <span>Review date passed — update status or reschedule.</span>
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Type</p>
              <p className="font-medium text-slate-800">{intv.intervention_type}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Assigned Staff</p>
              <p className="font-medium text-slate-800">{intv.assigned_staff}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Start Date</p>
              <p className="font-medium text-slate-800">{intv.start_date || '—'}{days != null && <span className="text-slate-400 text-xs ml-1">({days}d)</span>}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Review Date</p>
              <p className={`font-medium ${overdue ? 'text-red-600' : 'text-slate-800'}`}>{intv.review_date || '—'}</p>
            </div>
            {intv.frequency && <div className="col-span-2">
              <p className="text-xs text-slate-400 mb-0.5">Frequency</p>
              <p className="font-medium text-slate-800">{intv.frequency}</p>
            </div>}
          </div>

          {intv.rationale && <div>
            <p className="text-xs text-slate-400 mb-0.5">Rationale</p>
            <p className="text-slate-700 leading-relaxed">{intv.rationale}</p>
          </div>}

          {intv.goals && <div>
            <p className="text-xs text-slate-400 mb-0.5">Goals</p>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{intv.goals}</p>
          </div>}

          {/* Goal Progress Status */}
          {canEdit && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Goal Progress</p>
              <div className="flex flex-wrap gap-2">
                {PROGRESS_OPTS.map(opt => (
                  <button key={opt.value}
                    onClick={() => setProgressStatus(p => p === opt.value ? '' : opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      progressStatus === opt.value ? `${opt.cls} shadow-sm` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!canEdit && progressStatus && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Goal Progress</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${PROGRESS_OPTS.find(o => o.value === progressStatus)?.cls || 'bg-slate-100 text-slate-600'}`}>
                {PROGRESS_OPTS.find(o => o.value === progressStatus)?.label}
              </span>
            </div>
          )}

          {/* Status toggle */}
          {canEdit && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
              <div className="flex gap-2">
                {['active', 'completed'].map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                      status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Progress notes */}
          {canEdit ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Progress Notes</p>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Add progress notes..."
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none" />
            </div>
          ) : intv.progress_notes && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Progress Notes</p>
              <p className="text-slate-700 leading-relaxed">{intv.progress_notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          {canEdit && (
            <button onClick={save} disabled={saving}
              className="flex-1 py-3 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--wt-accent)' }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
          <button onClick={() => navigate(`/students/${intv.student_id}`)}
            className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
            <ArrowUpRight size={15} /> Profile
          </button>
          <button onClick={onClose}
            className="px-4 py-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InterventionsPage() {
  useDocumentTitle('Interventions');
  const navigate = useNavigate();
  const { canDo } = usePermissions();
  const { settings } = useSettings();
  // Backend may store intervention_types either as legacy strings or as dicts
  // ({name, appointment_scheduling_enabled}). Normalise to an array of strings
  // for all dropdown/list UI.
  const interventionTypes = (() => {
    const raw = settings.intervention_types?.length ? settings.intervention_types : INTERVENTION_TYPES;
    return raw.map(t => typeof t === 'string' ? t : (t?.name || '')).filter(Boolean);
  })();

  const [interventions, setInterventions] = useState([]);
  const [students, setStudents]           = useState([]);
  const [loading, setLoading]             = useState(true);

  // Filters + sort
  const [filterStatus, setFilterStatus]   = useState('active');
  const [filterType, setFilterType]       = useState('');
  const [filterTier, setFilterTier]       = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [sortBy, setSortBy]               = useState('review_date');
  const [sortDir, setSortDir]             = useState('asc');
  const [groupByStudent, setGroupByStudent] = useState(false);

  // Modals
  const [showAdd, setShowAdd]       = useState(false);
  const [detailIntv, setDetailIntv] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [professionals, setProfessionals] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [form, setForm] = useState({
    student_id: '', intervention_type: '', assigned_staff: '',
    start_date: '', review_date: '', goals: '', rationale: '',
    frequency: '', status: 'active', progress_notes: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [intRes, studRes] = await Promise.all([
          api.get('/interventions'),
          api.get('/students/summary'),
        ]);
        setInterventions(intRes.data);
        setStudents(studRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadProfessionals = async () => {
    try {
      if (!professionals.length) {
        const res = await api.get('/users/professionals');
        setProfessionals(res.data || []);
      }
      if (!allUsers.length) {
        const res = await api.get('/users');
        setAllUsers(res.data || []);
      }
    } catch { /* not critical */ }
  };

  const getStudent = sid => students.find(s => s.student_id === sid);
  const getName = sid => { const s = getStudent(sid); return s ? studentDisplayName(s) : sid; };

  // Stats
  const activeCount      = interventions.filter(i => i.status === 'active').length;
  const overdueCount     = interventions.filter(isOverdue).length;
  const dueThisWeekCount = interventions.filter(isDueThisWeek).length;

  // Filtered + sorted list
  const filtered = useMemo(() => {
    return interventions
      .filter(i => {
        if (filterStatus === 'overdue')    return isOverdue(i);
        if (filterStatus)                  return i.status === filterStatus;
        return true;
      })
      .filter(i => !filterType || i.intervention_type === filterType)
      .filter(i => !filterTier || String(getStudent(i.student_id)?.mtss_tier) === filterTier)
      .filter(i => !searchQuery || getName(i.student_id).toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'student')      return dir * getName(a.student_id).localeCompare(getName(b.student_id));
        if (sortBy === 'type')         return dir * (a.intervention_type || '').localeCompare(b.intervention_type || '');
        if (sortBy === 'start_date')   return dir * (a.start_date || '').localeCompare(b.start_date || '');
        if (sortBy === 'review_date')  return dir * (a.review_date || '').localeCompare(b.review_date || '');
        if (sortBy === 'days')         return dir * ((daysActive(a) ?? -1) - (daysActive(b) ?? -1));
        return 0;
      });
  // daysActive is a stable pure function — deps list is complete
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, students, filterStatus, filterType, filterTier, searchQuery, sortBy, sortDir]);

  const onSort = col => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  // Quick status toggle (inline, no modal)
  const quickToggle = async (e, intv) => {
    e.stopPropagation();
    const newStatus = intv.status === 'active' ? 'completed' : 'active';
    try {
      await api.put(`/interventions/${intv.intervention_id}`, { status: newStatus });
      setInterventions(prev => prev.map(i => i.intervention_id === intv.intervention_id ? { ...i, status: newStatus } : i));
    } catch (e) { console.error(e); }
  };

  const saveIntervention = async (formFromModal) => {
    const payload = formFromModal || form;
    const res = await api.post('/interventions', payload);
    setInterventions(prev => [res.data, ...prev]);
    setForm({ student_id: '', intervention_type: '', assigned_staff: '', start_date: '', review_date: '', goals: '', rationale: '', frequency: '', status: 'active', progress_notes: '' });
  };

  const handleUpdated = updated =>
    setInterventions(prev => prev.map(i => i.intervention_id === updated.intervention_id ? updated : i));

  const intTypes = [...new Set(interventions.map(i => i.intervention_type))];

  // Group by student helper
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(intv => {
      const sid = intv.student_id;
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid).push(intv);
    });
    return [...map.entries()];
  }, [filtered]);

  const progressOpt = val => PROGRESS_OPTS.find(o => o.value === val);

  // ── Row renderer ──────────────────────────────────────────────────────────
  const renderRow = (intv) => {
    const student = getStudent(intv.student_id);
    const overdue = isOverdue(intv);
    const dueWeek = isDueThisWeek(intv);
    const days = daysActive(intv);
    const prog = progressOpt(intv.progress_status);

    return (
      <tr key={intv.intervention_id}
        data-testid={`intervention-row-${intv.intervention_id}`}
        onClick={() => setDetailIntv(intv)}
        className={`border-b border-slate-50 transition-colors cursor-pointer ${
          overdue ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50'
        }`}>

        {/* Student */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2.5">
            {overdue && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
            <StudentAvatar student={student} />
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{getName(intv.student_id)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <TierBadge tier={student?.mtss_tier} />
                {student?.class_name && <span className="text-xs text-slate-400">{student.class_name}</span>}
              </div>
            </div>
          </div>
        </td>

        {/* Type */}
        <td className="py-3 px-4">
          <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">{intv.intervention_type}</span>
        </td>

        {/* Staff */}
        <td className="py-3 px-4 text-slate-600 text-xs whitespace-nowrap">{intv.assigned_staff}</td>

        {/* Days active */}
        <td className="py-3 px-4">
          {days != null
            ? <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">Day {days}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </td>

        {/* Review date */}
        <td className="py-3 px-4 text-xs whitespace-nowrap">
          {intv.review_date
            ? <span className={overdue ? 'text-red-600 font-semibold' : dueWeek ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                {intv.review_date}
              </span>
            : <span className="text-slate-300">—</span>}
        </td>

        {/* Goal progress */}
        <td className="py-3 px-4">
          {prog
            ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prog.cls.replace('ring-1 ring-emerald-300','').replace('ring-1 ring-amber-300','').replace('ring-1 ring-red-300','').replace('ring-1 ring-blue-300','')}`}>{prog.label}</span>
            : <span className="text-xs text-slate-300">—</span>}
        </td>

        {/* Status + quick toggle */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
              intv.status === 'active'    ? 'bg-emerald-100 text-emerald-700' :
              intv.status === 'completed' ? 'bg-blue-100 text-blue-700'      : 'bg-slate-100 text-slate-600'
            }`}>{intv.status}</span>
            {canDo('interventions.add_edit') && (
              <button onClick={e => quickToggle(e, intv)}
                title={intv.status === 'active' ? 'Mark completed' : 'Reactivate'}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 transition-all text-slate-400 hover:text-slate-700">
                <CheckCircle size={13} />
              </button>
            )}
          </div>
        </td>

        {/* Go to profile */}
        <td className="py-3 px-4" onClick={e => { e.stopPropagation(); navigate(`/students/${intv.student_id}`); }}>
          <button className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors">
            <ArrowUpRight size={14} />
          </button>
        </td>
      </tr>
    );
  };

  // ── Page render ───────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 fade-in">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <Target size={28} className="text-slate-600" /> Interventions
          </h1>
          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full">{activeCount} active</span>
            {overdueCount > 0 && (
              <button onClick={() => setFilterStatus('overdue')}
                className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors flex items-center gap-1">
                <AlertTriangle size={11} /> {overdueCount} overdue
              </button>
            )}
            {dueThisWeekCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                <Clock size={11} /> {dueThisWeekCount} due this week
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setGroupByStudent(g => !g)}
            title={groupByStudent ? 'Table view' : 'Group by student'}
            className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium transition-colors ${groupByStudent ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {groupByStudent ? <LayoutList size={15} /> : <Users size={15} />}
            {groupByStudent ? 'Table' : 'By Student'}
          </button>
          {canDo('analytics.export') && (
            <button onClick={() => exportInterventionsReport(interventions, students)}
              data-testid="export-interventions-btn"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              Export PDF
            </button>
          )}
          {canDo('interventions.add_edit') && (
            <button onClick={() => { setShowAdd(true); loadProfessionals(); }} data-testid="new-intervention-btn"
              className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--wt-accent)' }}>
              <Plus size={16} /> New Intervention
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
          {[['', 'All'], ['active', 'Active'], ['overdue', 'Overdue'], ['completed', 'Completed']].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filterStatus === val
                  ? val === 'overdue' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {val === 'overdue' && <AlertTriangle size={12} />}{label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search student…"
            className="pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white w-44" />
        </div>

        {/* Type filter */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
          <option value="">All Types</option>
          {intTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Tier filter */}
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
      </div>

      <p className="text-xs text-slate-400 mb-3">Click any row to view and edit details · <kbd className="bg-slate-100 px-1 rounded">→</kbd> icon goes to student profile</p>

      {/* Content */}
      {loading ? (
        <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p>No interventions match these filters</p>
        </div>
      ) : groupByStudent ? (
        /* ── Grouped by student ── */
        <div className="space-y-4">
          {grouped.map(([sid, intvsForStudent]) => {
            const student = getStudent(sid);
            return (
              <div key={sid} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Student header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => navigate(`/students/${sid}`)}>
                  <StudentAvatar student={student} />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-semibold text-slate-900 text-sm">{getName(sid)}</span>
                    <TierBadge tier={student?.mtss_tier} />
                    {student?.class_name && <span className="text-xs text-slate-400">{student.class_name}</span>}
                  </div>
                  <span className="text-xs text-slate-400">{intvsForStudent.length} intervention{intvsForStudent.length !== 1 ? 's' : ''}</span>
                  <ArrowUpRight size={14} className="text-slate-400" />
                </div>
                {/* Interventions for this student */}
                <div className="divide-y divide-slate-50">
                  {intvsForStudent.map(intv => {
                    const overdue = isOverdue(intv);
                    const days = daysActive(intv);
                    const prog = progressOpt(intv.progress_status);
                    return (
                      <div key={intv.intervention_id}
                        onClick={() => setDetailIntv(intv)}
                        className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${overdue ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'}`}>
                        {overdue && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                        <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-medium">{intv.intervention_type}</span>
                        <span className="text-xs text-slate-500 flex-1">{intv.assigned_staff}</span>
                        {days != null && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Day {days}</span>}
                        {intv.review_date && <span className={`text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>Review {intv.review_date}</span>}
                        {prog && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prog.cls.split('ring')[0]}`}>{prog.label}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${intv.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{intv.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Flat table ── */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm group">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <SortTh col="student"     label="Student"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortTh col="type"        label="Type"        sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Staff</th>
                  <SortTh col="days"        label="Days Active" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <SortTh col="review_date" label="Review"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Progress</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 w-10" />
                </tr>
              </thead>
              <tbody>{filtered.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailIntv && (
        <InterventionDetailModal
          intv={detailIntv}
          students={students}
          canEdit={canDo('interventions.add_edit')}
          onClose={() => setDetailIntv(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Add Modal */}
      <AddInterventionModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={saveIntervention}
        students={students}
        interventionTypes={interventionTypes}
        professionals={professionals}
        allUsers={allUsers}
      />
    </div>
  );
}