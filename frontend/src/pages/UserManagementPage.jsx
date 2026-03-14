import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Trash2, X, Shield, Edit2, Loader, Mail } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher', color: 'bg-blue-100 text-blue-700' },
  { value: 'wellbeing', label: 'Wellbeing Staff', color: 'bg-purple-100 text-purple-700' },
  { value: 'leadership', label: 'Leadership', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'admin', label: 'Administrator', color: 'bg-slate-900 text-white' },
];

const getRoleBadge = (role) => {
  const opt = ROLE_OPTIONS.find(r => r.value === role);
  return opt ? opt.color : 'bg-slate-100 text-slate-600';
};

export default function UserManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'teacher' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Only admins can access this page
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadUsers();
  }, []);

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
      showMsg(`User ${form.name} added successfully. They can now sign in with ${form.email}`);
    } catch (e) {
      const detail = e.response?.data?.detail || 'Failed to add user';
      showMsg(detail, 'error');
    } finally { setSaving(false); }
  };

  const updateRole = async (userId, role) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { role }, { withCredentials: true });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role } : u));
      setEditUser(null);
      showMsg('Role updated successfully');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to update role', 'error');
    }
  };

  const deleteUser = async (userId) => {
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      setDeleteConfirm(null);
      showMsg('User removed successfully');
    } catch (e) {
      showMsg(e.response?.data?.detail || 'Failed to delete user', 'error');
    }
  };

  if (user?.role !== 'admin') return null;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <UserCog size={28} className="text-slate-600" /> User Management
          </h1>
          <p className="text-slate-500 mt-1">Manage who can access WellTrack. Only registered users can sign in.</p>
        </div>
        <button onClick={() => setShowAdd(true)} data-testid="add-user-btn"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Message */}
      {msg.text && (
        <div className={`flex items-start gap-3 rounded-xl p-4 mb-5 ${msg.type === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="flex-1">
            <p className={`text-sm ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
        <Shield size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Access Control</p>
          <p className="text-xs text-amber-600 mt-0.5">Only users listed here can sign in with their Google account. If someone tries to sign in without being registered, they will be denied access.</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-slate-400">No users registered yet</div>
        ) : (
          <table className="w-full text-sm">
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
                      {u.picture ? (
                        <img src={u.picture} alt={u.name} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 bg-slate-200 rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-slate-600">{(u.name || u.email)[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <span className="font-medium text-slate-900">{u.name || '—'}</span>
                      {u.user_id === user?.user_id && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">You</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      {u.email}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {editUser === u.user_id ? (
                      <div className="flex items-center gap-2">
                        <select
                          defaultValue={u.role}
                          onChange={e => updateRole(u.user_id, e.target.value)}
                          data-testid={`role-select-${u.user_id}`}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white"
                        >
                          {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getRoleBadge(u.role)}`}>
                          {ROLE_OPTIONS.find(r => r.value === u.role)?.label || u.role}
                        </span>
                        <button onClick={() => setEditUser(u.user_id)} className="text-slate-300 hover:text-slate-600 transition-colors" title="Edit role">
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 text-xs">
                    {u.created_at?.split('T')[0] || '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {u.user_id !== user?.user_id && (
                      <button
                        onClick={() => setDeleteConfirm(u)}
                        data-testid={`delete-user-${u.user_id}`}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove user"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>Add User</h3>
                <p className="text-xs text-slate-400 mt-0.5">The user will be able to sign in with their Google account</p>
              </div>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  placeholder="e.g. Jane Smith"
                  value={form.name}
                  onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  data-testid="add-user-name"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. jane.smith@school.edu.au"
                  value={form.email}
                  onChange={e => setForm(p => ({...p, email: e.target.value}))}
                  data-testid="add-user-email"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
                <p className="text-xs text-slate-400 mt-1">Must match their Google account email exactly</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm(p => ({...p, role: opt.value}))}
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
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-slate-900 mb-2" style={{fontFamily:'Manrope,sans-serif'}}>Remove User?</h3>
            <p className="text-sm text-slate-600 mb-5">
              <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email}) will no longer be able to sign in. This does not delete their student data.
            </p>
            <div className="flex gap-2">
              <button onClick={() => deleteUser(deleteConfirm.user_id)} data-testid="confirm-delete-user"
                className="flex-1 bg-rose-600 text-white py-3 text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors">
                Remove User
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
