import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { 
  Plus, Calendar, Clock, CheckCircle, X, Trash2, Edit2, 
  AlertCircle, ChevronRight, Play, RotateCcw
} from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3', 'Term 4'];

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Given a term's start/end dates, return an array of { week, start, end, label } for every Monday-Sunday week. */
function buildTermWeeks(termStart, termEnd) {
  if (!termStart || !termEnd) return [];
  const weeks = [];
  // Find the Monday on or before termStart
  const s = new Date(termStart + 'T00:00:00');
  const e = new Date(termEnd + 'T00:00:00');
  // Walk to first Monday on or before start
  const cursor = new Date(s);
  const dayOfWeek = cursor.getDay(); // 0=Sun
  cursor.setDate(cursor.getDate() - ((dayOfWeek + 6) % 7)); // back to Monday
  let weekNum = 1;
  while (cursor <= e) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6); // Sunday (full week)
    // Only include if the week overlaps the term
    if (weekEnd >= s) {
      const clampedStart = weekStart < s ? new Date(s) : weekStart;
      const clampedEnd = weekEnd > e ? new Date(e) : weekEnd;
      weeks.push({
        week: weekNum,
        start: fmtISO(clampedStart),
        end: fmtISO(clampedEnd),
        label: `Week ${weekNum}, ${fmtDisplay(clampedStart)} – ${fmtDisplay(clampedEnd)}`,
      });
      weekNum++;
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function fmtISO(d) {
  // Use local date parts to avoid UTC timezone shift
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function fmtDisplay(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDisplayFromISO(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return fmtDisplay(d);
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ScreeningPeriodManager() {
  const [periods, setPeriods] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [calendarTerms, setCalendarTerms] = useState([]); // raw term objects from calendar settings
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'activate'|'deactivate'|'delete', period }
  
  // Form state
  const [form, setForm] = useState({
    term: 'Term 1',
    year: new Date().getFullYear(),
    period_number: 1,
    week: 1,
    start_date: '',
    end_date: '',
  });

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const currentYear = new Date().getFullYear();
      const [periodsRes, statusRes, termsRes] = await Promise.all([
        api.get('/screening/periods'),
        api.get('/screening/periods/current/status'),
        api.get(`/settings/terms?year=${currentYear}`),
      ]);
      setPeriods(periodsRes.data.periods || []);
      setCurrentStatus(statusRes.data);
      setCalendarTerms(termsRes.data?.terms || []);
    } catch (e) {
      console.error('Failed to load screening periods:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────────

  /** Map term name → { start_date, end_date } from calendar settings */
  const termDateMap = useMemo(() => {
    const map = {};
    for (const t of calendarTerms) {
      if (t.name && t.start_date && t.end_date) {
        map[t.name] = { start: t.start_date, end: t.end_date };
      }
    }
    return map;
  }, [calendarTerms]);

  /** Detect current term from today's date */
  const currentTermName = useMemo(() => {
    const today = new Date();
    const todayStr = fmtISO(today);
    for (const t of calendarTerms) {
      if (t.start_date && t.end_date && todayStr >= t.start_date && todayStr <= t.end_date) {
        return t.name;
      }
    }
    return TERMS[0];
  }, [calendarTerms]);

  /** Weeks for the currently selected term in the modal */
  const termWeeks = useMemo(() => {
    const td = termDateMap[form.term];
    return td ? buildTermWeeks(td.start, td.end) : [];
  }, [form.term, termDateMap]);

  // When user changes term, auto-select first available week and update dates
  useEffect(() => {
    if (termWeeks.length > 0 && showCreateModal) {
      const firstWeek = termWeeks[0];
      setForm(prev => ({
        ...prev,
        week: firstWeek.week,
        start_date: firstWeek.start,
        end_date: firstWeek.end,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.term, termWeeks.length]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleWeekSelect = (weekObj) => {
    setForm(prev => ({
      ...prev,
      week: weekObj.week,
      start_date: weekObj.start,
      end_date: weekObj.end,
    }));
  };

  const handleCreate = async () => {
    try {
      await api.post('/screening/periods', form);
      setShowCreateModal(false);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create period');
    }
  };

  const handleUpdate = async () => {
    try {
      await api.put(`/screening/periods/${editingPeriod.period_id}`, {
        week: form.week,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      setEditingPeriod(null);
      loadData();
    } catch (e) {
      alert('Failed to update period');
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, period } = confirmAction;
    try {
      if (type === 'activate') {
        await api.post(`/screening/periods/${period.period_id}/activate`);
      } else if (type === 'deactivate') {
        await api.post(`/screening/periods/${period.period_id}/deactivate`);
      } else if (type === 'delete') {
        await api.delete(`/screening/periods/${period.period_id}`);
      }
      setConfirmAction(null);
      loadData();
    } catch (e) {
      alert(e.response?.data?.detail || `Failed to ${type} period`);
      setConfirmAction(null);
    }
  };

  const openCreateModal = () => {
    const term = currentTermName;
    const existingPeriods = periods.filter(p => p.term === term && p.year === new Date().getFullYear());
    const nextNumber = existingPeriods.length > 0
      ? Math.max(...existingPeriods.map(p => p.period_number)) + 1
      : 1;

    // Pre-select the first week of the detected term
    const td = termDateMap[term];
    const weeks = td ? buildTermWeeks(td.start, td.end) : [];
    const firstWeek = weeks[0] || {};

    setForm({
      term,
      year: new Date().getFullYear(),
      period_number: nextNumber,
      week: firstWeek.week || 1,
      start_date: firstWeek.start || '',
      end_date: firstWeek.end || '',
    });
    setShowCreateModal(true);
  };

  const openEditModal = (period) => {
    setEditingPeriod(period);
    setForm({
      term: period.term,
      year: period.year,
      period_number: period.period_number,
      week: period.week,
      start_date: period.start_date,
      end_date: period.end_date,
    });
  };

  const getStatusBadge = (period) => {
    if (period.is_active) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full"><Play size={12} /> Active</span>;
    }
    if (period.status === 'completed') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full"><CheckCircle size={12} /> Completed</span>;
    }
    if (period.status === 'upcoming') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full"><Clock size={12} /> Upcoming</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full"><AlertCircle size={12} /> {period.status}</span>;
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading...</div>;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Current Status */}
      {currentStatus && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-5" style={{ background: 'var(--wt-surface)' }}>
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
            <Calendar size={16} /> Current Screening Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Active Period</span>
              <p className="text-lg font-semibold text-slate-900">
                {currentStatus.active?.name || 'None'}
              </p>
              {currentStatus.active && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {fmtDisplayFromISO(currentStatus.active.start_date)} – {fmtDisplayFromISO(currentStatus.active.end_date)}
                </p>
              )}
            </div>
            <div>
              <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Current Term</span>
              <p className="text-lg font-semibold text-slate-900">{currentTermName}</p>
            </div>
            <div>
              <span className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide">Upcoming</span>
              <p className="text-sm text-slate-900">
                {currentStatus.upcoming?.length > 0 
                  ? `${currentStatus.upcoming.length} period(s) in next 14 days`
                  : 'No upcoming periods'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Screening Periods</h3>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Create Period
        </button>
      </div>

      {/* Periods List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {periods.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Calendar size={48} className="mx-auto mb-3 text-slate-300" />
            <p>No screening periods created yet.</p>
            <p className="text-sm text-slate-400 mt-1">Create periods for each term to track SAEBRS data.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Period</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Dates</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...periods].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')).map((period) => (
                <tr key={period.period_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{period.name}</div>
                    <div className="text-xs text-slate-500">{period.year}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-slate-700 font-medium">
                      {fmtDisplayFromISO(period.start_date)} – {fmtDisplayFromISO(period.end_date)}
                    </div>
                  </td>
                  <td className="py-3 px-4">{getStatusBadge(period)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {period.is_active ? (
                        <button
                          onClick={() => setConfirmAction({ type: 'deactivate', period })}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ type: 'activate', period })}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(period)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: 'delete', period })}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingPeriod) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">
                {editingPeriod ? 'Edit Screening Period' : 'Create Screening Period'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPeriod(null);
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Term Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Term</label>
                <div className="grid grid-cols-4 gap-2">
                  {TERMS.map(term => {
                    const isCurrent = term === currentTermName;
                    const hasDates = !!termDateMap[term];
                    return (
                      <button
                        key={term}
                        onClick={() => setForm(prev => ({ ...prev, term }))}
                        disabled={editingPeriod}
                        className={`py-2 text-sm font-medium rounded-lg border transition-all ${
                          form.term === term
                            ? 'bg-blue-600 text-white border-blue-600'
                            : isCurrent
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                        } ${editingPeriod ? 'opacity-50 cursor-not-allowed' : ''} ${!hasDates && !editingPeriod ? 'opacity-40' : ''}`}
                      >
                        {term}
                        {isCurrent && form.term !== term && <span className="block text-[10px] opacity-75">Current</span>}
                      </button>
                    );
                  })}
                </div>
                {!termDateMap[form.term] && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={12} /> No calendar dates set for {form.term}. Add them in Settings → Calendar.
                  </p>
                )}
              </div>

              {/* Period Number */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Period Number</label>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-slate-400">P</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.period_number}
                    onChange={(e) => setForm(prev => ({ ...prev, period_number: parseInt(e.target.value) || 1 }))}
                    disabled={editingPeriod}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Auto-named: {form.term} - P{form.period_number}
                </p>
              </div>

              {/* Date Selection — computed from term dates */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Screening Dates</label>
                {termWeeks.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                    {termWeeks.map(w => (
                      <button
                        key={w.week}
                        onClick={() => handleWeekSelect(w)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all ${
                          form.week === w.week
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-100 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No term dates available to compute weeks.</p>
                )}
              </div>

              {/* Year (hidden unless needed) */}
              {!editingPeriod && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingPeriod(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={editingPeriod ? handleUpdate : handleCreate}
                disabled={!form.start_date || !form.end_date}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editingPeriod ? 'Save Changes' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
            <div className="p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                confirmAction.type === 'delete' ? 'bg-red-100' : confirmAction.type === 'deactivate' ? 'bg-amber-100' : 'bg-emerald-100'
              }`}>
                {confirmAction.type === 'delete' ? <Trash2 size={18} className="text-red-600" /> :
                 confirmAction.type === 'deactivate' ? <AlertCircle size={18} className="text-amber-600" /> :
                 <Play size={18} className="text-emerald-600" />}
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                {confirmAction.type === 'activate' && 'Activate Screening Period'}
                {confirmAction.type === 'deactivate' && 'Deactivate Screening Period'}
                {confirmAction.type === 'delete' && 'Delete Screening Period'}
              </h3>
              <p className="text-sm text-slate-500">
                {confirmAction.type === 'activate' && (
                  <>Are you sure you want to activate <strong>{confirmAction.period.name}</strong>? Any currently active period will be deactivated.</>
                )}
                {confirmAction.type === 'deactivate' && (
                  <>Are you sure you want to deactivate <strong>{confirmAction.period.name}</strong>? Screening will not be linked to any active period.</>
                )}
                {confirmAction.type === 'delete' && (
                  <>Are you sure you want to delete <strong>{confirmAction.period.name}</strong>? This cannot be undone.</>
                )}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-200">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                  confirmAction.type === 'deactivate' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmAction.type === 'activate' && 'Activate'}
                {confirmAction.type === 'deactivate' && 'Deactivate'}
                {confirmAction.type === 'delete' && 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
