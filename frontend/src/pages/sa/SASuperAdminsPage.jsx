import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Loader2, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useSAAuth } from '../../context/SuperAdminAuthContext';
import saApi from '../../api-superadmin';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function SASuperAdminsPage() {
  useDocumentTitle('Super Admins · Super Admin');
  const { admin: currentAdmin } = useSAAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    saApi.get('/super-admins')
      .then(r => setAdmins(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (sa) => {
    if (sa.super_admin_id === currentAdmin?.super_admin_id) return;
    if (!window.confirm(`Delete super admin "${sa.name}"?`)) return;
    try {
      await saApi.delete(`/super-admins/${sa.super_admin_id}`);
      load();
    } catch(e) { console.warn("SA action failed:", e.response?.data?.detail || e.message); }
  };

  return (
    <div data-testid="sa-admins-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Super Admins</h1>
          <p className="text-sm text-slate-500 mt-0.5">Platform administrators with full access</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm" data-testid="sa-add-admin-button">
          <Plus size={16} /> Add Super Admin
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-800" data-testid="sa-admins-list">
          {admins.map(sa => (
            <div key={sa.super_admin_id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {(sa.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{sa.name}</p>
                  <p className="text-xs text-slate-400">{sa.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{sa.created_at ? new Date(sa.created_at).toLocaleDateString() : ''}</span>
                {sa.super_admin_id === currentAdmin?.super_admin_id ? (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">YOU</span>
                ) : (
                  <button onClick={() => handleDelete(sa)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" data-testid={`sa-delete-admin-${sa.super_admin_id}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddSuperAdminModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddSuperAdminModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await saApi.post('/super-admins', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create super admin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="sa-add-admin-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Add Super Admin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3 border border-red-200 flex items-start gap-2"><AlertCircle size={14} className="mt-0.5" />{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 8 characters" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 dark:bg-slate-800 rounded-lg">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 flex items-center gap-2" data-testid="sa-add-admin-submit">
              {submitting && <Loader2 size={14} className="animate-spin" />} Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
