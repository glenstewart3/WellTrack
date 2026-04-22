import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { School, Plus, Search, Users, Loader2, ExternalLink, X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { SA_PATH_PREFIX } from '../../context/SABasePath';
import saApi from '../../api-superadmin';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function SASchoolsPage() {
  useDocumentTitle('Schools · Super Admin');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    saApi.get('/schools')
      .then(r => setSchools(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = schools.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name?.toLowerCase().includes(q) || s.slug?.toLowerCase().includes(q) || s.contact_email?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div data-testid="sa-schools-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Schools</h1>
          <p className="text-sm text-slate-500 mt-0.5">{schools.length} school(s) registered</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition-colors" data-testid="sa-add-school-button">
          <Plus size={16} /> Add School
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search schools..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="sa-school-search"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'trial', 'suspended', 'archived'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${statusFilter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              data-testid={`sa-filter-${f}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">No schools match your filters</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="sa-schools-table">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">School</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Slug</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Students</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Users</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last Active</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map(s => (
                  <tr key={s.school_id || s.slug} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigate(`${SA_PATH_PREFIX}/schools/${s.school_id}`)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                          <School size={14} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.contact_email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{s.slug}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 text-center font-medium text-slate-700">{s.student_count ?? 0}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{s.user_count ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.last_active ? new Date(s.last_active).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`${SA_PATH_PREFIX}/schools/${s.school_id}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-700" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <AddSchoolModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    trial: 'bg-amber-100 text-amber-700',
    suspended: 'bg-red-100 text-red-700',
    archived: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{status}</span>;
}

function AddSchoolModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', contact_name: '', contact_email: '',
    admin_name: '', admin_email: '', admin_password: '',
    status: 'active', trial_days: 30,
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const autoSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (name) => {
    const newSlug = form.slug === autoSlug(form.name) || !form.slug ? autoSlug(name) : form.slug;
    setForm({ ...form, name, slug: newSlug });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await saApi.post('/schools', form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create school');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="sa-add-school-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900">Add New School</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3 border border-red-200" data-testid="sa-add-school-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">School Name *</label>
              <input value={form.name} onChange={e => handleNameChange(e.target.value)} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Dummy School" data-testid="sa-school-name-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Slug * <span className="text-slate-400 font-normal">(subdomain)</span></label>
              <div className="flex items-center gap-1">
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="mooroopna" data-testid="sa-school-slug-input" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{form.slug || '...'}.{process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
              <input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="jane@school.edu.au" />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-700 mb-3">School Admin Account</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Admin Name *</label>
                <input value={form.admin_name} onChange={e => setForm({ ...form, admin_name: e.target.value })} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Admin name" data-testid="sa-admin-name-input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Admin Email *</label>
                <input type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} required className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@school.edu.au" data-testid="sa-admin-email-input" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Admin Password *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} required minLength={8} className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min 8 characters" data-testid="sa-admin-password-input" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm" data-testid="sa-add-school-submit">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Create School
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
