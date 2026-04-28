import React, { useState } from 'react';
import api from '../api';
import { Plus, X, Edit2, Trash2, ChevronDown, ChevronUp, Check, FileText, Loader, ClipboardList } from 'lucide-react';
import { timeAgo, todayLocal } from '../utils/dateFmt';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-slate-100 text-slate-400',
};

const TIER_COLORS = {
  1: 'bg-emerald-100 text-emerald-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-rose-100 text-rose-700',
};

const EMPTY_PLAN = {
  title: 'Support Plan',
  tier: null,
  strengths: '',
  concerns: '',
  goals: [{ description: '', target: '', timeline: '' }],
  strategies: [{ description: '', responsible: '' }],
  responsible_staff: [],
  parent_involvement: '',
  review_schedule: 'Fortnightly',
  review_date: '',
  notes: '',
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

function PlanCard({ plan, onEdit, onDelete, onAddReview, expanded, onToggle }) {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [review, setReview] = useState({ notes: '', outcome: 'on_track', next_review_date: '', date: todayLocal() });
  const [submitting, setSubmitting] = useState(false);

  const submitReview = async () => {
    setSubmitting(true);
    try {
      await onAddReview(plan.plan_id, review);
      setShowReviewForm(false);
      setReview({ notes: '', outcome: 'on_track', next_review_date: '', date: todayLocal() });
    } catch { }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-slate-900">{plan.title || 'Support Plan'}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[plan.status] || STATUS_COLORS.draft}`}>{plan.status}</span>
            {plan.tier && <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${TIER_COLORS[plan.tier] || ''}`}>Tier {plan.tier}</span>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400">
            <span>Created {timeAgo(plan.created_at)} by {plan.created_by_name}</span>
            {plan.review_date && <span>· Review: {plan.review_date}</span>}
            {plan.reviews?.length > 0 && <span>· {plan.reviews.length} review{plan.reviews.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Strengths & Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.strengths && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Strengths</h4>
                <p className="text-sm text-slate-700 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">{plan.strengths}</p>
              </div>
            )}
            {plan.concerns && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Concerns</h4>
                <p className="text-sm text-slate-700 bg-rose-50/50 p-3 rounded-lg border border-rose-100">{plan.concerns}</p>
              </div>
            )}
          </div>

          {/* Goals */}
          {plan.goals?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Goals</h4>
              <div className="space-y-1.5">
                {plan.goals.map((g, i) => <GoalRow key={i} goal={g} index={i} readOnly />)}
              </div>
            </div>
          )}

          {/* Strategies */}
          {plan.strategies?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Strategies</h4>
              <div className="space-y-1.5">
                {plan.strategies.map((s, i) => <StrategyRow key={i} strategy={s} index={i} readOnly />)}
              </div>
            </div>
          )}

          {/* Parent & Review info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.parent_involvement && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Parent Involvement</h4>
                <p className="text-sm text-slate-600">{plan.parent_involvement}</p>
              </div>
            )}
            {plan.review_schedule && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Review Schedule</h4>
                <p className="text-sm text-slate-600">{plan.review_schedule}{plan.review_date ? ` · Next: ${plan.review_date}` : ''}</p>
              </div>
            )}
          </div>

          {plan.notes && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Additional Notes</h4>
              <p className="text-sm text-slate-600">{plan.notes}</p>
            </div>
          )}

          {/* Reviews history */}
          {plan.reviews?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Review History</h4>
              <div className="space-y-2">
                {plan.reviews.map((r) => (
                  <div key={r.review_id} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-700">{r.date}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        r.outcome === 'on_track' ? 'bg-emerald-100 text-emerald-700' :
                        r.outcome === 'needs_adjustment' ? 'bg-amber-100 text-amber-700' :
                        r.outcome === 'goals_met' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{r.outcome?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">{r.reviewed_by_name}</span>
                    </div>
                    {r.notes && <p className="text-xs text-slate-600">{r.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            {plan.status !== 'archived' && (
              <button onClick={() => setShowReviewForm(!showReviewForm)}
                className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5">
                <Plus size={12} /> Add Review
              </button>
            )}
            <button onClick={() => onEdit(plan)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={() => onDelete(plan.plan_id)}
              className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1.5">
              <Trash2 size={12} /> Delete
            </button>
          </div>

          {/* Review form */}
          {showReviewForm && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">New Review</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="date" value={review.date} onChange={e => setReview(p => ({ ...p, date: e.target.value }))}
                  className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                <select value={review.outcome} onChange={e => setReview(p => ({ ...p, outcome: e.target.value }))}
                  className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                  <option value="on_track">On Track</option>
                  <option value="needs_adjustment">Needs Adjustment</option>
                  <option value="goals_met">Goals Met</option>
                  <option value="not_progressing">Not Progressing</option>
                </select>
              </div>
              <textarea value={review.notes} onChange={e => setReview(p => ({ ...p, notes: e.target.value }))}
                placeholder="Review notes..." rows={3}
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <input type="date" value={review.next_review_date} onChange={e => setReview(p => ({ ...p, next_review_date: e.target.value }))}
                placeholder="Next review date" className="text-sm px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <div className="flex gap-2">
                <button onClick={submitReview} disabled={submitting}
                  className="text-xs px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
                  {submitting ? 'Saving…' : 'Save Review'}
                </button>
                <button onClick={() => setShowReviewForm(false)}
                  className="text-xs px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupportPlanTab({ studentId, studentName, tier, canEdit }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_PLAN });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/action-plans?student_id=${studentId}`);
      setPlans(res.data);
      if (res.data.length === 1) setExpandedId(res.data[0].plan_id);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, [studentId]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...EMPTY_PLAN, tier: tier || null });
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setForm({
      title: plan.title || 'Support Plan',
      tier: plan.tier,
      strengths: plan.strengths || '',
      concerns: plan.concerns || '',
      goals: plan.goals?.length ? plan.goals : [{ description: '', target: '', timeline: '' }],
      strategies: plan.strategies?.length ? plan.strategies : [{ description: '', responsible: '' }],
      responsible_staff: plan.responsible_staff || [],
      parent_involvement: plan.parent_involvement || '',
      review_schedule: plan.review_schedule || 'Fortnightly',
      review_date: plan.review_date || '',
      notes: plan.notes || '',
      status: plan.status || 'draft',
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editingPlan) {
        await api.put(`/action-plans/${editingPlan.plan_id}`, form);
      } else {
        await api.post('/action-plans', { ...form, student_id: studentId });
      }
      setShowForm(false);
      load();
    } catch (err) { alert(err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm('Delete this support plan?')) return;
    try {
      await api.delete(`/action-plans/${planId}`);
      load();
    } catch { alert('Failed to delete'); }
  };

  const addReview = async (planId, review) => {
    await api.post(`/action-plans/${planId}/reviews`, review);
    load();
  };

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

  if (loading) {
    return <div className="py-16 text-center text-slate-400"><Loader size={20} className="animate-spin mx-auto mb-2" />Loading support plans…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{plans.length} plan{plans.length !== 1 ? 's' : ''}</p>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors">
            <Plus size={14} /> New Plan
          </button>
        )}
      </div>

      {/* Plans list */}
      {plans.length === 0 && !showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          <ClipboardList size={28} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No support plans yet</p>
          <p className="text-xs mt-1 text-slate-300">Create a structured support plan to document goals, strategies, and review progress</p>
        </div>
      )}

      {plans.map(plan => (
        <PlanCard key={plan.plan_id} plan={plan}
          expanded={expandedId === plan.plan_id}
          onToggle={() => setExpandedId(expandedId === plan.plan_id ? null : plan.plan_id)}
          onEdit={openEdit} onDelete={deletePlan} onAddReview={addReview} />
      ))}

      {/* Create / Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>
                {editingPlan ? 'Edit Support Plan' : 'New Support Plan'}
              </h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
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
                {editingPlan && (
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
              <button onClick={save} disabled={saving}
                className="flex-1 bg-slate-900 text-white py-2.5 text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
