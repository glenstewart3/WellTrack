import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardList, ArrowRight, Filter, ChevronDown, ChevronUp, Loader, User, Plus, X, Search
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { timeAgo } from '../utils/dateFmt';

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
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [tierFilter, setTierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newPlan, setNewPlan] = useState({
    title: '',
    tier: '2',
    goals: '',
    strategies: ''
  });
  const [creating, setCreating] = useState(false);
  
  // Load students for selection
  useEffect(() => {
    if (!showCreateModal) return;
    api.get('/students?limit=100').then(r => setStudents(r.data?.students || [])).catch(() => {});
  }, [showCreateModal]);

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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus size={18} /> New Support Plan
        </button>
      </div>

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
      
      {/* Create Support Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Create Support Plan</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-5 overflow-y-auto">
              {/* Student Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Student *</label>
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
                      className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
              
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan Title *</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Reading Support Plan - Term 2"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              
              {/* Tier */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Support Tier *</label>
                <div className="flex gap-3">
                  {[
                    { value: '1', label: 'Tier 1', desc: 'Universal', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                    { value: '2', label: 'Tier 2', desc: 'Targeted', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                    { value: '3', label: 'Tier 3', desc: 'Intensive', color: 'bg-rose-100 text-rose-700 border-rose-200' },
                  ].map(tier => (
                    <button
                      key={tier.value}
                      onClick={() => setNewPlan(p => ({ ...p, tier: tier.value }))}
                      className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                        newPlan.tier === tier.value 
                          ? tier.color + ' border-current' 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${newPlan.tier === tier.value ? '' : 'text-slate-700'}`}>{tier.label}</p>
                      <p className={`text-xs ${newPlan.tier === tier.value ? '' : 'text-slate-500'}`}>{tier.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Goals */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Goals (optional)</label>
                <textarea
                  value={newPlan.goals}
                  onChange={(e) => setNewPlan(p => ({ ...p, goals: e.target.value }))}
                  placeholder="Enter goals, one per line"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">One goal per line. You can add more later.</p>
              </div>
              
              {/* Strategies */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Strategies (optional)</label>
                <textarea
                  value={newPlan.strategies}
                  onChange={(e) => setNewPlan(p => ({ ...p, strategies: e.target.value }))}
                  placeholder="Enter strategies, one per line"
                  rows={3}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">One strategy per line. You can add more later.</p>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedStudent || !newPlan.title.trim()) return;
                  setCreating(true);
                  try {
                    const payload = {
                      student_id: selectedStudent.student_id,
                      title: newPlan.title.trim(),
                      tier: parseInt(newPlan.tier),
                      status: 'draft',
                      goals: newPlan.goals.split('\n').filter(g => g.trim()).map(g => ({ description: g.trim(), achieved: false })),
                      strategies: newPlan.strategies.split('\n').filter(s => s.trim()),
                      review_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    };
                    await api.post('/action-plans', payload);
                    setShowCreateModal(false);
                    setNewPlan({ title: '', tier: '2', goals: '', strategies: '' });
                    setSelectedStudent(null);
                    // Refresh plans
                    const params = new URLSearchParams();
                    if (statusFilter) params.set('status', statusFilter);
                    const res = await api.get(`/action-plans?${params.toString()}`);
                    setPlans(res.data);
                  } catch (e) {
                    alert('Failed to create support plan: ' + (e.response?.data?.detail || e.message));
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={!selectedStudent || !newPlan.title.trim() || creating}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader size={16} className="animate-spin" /> : <Plus size={18} />}
                {creating ? 'Creating...' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
