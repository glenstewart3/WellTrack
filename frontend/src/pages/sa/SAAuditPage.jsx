import React, { useState, useEffect } from 'react';
import { ScrollText, Loader2, ChevronLeft, ChevronRight, Shield, School, UserPlus, Key, Trash2, LogIn } from 'lucide-react';
import saApi from '../../api-superadmin';

const ACTION_ICONS = {
  login: LogIn, created_school: School, updated_school: School, archived_school: Trash2,
  added_school_admin: UserPlus, removed_school_admin: Trash2, reset_password: Key,
  impersonated: Shield, created_super_admin: Shield, deleted_super_admin: Trash2,
};

const ACTION_COLORS = {
  login: 'text-blue-500 bg-blue-50',
  created_school: 'text-teal-500 bg-teal-50',
  updated_school: 'text-amber-500 bg-amber-50',
  archived_school: 'text-red-500 bg-red-50',
  added_school_admin: 'text-violet-500 bg-violet-50',
  removed_school_admin: 'text-red-500 bg-red-50',
  reset_password: 'text-amber-500 bg-amber-50',
  impersonated: 'text-blue-500 bg-blue-50',
  created_super_admin: 'text-teal-500 bg-teal-50',
  deleted_super_admin: 'text-red-500 bg-red-50',
};

export default function SAAuditPage() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const perPage = 30;

  useEffect(() => {
    setLoading(true);
    saApi.get('/audit', { params: { page, per_page: perPage } })
      .then(r => { setEntries(r.data.entries); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div data-testid="sa-audit-page">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-stone-900">Audit Log</h1>
        <p className="text-sm text-stone-500 mt-0.5">{total} total entries</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-stone-400 text-sm">No audit entries yet</div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-stone-100" data-testid="sa-audit-entries">
            {entries.map(e => {
              const Icon = ACTION_ICONS[e.action] || ScrollText;
              const color = ACTION_COLORS[e.action] || 'text-stone-500 bg-stone-50';
              return (
                <div key={e.audit_id} className="flex items-start gap-3 px-5 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-800">
                      <span className="font-medium">{e.super_admin_name}</span>{' '}
                      <span className="text-stone-500">{formatAction(e.action)}</span>{' '}
                      {e.entity_name && <span className="font-medium">{e.entity_name}</span>}
                    </p>
                    {e.details && Object.keys(e.details).length > 0 && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {JSON.stringify(e.details).slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 shrink-0 whitespace-nowrap">
                    {e.timestamp ? formatTime(e.timestamp) : ''}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-stone-100 bg-stone-50">
              <span className="text-xs text-stone-500">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1.5 rounded text-stone-500 hover:bg-white disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1.5 rounded text-stone-500 hover:bg-white disabled:opacity-30">
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
