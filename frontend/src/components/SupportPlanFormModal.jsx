import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, X, Loader, User, Search } from 'lucide-react';

const EMPTY_PLAN = {
  title: 'Support Plan',
  tier: 2,
  strengths: '',
  concerns: '',
  goals: [{ description: '', target: '', timeline: '' }],
  strategies: [{ description: '', responsible: '' }],
  responsible_staff: [],
  parent_involvement: '',
  review_schedule: 'Fortnightly',
  review_date: '',
  notes: '',
  status: 'draft',
};

function GoalRow({ goal, index, onChange, onRemove, readOnly }) {
  if (readOnly) {
    return (
      <div className="flex gap-2 p-2.5 bg-slate-50 rounded-lg text-sm">
        <span className="text-slate-400 font-mono text-xs mt-0.5">{index + 1}.</span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-700">{goal.description}</p>
          {goal.target && <p className="text-xs text-slate-500 mt-0.5">Target: {goal.target}</p>}
          {goal.timeline && <p className="text-xs text-slate-400">Timeline: {goal.timeline}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xs text-slate-400 font-mono mt-2.5">{index + 1}.</span>
      <div className="flex-1 space-y-1.5">
        <input value={goal.description} onChange={e => onChange(index, 'description', e.target.value)}
          placeholder="Goal description" className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        <div className="flex gap-2">
          <input value={goal.target || ''} onChange={e => onChange(index, 'target', e.target.value)}
            placeholder="Measurable target" className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          <input value={goal.timeline || ''} onChange={e => onChange(index, 'timeline', e.target.value)}
            placeholder="By when" className="w-32 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
      </div>
      <button onClick={() => onRemove(index)} className="mt-2 p-1 text-slate-400 hover:text-rose-500"><X size={14} /></button>
    </div>
  );
}

function StrategyRow({ strategy, index, onChange, onRemove, readOnly }) {
  if (readOnly) {
    return (
      <div className="flex gap-2 p-2.5 bg-slate-50 rounded-lg text-sm">
        <span className="text-slate-400 font-mono text-xs mt-0.5">{index + 1}.</span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-700">{strategy.description}</p>
          {strategy.responsible && <p className="text-xs text-slate-500 mt-0.5">Responsible: {strategy.responsible}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-start">
      <span className="text-xs text-slate-400 font-mono mt-2.5">{index + 1}.</span>
      <div className="flex-1 space-y-1.5">
        <input value={strategy.description} onChange={e => onChange(index, 'description', e.target.value)}
          placeholder="Strategy / action" className="w-full text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        <input value={strategy.responsible || ''} onChange={e => onChange(index, 'responsible', e.target.value)}
          placeholder="Responsible staff" className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
      </div>
      <button onClick={() => onRemove(index)} className="mt-2 p-1 text-slate-400 hover:text-rose-500"><X size={14} /></button>
    </div>
  );
}

export default function SupportPlanFormModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editingPlan = null,
  prefillStudent = null // { student_id, name, year_level, class_name } - if provided, student is locked
}) {
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(prefillStudent);
  const [form, setForm] = useState({ ...EMPTY_PLAN });
  const [saving, setSaving] = useState(false);

  // Load students if no prefill
  useEffect(() => {
    if (!isOpen || prefillStudent) return;
    api.get('/students?limit=100').then(r => setStudents(r.data?.students || [])).catch(() => {});
  }, [isOpen, prefillStudent]);

  // Reset form when opening
  useEffect(() => {
    if (!isOpen) return;
    if (editingPlan) {
      setForm({
        title: editingPlan.title || 'Support Plan',
        tier: editingPlan.tier || 2,
        strengths: editingPlan.strengths || '',
        concerns: editingPlan.concerns || '',
        goals: editingPlan.goals?.length ? editingPlan.goals : [{ description: '', target: '', timeline: '' }],
        strategies: editingPlan.strategies?.length ? editingPlan.strategies : [{ description: '', responsible: '' }],
        responsible_staff: editingPlan.responsible_staff || [],
        parent_involvement: editingPlan.parent_involvement || '',
        review_schedule: editingPlan.review_schedule || 'Fortnightly',
        review_date: editingPlan.review_date || '',
        notes: editingPlan.notes || '',
        status: editingPlan.status || 'draft',
      });
      setSelectedStudent(prefillStudent || { 
        student_id: editingPlan.student_id,
        name: editingPlan.student_name,
        year_level: editingPlan.student_year_level,
        class_name: editingPlan.student_class
      });
    } else {
      setForm({ ...EMPTY_PLAN });
      setSelectedStudent(prefillStudent || null);
    }
    setStudentSearch('');
  }, [isOpen, editingPlan, prefillStudent]);

  const updateGoal = (i, field, value) => {
    setForm(f => {
      const goals = [...f.goals];
      goals[i] = { ...goals[i], [field]: value };
      return { ...f, goals };
    });
  };
  const removeGoal = (i) => setForm(f => ({ ...f, goals: f.goals.filter((_, idx) => idx !== i) }));
  const addGoal = () => setForm(f => ({ ...f, goals: [...f.goals, { description: '', target: '', timeline: '' }] }));

  const updateStrategy = (i, field, value) => {
    setForm(f => {
      const strategies = [...f.strategies];
      strategies[i] = { ...strategies[i], [field]: value };
      return { ...f, strategies };
    });
  };
  const removeStrategy = (i) => setForm(f => ({ ...f, strategies: f.strategies.filter((_, idx) => idx !== i) }));
  const addStrategy = () => setForm(f => ({ ...f, strategies: [...f.strategies, { description: '', responsible: '' }] }));

  const handleSave = async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        student_id: selectedStudent.student_id,
        goals: form.goals.filter(g => g.description.trim()),
        strategies: form.strategies.filter(s => s.description.trim()),
      };
      await onSave(payload, editingPlan?.plan_id);
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!editingPlan;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>
            {isEdit ? 'Edit Support Plan' : 'New Support Plan'}
          </h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        
        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Student Selection (only if no prefill) */}
          {!prefillStudent && (
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Student *</label>
              {selectedStudent ? (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
                    <User size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{selectedStudent.name}</p>
                    <p className="text-xs text-slate-500">{[selectedStudent.year_level, selectedStudent.class_name].filter(Boolean).join(' · ')}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="p-1 hover:bg-blue-100 rounded transition-colors"
                  >
                    <X size={16} className="text-blue-600" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student name..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                  {studentSearch.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                      {students
                        .filter(s => s.name?.toLowerCase().includes(studentSearch.toLowerCase()))
                        .slice(0, 6)
                        .map(student => (
                          <button
                            key={student.student_id}
                            onClick={() => { setSelectedStudent(student); setStudentSearch(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
                              <User size={12} className="text-slate-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">{student.name}</p>
                              <p className="text-xs text-slate-500">{[student.year_level, student.class_name].filter(Boolean).join(' · ')}</p>
                            </div>
                          </button>
                        ))}
                      {students.filter(s => s.name?.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-slate-400">No students found</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Title & Tier & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Tier</label>
              <select value={form.tier || ''} onChange={e => setForm(f => ({ ...f, tier: e.target.value ? Number(e.target.value) : null }))}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                <option value="">—</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                <select value={form.status || 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Strengths</label>
              <textarea value={form.strengths} onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                rows={3} placeholder="Student strengths, interests, motivators…"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Concerns</label>
              <textarea value={form.concerns} onChange={e => setForm(f => ({ ...f, concerns: e.target.value }))}
                rows={3} placeholder="Areas of concern, risk factors…"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>
          </div>

          {/* Goals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Goals</label>
              <button onClick={addGoal} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"><Plus size={12} /> Add goal</button>
            </div>
            <div className="space-y-2">
              {form.goals.map((g, i) => (
                <GoalRow key={i} goal={g} index={i} onChange={updateGoal} onRemove={removeGoal} />
              ))}
            </div>
          </div>

          {/* Strategies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">Strategies</label>
              <button onClick={addStrategy} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"><Plus size={12} /> Add strategy</button>
            </div>
            <div className="space-y-2">
              {form.strategies.map((s, i) => (
                <StrategyRow key={i} strategy={s} index={i} onChange={updateStrategy} onRemove={removeStrategy} />
              ))}
            </div>
          </div>

          {/* Parent & Review */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Parent Involvement</label>
              <textarea value={form.parent_involvement} onChange={e => setForm(f => ({ ...f, parent_involvement: e.target.value }))}
                rows={2} placeholder="How parents/guardians will be involved…"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Review Schedule</label>
                <select value={form.review_schedule} onChange={e => setForm(f => ({ ...f, review_schedule: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option>Weekly</option>
                  <option>Fortnightly</option>
                  <option>Monthly</option>
                  <option>Each term</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Next Review Date</label>
                <input type="date" value={form.review_date || ''} onChange={e => setForm(f => ({ ...f, review_date: e.target.value }))}
                  className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Additional Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Anything else…"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-slate-200">
          <button 
            onClick={handleSave} 
            disabled={saving || (!prefillStudent && !selectedStudent)}
            className="flex-1 bg-slate-900 text-white py-2.5 text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <span className="flex items-center justify-center gap-2"><Loader size={14} className="animate-spin" /> Saving…</span> : (isEdit ? 'Update Plan' : 'Create Plan')}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 py-2.5 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
