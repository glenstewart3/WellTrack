import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import {
  UserCog, Plus, Trash2, X, Shield, Edit2, Loader, Mail, KeyRound,
  Eye, EyeOff, CheckCircle, Lock, LayoutDashboard, ClipboardCheck,
  Users, Radar, BarChart3, Target, CalendarDays, Users2, Bell, Settings,
  RotateCcw, Zap,
} from 'lucide-react';
import { DEFAULT_FEATURE_PERMISSIONS } from '../hooks/usePermissions';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_OPTIONS = [
  { value: 'teacher',    label: 'Teacher',          color: 'bg-blue-100 text-blue-700' },
  { value: 'screener',   label: 'Screener',         color: 'bg-indigo-100 text-indigo-700' },
  { value: 'wellbeing',  label: 'Wellbeing Staff',  color: 'bg-purple-100 text-purple-700' },
  { value: 'leadership', label: 'Leadership',       color: 'bg-emerald-100 text-emerald-700' },
  { value: 'admin',      label: 'Administrator',    color: 'bg-slate-900 text-white' },
];

const getRoleBadge = (role) => ROLE_OPTIONS.find(r => r.value === role)?.color || 'bg-slate-100 text-slate-600';

// Pages that can be toggled per role (key matches route path without leading slash)
const PERMISSION_PAGES = [
  { key: 'dashboard',     label: 'Dashboard',           icon: LayoutDashboard },
  { key: 'screening',     label: 'Screening',           icon: ClipboardCheck },
  { key: 'students',      label: 'Students & Profiles', icon: Users },
  { key: 'radar',         label: 'Class Risk Radar',    icon: Radar },
  { key: 'analytics',     label: 'Analytics & Reports', icon: BarChart3 },
  { key: 'interventions', label: 'Interventions',       icon: Target },
  { key: 'attendance',    label: 'Attendance',          icon: CalendarDays },
  { key: 'meeting',       label: 'MTSS Meeting',        icon: Users2 },
  { key: 'alerts',        label: 'Alerts',              icon: Bell },
  { key: 'settings',      label: 'Settings',            icon: Settings },
];

// Feature-level actions that can be toggled per role
const FEATURE_ACTIONS = [
  { key: 'students.add_edit',         label: 'Add & Edit Students',           group: 'Students' },
  { key: 'students.archive',          label: 'Archive / Reactivate Students', group: 'Students' },
  { key: 'case_notes.add_edit',       label: 'Add & Edit Case Notes',         group: 'Students' },
  { key: 'case_notes.delete',         label: 'Delete Case Notes',             group: 'Students' },
  { key: 'interventions.add_edit',    label: 'Add & Edit Interventions',      group: 'Interventions' },
  { key: 'interventions.delete',      label: 'Delete Interventions',          group: 'Interventions' },
  { key: 'interventions.ai_suggest',  label: 'Use AI Suggestions',            group: 'Interventions' },
  { key: 'screenings.submit',         label: 'Submit Screenings',             group: 'Screening' },
  { key: 'alerts.approve',            label: 'Approve / Reject Alerts',       group: 'Alerts' },
  { key: 'attendance.upload',         label: 'Upload Attendance Data',        group: 'Attendance' },
  { key: 'analytics.export',          label: 'Export Data (CSV / PDF)',       group: 'Analytics & Reports' },
];

const ACTION_GROUPS = [...new Set(FEATURE_ACTIONS.map(a => a.group))];

// Roles that admins can configure (admin itself is always full access)
const CONFIGURABLE_ROLES = [
  { value: 'teacher',    label: 'Teacher' },
  { value: 'screener',   label: 'Screener' },
  { value: 'wellbeing',  label: 'Wellbeing' },
  { value: 'leadership', label: 'Leadership' },
];

const DEFAULT_PERMISSIONS = {
  teacher:    ['dashboard', 'screening', 'students', 'radar', 'analytics', 'interventions', 'meeting', 'alerts'],
  screener:   ['screening'],
  wellbeing:  ['dashboard', 'screening', 'students', 'radar', 'analytics', 'interventions', 'meeting', 'alerts'],
  leadership: ['dashboard', 'screening', 'students', 'radar', 'analytics', 'interventions', 'attendance', 'meeting', 'alerts'],
};

// ── TAB NAV ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'User Management', icon: UserCog },
  { key: 'Role Permissions', icon: Shield },
];

function TabNav({ active, onChange }) {
  return (
    <div className="flex gap-1 mb-8 p-1.5 bg-slate-100 rounded-2xl w-fit">
      {TABS.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          data-testid={`admin-tab-${key.toLowerCase().replace(/\s+/g, '-')}`}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
            active === key
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
          }`}
        >
          <Icon size={13} />
          {key}
        </button>
      ))}
    </div>
  );
}

// ── USER MANAGEMENT TAB ──────────────────────────────────────────────────────
function UserManagementTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'teacher' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [setPasswordUser, setSetPasswordUser] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API}/users`, { withCredentials: true });
      setUsers(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const addUser = async () => {
    if (!form.email || !form.name) return;
    setSaving(true);
    try {
      await axios.post(`${API}/users`, form, { withCredentials: true });
      await loadUsers();
      setShowAdd(false);
      setForm({ email: '', name: '', role: 'teacher' });
      showMsg(`${form.name} added. They can sign in with ${form.email}`);
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to add user', 'error');
    } finally { setSaving(false); }
  };

  const updateRole = async (userId, role) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role }, { withCredentials: true });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
      setEditUser(null);
      showMsg('Role updated');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to update role', 'error');
    }
  };

  const setPassword = async () => {
    if (passwordForm.password !== passwordForm.confirm) { showMsg('Passwords do not match', 'error'); return; }
    if (passwordForm.password.length < 8) { showMsg('Password must be at least 8 characters', 'error'); return; }
    setPwSaving(true);
    try {
      await axios.post(`${API}/users/${setPasswordUser.user_id}/set-password`, { password: passwordForm.password }, { withCredentials: true });
      showMsg(`Password set for ${setPasswordUser.name}`);
      setSetPasswordUser(null); setPasswordForm({ password: '', confirm: '' });
    } catch (e) { showMsg(e.response?.data?.detail || 'Failed to set password', 'error'); }
    finally { setPwSaving(false); }
  };

  const deleteUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      setDeleteConfirm(null);
      showMsg('User removed');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to delete user', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Only registered users can sign in to WellTrack.</p>
        </div>
        <button onClick={() => setShowAdd(true)} data-testid="add-user-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ backgroundColor: 'var(--wt-accent)' }}>
          <Plus size={15} /> Add User
        </button>
      </div>

      {msg.text && (
        <div className={`flex items-start gap-3 rounded-xl p-4 ${msg.type === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <p className={`text-sm ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</p>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          Only users listed here can sign in. Use the <KeyRound size={10} className="inline mb-0.5" /> icon to set an email &amp; password — requires Email Login enabled in <strong>Settings → General</strong>.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-slate-400">No users registered yet</div>
        ) : (
          <>
            {/* Desktop table */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['User', 'Email', 'Role', 'Added', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`user-row-${u.user_id}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {u.picture
                          ? <img src={u.picture} alt={u.name} className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center"><span className="text-xs font-semibold text-slate-600">{(u.name || u.email)[0]?.toUpperCase()}</span></div>
                        }
                        <span className="font-medium text-slate-900">{u.name || '—'}</span>
                        {u.user_id === user?.user_id && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">You</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1.5"><Mail size={12} className="text-slate-400 shrink-0" />{u.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {editUser === u.user_id ? (
                        <div className="flex items-center gap-2">
                          <select defaultValue={u.role} onChange={e => updateRole(u.user_id, e.target.value)}
                            data-testid={`role-select-${u.user_id}`}
                            className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white">
                            {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadge(u.role)}`}>
                            {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                          </span>
                          <button onClick={() => setEditUser(u.user_id)} className="text-slate-300 hover:text-slate-600 transition-colors" title="Edit role"><Edit2 size={13} /></button>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{u.created_at?.split('T')[0] || '—'}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setSetPasswordUser(u); setPasswordForm({ password: '', confirm: '' }); setShowPw(false); }}
                          data-testid={`set-password-${u.user_id}`}
                          className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="Set password">
                          <KeyRound size={14} />
                        </button>
                        {u.user_id !== user?.user_id && (
                          <button onClick={() => setDeleteConfirm(u)} data-testid={`delete-user-${u.user_id}`}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove user">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-50">
              {users.map(u => (
                <div key={u.user_id} className="p-4" data-testid={`user-row-${u.user_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {u.picture
                        ? <img src={u.picture} alt={u.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                        : <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center shrink-0"><span className="text-sm font-semibold text-slate-600">{(u.name || u.email)[0]?.toUpperCase()}</span></div>
                      }
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">{u.name || '—'}</span>
                          {u.user_id === user?.user_id && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">You</span>}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {editUser === u.user_id ? (
                            <div className="flex items-center gap-2">
                              <select defaultValue={u.role} onChange={e => updateRole(u.user_id, e.target.value)}
                                className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white">
                                {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                              </select>
                              <button onClick={() => setEditUser(null)} className="text-slate-400"><X size={13} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadge(u.role)}`}>
                                {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                              </span>
                              <button onClick={() => setEditUser(u.user_id)} className="text-slate-300 hover:text-slate-600"><Edit2 size={12} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setSetPasswordUser(u); setPasswordForm({ password: '', confirm: '' }); setShowPw(false); }}
                        data-testid={`set-password-${u.user_id}`}
                        className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                        <KeyRound size={15} />
                      </button>
                      {u.user_id !== user?.user_id && (
                        <button onClick={() => setDeleteConfirm(u)} data-testid={`delete-user-${u.user_id}`}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>Add User</h3>
                <p className="text-xs text-slate-400 mt-0.5">The user will be able to sign in with their Google account or email &amp; password</p>
              </div>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input placeholder="e.g. Jane Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  data-testid="add-user-name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input type="email" placeholder="e.g. jane.smith@school.edu.au" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  data-testid="add-user-email"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm(p => ({ ...p, role: opt.value }))}
                      className={`py-2.5 px-3 text-left rounded-xl border text-sm font-medium transition-all ${form.role === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={addUser} disabled={saving || !form.email || !form.name} data-testid="save-user-btn"
                className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <Loader size={14} className="animate-spin" /> : null}
                {saving ? 'Adding...' : 'Add User'}
              </button>
              <button onClick={() => setShowAdd(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {setPasswordUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>Set Password</h3>
                <p className="text-xs text-slate-400 mt-0.5">For <strong>{setPasswordUser.name}</strong></p>
              </div>
              <button onClick={() => setSetPasswordUser(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={passwordForm.password}
                    onChange={e => setPasswordForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="At least 8 characters" data-testid="set-password-input"
                    className="w-full pr-10 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                  <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Confirm Password</label>
                <input type={showPw ? 'text' : 'password'} value={passwordForm.confirm}
                  onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                  placeholder="Repeat password" data-testid="confirm-set-password-input"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={setPassword} disabled={pwSaving || !passwordForm.password} data-testid="save-set-password-btn"
                className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {pwSaving ? <Loader size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {pwSaving ? 'Setting…' : 'Set Password'}
              </button>
              <button onClick={() => setSetPasswordUser(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope,sans-serif' }}>Remove User?</h3>
            <p className="text-sm text-slate-600 mb-5">
              <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) will no longer be able to sign in.
            </p>
            <div className="flex gap-2">
              <button onClick={() => deleteUser(deleteConfirm.user_id)} data-testid="confirm-delete-user"
                className="flex-1 bg-rose-600 text-white py-3 text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors">
                Remove User
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROLE PERMISSIONS TAB ─────────────────────────────────────────────────────
function RolePermissionsTab() {
  const { settings, loadFullSettings } = useSettings();
  const [permissions, setPermissions] = useState(null);
  const [featurePerms, setFeaturePerms] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    const saved = settings?.role_permissions;
    setPermissions(saved ? { ...DEFAULT_PERMISSIONS, ...saved } : { ...DEFAULT_PERMISSIONS });
    const savedFeat = settings?.role_feature_permissions;
    setFeaturePerms(savedFeat ? { ...DEFAULT_FEATURE_PERMISSIONS, ...savedFeat } : { ...DEFAULT_FEATURE_PERMISSIONS });
  }, [settings?.role_permissions, settings?.role_feature_permissions]);

  const togglePage = (role, pageKey) => {
    setPermissions(prev => {
      const current = new Set(prev[role] || []);
      if (current.has(pageKey)) current.delete(pageKey); else current.add(pageKey);
      return { ...prev, [role]: [...current] };
    });
  };

  const toggleFeature = (role, actionKey) => {
    setFeaturePerms(prev => {
      const current = new Set(prev[role] || []);
      if (current.has(actionKey)) current.delete(actionKey); else current.add(actionKey);
      return { ...prev, [role]: [...current] };
    });
  };

  const hasPagePerm = (role, pageKey) => (permissions?.[role] || []).includes(pageKey);
  const hasFeaturePerm = (role, actionKey) => (featurePerms?.[role] || []).includes(actionKey);

  const resetToDefaults = () => {
    setPermissions({ ...DEFAULT_PERMISSIONS });
    setFeaturePerms({ ...DEFAULT_FEATURE_PERMISSIONS });
  };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, { ...settings, role_permissions: permissions, role_feature_permissions: featurePerms }, { withCredentials: true });
      await loadFullSettings();
      setMsg({ text: 'Permissions saved', type: 'success' });
    } catch (e) {
      setMsg({ text: e.response?.data?.detail || 'Failed to save', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    }
  };

  if (!permissions || !featurePerms) return <div className="py-12 text-center text-slate-400 text-sm">Loading…</div>;

  // Shared column grid style
  const gridCols = { gridTemplateColumns: '1fr repeat(4, 100px) 80px' };

  // Reusable permission row
  const PermRow = ({ label, roleKey, hasPermFn, onToggle, isLast }) => (
    <div className={`grid items-center border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isLast ? 'border-b-0' : ''}`} style={gridCols}>
      <div className="px-5 py-3.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {CONFIGURABLE_ROLES.map(role => {
        const allowed = hasPermFn(role.value);
        return (
          <div key={role.value} className="flex items-center justify-center">
            <button onClick={() => onToggle(role.value)}
              data-testid={`perm-${role.value}-${roleKey}`}
              title={`${allowed ? 'Revoke' : 'Grant'} ${role.label} access`}
              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                allowed ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600' : 'border-slate-200 hover:border-slate-400 bg-white'
              }`}>
              {allowed && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
            </button>
          </div>
        );
      })}
      <div className="flex items-center justify-center">
        <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 border-2 border-slate-200" title="Administrators always have full access">
          <Lock size={9} className="text-slate-400" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {msg.text && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msg.type === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msg.type === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Role Permissions</h2>
          <p className="text-sm text-slate-500 mt-0.5">Control page access and feature actions per role. Administrators always have full access.</p>
        </div>
        <button onClick={resetToDefaults} data-testid="reset-permissions-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0 mt-1">
          <RotateCcw size={11} /> Reset to Defaults
        </button>
      </div>

      {/* ── PAGE ACCESS ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Page Access</h3>
          <span className="text-xs text-slate-400">— which pages each role can navigate to</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid border-b border-slate-200 bg-slate-50" style={gridCols}>
            <div className="px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Page</div>
            {CONFIGURABLE_ROLES.map(r => (
              <div key={r.value} className="py-3 text-xs font-semibold text-slate-600 text-center">{r.label}</div>
            ))}
            <div className="py-3 flex items-center justify-center">
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Lock size={10} /> Admin</span>
            </div>
          </div>
          {PERMISSION_PAGES.map((page, idx) => {
            const Icon = page.icon;
            return (
              <div key={page.key}
                className={`grid items-center border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx === PERMISSION_PAGES.length - 1 ? 'border-b-0' : ''}`}
                style={gridCols}>
                <div className="px-5 py-3.5 flex items-center gap-2.5">
                  <Icon size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">{page.label}</span>
                </div>
                {CONFIGURABLE_ROLES.map(role => {
                  const allowed = hasPagePerm(role.value, page.key);
                  return (
                    <div key={role.value} className="flex items-center justify-center">
                      <button onClick={() => togglePage(role.value, page.key)}
                        data-testid={`perm-${role.value}-${page.key}`}
                        title={`${allowed ? 'Revoke' : 'Grant'} ${role.label} access to ${page.label}`}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                          allowed ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600' : 'border-slate-200 hover:border-slate-400 bg-white'
                        }`}>
                        {allowed && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 border-2 border-slate-200">
                    <Lock size={9} className="text-slate-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FEATURE ACTIONS ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Zap size={14} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Feature Actions</h3>
          <span className="text-xs text-slate-400">— what each role can do within those pages</span>
        </div>
        <div className="space-y-3">
          {ACTION_GROUPS.map(group => {
            const actions = FEATURE_ACTIONS.filter(a => a.group === group);
            return (
              <div key={group} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="grid border-b border-slate-100 bg-slate-50/70" style={gridCols}>
                  <div className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{group}</div>
                  {CONFIGURABLE_ROLES.map(r => (
                    <div key={r.value} className="py-2.5 text-xs font-semibold text-slate-500 text-center">{r.label}</div>
                  ))}
                  <div className="py-2.5 flex items-center justify-center">
                    <span className="flex items-center gap-1 text-xs text-slate-400"><Lock size={9} /> Admin</span>
                  </div>
                </div>
                {actions.map((action, idx) => (
                  <PermRow
                    key={action.key}
                    label={action.label}
                    roleKey={action.key.replace('.', '-')}
                    hasPermFn={(role) => hasFeaturePerm(role, action.key)}
                    onToggle={(role) => toggleFeature(role, action.key)}
                    isLast={idx === actions.length - 1}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Shield size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700">
          Page Access controls sidebar visibility. Feature Actions hide UI elements (buttons, panels) for restricted roles — backend access controls remain in place regardless.
        </p>
      </div>

      <button onClick={save} disabled={saving} data-testid="save-permissions-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save Permissions'}
      </button>
    </div>
  );
}

// ── MAIN ADMINISTRATION PAGE ──────────────────────────────────────────────────
export default function AdministrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('User Management');

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard');
  }, [user, navigate]);

  if (user?.role !== 'admin') return null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
          <Shield size={26} className="text-slate-600" /> Administration
        </h1>
        <p className="text-slate-500 mt-1">Manage users and configure role-based access control</p>
      </div>

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === 'User Management' && <UserManagementTab />}
      {activeTab === 'Role Permissions' && <RolePermissionsTab />}
    </div>
  );
}
