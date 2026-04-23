import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Check } from 'lucide-react';

/**
 * Shared Add-Intervention modal used by InterventionsPage and StudentProfilePage.
 *
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSave: (form) => Promise<void>  — parent handles API + state updates
 * - students: [{ student_id, first_name, last_name, preferred_name, class_name, year_level, photo_url }]
 * - interventionTypes: string[]
 * - professionals: users with role=professional
 * - allUsers: all tenant users
 * - lockedStudentId: when set, student is fixed (used from Student Profile page)
 */
export default function AddInterventionModal({
  open, onClose, onSave,
  students = [], interventionTypes = [], professionals = [], allUsers = [],
  lockedStudentId = null,
}) {
  const [form, setForm] = useState({
    student_id: lockedStudentId || '',
    intervention_type: '',
    assigned_staff: '',
    start_date: '',
    review_date: '',
    goals: '',
    rationale: '',
    frequency: '',
    status: 'active',
    progress_notes: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Student typeahead ────────────────────────────────────────────────────
  const [studentQuery, setStudentQuery] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const studentBoxRef = useRef(null);

  const lockedStudent = lockedStudentId ? students.find(s => s.student_id === lockedStudentId) : null;

  useEffect(() => {
    if (!open) return;
    // Reset on open
    setForm({
      student_id: lockedStudentId || '',
      intervention_type: '', assigned_staff: '', start_date: '', review_date: '',
      goals: '', rationale: '', frequency: '', status: 'active', progress_notes: '',
    });
    setStudentQuery('');
    setShowStudentDropdown(false);
    setFrequencyChecks({ daily: false, weekly: false });
    setFreqCustom('');
  }, [open, lockedStudentId]);

  useEffect(() => {
    const handler = (e) => {
      if (studentBoxRef.current && !studentBoxRef.current.contains(e.target)) {
        setShowStudentDropdown(false);
      }
    };
    if (showStudentDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStudentDropdown]);

  const matchedStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 30);
    return students.filter(s => {
      const fn = (s.first_name || '').toLowerCase();
      const pn = (s.preferred_name || '').toLowerCase();
      const ln = (s.last_name || '').toLowerCase();
      const cls = (s.class_name || '').toLowerCase();
      return fn.includes(q) || ln.includes(q) || pn.includes(q) || cls.includes(q) ||
             `${fn} ${ln}`.includes(q) || `${ln} ${fn}`.includes(q);
    }).slice(0, 30);
  }, [studentQuery, students]);

  const selectedStudent = students.find(s => s.student_id === form.student_id);
  const pickStudent = (s) => {
    setForm(p => ({ ...p, student_id: s.student_id }));
    setStudentQuery('');
    setShowStudentDropdown(false);
  };

  // ── Frequency helpers ────────────────────────────────────────────────────
  // Checkboxes for common cadences + a free-text input, combined into a single
  // human-readable `frequency` string. Keeps backend schema untouched.
  const [frequencyChecks, setFrequencyChecks] = useState({ daily: false, weekly: false });
  const [freqCustom, setFreqCustom] = useState('');

  useEffect(() => {
    const parts = [];
    if (frequencyChecks.daily) parts.push('Daily');
    if (frequencyChecks.weekly) parts.push('Weekly');
    if (freqCustom.trim()) parts.push(freqCustom.trim());
    setForm(p => ({ ...p, frequency: parts.join(' · ') }));
  }, [frequencyChecks, freqCustom]);

  // ── Save ─────────────────────────────────────────────────────────────────
  // Backend Intervention model requires student_id, intervention_type,
  // assigned_staff, start_date AND review_date — gate the button on all of
  // them so the user gets clear affordance instead of a 422.
  const canSave = !!(form.student_id && form.intervention_type && form.assigned_staff
                     && form.start_date && form.review_date) && !saving;
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      // parent surfaces error; keep modal open
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputBase = 'w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20';
  const label = 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1';

  // Split tenant users into the three role groups used by the dropdown.
  // "Staff" = teachers + screeners (practical "school staff" bucket).
  const wellbeingUsers  = allUsers.filter(u => u.role === 'wellbeing');
  const leadershipUsers = allUsers.filter(u => u.role === 'leadership');
  const teacherStaff    = allUsers.filter(u => u.role === 'teacher' || u.role === 'screener');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" data-testid="add-intervention-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>New Intervention</h3>
          <button onClick={onClose} aria-label="Close">
            <X size={18} className="text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Student — typeahead OR locked pill */}
          {lockedStudentId ? (
            <div>
              <label className={label}>Student</label>
              <div className="px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200">
                {lockedStudent ? `${lockedStudent.first_name} ${lockedStudent.last_name}${lockedStudent.class_name ? ` — ${lockedStudent.class_name}` : ''}` : 'Student'}
              </div>
            </div>
          ) : (
            <div ref={studentBoxRef}>
              <label className={label}>Student</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-900 dark:text-slate-100">
                    <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong>
                    {selectedStudent.class_name && <span className="text-slate-500 dark:text-slate-400"> — {selectedStudent.class_name}</span>}
                  </span>
                  <button
                    onClick={() => setForm(p => ({ ...p, student_id: '' }))}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    data-testid="clear-student-selection"
                  >Change</button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    value={studentQuery}
                    onChange={(e) => { setStudentQuery(e.target.value); setShowStudentDropdown(true); }}
                    onFocus={() => setShowStudentDropdown(true)}
                    placeholder="Type a student's name to search…"
                    data-testid="intervention-student-typeahead"
                    className={`${inputBase} pl-9`}
                  />
                  {showStudentDropdown && matchedStudents.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-64 overflow-y-auto" data-testid="student-typeahead-dropdown">
                      {matchedStudents.map(s => (
                        <button
                          key={s.student_id}
                          onClick={() => pickStudent(s)}
                          data-testid={`student-option-${s.student_id}`}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-sm transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {s.photo_url ? (
                              <img src={s.photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{(s.first_name || '?')[0]}</span>
                            )}
                          </div>
                          <span className="flex-1 truncate">
                            <strong>{s.first_name}</strong> {s.last_name}
                            {s.class_name && <span className="text-slate-400 dark:text-slate-500"> — {s.class_name}</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showStudentDropdown && studentQuery.trim() && matchedStudents.length === 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400" data-testid="student-typeahead-empty">
                      No students match "{studentQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Intervention Type */}
          <div>
            <label className={label}>Intervention Type</label>
            <input
              list="aim-intervention-type-options"
              value={form.intervention_type}
              onChange={e => setForm(p => ({ ...p, intervention_type: e.target.value }))}
              placeholder="Select or type intervention type"
              data-testid="intervention-type-input"
              className={inputBase}
            />
            <datalist id="aim-intervention-type-options">
              {interventionTypes.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          {/* Assigned Staff — grouped */}
          <div>
            <label className={label}>Assigned Staff</label>
            <select
              value={form.assigned_staff}
              onChange={e => setForm(p => ({ ...p, assigned_staff: e.target.value }))}
              data-testid="intervention-assigned-staff"
              className={`${inputBase} bg-white dark:bg-slate-800`}
            >
              <option value="">Select assignee…</option>
              <optgroup label="Group">
                <option value="Unassigned">Unassigned (no one specific)</option>
                <option value="Multiple">Multiple</option>
              </optgroup>
              {wellbeingUsers.length > 0 && (
                <optgroup label="Wellbeing">
                  <option value="Wellbeing">Wellbeing (entire team)</option>
                  {wellbeingUsers.map(u => (
                    <option key={u.user_id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
              )}
              {wellbeingUsers.length === 0 && (
                <optgroup label="Wellbeing">
                  <option value="Wellbeing">Wellbeing</option>
                </optgroup>
              )}
              {leadershipUsers.length > 0 && (
                <optgroup label="Leadership">
                  <option value="Leadership">Leadership (entire team)</option>
                  {leadershipUsers.map(u => (
                    <option key={u.user_id} value={u.name}>{u.name}</option>
                  ))}
                </optgroup>
              )}
              {leadershipUsers.length === 0 && (
                <optgroup label="Leadership">
                  <option value="Leadership">Leadership</option>
                </optgroup>
              )}
              {professionals.length > 0 && (
                <optgroup label="Professionals">
                  {professionals.map(p => (
                    <option key={p.user_id} value={p.name}>{p.name}{p.professional_type ? ` — ${p.professional_type}` : ''}</option>
                  ))}
                </optgroup>
              )}
              {teacherStaff.length > 0 && (
                <optgroup label="Staff">
                  {teacherStaff
                    .filter(u => !professionals.some(p => p.user_id === u.user_id))
                    .map(u => (
                      <option key={u.user_id} value={u.name}>{u.name}{u.role ? ` — ${u.role}` : ''}</option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className={inputBase} />
            </div>
            <div>
              <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">Review Date</label>
              <input type="date" value={form.review_date} onChange={e => setForm(p => ({ ...p, review_date: e.target.value }))}
                className={inputBase} />
            </div>
          </div>

          {/* Frequency — checkboxes + custom */}
          <div>
            <label className={label}>Frequency</label>
            <div className="flex items-center flex-wrap gap-2">
              <FreqCheck
                checked={frequencyChecks.daily}
                onChange={(v) => setFrequencyChecks(p => ({ ...p, daily: v }))}
                label="Daily"
                testid="freq-daily"
              />
              <FreqCheck
                checked={frequencyChecks.weekly}
                onChange={(v) => setFrequencyChecks(p => ({ ...p, weekly: v }))}
                label="Weekly"
                testid="freq-weekly"
              />
              <input
                type="text"
                value={freqCustom}
                onChange={e => setFreqCustom(e.target.value)}
                placeholder="or type (e.g. 3× per week, Fortnightly)"
                data-testid="freq-custom"
                className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
            </div>
            {form.frequency && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Will save as: <strong>{form.frequency}</strong></p>
            )}
          </div>

          <textarea placeholder="Reason for intervention" rows={2} value={form.rationale}
            onChange={e => setForm(p => ({ ...p, rationale: e.target.value }))}
            className={`${inputBase} resize-none`} />
          <textarea placeholder="Goals" rows={3} value={form.goals}
            onChange={e => setForm(p => ({ ...p, goals: e.target.value }))}
            className={`${inputBase} resize-none`} />
          <textarea placeholder="Initial progress notes (optional)" rows={2} value={form.progress_notes}
            onChange={e => setForm(p => ({ ...p, progress_notes: e.target.value }))}
            className={`${inputBase} resize-none`} />
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleSave}
            disabled={!canSave}
            data-testid="save-intervention-btn"
            className="flex-1 py-3 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--wt-accent)' }}
          >
            {saving ? 'Saving…' : 'Save Intervention'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function FreqCheck({ checked, onChange, label, testid }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm border transition-colors ${
        checked
          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
      }`}
    >
      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
        {checked && <Check size={9} strokeWidth={3} />}
      </div>
      {label}
    </button>
  );
}
