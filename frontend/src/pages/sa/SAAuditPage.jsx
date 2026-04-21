import React, { useState, useEffect } from 'react';
import { ScrollText, Loader2, ChevronLeft, ChevronRight, Shield, School, UserPlus, Key, Trash2, LogIn, Filter } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import saApi from '../../api-superadmin';

const ACTION_ICONS = {
  login: LogIn, created_school: School, updated_school: School, archived_school: Trash2,
  added_school_admin: UserPlus, removed_school_admin: Trash2, reset_password: Key,
  impersonated: Shield, created_super_admin: Shield, deleted_super_admin: Trash2,
  tenant_updated: School, tenant_created: UserPlus, tenant_deleted: Trash2,
  tenant_bulk_import: UserPlus, tenant_data_wipe: Trash2, tenant_uploaded: School,
};

const ACTION_COLORS = {
  login: 'text-blue-500 bg-blue-50',
  created_school: 'text-emerald-500 bg-emerald-50',
  updated_school: 'text-amber-500 bg-amber-50',
  archived_school: 'text-red-500 bg-red-50',
  added_school_admin: 'text-violet-500 bg-violet-50',
  removed_school_admin: 'text-red-500 bg-red-50',
  reset_password: 'text-amber-500 bg-amber-50',
  impersonated: 'text-blue-500 bg-blue-50',
  created_super_admin: 'text-emerald-500 bg-emerald-50',
  deleted_super_admin: 'text-red-500 bg-red-50',
  tenant_updated: 'text-amber-500 bg-amber-50',
  tenant_created: 'text-emerald-500 bg-emerald-50',
  tenant_deleted: 'text-red-500 bg-red-50',
  tenant_bulk_import: 'text-violet-500 bg-violet-50',
  tenant_data_wipe: 'text-red-500 bg-red-50',
  tenant_uploaded: 'text-blue-500 bg-blue-50',
};

export default function SAAuditPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [trend, setTrend] = useState(null);
  const perPage = 30;

  // One-shot: load schools list for the filter
  useEffect(() => {
    saApi.get('/schools').then(r => setSchools(r.data || [])).catch(() => {});
  }, []);

  // Audit entries (paginated + filtered)
  useEffect(() => {
    setLoading(true);
    const params = { page, per_page: perPage };
    if (tenantFilter) params.tenant_slug = tenantFilter;
    saApi.get('/audit', { params })
      .then(r => { setEntries(r.data.entries); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tenantFilter]);

  // Trend chart (last 30 days of settings/admin changes)
  useEffect(() => {
    const params = { days: 30 };
    if (tenantFilter) params.tenant_slug = tenantFilter;
    saApi.get('/audit/trend', { params })
      .then(r => setTrend(r.data))
      .catch(() => setTrend(null));
  }, [tenantFilter]);

  // Reset to page 0 when filter changes
  useEffect(() => { setPage(0); }, [tenantFilter]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const activeSchool = schools.find(s => s.slug === tenantFilter);

  return (
    <div data-testid="sa-audit-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} {tenantFilter ? `entries for ${activeSchool?.name || tenantFilter}` : 'total entries'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            data-testid="sa-audit-tenant-filter"
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[180px]"
          >
            <option value="">All schools</option>
            {schools.map(s => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Trend chart */}
      {trend && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5" data-testid="sa-audit-trend">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Settings & administration changes</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Last 30 days · {trend.total} tenant-configuration changes
                {tenantFilter && activeSchool ? ` from ${activeSchool.name}` : ' across all tenants'}
              </p>
            </div>
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{trend.total}</span>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="saTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(d) => { try { const x = new Date(d); return `${x.getDate()}/${x.getMonth() + 1}`; } catch { return d; } }}
                  interval={4}
                  axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelFormatter={(d) => { try { return new Date(d).toLocaleDateString(); } catch { return d; } }}
                  formatter={(v) => [v, 'changes']}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#saTrendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          {tenantFilter ? `No audit entries for ${activeSchool?.name || tenantFilter}` : 'No audit entries yet'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100" data-testid="sa-audit-entries">
            {entries.map(e => {
              const Icon = ACTION_ICONS[e.action] || ScrollText;
              const color = ACTION_COLORS[e.action] || 'text-slate-500 bg-slate-50';
              return (
                <div key={e.audit_id} className="flex items-start gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{e.super_admin_name}</span>{' '}
                      <span className="text-slate-500">{formatAction(e.action)}</span>{' '}
                      {e.entity_name && <span className="font-medium">{e.entity_name}</span>}
                      {e.tenant_slug && (
                        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          <School size={10} />{e.school_name || e.tenant_slug}
                        </span>
                      )}
                    </p>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {JSON.stringify(e.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                    {e.timestamp ? formatTime(e.timestamp) : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-1">
                <button data-testid="sa-audit-prev" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded text-slate-500 hover:bg-white disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button data-testid="sa-audit-next" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded text-slate-500 hover:bg-white disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatAction(action) {
  return (action || '').replace(/_/g, ' ');
}

function formatTime(ts) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}
