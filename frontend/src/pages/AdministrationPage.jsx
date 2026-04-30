import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import {
  UserCog, Plus, Trash2, X, Shield, Edit2, Loader, Mail, KeyRound,
  Eye, EyeOff, CheckCircle, Lock, LayoutDashboard, ClipboardCheck,
  Users, Radar, BarChart3, Target, CalendarDays, Users2, Bell, Settings,
  RotateCcw, Zap, Stethoscope, Settings2, FileText, Upload, AlertTriangle,
  Database, Gauge, Calendar, Inbox, ClipboardList,
} from 'lucide-react';
import { DEFAULT_FEATURE_PERMISSIONS } from '../hooks/usePermissions';
import useDocumentTitle from '../hooks/useDocumentTitle';
import FileDropZone from '../components/FileDropZone';
import ImportPreviewCard from '../components/ImportPreviewCard';
import DataManagement from '../components/DataManagement';
import { todayLocal } from '../utils/dateFmt';
import { sortClasses } from '../utils/classSort';

const ROLE_OPTIONS = [
  { value: 'teacher',      label: 'Teacher',          color: 'bg-blue-100 text-blue-700' },
  { value: 'screener',     label: 'Screener',         color: 'bg-indigo-100 text-indigo-700' },
  { value: 'wellbeing',    label: 'Wellbeing Staff',  color: 'bg-purple-100 text-purple-700' },
  { value: 'professional', label: 'Professional',     color: 'bg-violet-100 text-violet-700' },
  { value: 'leadership',   label: 'Leadership',       color: 'bg-emerald-100 text-emerald-700' },
  { value: 'admin',        label: 'Administrator',    color: 'bg-slate-900 text-white' },
];

const getRoleBadge = (role) => ROLE_OPTIONS.find(r => r.value === role)?.color || 'bg-slate-100 text-slate-600';

// Pages that can be toggled per role (key matches route path without leading slash)
const PERMISSION_PAGES = [
  { key: 'dashboard',     label: 'Dashboard',           icon: LayoutDashboard },
  { key: 'screening',     label: 'Screening',           icon: ClipboardCheck },
  { key: 'students',      label: 'Students & Profiles', icon: Users },
  { key: 'radar',         label: 'Class Risk Radar',    icon: Radar },
  { key: 'analytics',     label: 'Analytics',           icon: BarChart3 },
  { key: 'reports',       label: 'Reports',             icon: FileText },
  { key: 'interventions', label: 'Interventions',       icon: Target },
  { key: 'action-plans',  label: 'Support Plans',       icon: ClipboardList },
  { key: 'appointments',  label: 'Appointments',        icon: Stethoscope },
  { key: 'calendar',      label: 'Calendar',            icon: Calendar },
  { key: 'notifications', label: 'Notifications',       icon: Inbox },
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
  { key: 'analytics.export',          label: 'Export Data (CSV / PDF)',       group: 'Analytics' },
  { key: 'appointments.delete',       label: 'Delete Appointments',           group: 'Appointments' },
  { key: 'reports.view',              label: 'View Reports',                  group: 'Reports' },
  { key: 'reports.export',            label: 'Export Reports (CSV)',          group: 'Reports' },
  { key: 'reports.export_pdf',        label: 'Export Reports (PDF)',          group: 'Reports' },
  { key: 'action-plans.add_edit',     label: 'Add & Edit Support Plans',      group: 'Support Plans' },
  { key: 'action-plans.delete',       label: 'Delete Support Plans',          group: 'Support Plans' },
];

const ACTION_GROUPS = [...new Set(FEATURE_ACTIONS.map(a => a.group))];

// Roles that admins can configure (admin itself is always full access)
const CONFIGURABLE_ROLES = [
  { value: 'teacher',      label: 'Teacher' },
  { value: 'screener',     label: 'Screener' },
  { value: 'wellbeing',    label: 'Wellbeing' },
  { value: 'professional', label: 'Professional' },
  { value: 'leadership',   label: 'Leadership' },
];

const DEFAULT_PERMISSIONS = {
  teacher:      ['dashboard', 'screening', 'students', 'radar', 'analytics', 'reports', 'interventions', 'action-plans', 'meeting', 'alerts', 'settings', 'calendar', 'notifications'],
  screener:     ['screening', 'students', 'settings', 'calendar', 'notifications'],
  wellbeing:    ['dashboard', 'screening', 'students', 'radar', 'analytics', 'reports', 'interventions', 'action-plans', 'appointments', 'meeting', 'alerts', 'settings', 'calendar', 'notifications'],
  professional: ['dashboard', 'students', 'interventions', 'action-plans', 'appointments', 'meeting', 'settings', 'calendar', 'notifications'],
  leadership:   ['dashboard', 'screening', 'students', 'radar', 'analytics', 'reports', 'interventions', 'action-plans', 'attendance', 'meeting', 'alerts', 'settings', 'calendar', 'notifications'],
};

// ── TAB NAV ──────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'Overview', icon: Gauge },
  { key: 'User Management', icon: UserCog },
  { key: 'Classes', icon: Users2 },
  { key: 'Role Permissions', icon: Shield },
  { key: 'Data', icon: Database },
  { key: 'Audit Log', icon: ClipboardCheck },
];

function TabNav({ active, onChange, attention = {} }) {
  return (
    <div className="flex gap-1 mb-6 md:mb-8 p-1 md:p-1.5 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
      {TABS.map(({ key, icon: Icon }) => {
        const count = attention[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            data-testid={`admin-tab-${key.toLowerCase().replace(/\s+/g, '-')}`}
            className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
              active === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
          >
            <Icon size={13} />
            {key}
            {count > 0 && active !== key && (
              <span
                data-testid={`admin-tab-attention-${key.toLowerCase().replace(/\s+/g, '-')}`}
                className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-amber-400/90 text-amber-950 text-[10px] font-bold tab-attention-pulse"
                title={`${count} need attention`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const VISIT_DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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
  // Professional settings modal
  const [profUser, setProfUser] = useState(null);
  const [profForm, setProfForm] = useState({});
  const [profInterventionTypes, setProfInterventionTypes] = useState([]);
  const [profSaving, setProfSaving] = useState(false);
  // Edit user modal
  const [editUserModal, setEditUserModal] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });
  const [editSaving, setEditSaving] = useState(false);
  // Bulk user upload
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
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
      await api.post('/users', form);
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
      await api.put(`/users/${userId}/role`, { role });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
      setEditUser(null);
      showMsg('Role updated');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to update role', 'error');
    }
  };

  const openEditModal = (u) => {
    setEditUserModal(u);
    setEditForm({ name: u.name || '', email: u.email || '', role: u.role || 'teacher' });
  };

  const saveUserDetails = async () => {
    if (!editForm.name || !editForm.email) {
      showMsg('Name and email are required', 'error');
      return;
    }
    setEditSaving(true);
    try {
      const res = await api.put(`/users/${editUserModal.user_id}`, editForm);
      setUsers(prev => prev.map(u => u.user_id === editUserModal.user_id ? { ...u, ...res.data } : u));
      setEditUserModal(null);
      showMsg('User details updated');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to update user', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const setPassword = async () => {
    if (passwordForm.password !== passwordForm.confirm) { showMsg('Passwords do not match', 'error'); return; }
    if (passwordForm.password.length < 8) { showMsg('Password must be at least 8 characters', 'error'); return; }
    setPwSaving(true);
    try {
      await api.post(`/users/${setPasswordUser.user_id}/set-password`, { password: passwordForm.password });
      showMsg(`Password set for ${setPasswordUser.name}`);
      setSetPasswordUser(null); setPasswordForm({ password: '', confirm: '' });
    } catch (e) { showMsg(e.response?.data?.detail || 'Failed to set password', 'error'); }
    finally { setPwSaving(false); }
  };

  const deleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      setDeleteConfirm(null);
      showMsg('User removed');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to delete user', 'error');
    }
  };

  const openProfSettings = async (u) => {
    setProfUser(u);
    setProfForm({
      appointment_access: u.appointment_access || false,
      professional_type: u.professional_type || '',
      visit_days: u.visit_days || [],
      accessible_intervention_types: u.accessible_intervention_types || [],
      cross_professional_view: u.cross_professional_view || false,
    });
    try {
      const res = await api.get('/settings');
      const types = (res.data.intervention_types || [])
        .map(t => typeof t === 'string' ? t : t.name)
        .filter(Boolean);
      setProfInterventionTypes(types);
    } catch { setProfInterventionTypes([]); }
  };

  const saveProfSettings = async () => {
    setProfSaving(true);
    try {
      const updated = await api.put(`/users/${profUser.user_id}/professional`, profForm);
      setUsers(prev => prev.map(u => u.user_id === profUser.user_id ? { ...u, ...updated.data } : u));
      setProfUser(null);
      showMsg('Professional settings saved');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to save', 'error');
    } finally { setProfSaving(false); }
  };

  const toggleProfDay = (day) =>
    setProfForm(p => ({
      ...p,
      visit_days: p.visit_days.includes(day)
        ? p.visit_days.filter(d => d !== day)
        : [...p.visit_days, day],
    }));

  const toggleProfType = (type) =>
    setProfForm(p => ({
      ...p,
      accessible_intervention_types: p.accessible_intervention_types.includes(type)
        ? p.accessible_intervention_types.filter(t => t !== type)
        : [...p.accessible_intervention_types, type],
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">Only registered users can sign in to WellTrack.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowBulkUpload(true)} data-testid="bulk-upload-users-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Upload size={15} /> Upload Staff
          </button>
          <button onClick={() => setShowAdd(true)} data-testid="add-user-btn"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors" style={{ backgroundColor: 'var(--wt-accent)' }}>
            <Plus size={15} /> Add User
          </button>
        </div>
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
                  {['User', 'Email', 'Role', 'Added', 'Last Login', 'Actions'].map(h => (
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
                          <button onClick={() => setEditUser(null)} className="text-slate-400"><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadge(u.role)}`}>
                            {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                          </span>
                          <button onClick={() => setEditUser(u.user_id)} className="text-slate-300 hover:text-slate-600"><Edit2 size={12} /></button>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{u.created_at?.split('T')[0] || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-xs">{u.last_login ? u.last_login.split('T')[0].split('-').reverse().join('-') : <span className="text-slate-300">Never</span>}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditModal(u)}
                          data-testid={`edit-user-${u.user_id}`}
                          className="p-1.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit user details">
                          <Edit2 size={14} />
                        </button>
                        {u.role === 'professional' && (
                          <button onClick={() => openProfSettings(u)}
                            data-testid={`prof-settings-${u.user_id}`}
                            className="p-1.5 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors" title="Professional / Appointment settings">
                            <Settings2 size={14} />
                          </button>
                        )}
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
                      <button onClick={() => openEditModal(u)}
                        data-testid={`edit-user-mobile-${u.user_id}`}
                        className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>
                      {u.role === 'professional' && (
                        <button onClick={() => openProfSettings(u)}
                          data-testid={`prof-settings-mobile-${u.user_id}`}
                          className="p-2 text-slate-300 hover:text-violet-500 hover:bg-violet-50 rounded-lg transition-colors">
                          <Settings2 size={15} />
                        </button>
                      )}
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
      {showAdd && createPortal(
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
      , document.body)}

      {/* Set Password Modal */}
      {setPasswordUser && createPortal(
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
      , document.body)}

      {/* Professional Settings Modal */}
      {profUser && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>Professional Settings</h3>
                <p className="text-xs text-slate-400 mt-0.5">{profUser.name}</p>
              </div>
              <button onClick={() => setProfUser(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Appointment Access */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Appointment System Access</p>
                  <p className="text-xs text-slate-400 mt-0.5">Allow this user to use the Appointments module</p>
                </div>
                <button
                  onClick={() => setProfForm(p => ({ ...p, appointment_access: !p.appointment_access }))}
                  data-testid="toggle-appointment-access"
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 ${
                    profForm.appointment_access ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}>
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-1 ${
                    profForm.appointment_access ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Professional Type */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Professional Type</label>
                <input value={profForm.professional_type} onChange={e => setProfForm(p => ({ ...p, professional_type: e.target.value }))}
                  placeholder="e.g. School Counsellor, Psychologist..."
                  data-testid="professional-type-input"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-200" />
              </div>

              {/* Visit Days */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Visit Days</label>
                <div className="flex gap-2 flex-wrap">
                  {VISIT_DAY_OPTIONS.map(day => (
                    <button key={day} onClick={() => toggleProfDay(day)}
                      data-testid={`visit-day-${day}`}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        profForm.visit_days.includes(day)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accessible Intervention Types */}
              {profInterventionTypes.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Accessible Intervention Types
                  </label>
                  <p className="text-xs text-slate-400 mb-2">Leave all unchecked to allow access to all types</p>
                  <div className="space-y-1.5">
                    {profInterventionTypes.map(type => (
                      <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                        <button onClick={() => toggleProfType(type)}
                          className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                            profForm.accessible_intervention_types.includes(type)
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-slate-200 bg-white group-hover:border-slate-400'
                          }`}>
                          {profForm.accessible_intervention_types.includes(type) && (
                            <CheckCircle size={10} className="text-white" strokeWidth={3} />
                          )}
                        </button>
                        <span className="text-sm text-slate-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Professional View */}
              <div className="flex items-center justify-between pb-1">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Cross-Professional View</p>
                  <p className="text-xs text-slate-400 mt-0.5">Can view other professionals' sessions</p>
                </div>
                <button
                  onClick={() => setProfForm(p => ({ ...p, cross_professional_view: !p.cross_professional_view }))}
                  data-testid="toggle-cross-professional"
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors shrink-0 ${
                    profForm.cross_professional_view ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}>
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-1 ${
                    profForm.cross_professional_view ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-2 shrink-0">
              <button onClick={saveProfSettings} disabled={profSaving}
                data-testid="save-prof-settings-btn"
                className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: 'var(--wt-accent)' }}>
                {profSaving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {profSaving ? 'Saving…' : 'Save Settings'}
              </button>
              <button onClick={() => setProfUser(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Delete Confirm Modal */}
      {deleteConfirm && createPortal(
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
      , document.body)}

      {showBulkUpload && (
        <StaffUploadModal
          onClose={() => setShowBulkUpload(false)}
          onDone={(result) => {
            setShowBulkUpload(false);
            loadUsers();
            const uncat = result.uncategorised?.length || 0;
            showMsg(
              `Staff import: ${result.imported} new · ${result.updated} updated · ${result.skipped} skipped${uncat ? ` · ${uncat} uncategorised (→ teacher)` : ''}`,
              result.errors?.length ? 'error' : 'success'
            );
          }}
        />
      )}

      {/* Edit User Modal */}
      {editUserModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>Edit User</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update staff account details</p>
              </div>
              <button onClick={() => setEditUserModal(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@school.edu.au"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setEditForm(p => ({ ...p, role: opt.value }))}
                      className={`py-2.5 px-3 text-left rounded-xl border text-sm font-medium transition-all ${
                        editForm.role === opt.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={saveUserDetails}
                disabled={editSaving || !editForm.name || !editForm.email}
                className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                style={{ backgroundColor: 'var(--wt-accent)' }}>
                {editSaving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditUserModal(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

// ── STAFF UPLOAD MODAL ──────────────────────────────────────────────────────
// Uses the SIS payroll-based preview + import endpoints. Keeps the popup UX
// admins are used to from the old bulk-upload flow; replaces the generic
// email,name,role CSV with the production payroll schema.
function StaffUploadModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [validation, setValidation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Auto-preview on file pick so the admin can spot file mix-ups before committing.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    let cancelled = false;
    (async () => {
      setPreviewing(true);
      setError('');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post('/users/import-staff-preview', fd);
        if (!cancelled) setPreview(res.data);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || e.message || 'Could not preview staff file');
          setFile(null);
        }
      } finally { if (!cancelled) setPreviewing(false); }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const runImport = async () => {
    if (!file || !preview) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/users/import-staff', fd);
      onDone?.(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const canConfirm = preview && !previewing && !uploading && (preview.counts?.add || 0) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="staff-upload-modal">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between shrink-0 gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope,sans-serif' }}>Upload Staff</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload your SIS payroll export (XLSX or CSV). Expected headers:{' '}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">SFKEY, FIRST_NAME, SURNAME, E_MAIL, PAYROLL_CLASS</code>.
              Roles are mapped from <code>PAYROLL_CLASS</code>; existing staff are never overwritten; Casual Relief Teachers (CRT*) are excluded.
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center wt-hover text-slate-400 dark:text-slate-500" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <FileDropZone
            accept=".csv,.xlsx,.xls"
            expectedKind="staff"
            label="Drop your staff XLSX or CSV here or click to browse"
            file={file}
            onChange={(f, v) => { setFile(f); setValidation(v); setPreview(null); setError(''); }}
            testIdPrefix="staff-upload"
          />

          {previewing && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2" data-testid="staff-upload-preview-loading">
              <Loader size={12} className="animate-spin" /> Parsing…
            </p>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {preview && (
            <ImportPreviewCard
              kind="staff"
              preview={preview}
              testIdPrefix="staff-upload-preview"
            />
          )}
        </div>

        <div className="p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            data-testid="staff-upload-cancel"
          >
            Cancel
          </button>
          <button
            onClick={runImport}
            disabled={!canConfirm || (validation && validation.ok === false)}
            data-testid="staff-upload-confirm"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--wt-accent)' }}
          >
            {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading
              ? 'Importing…'
              : preview
                ? `Confirm Import (${preview.counts?.add || 0} staff)`
                : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── ROLE PERMISSIONS TAB ─────────────────────────────────────────────────────
// Shared column grid for permission tables (declared at module scope so the
// styles object is stable across renders — keeps PermRow's props identity stable)
const PERM_GRID_COLS = { gridTemplateColumns: '1fr repeat(5, 90px) 80px', minWidth: '700px' };

// Extracted so the component identity is stable across re-renders. When
// PermRow was defined INSIDE RolePermissionsTab, React re-declared the
// function on every render, treating it as a new component type and
// unmounting+remounting every row on each parent update. That caused the
// "pulse" effect on hover because the row's transition-colors animation
// restarted from its non-hover state on every remount.
function PermRow({ label, roleKey, hasPermFn, onToggle, isLast, roles }) {
  return (
    <div
      className={`grid items-center border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isLast ? 'border-b-0' : ''}`}
      style={PERM_GRID_COLS}
    >
      <div className="px-5 py-3.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      {roles.map(role => {
        const allowed = hasPermFn(role.value);
        return (
          <div key={role.value} className="flex items-center justify-center">
            <button
              onClick={() => onToggle(role.value)}
              data-testid={`perm-${role.value}-${roleKey}`}
              title={`${allowed ? 'Revoke' : 'Grant'} ${role.label} access`}
              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${
                allowed ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600'
                        : 'border-slate-200 hover:border-slate-400 bg-white'
              }`}
            >
              {allowed && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
            </button>
          </div>
        );
      })}
      <div className="flex items-center justify-center">
        <div
          className="w-5 h-5 rounded flex items-center justify-center bg-slate-200 border-2 border-slate-200"
          title="Administrators always have full access"
        >
          <Lock size={9} className="text-slate-400" />
        </div>
      </div>
    </div>
  );
}

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
      await api.put('/settings', { ...settings, role_permissions: permissions, role_feature_permissions: featurePerms });
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

  return (
    <div className="space-y-5">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <div className="grid border-b border-slate-200 bg-slate-50" style={PERM_GRID_COLS}>
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
                style={PERM_GRID_COLS}>
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
              <div key={group} className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                {/* Group header */}
                <div className="grid border-b border-slate-100 bg-slate-50/70" style={PERM_GRID_COLS}>
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
                    roles={CONFIGURABLE_ROLES}
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

      <div className="flex items-center gap-3">
        {msg.text && (
          <span className={`text-sm font-medium ${msg.type === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} data-testid="perm-save-status">
            {msg.text}
          </span>
        )}
        <button onClick={save} disabled={saving} data-testid="save-permissions-btn"
          className="flex-1 py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
          {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {saving ? 'Saving…' : 'Save Permissions'}
        </button>
      </div>
    </div>
  );
}

// ── AUDIT LOG TAB ─────────────────────────────────────────────────────────────
const ENTITY_META = {
  student:     { label: 'Student',     color: 'bg-blue-100 text-blue-700' },
  intervention:{ label: 'Intervention',color: 'bg-purple-100 text-purple-700' },
  case_note:   { label: 'Case Note',   color: 'bg-indigo-100 text-indigo-700' },
  appointment: { label: 'Appointment', color: 'bg-violet-100 text-violet-700' },
  user:        { label: 'User',        color: 'bg-emerald-100 text-emerald-700' },
  setting:     { label: 'Settings',    color: 'bg-amber-100 text-amber-700' },
  attendance:  { label: 'Attendance',  color: 'bg-cyan-100 text-cyan-700' },
};

const ACTION_META = {
  created:          { label: 'Created',    color: 'bg-emerald-100 text-emerald-700' },
  updated:          { label: 'Updated',    color: 'bg-blue-100 text-blue-700' },
  deleted:          { label: 'Deleted',    color: 'bg-rose-100 text-rose-700' },
  bulk_import:      { label: 'Bulk Import',color: 'bg-violet-100 text-violet-700' },
  bulk_archive:     { label: 'Archived',   color: 'bg-amber-100 text-amber-700' },
  bulk_reactivate:  { label: 'Reactivated',color: 'bg-teal-100 text-teal-700' },
  uploaded:         { label: 'Uploaded',   color: 'bg-cyan-100 text-cyan-700' },
  data_wipe:        { label: 'Data Wipe',  color: 'bg-red-200 text-red-800' },
};

function AuditLogTab() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({ entity_type: '', action: '', date_from: '', date_to: '', user_id: '' });
  const PER_PAGE = 50;

  const load = async (p = 0, f = filters) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, per_page: PER_PAGE });
      if (f.entity_type) params.set('entity_type', f.entity_type);
      if (f.action) params.set('action', f.action);
      if (f.date_from) params.set('date_from', f.date_from);
      if (f.date_to) params.set('date_to', f.date_to);
      if (f.user_id) params.set('user_id', f.user_id);
      const res = await api.get(`/audit?${params}`);
      setLogs(res.data.entries || []);
      setTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(0); }, []);

  const applyFilters = () => { setPage(0); load(0); };
  const clearFilters = () => {
    const reset = { entity_type: '', action: '', date_from: '', date_to: '', user_id: '' };
    setFilters(reset); setPage(0); load(0, reset);
  };

  const goPage = async (p) => { setPage(p); await load(p); };

  const totalPages = Math.ceil(total / PER_PAGE);
  const setF = (k, v) => setFilters(p => ({ ...p, [k]: v }));

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Platform Audit Log</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Every change across students, interventions, appointments, users and settings
          </p>
        </div>
        <span className="text-xs text-slate-400 mt-1">{total.toLocaleString()} entries</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Type</label>
          <select value={filters.entity_type} onChange={e => setF('entity_type', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="">All types</option>
            {Object.entries(ENTITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Action</label>
          <select value={filters.action} onChange={e => setF('action', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none">
            <option value="">All actions</option>
            {Object.entries(ACTION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">From</label>
          <input type="date" value={filters.date_from} onChange={e => setF('date_from', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">To</label>
          <input type="date" value={filters.date_to} onChange={e => setF('date_to', e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">User</label>
          <input type="text" value={filters.user_id} onChange={e => setF('user_id', e.target.value)}
            placeholder="User ID or email"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none w-40" />
        </div>
        <button onClick={applyFilters}
          className="px-4 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          style={{ backgroundColor: 'var(--wt-accent)' }}>
          Apply
        </button>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800 rounded-lg hover:bg-white transition-colors border border-slate-200">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse border border-slate-100" />)}
        </div>
      ) : !logs.length ? (
        <div className="py-20 text-center">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No audit entries {hasFilters ? 'matching filters' : 'yet'}</p>
          {!hasFilters && <p className="text-xs text-slate-400 mt-1">Create, edit, or delete any record to see it appear here</p>}
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            {/* Header */}
            <div className="grid border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider"
              style={{ gridTemplateColumns: '150px 110px 110px 1fr 130px', minWidth: '700px' }}>
              {['Timestamp', 'Type', 'Action', 'Details', 'User'].map(h => (
                <div key={h} className="px-4 py-3">{h}</div>
              ))}
            </div>

            {logs.map((entry, idx) => {
              const em = ENTITY_META[entry.entity_type] || { label: entry.entity_type, color: 'bg-slate-100 text-slate-600' };
              const am = ACTION_META[entry.action] || { label: entry.action, color: 'bg-slate-100 text-slate-600' };
              return (
                <div key={entry.audit_id || idx}
                  className={`grid items-start border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60 transition-colors`}
                  style={{ gridTemplateColumns: '150px 110px 110px 1fr 130px', minWidth: '700px' }}
                  data-testid={`audit-entry-${idx}`}>
                  <div className="px-4 py-3">
                    <p className="text-xs font-mono text-slate-600">{entry.timestamp?.split('T')[0]}</p>
                    <p className="text-xs font-mono text-slate-400">{entry.timestamp?.split('T')[1]?.slice(0,8)}</p>
                  </div>
                  <div className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${em.color}`}>{em.label}</span>
                  </div>
                  <div className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${am.color}`}>{am.label}</span>
                    {entry.bulk_count != null && (
                      <p className="text-[10px] text-slate-400 mt-0.5">{entry.bulk_count} records</p>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    {entry.entity_name && (
                      <p className="text-xs font-semibold text-slate-800 mb-0.5">{entry.entity_name}</p>
                    )}
                    {Object.keys(entry.changes || {}).length > 0 && (
                      <div className="space-y-0.5">
                        {Object.entries(entry.changes).slice(0, 3).map(([k, v]) => (
                          <p key={k} className="text-[11px] text-slate-500">
                            <span className="font-medium text-slate-600">{k}:</span>{' '}
                            {v?.old !== undefined && <><span className="line-through text-slate-400">{String(v.old ?? '—')}</span> → </>}
                            <span className="text-slate-700">{String(v?.new ?? v ?? '—')}</span>
                          </p>
                        ))}
                        {Object.keys(entry.changes).length > 3 && (
                          <p className="text-[10px] text-slate-400">+{Object.keys(entry.changes).length - 3} more</p>
                        )}
                      </div>
                    )}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && !Object.keys(entry.changes || {}).length && (
                      <p className="text-[11px] text-slate-400 italic">
                        {Object.entries(entry.metadata).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs font-medium text-slate-700 truncate">{entry.user_name || '—'}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{entry.user_role}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total.toLocaleString()}
              </p>
              <div className="flex gap-1">
                <button onClick={() => goPage(Math.max(0, page - 1))} disabled={page === 0}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Prev</button>
                <button onClick={() => goPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── CLASSES TAB ──────────────────────────────────────────────────────────────
function ClassesTab() {
  const [classes, setClasses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState({ text: '', type: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        api.get('/classes'),
        api.get('/users'),
      ]);
      setClasses(sortClasses(cRes.data || []));
      setUsers((uRes.data || []).filter(u => u.is_active !== false));
    } catch (e) {
      setMsg({ text: e.response?.data?.detail || 'Failed to load classes', type: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const assign = async (className, teacherUserId) => {
    setSaving(prev => ({ ...prev, [className]: true }));
    try {
      const res = await api.put(`/classes/${encodeURIComponent(className)}/teacher`, {
        teacher_user_id: teacherUserId || null,
      });
      setClasses(prev => prev.map(c => c.class_name === className ? { ...c, ...res.data } : c));
      showMsg(teacherUserId ? `Assigned teacher to ${className}` : `Cleared teacher for ${className}`);
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to assign teacher', 'error');
    } finally {
      setSaving(prev => ({ ...prev, [className]: false }));
    }
  };

  const teacherOptions = users
    .filter(u => ['teacher', 'leadership', 'wellbeing', 'professional', 'admin'].includes(u.role))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Classes &amp; Teachers</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Assign one teacher per class (home group). Classes are detected from your imported students' <code className="bg-slate-100 px-1 rounded text-xs">HOME_GROUP</code>. The selected teacher becomes the owner of that class everywhere in WellTrack.
        </p>
      </div>

      {msg.text && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
             data-testid="classes-msg">
          <CheckCircle size={14} />
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse border border-slate-100" />)}
        </div>
      ) : classes.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-xl">
          <Users2 size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No classes found yet</p>
          <p className="text-xs text-slate-400 mt-1">Import students with a HOME_GROUP / Form Group column to populate this list.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Desktop grid header */}
          <div className="hidden md:grid border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 uppercase tracking-wider"
               style={{ gridTemplateColumns: '180px 110px 1fr 100px' }}>
            <div className="px-4 py-3">Class</div>
            <div className="px-4 py-3">Students</div>
            <div className="px-4 py-3">Teacher</div>
            <div className="px-4 py-3 text-right">&nbsp;</div>
          </div>
          {classes.map(c => {
            const isBusy = !!saving[c.class_name];
            return (
              <div key={c.class_name}
                   data-testid={`class-row-${c.class_name}`}>
                {/* Desktop row */}
                <div className="hidden md:grid items-center border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60 transition-colors"
                     style={{ gridTemplateColumns: '180px 110px 1fr 100px' }}>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{c.class_name}</p>
                  </div>
                  <div className="px-4 py-3 text-sm text-slate-600">{c.student_count}</div>
                  <div className="px-4 py-3">
                    <select
                      value={c.teacher_user_id || ''}
                      onChange={(e) => assign(c.class_name, e.target.value)}
                      disabled={isBusy}
                      data-testid={`class-teacher-select-${c.class_name}`}
                      className="w-full max-w-xs px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                    >
                      <option value="">— Unassigned —</option>
                      {teacherOptions.map(u => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.name || u.email} · {u.role}
                        </option>
                      ))}
                    </select>
                    {c.teacher_name && c.teacher_user_id && !teacherOptions.find(u => u.user_id === c.teacher_user_id) && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Currently assigned to <strong>{c.teacher_name}</strong> (user no longer in the list)
                      </p>
                    )}
                  </div>
                  <div className="px-4 py-3 text-right">
                    {isBusy && <Loader size={14} className="inline animate-spin text-indigo-500" />}
                  </div>
                </div>
                {/* Mobile card */}
                <div className="md:hidden p-4 border-b border-slate-50 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-800">{c.class_name}</p>
                    <span className="text-xs text-slate-500">{c.student_count} students</span>
                  </div>
                  <select
                    value={c.teacher_user_id || ''}
                    onChange={(e) => assign(c.class_name, e.target.value)}
                    disabled={isBusy}
                    data-testid={`class-teacher-select-mobile-${c.class_name}`}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:border-indigo-400 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">— Unassigned —</option>
                    {teacherOptions.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.name || u.email} · {u.role}
                      </option>
                    ))}
                  </select>
                  {isBusy && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-500">
                      <Loader size={12} className="animate-spin" /> Saving…
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── OVERVIEW DATA FETCHER (headless, always mounted) ─────────────────────────
// Uses a ref so the effect fires exactly once on mount — passing onStats directly
// into the dependency array caused an infinite loop because handleStats is a new
// function reference on every parent render, which re-triggered the effect, which
// called onStats, which set state, which re-rendered the parent, and so on.
function OverviewFetcher({ onStats }) {
  const onStatsRef = useRef(onStats);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = todayLocal();
        const [users, classes, backups, audit] = await Promise.all([
          api.get('/users').then(r => r.data).catch(() => []),
          api.get('/classes').then(r => sortClasses(r.data)).catch(() => []),
          api.get('/backups').then(r => r.data.backups || []).catch(() => []),
          api.get(`/audit?date_from=${today}&date_to=${today}&per_page=1`).then(r => r.data).catch(() => ({ total: 0 })),
        ]);
        if (cancelled) return;

        const activeUsers = users.filter(u => u.is_active !== false).length;
        const latestBackup = backups[0];
        let backupLabel = 'No backups yet';
        let backupTone = 'amber';
        if (latestBackup) {
          const ts = new Date(latestBackup.created_at).getTime();
          const hrsAgo = (Date.now() - ts) / 36e5;
          if (hrsAgo < 1)       backupLabel = 'Just now';
          else if (hrsAgo < 24) backupLabel = `${Math.floor(hrsAgo)}h ago`;
          else if (hrsAgo < 48) backupLabel = 'Yesterday';
          else                  backupLabel = `${Math.floor(hrsAgo / 24)}d ago`;
          backupTone = hrsAgo < 36 ? 'emerald' : 'amber';
        }
        const assignedClasses = classes.filter(c => c.teacher_user_id).length;
        const unassignedClasses = classes.length - assignedClasses;

        onStatsRef.current({
          classes_unassigned: unassignedClasses,
          users:   { total: activeUsers, inactive: users.length - activeUsers, list: users },
          classes: { total: classes.length, assigned: assignedClasses, list: classes },
          backup:  { label: backupLabel, sub: latestBackup ? `${latestBackup.size_kb} KB` : 'Run your first backup', tone: backupTone },
          audit:   { total: audit.total },
        });
      } catch (e) { console.error('overview fetch failed', e); }
    })();
    return () => { cancelled = true; };
  }, []); // ← empty: fires once on mount only

  return null;
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────────────
function OverviewTab({ stats, onJump }) {
  const toneMap = {
    slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   ring: 'ring-slate-200' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-200' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   ring: 'ring-amber-200' },
    indigo:  { bg: 'bg-indigo-50',  icon: 'text-indigo-600',  ring: 'ring-indigo-200' },
  };

  const Card = ({ label, value, sub, icon: Icon, tone = 'slate', onClick, testId }) => {
    const t = toneMap[tone] || toneMap.slate;
    return (
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className="group bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm rounded-xl p-4 text-left transition-all flex flex-col justify-between min-h-[110px]"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.bg} ring-1 ${t.ring}`}>
            <Icon size={14} className={t.icon} />
          </div>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums" style={{ fontFamily: 'Manrope,sans-serif' }}>{value}</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{sub}</p>
        </div>
      </button>
    );
  };

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-[110px] bg-white border border-slate-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  const usersSub = `${stats.users.inactive} inactive`;
  const classesSub = `${stats.classes.assigned}/${stats.classes.total} with teacher`;

  // Recent activity snapshot — last 5 audit events
  return (
    <div className="space-y-6" data-testid="admin-overview-tab">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Active users" value={stats.users.total} sub={usersSub}
              icon={UserCog} tone="indigo"
              onClick={() => onJump('User Management')} testId="overview-users-card" />
        <Card label="Classes" value={stats.classes.total} sub={classesSub}
              icon={Users2} tone="slate"
              onClick={() => onJump('Classes')} testId="overview-classes-card" />
        <Card label="Last backup" value={stats.backup.label} sub={stats.backup.sub}
              icon={Database} tone={stats.backup.tone}
              onClick={() => onJump('Data')} testId="overview-backup-card" />
        <Card label="Audit activity" value={stats.audit.total} sub="changes today"
              icon={ClipboardCheck} tone="emerald"
              onClick={() => onJump('Audit Log')} testId="overview-audit-card" />
      </div>

      {/* Quick action callouts — things that need attention */}
      {stats.classes_unassigned > 0 && (
        <button
          onClick={() => onJump('Classes')}
          data-testid="overview-unassigned-callout"
          className="w-full flex items-center gap-3 p-4 text-left bg-amber-50 border border-amber-200 hover:border-amber-300 rounded-xl transition-all"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              {stats.classes_unassigned} {stats.classes_unassigned === 1 ? 'class needs' : 'classes need'} a teacher assigned
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Assign teachers so radar filters and targeted interventions work correctly.</p>
          </div>
          <span className="text-xs font-semibold text-amber-800 shrink-0">Open Classes →</span>
        </button>
      )}

      {(!stats.backup.label || stats.backup.tone === 'amber') && (
        <button
          onClick={() => onJump('Data')}
          data-testid="overview-backup-callout"
          className="w-full flex items-center gap-3 p-4 text-left bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
        >
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <Database size={18} className="text-slate-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {stats.backup.label === 'No backups yet' ? "You haven't run a backup yet" : `Last backup was ${stats.backup.label}`}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Backups run automatically overnight. You can also trigger one on demand.</p>
          </div>
          <span className="text-xs font-semibold text-slate-600 shrink-0">Open Data →</span>
        </button>
      )}
    </div>
  );
}

// ── MAIN ADMINISTRATION PAGE ──────────────────────────────────────────────────
export default function AdministrationPage() {
  useDocumentTitle('Administration');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [attention, setAttention] = useState({});
  const [overviewStats, setOverviewStats] = useState(null);

  const handleStats = useCallback((stats) => {
    setOverviewStats(stats);
    setAttention({ classes_unassigned: stats.classes_unassigned });
  }, []);

  useEffect(() => {
    if (user && user.role !== 'admin') navigate('/dashboard');
  }, [user, navigate]);

  if (user?.role !== 'admin') return null;

  const tabAttention = { Classes: attention.classes_unassigned || 0 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
          <Shield size={24} className="text-slate-600 shrink-0" /> Administration
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Manage users and configure role-based access control</p>
      </div>

      <TabNav active={activeTab} onChange={setActiveTab} attention={tabAttention} />

      {/* Overview data is fetched here and lifted for the Overview tab + tab-nudges */}
      <OverviewFetcher onStats={handleStats} />

      {activeTab === 'Overview' && <OverviewTab stats={overviewStats} onJump={setActiveTab} />}
      {activeTab === 'User Management' && <UserManagementTab />}
      {activeTab === 'Classes' && <ClassesTab />}
      {activeTab === 'Role Permissions' && <RolePermissionsTab />}
      {activeTab === 'Data' && <DataManagement />}
      {activeTab === 'Audit Log' && <AuditLogTab />}
    </div>
  );
}