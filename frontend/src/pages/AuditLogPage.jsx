import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Shield, ChevronLeft, ChevronRight, Search, Filter, Loader } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { timeAgo } from '../utils/dateFmt';

const ACTION_COLORS = {
  created: 'bg-emerald-100 text-emerald-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-rose-100 text-rose-700',
  uploaded: 'bg-indigo-100 text-indigo-700',
  bulk_import: 'bg-purple-100 text-purple-700',
  bulk_archive: 'bg-amber-100 text-amber-700',
  bulk_reactivate: 'bg-teal-100 text-teal-700',
  login: 'bg-slate-100 text-slate-600',
};

const ENTITY_TYPES = ['student', 'screening', 'intervention', 'case_note', 'settings', 'user', 'photo', 'document', 'attendance', 'backup'];

export default function AuditLogPage() {
  useDocumentTitle('Audit Log');
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage] = useState(30);
  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (filterEntity) params.set('entity_type', filterEntity);
      if (filterAction) params.set('action', filterAction);
      if (filterDateFrom) params.set('date_from', filterDateFrom);
      if (filterDateTo) params.set('date_to', filterDateTo);
      if (searchUser) params.set('user_id', searchUser);
      const res = await api.get(`/audit?${params.toString()}`);
      setEntries(res.data.entries || []);
      setTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, filterEntity, filterAction, filterDateFrom, filterDateTo, searchUser]);

  const totalPages = Math.ceil(total / perPage);

  // Extract unique actions from current data for the filter dropdown
  const uniqueActions = [...new Set(entries.map(e => e.action).filter(Boolean))].sort();

  if (user?.role !== 'admin') {
    return (
      <div className="p-6 lg:p-8 fade-in">
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Shield size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">Admin access required</p>
          <p className="text-sm text-slate-400 mt-1">Only administrators can view the audit log.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <Shield size={28} className="text-slate-600" /> Audit Log
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {total} event{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
            <option value="">All entities</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
            <option value="">All actions</option>
            {['created', 'updated', 'deleted', 'uploaded', 'bulk_import', 'bulk_archive', 'bulk_reactivate', 'login'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder="From" />
          <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            placeholder="To" />
          {(filterEntity || filterAction || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setFilterEntity(''); setFilterAction(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(0); }}
              className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <Loader size={20} className="animate-spin mx-auto mb-2" /> Loading audit log…
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Shield size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No audit entries found</p>
            <p className="text-xs mt-1">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">When</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">Entity</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700 text-xs">Description</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr key={entry.audit_id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="text-xs text-slate-500" title={entry.timestamp}>{timeAgo(entry.timestamp)}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs font-medium text-slate-700">{entry.user_name || entry.user_email || entry.user_id || '—'}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-600'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs text-slate-600">{entry.entity_type}</span>
                      {entry.entity_id && (
                        <span className="text-[10px] text-slate-400 ml-1 font-mono">{entry.entity_id.slice(0, 12)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 max-w-xs">
                      <span className="text-xs text-slate-600 truncate block">{entry.description || '—'}</span>
                      {entry.bulk_count > 0 && (
                        <span className="text-[10px] text-slate-400">{entry.bulk_count} items</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <span className="text-xs font-medium text-slate-600 px-2">
                {page + 1} / {totalPages}
              </span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
