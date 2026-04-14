import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { School, Users, Activity, AlertTriangle, ArrowRight, Loader2, Clock } from 'lucide-react';
import { SA_PATH_PREFIX } from '../../context/SABasePath';
import saApi from '../../api-superadmin';

export default function SADashboardPage() {
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([saApi.get('/stats'), saApi.get('/schools')])
      .then(([s, sch]) => { setStats(s.data); setSchools(sch.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Schools', value: stats?.total_schools ?? 0, icon: School, color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { label: 'Active Schools', value: stats?.active_schools ?? 0, icon: Activity, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
    { label: 'Trial Schools', value: stats?.trial_schools ?? 0, icon: Clock, color: 'bg-amber-50 text-amber-600 border-amber-200' },
    { label: 'Total Students', value: stats?.total_students ?? 0, icon: Users, color: 'bg-violet-50 text-violet-600 border-violet-200' },
  ];

  const recentSchools = [...schools]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 5);

  return (
    <div data-testid="sa-dashboard-page">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">WellTrack multi-tenant administration</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="sa-stat-cards">
        {statCards.map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={18} />
              <span className="text-xs font-medium opacity-80">{s.label}</span>
            </div>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Warnings */}
      {(stats?.suspended_schools > 0 || stats?.archived_schools > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            {stats.suspended_schools > 0 && <span>{stats.suspended_schools} suspended school(s). </span>}
            {stats.archived_schools > 0 && <span>{stats.archived_schools} archived school(s).</span>}
          </div>
        </div>
      )}

      {/* Recent schools */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Recent Schools</h2>
          <Link to={`${SA_PATH_PREFIX}/schools`} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-slate-100" data-testid="sa-recent-schools">
          {recentSchools.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No schools provisioned yet</div>
          ) : recentSchools.map(s => (
            <Link
              key={s.school_id || s.slug}
              to={`${SA_PATH_PREFIX}/schools/${s.school_id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <School size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.slug}.{process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>{s.student_count ?? 0} students</span>
                <StatusBadge status={s.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    trial: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
    archived: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[status] || 'bg-slate-100 text-slate-500'}`} data-testid={`status-badge-${status}`}>
      {status}
    </span>
  );
}
