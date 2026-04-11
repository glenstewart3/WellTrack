import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, School, Users, Activity, Globe, Pencil, Trash2, UserPlus, Key, Loader2,
  AlertCircle, CheckCircle, XCircle, X, Eye, EyeOff, ExternalLink, Shield, ToggleLeft, ToggleRight
} from 'lucide-react';
import saApi from '../../api-superadmin';

export default function SASchoolDetailPage() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const [school, setSchool] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editStatus, setEditStatus] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [resetUser, setResetUser] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      saApi.get(`/schools/${schoolId}`),
      saApi.get(`/schools/${schoolId}/admins`),
    ])
      .then(([s, a]) => { setSchool(s.data); setAdmins(a.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (status) => {
    try {
      const res = await saApi.put(`/schools/${schoolId}`, { status });
      setSchool(res.data);
      setEditStatus(null);
    } catch {}
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${school.name}"? The school data will be preserved but users won't be able to log in.`)) return;
    try {
      await saApi.delete(`/schools/${schoolId}`);
      navigate('/sa/schools');
    } catch {}
  };

  const handleRemoveUser = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from this school?`)) return;
    try {
      await saApi.delete(`/schools/${schoolId}/admins/${userId}`);
      load();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!school) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>School not found</p>
        <Link to="/sa/schools" className="text-blue-600 text-sm mt-2 inline-block">Back to Schools</Link>
      </div>
    );
  }

  return (
    <div data-testid="sa-school-detail-page">
      <Link to="/sa/schools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={14} /> Back to Schools
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
            <School size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{school.name}</h1>
            <p className="text-sm text-slate-400 font-mono">{school.slug}.welltrack.com.au</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusSelector current={school.status} onChange={handleStatusChange} />
          <button onClick={handleArchive} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Archive school" data-testid="sa-archive-school">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6" data-testid="sa-school-stats">
        <StatCard icon={Users} label="Students" value={school.student_count ?? 0} color="text-blue-600 bg-blue-50" />
        <StatCard icon={Shield} label="Admins" value={school.admin_count ?? 0} color="text-violet-600 bg-violet-50" />
        <StatCard icon={Users} label="Total Users" value={school.user_count ?? 0} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={Activity} label="Onboarding" value={school.onboarding_complete ? 'Complete' : 'Pending'} color={school.onboarding_complete ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'} />
      </div>

      {/* Details */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">School Details</h2>
          <dl className="space-y-2 text-sm">
            <DetailRow label="Database" value={school.db_name} mono />
            <DetailRow label="Status" value={school.status} />
            <DetailRow label="Contact" value={school.contact_name || '-'} />
            <DetailRow label="Contact Email" value={school.contact_email || '-'} />
            <DetailRow label="Created" value={school.created_at ? new Date(school.created_at).toLocaleDateString() : '-'} />
            {school.trial_expires_at && <DetailRow label="Trial Expires" value={new Date(school.trial_expires_at).toLocaleDateString()} />}
            {school.notes && <DetailRow label="Notes" value={school.notes} />}
          </dl>
        </div>

        {/* Feature Flags */}
        <FeatureFlagsCard schoolId={schoolId} flags={school.feature_flags || {}} onUpdated={(updated) => setSchool(updated)} />
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">School Users ({admins.length})</h2>
          <button onClick={() => setShowAddUser(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700" data-testid="sa-add-user-button">
            <UserPlus size={14} /> Add User
          </button>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto" data-testid="sa-school-users">
          {admins.map(u => (
            <div key={u.user_id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase">{u.role}</span>
                <button onClick={() => setResetUser(u)} className="p-1 text-slate-400 hover:text-amber-600 rounded" title="Reset password">
                  <Key size={13} />
                </button>
                <button onClick={() => handleRemoveUser(u.user_id, u.name)} className="p-1 text-slate-400 hover:text-red-600 rounded" title="Remove user" data-testid={`sa-remove-user-${u.user_id}`}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {admins.length === 0 && <div className="px-5 py-6 text-center text-sm text-slate-400">No users</div>}
        </div>
      </div>

      {showAddUser && <AddUserModal schoolId={schoolId} onClose={() => setShowAddUser(false)} onCreated={() => { setShowAddUser(false); load(); }} />}
      {resetUser && <ResetPasswordModal schoolId={schoolId} user={resetUser} onClose={() => setResetUser(null)} onDone={() => setResetUser(null)} />}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} />
        <span className="text-xs font-medium opacity-70">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex justify-between items-start">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-800 font-medium text-right max-w-[60%] truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function StatusSelector({ current, onChange }) {
  const [open, setOpen] = useState(false);
  const statuses = ['active', 'trial', 'suspended'];
  const styles = {
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    trial: 'bg-amber-100 text-amber-700 border-amber-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
    archived: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase flex items-center gap-1.5 ${styles[current]}`} data-testid="sa-status-selector">
        {current} <Pencil size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
          {statuses.filter(s => s !== current).map(s => (
            <button key={s} onClick={() => { onChange(s); setOpen(false); }} className="w-full px-4 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 capitalize">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddUserModal({ schoolId, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await saApi.post(`/schools/${schoolId}/admins`, form);
      onCreated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="sa-add-user-modal">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Add User to School</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3 border border-red-200 flex items-start gap-2"><AlertCircle size={14} className="mt-0.5" />{error}</div>}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} className="w-full border border-slate-200 rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="admin">Admin</option>
              <option value="leadership">Leadership</option>
              <option value="wellbeing">Wellbeing</option>
              <option value="teacher">Teacher</option>
              <option value="screener">Screener</option>
              <option value="professional">Professional</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-50 flex items-center gap-2" data-testid="sa-add-user-submit">
              {submitting && <Loader2 size={14} className="animate-spin" />} Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const FLAG_LABELS = {
  appointments: 'Appointments Module',
  ai_suggestions: 'AI Suggestions (Ollama)',
  google_auth: 'Google OAuth Login',
  saebrs_plus: 'SAEBRS+ Self-Report',
};

function FeatureFlagsCard({ schoolId, flags, onUpdated }) {
  const [saving, setSaving] = useState(false);

  const toggleFlag = async (key) => {
    setSaving(true);
    const newFlags = { ...flags, [key]: !flags[key] };
    try {
      const res = await saApi.put(`/schools/${schoolId}`, { feature_flags: newFlags });
      onUpdated(res.data);
    } catch {}
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5" data-testid="sa-feature-flags-card">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">Feature Flags</h2>
      <div className="space-y-3">
        {Object.entries(FLAG_LABELS).map(([key, label]) => {
          const enabled = flags[key] !== false;
          return (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-slate-700">{label}</span>
              <button
                onClick={() => toggleFlag(key)}
                disabled={saving}
                data-testid={`flag-toggle-${key}`}
                className={`transition-colors ${enabled ? 'text-emerald-600' : 'text-slate-300'}`}
              >
                {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-3">Flags control which modules are visible to school users.</p>
    </div>
  );
}


function ResetPasswordModal({ schoolId, user, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await saApi.put(`/schools/${schoolId}/admins/${user.user_id}/reset-password`, { password });
      setSuccess(true);
      setTimeout(onDone, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Reset Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500">Resetting password for <strong>{user.name}</strong> ({user.email})</p>
          {error && <div className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</div>}
          {success && <div className="text-emerald-600 text-sm bg-emerald-50 rounded-lg p-3 flex items-center gap-2"><CheckCircle size={14} /> Password reset successfully</div>}
          {!success && (
            <>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="New password (min 8 chars)" className="w-full border border-slate-200 rounded-lg px-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 text-sm text-white bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {submitting && <Loader2 size={14} className="animate-spin" />} Reset
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
