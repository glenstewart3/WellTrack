import React from 'react';
import { X, Target, CheckCircle2, Users, Calendar, FileText, Clock, User, ChevronRight, TrendingUp, Lightbulb, AlertCircle } from 'lucide-react';
import { timeAgo } from '../utils/dateFmt';

const STATUS_CONFIG = {
  draft: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText, label: 'Draft' },
  active: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Target, label: 'Active' },
  completed: { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2, label: 'Completed' },
  archived: { color: 'bg-slate-100 text-slate-400 border-slate-200', icon: FileText, label: 'Archived' },
};

const OUTCOME_COLORS = {
  on_track: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  needs_adjustment: 'bg-amber-100 text-amber-700 border-amber-200',
  goals_met: 'bg-blue-100 text-blue-700 border-blue-200',
  not_progressing: 'bg-rose-100 text-rose-700 border-rose-200',
};

const OUTCOME_LABELS = {
  on_track: 'On Track',
  needs_adjustment: 'Needs Adjustment',
  goals_met: 'Goals Met',
  not_progressing: 'Not Progressing',
};

function Section({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 ${className}`}>
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        {Icon && <Icon size={16} className="text-slate-500" />}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoCard({ label, value, icon: Icon, variant = 'default' }) {
  const variantClasses = {
    default: 'bg-white border-slate-200',
    success: 'bg-emerald-50/50 border-emerald-200',
    warning: 'bg-amber-50/50 border-amber-200',
    danger: 'bg-rose-50/50 border-rose-200',
  };
  
  return (
    <div className={`rounded-xl border p-4 ${variantClasses[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className="text-slate-400" />}
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm text-slate-700">{value || '—'}</p>
    </div>
  );
}

export default function SupportPlanDetailModal({ plan, isOpen, onClose, onEdit, onDelete, onAddReview }) {
  if (!isOpen || !plan) return null;

  const statusConfig = STATUS_CONFIG[plan.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${statusConfig.color}`}>
              <StatusIcon size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{plan.title}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {plan.tier && (
                  <span className="text-xs text-slate-500">
                    Tier {plan.tier} Support
                  </span>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard 
              label="Created" 
              value={timeAgo(plan.created_at)} 
              icon={Clock}
            />
            <InfoCard 
              label="Review Date" 
              value={plan.review_date || 'Not set'} 
              icon={Calendar}
            />
            <InfoCard 
              label="Created By" 
              value={plan.created_by_name || plan.staff_member} 
              icon={User}
            />
            <InfoCard 
              label="Schedule" 
              value={plan.review_schedule || 'Not set'} 
              icon={Clock}
            />
          </div>

          {/* Strengths & Concerns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.strengths && (
              <Section title="Strengths" icon={Lightbulb} className="border-l-4 border-l-emerald-400">
                <p className="text-sm text-slate-700 leading-relaxed">{plan.strengths}</p>
              </Section>
            )}
            {plan.concerns && (
              <Section title="Areas of Concern" icon={AlertCircle} className="border-l-4 border-l-rose-400">
                <p className="text-sm text-slate-700 leading-relaxed">{plan.concerns}</p>
              </Section>
            )}
          </div>

          {/* Goals */}
          {plan.goals?.length > 0 && (
            <Section title="Goals" icon={Target}>
              <div className="space-y-3">
                {plan.goals.map((goal, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 mb-1">{goal.description}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        {goal.target && (
                          <span className="flex items-center gap-1">
                            <ChevronRight size={12} /> Target: {goal.target}
                          </span>
                        )}
                        {goal.timeline && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> Timeline: {goal.timeline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Strategies */}
          {plan.strategies?.length > 0 && (
            <Section title="Strategies & Interventions" icon={TrendingUp}>
              <div className="space-y-3">
                {plan.strategies.map((strategy, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 mb-1">{strategy.description}</p>
                      {strategy.responsible && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Users size={12} /> Responsible: {strategy.responsible}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Parent Involvement & Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.parent_involvement && (
              <Section title="Parent Involvement" icon={Users}>
                <p className="text-sm text-slate-700 leading-relaxed">{plan.parent_involvement}</p>
              </Section>
            )}
            {plan.notes && (
              <Section title="Additional Notes" icon={FileText}>
                <p className="text-sm text-slate-700 leading-relaxed">{plan.notes}</p>
              </Section>
            )}
          </div>

          {/* Review History */}
          {plan.reviews?.length > 0 && (
            <Section title={`Review History (${plan.reviews.length})`} icon={Clock}>
              <div className="space-y-3">
                {plan.reviews.map((review) => (
                  <div key={review.review_id} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">{review.date}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${OUTCOME_COLORS[review.outcome] || 'bg-slate-100 text-slate-600'}`}>
                          {OUTCOME_LABELS[review.outcome] || review.outcome}
                        </span>
                      </div>
                      {review.reviewed_by_name && (
                        <span className="text-xs text-slate-400">{review.reviewed_by_name}</span>
                      )}
                    </div>
                    {review.notes && (
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{review.notes}</p>
                    )}
                    {review.next_review_date && (
                      <p className="text-xs text-slate-400 mt-2">Next review: {review.next_review_date}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* No Reviews State */}
          {(!plan.reviews || plan.reviews.length === 0) && plan.status !== 'draft' && (
            <div className="text-center py-8 text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No reviews recorded yet</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
          <button 
            onClick={() => onDelete && onDelete(plan.plan_id)}
            className="px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            Delete Plan
          </button>
          <div className="flex gap-3">
            {plan.status !== 'archived' && (
              <button 
                onClick={() => onAddReview && onAddReview(plan)}
                className="px-4 py-2 text-sm font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Add Review
              </button>
            )}
            <button 
              onClick={() => onEdit && onEdit(plan)}
              className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Edit Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
