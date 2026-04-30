import React, { useState } from 'react';
import api from '../api';
import { Plus, Edit2, FileText, Loader, ClipboardList, Eye } from 'lucide-react';
import { timeAgo } from '../utils/dateFmt';
import SupportPlanFormModal from './SupportPlanFormModal';
import SupportPlanDetailModal from './SupportPlanDetailModal';

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

function PlanCard({ plan, onView, onEdit }) {
  const isOverdue = plan.review_date && plan.status === 'active' && plan.review_date < new Date().toISOString().slice(0, 10);
  
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      <div className="p-4 flex items-center gap-4">
        {/* Status Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          plan.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
          plan.status === 'completed' ? 'bg-blue-50 text-blue-600' :
          'bg-slate-50 text-slate-500'
        }`}>
          <FileText size={22} />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(plan)}>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900">{plan.title || 'Support Plan'}</h3>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[plan.status]}`}>{plan.status}</span>
            {plan.tier && <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${TIER_COLORS[plan.tier]}`}>Tier {plan.tier}</span>}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
            <span>{plan.goals?.length || 0} goals</span>
            <span>{plan.strategies?.length || 0} strategies</span>
            {plan.review_date && (
              <span className={isOverdue ? 'text-rose-500 font-medium' : ''}>
                Review: {plan.review_date}{isOverdue && ' (Overdue)'}
              </span>
            )}
            {plan.reviews?.length > 0 && <span>· {plan.reviews.length} review{plan.reviews.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onView(plan)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="View details"
          >
            <Eye size={18} />
          </button>
          <button 
            onClick={() => onEdit(plan)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            title="Edit plan"
          >
            <Edit2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SupportPlanTab({ studentId, studentName, tier, canEdit }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/action-plans?student_id=${studentId}`);
      setPlans(res.data);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, [studentId]);

  const openCreate = () => {
    setEditingPlan(null);
    setShowForm(true);
  };

  const openEdit = (plan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSave = async (payload, planId) => {
    if (planId) {
      await api.put(`/action-plans/${planId}`, payload);
    } else {
      await api.post('/action-plans', payload);
    }
    load();
  };

  const deletePlan = async (planId) => {
    if (!window.confirm('Delete this support plan?')) return;
    try {
      await api.delete(`/action-plans/${planId}`);
      load();
    } catch { alert('Failed to delete'); }
  };

  const addReview = async (plan, review) => {
    await api.post(`/action-plans/${plan.plan_id}/reviews`, review);
    load();
    setViewingPlan(null);
  };


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
          onView={() => setViewingPlan(plan)}
          onEdit={openEdit} />
      ))}

      <SupportPlanFormModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        editingPlan={editingPlan}
        prefillStudent={studentId ? {
          student_id: studentId,
          name: studentName,
          year_level: '',
          class_name: ''
        } : null}
      />

      <SupportPlanDetailModal
        plan={viewingPlan}
        isOpen={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        onEdit={(plan) => { setViewingPlan(null); openEdit(plan); }}
        onDelete={deletePlan}
        onAddReview={(plan) => { setViewingPlan(null); openEdit(plan); }}
      />
    </div>
  );
}
