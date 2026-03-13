import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Settings, Trash2, Database, AlertTriangle, CheckCircle, Loader, School } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher', desc: 'Complete screenings, view class data' },
  { value: 'wellbeing', label: 'Wellbeing Staff', desc: 'View all students, manage interventions' },
  { value: 'leadership', label: 'Leadership', desc: 'View analytics and reports' },
  { value: 'admin', label: 'Administrator', desc: 'Full access to all features' },
];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const [settings, setSettings] = useState({ school_name: '', school_type: 'both', current_term: 'Term 1', current_year: 2025 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [msg, setMsg] = useState('');
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeInput, setWipeInput] = useState('');

  useEffect(() => {
    axios.get(`${API}/settings`, { withCredentials: true })
      .then(r => setSettings(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, settings, { withCredentials: true });
      setMsg('Settings saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const res = await axios.post(`${API}/settings/seed`, {}, { withCredentials: true });
      setMsg(`Demo data loaded: ${res.data.students} students, ${res.data.interventions} interventions`);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  const wipeData = async () => {
    if (wipeInput !== 'DELETE') return;
    setWiping(true);
    try {
      await axios.delete(`${API}/settings/data`, { withCredentials: true });
      setShowWipeConfirm(false);
      setWipeInput('');
      setMsg('All data wiped successfully');
      setTimeout(() => setMsg(''), 4000);
    } catch (e) { console.error(e); }
    finally { setWiping(false); }
  };

  const updateRole = async (role) => {
    try {
      await axios.put(`${API}/auth/role`, { role }, { withCredentials: true });
      setUser(prev => ({ ...prev, role }));
      setMsg(`Role updated to ${role}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="p-8"><div className="h-48 bg-white rounded-xl animate-pulse border border-slate-200" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
          <Settings size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Settings</h1>
          <p className="text-sm text-slate-500">School configuration and data management</p>
        </div>
      </div>

      {msg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">{msg}</p>
        </div>
      )}

      {/* School Settings */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-5">
          <School size={18} className="text-slate-600" />
          <h2 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>School Configuration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">School Name</label>
            <input value={settings.school_name} onChange={e => setSettings(p => ({...p, school_name: e.target.value}))}
              data-testid="school-name-input"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">School Context</label>
            <div className="grid grid-cols-3 gap-3">
              {[['primary', 'Primary', 'Years K-6'], ['secondary', 'Secondary', 'Years 7-12'], ['both', 'Both', 'Years K-12']].map(([val, label, desc]) => (
                <button key={val} onClick={() => setSettings(p => ({...p, school_type: val}))}
                  data-testid={`school-type-${val}`}
                  className={`py-3 px-3 text-left rounded-xl border transition-all ${settings.school_type === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className={`text-xs mt-0.5 ${settings.school_type === val ? 'text-white/60' : 'text-slate-400'}`}>{desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Term</label>
              <div className="flex gap-2">
                {['Term 1', 'Term 2', 'Term 3'].map(t => (
                  <button key={t} onClick={() => setSettings(p => ({...p, current_term: t}))}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-xl border transition-all ${settings.current_term === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Current Year</label>
              <input type="number" value={settings.current_year} onChange={e => setSettings(p => ({...p, current_year: parseInt(e.target.value)}))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none" />
            </div>
          </div>
          <button onClick={saveSettings} disabled={saving} data-testid="save-settings-btn"
            className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader size={15} className="animate-spin" /> : null}
            Save Settings
          </button>
        </div>
      </div>

      {/* User Role */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
        <h2 className="font-semibold text-slate-900 mb-1" style={{fontFamily:'Manrope,sans-serif'}}>Your Role</h2>
        <p className="text-sm text-slate-400 mb-4">Change your role to access different features of the platform.</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => updateRole(opt.value)}
              data-testid={`role-btn-${opt.value}`}
              className={`text-left p-4 rounded-xl border transition-all ${user?.role === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className={`text-xs mt-0.5 ${user?.role === opt.value ? 'text-white/60' : 'text-slate-400'}`}>{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database size={18} className="text-slate-600" />
          <h2 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Data Management</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-sm font-semibold text-slate-700">Load Demo Data</p>
              <p className="text-xs text-slate-400 mt-0.5">Reload sample students, screenings, interventions and alerts</p>
            </div>
            <button onClick={seedData} disabled={seeding} data-testid="seed-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
              {seeding ? <Loader size={14} className="animate-spin" /> : <Database size={14} />}
              {seeding ? 'Loading...' : 'Load Demo Data'}
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-rose-50 rounded-xl border border-rose-100">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete All Data</p>
              <p className="text-xs text-rose-400 mt-0.5">Permanently removes all students, screenings, and interventions</p>
            </div>
            <button onClick={() => setShowWipeConfirm(true)} data-testid="wipe-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors">
              <Trash2 size={14} /> Wipe All Data
            </button>
          </div>
        </div>
      </div>

      {/* Wipe Confirm Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Wipe All Data?</h3>
                <p className="text-sm text-slate-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">This will permanently delete all students, screenings, interventions, case notes, and alerts. Type <strong>DELETE</strong> to confirm.</p>
            <input value={wipeInput} onChange={e => setWipeInput(e.target.value)}
              placeholder="Type DELETE to confirm"
              data-testid="wipe-confirm-input"
              className="w-full px-4 py-3 border border-rose-200 rounded-xl text-sm focus:outline-none mb-4" />
            <div className="flex gap-2">
              <button onClick={wipeData} disabled={wipeInput !== 'DELETE' || wiping} data-testid="confirm-wipe-btn"
                className="flex-1 bg-rose-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-40 transition-colors">
                {wiping ? 'Wiping...' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setShowWipeConfirm(false); setWipeInput(''); }}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
