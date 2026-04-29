import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  ClipboardList, ArrowRight, Filter, ChevronDown, ChevronUp, Loader, User, Plus
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { timeAgo } from '../utils/dateFmt';
import SupportPlanFormModal from '../components/SupportPlanFormModal';

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

export default function ActionPlansPage() {
  useDocumentTitle('Support Plans');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canDo } = usePermissions();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [tierFilter, setTierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        const res = await api.get(`/action-plans?${params.toString()}`);
        setPlans(res.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    let list = plans;
    if (tierFilter) list = list.filter(p => String(p.tier) === tierFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [plans, tierFilter, searchQuery]);

  // Group by student
  const grouped = useMemo(() => {
    const map = {};
    for (const p of filtered) {
      const key = p.student_id;
      if (!map[key]) map[key] = { student_id: key, student_name: p.student_name, student_year_level: p.student_year_level, student_class: p.student_class, plans: [] };
      map[key].plans.push(p);
    }
    return Object.values(map).sort((a, b) => a.student_name.localeCompare(b.student_name));
  }, [filtered]);

  const counts = useMemo(() => ({
    active: plans.filter(p => p.status === 'active').length,
    draft: plans.filter(p => p.status === 'draft').length,
    overdue: plans.filter(p => {
      if (!p.review_date || p.status !== 'active') return false;
      return p.review_date < new Date().toISOString().slice(0, 10);
    }).length,
  }), [plans]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <ClipboardList size={28} className="text-slate-600" /> Support Plans
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage student action plans and track progress</p>
        </div>
        {canDo('action-plans.add_edit') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus size={18} /> New Support Plan
          </button>
        )}
      </div>

      <SupportPlanFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={async (payload, planId) => {
          if (planId) {
            await api.put(`/action-plans/${planId}`, payload);
          } else {
            await api.post('/action-plans', payload);
          }
          // Refresh plans
          const params = new URLSearchParams();
          if (statusFilter) params.set('status', statusFilter);
          const res = await api.get(`/action-plans?${params.toString()}`);
          setPlans(res.data);
        }}
        editingPlan={null}
        prefillStudent={null}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Active Plans', value: counts.active, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Drafts', value: counts.draft, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-100' },
          { label: 'Review Overdue', value: counts.overdue, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold ${s.color}`} style={{ fontFamily: 'Manrope,sans-serif' }}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {['', 'active', 'draft', 'completed', 'archived'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); }}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
          <option value="">All tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search student name…"
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 w-48" />
      </div>

      {/* Plan list grouped by student */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Loader size={20} className="animate-spin mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-400">Loading plans…</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <ClipboardList size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">No support plans found</p>
          <p className="text-sm text-slate-400 mt-1">Support plans created from student profiles will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(group => (
            <div key={group.student_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Student header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => navigate(`/students/${group.student_id}`)}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                  <User size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{group.student_name}</p>
                  <p className="text-[11px] text-slate-400">{[group.student_year_level, group.student_class].filter(Boolean).join(' · ')}</p>
                </div>
                <span className="text-xs text-slate-400">{group.plans.length} plan{group.plans.length !== 1 ? 's' : ''}</span>
                <ArrowRight size={14} className="text-slate-400" />
              </div>

              {/* Plans */}
              <div className="divide-y divide-slate-100">
                {group.plans.map(plan => (
                  <div key={plan.plan_id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/students/${plan.student_id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-800">{plan.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[plan.status]}`}>{plan.status}</span>
                        {plan.tier && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${TIER_COLORS[plan.tier]}`}>Tier {plan.tier}</span>}
                        {plan.review_date && plan.status === 'active' && plan.review_date < new Date().toISOString().slice(0, 10) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">Review Overdue</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{plan.goals?.length || 0} goal{(plan.goals?.length || 0) !== 1 ? 's' : ''}</span>
                        <span>{plan.strategies?.length || 0} strateg{(plan.strategies?.length || 0) !== 1 ? 'ies' : 'y'}</span>
                        {plan.review_date && <span>Review: {plan.review_date}</span>}
                        {plan.reviews?.length > 0 && <span>{plan.reviews.length} review{plan.reviews.length !== 1 ? 's' : ''}</span>}
                        <span>Created {timeAgo(plan.created_at)}</span>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      
    </div>
  );
}
