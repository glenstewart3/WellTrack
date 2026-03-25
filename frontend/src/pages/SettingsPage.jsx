import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  Settings, Trash2, Database, AlertTriangle, CheckCircle, Loader, School,
  Download, Upload, RefreshCw, Palette, Building2, Image, Plus, X,
  Sliders, ToggleLeft, ToggleRight, Tag, User, Shield, RotateCcw, Bot, Wifi, FileUp,
  Calendar, CalendarDays, BookOpen, Target, ClipboardCheck
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ROLE_OPTIONS = [
  { value: 'teacher', label: 'Teacher', desc: 'Can complete screenings & view class data' },
  { value: 'screener', label: 'Screener', desc: 'Can process SAEBRS & Student Self-Report screenings' },
  { value: 'wellbeing', label: 'Wellbeing Staff', desc: 'Manages interventions & case notes' },
  { value: 'leadership', label: 'Leadership', desc: 'Views analytics & meeting prep' },
  { value: 'admin', label: 'Administrator', desc: 'Full access + user management' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const PRESET_COLOURS = ['#0f172a','#1e40af','#065f46','#7c2d12','#4a044e','#0c4a6e','#713f12','#164e63','#6b21a8','#be123c'];

const FIELD_TYPES = ['text', 'select', 'boolean', 'number'];

const TAB_CONFIG = [
  { key: 'General',             icon: Settings },
  { key: 'Branding',            icon: Palette },
  { key: 'MTSS & Screening',    icon: Sliders },
  { key: 'Interventions',       icon: Target },
  { key: 'Student Data',        icon: User },
  { key: 'Screening Sessions',  icon: ClipboardCheck },
  { key: 'Calendar',            icon: CalendarDays },
  { key: 'Imports',             icon: FileUp },
  { key: 'Integrations',        icon: Wifi },
  { key: 'Data',                icon: Database },
];

function TabNav({ active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 mb-8 p-1.5 bg-slate-100 rounded-2xl">
      {TAB_CONFIG.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
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

// ── BRANDING TAB ────────────────────────────────────────────────────────────
function BrandingTab({ settings: s, onSave, saving, msg, msgType }) {
  const [platformName, setPlatformName] = useState(s.platform_name || 'WellTrack');
  const [welcomeMessage, setWelcomeMessage] = useState(s.welcome_message || '');
  const [accentColor, setAccentColor] = useState(s.accent_color || '#0f172a');
  const [logoBase64, setLogoBase64] = useState(s.logo_base64 || '');
  const [logoDarkBase64, setLogoDarkBase64] = useState(s.logo_dark_base64 || '');
  const logoRef = useRef(null);
  const logoDarkRef = useRef(null);
  const { updateSettings } = useSettings();

  useEffect(() => {
    setPlatformName(s.platform_name || 'WellTrack');
    setWelcomeMessage(s.welcome_message || '');
    setAccentColor(s.accent_color || '#0f172a');
    setLogoBase64(s.logo_base64 || '');
    setLogoDarkBase64(s.logo_dark_base64 || '');
  }, [s.accent_color, s.platform_name, s.welcome_message, s.logo_base64, s.logo_dark_base64]);

  const makeLogoHandler = (setter) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setter(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleColorChange = (c) => {
    setAccentColor(c);
    document.documentElement.style.setProperty('--wt-accent', c);
  };

  const handleSave = () => {
    const patch = { platform_name: platformName, welcome_message: welcomeMessage, accent_color: accentColor, logo_base64: logoBase64, logo_dark_base64: logoDarkBase64 };
    updateSettings(patch);
    onSave(patch);
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Logos — Light & Dark */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>School Logo</h3>
        <p className="text-xs text-slate-400 mb-4">
          Upload separate logos for light and dark mode. PNG, SVG, or WebP recommended. Max 2 MB each.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {/* Light logo */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Light mode</p>
            <div className="rounded-xl border border-slate-200 overflow-hidden" style={{ background: '#f8fafc' }}>
              <div className="h-24 flex items-center justify-center p-3">
                {logoBase64
                  ? <img src={logoBase64} alt="Light logo" className="max-h-full max-w-full object-contain" />
                  : <Image size={28} className="text-slate-300" />
                }
              </div>
              <div className="border-t border-slate-100 px-3 py-2 flex items-center gap-2">
                <button onClick={() => logoRef.current?.click()} data-testid="upload-logo-btn"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  <Upload size={12} /> Upload
                </button>
                {logoBase64 && (
                  <button onClick={() => setLogoBase64('')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Remove">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
              data-testid="logo-file-input" onChange={makeLogoHandler(setLogoBase64)} />
          </div>
          {/* Dark logo */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Dark mode</p>
            <div className="rounded-xl border border-slate-700 overflow-hidden" style={{ background: '#1e293b' }}>
              <div className="h-24 flex items-center justify-center p-3">
                {logoDarkBase64
                  ? <img src={logoDarkBase64} alt="Dark logo" className="max-h-full max-w-full object-contain" />
                  : <Image size={28} className="text-slate-600" />
                }
              </div>
              <div className="border-t border-slate-700 px-3 py-2 flex items-center gap-2" style={{ background: '#1e293b' }}>
                <button onClick={() => logoDarkRef.current?.click()} data-testid="upload-logo-dark-btn"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors">
                  <Upload size={12} /> Upload
                </button>
                {logoDarkBase64 && (
                  <button onClick={() => setLogoDarkBase64('')}
                    className="p-1.5 text-rose-400 hover:bg-slate-700 rounded-lg transition-colors" title="Remove">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            <input ref={logoDarkRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
              data-testid="logo-dark-file-input" onChange={makeLogoHandler(setLogoDarkBase64)} />
          </div>
        </div>
      </div>

      {/* Platform name + welcome */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Platform Name</label>
          <p className="text-xs text-slate-400 mb-2">Shown in the browser tab, sidebar header, and all screens.</p>
          <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)}
            data-testid="platform-name-input"
            placeholder="WellTrack"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Login Welcome Message</label>
          <p className="text-xs text-slate-400 mb-2">Shown beneath "Welcome back" on the login screen.</p>
          <textarea value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)}
            data-testid="welcome-message-input"
            placeholder="Supporting every student at Riverside Community School."
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 resize-none" />
        </div>
      </div>

      {/* Accent colour */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Accent Colour</h3>
        <p className="text-xs text-slate-400 mb-4">Used for the sidebar, active navigation, and primary buttons across the app.</p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {PRESET_COLOURS.map(c => (
            <button key={c} onClick={() => handleColorChange(c)}
              title={c}
              style={{ backgroundColor: c }}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${accentColor === c ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'}`}
            />
          ))}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs text-slate-600">
            <Palette size={13} /> Custom
            <input type="color" value={accentColor} onChange={e => handleColorChange(e.target.value)}
              data-testid="accent-color-picker"
              className="w-0 h-0 opacity-0 absolute" />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl shadow-sm" style={{ backgroundColor: accentColor }} />
          <input type="text" value={accentColor} onChange={e => handleColorChange(e.target.value)}
            className="w-28 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none" />
          <span className="text-xs text-slate-400">Preview colour applied instantly</span>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} data-testid="save-branding-btn"
        className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save Branding'}
      </button>
    </div>
  );
}

// ── MTSS & SCREENING TAB ─────────────────────────────────────────────────────
function MTSSTab({ settings: s, onSave, saving, msg, msgType }) {
  const DEFAULT_THRESHOLDS = { saebrs_some_risk: 37, saebrs_high_risk: 24, attendance_some_risk: 95, attendance_high_risk: 90 };
  const [thresholds, setThresholds] = useState({ ...DEFAULT_THRESHOLDS, ...s.tier_thresholds });
  const [modules, setModules] = useState({ saebrs_plus: true, ...s.modules_enabled });
  const resetThresholds = () => setThresholds({ ...DEFAULT_THRESHOLDS });
  const handleSave = () => onSave({ tier_thresholds: thresholds, modules_enabled: modules });

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Tier thresholds */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Tier Classification Thresholds</h3>
          <button onClick={resetThresholds} data-testid="reset-thresholds-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <RotateCcw size={11} /> Reset to Defaults
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-5">Adjust the score cut-offs used to classify students into Tier 1, 2, and 3.</p>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">SAEBRS Total Score (0–57)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Amber (Some Risk) — below</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={thresholds.saebrs_high_risk + 1} max={57} value={thresholds.saebrs_some_risk}
                    onChange={e => setThresholds(p => ({ ...p, saebrs_some_risk: +e.target.value }))}
                    data-testid="saebrs-some-risk-slider"
                    className="flex-1 accent-amber-500" />
                  <span className="w-8 text-sm font-bold text-amber-600">{thresholds.saebrs_some_risk}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Red (High Risk) — below</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={thresholds.saebrs_some_risk - 1} value={thresholds.saebrs_high_risk}
                    onChange={e => setThresholds(p => ({ ...p, saebrs_high_risk: +e.target.value }))}
                    data-testid="saebrs-high-risk-slider"
                    className="flex-1 accent-rose-500" />
                  <span className="w-8 text-sm font-bold text-rose-600">{thresholds.saebrs_high_risk}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden flex">
              <div style={{ width: `${(thresholds.saebrs_high_risk / 57) * 100}%` }} className="bg-rose-400" />
              <div style={{ width: `${((thresholds.saebrs_some_risk - thresholds.saebrs_high_risk) / 57) * 100}%` }} className="bg-amber-400" />
              <div className="flex-1 bg-emerald-400" />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>0 — High Risk</span><span>{thresholds.saebrs_high_risk} — Some Risk</span><span>{thresholds.saebrs_some_risk} — Low Risk — 57</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">Attendance (%)</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Amber — below</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={thresholds.attendance_high_risk + 1} max={100} value={thresholds.attendance_some_risk}
                    onChange={e => setThresholds(p => ({ ...p, attendance_some_risk: +e.target.value }))}
                    data-testid="attendance-some-risk-slider"
                    className="flex-1 accent-amber-500" />
                  <span className="w-10 text-sm font-bold text-amber-600">{thresholds.attendance_some_risk}%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Red — below</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={1} max={thresholds.attendance_some_risk - 1} value={thresholds.attendance_high_risk}
                    onChange={e => setThresholds(p => ({ ...p, attendance_high_risk: +e.target.value }))}
                    data-testid="attendance-high-risk-slider"
                    className="flex-1 accent-rose-500" />
                  <span className="w-10 text-sm font-bold text-rose-600">{thresholds.attendance_high_risk}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Screening Modules</h3>
        <p className="text-xs text-slate-400 mb-4">Enable or disable screening components for your school.</p>
        <div className="space-y-3">
          {[
            { key: 'saebrs_plus', label: 'Student Self-Report', desc: '7-item student self-report for social, emotional, and school belonging (completed individually with student)' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
              </div>
              <button onClick={() => setModules(p => ({ ...p, [key]: !p[key] }))}
                data-testid={`module-toggle-${key}`}
                className="text-slate-400 hover:text-slate-900 transition-colors">
                {modules[key]
                  ? <ToggleRight size={28} className="text-emerald-500" />
                  : <ToggleLeft size={28} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} data-testid="save-mtss-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save MTSS Settings'}
      </button>
    </div>
  );
}

// ── INTERVENTIONS TAB ────────────────────────────────────────────────────────
function InterventionsTab({ settings: s, onSave, saving, msg, msgType }) {
  const [intTypes, setIntTypes] = useState(s.intervention_types || []);
  const [newType, setNewType] = useState('');
  const addType = () => {
    const v = newType.trim();
    if (v && !intTypes.includes(v)) { setIntTypes(prev => [...prev, v]); setNewType(''); }
  };
  const removeType = (t) => setIntTypes(prev => prev.filter(x => x !== t));
  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Intervention Library</h3>
        <p className="text-xs text-slate-400 mb-4">The types of interventions available when creating or editing interventions.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {intTypes.map(t => (
            <span key={t} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg">
              {t}
              <button onClick={() => removeType(t)} className="text-slate-400 hover:text-rose-500 transition-colors"><X size={11} /></button>
            </span>
          ))}
          {intTypes.length === 0 && <p className="text-sm text-slate-400">No intervention types added yet.</p>}
        </div>
        <div className="flex gap-2">
          <input type="text" value={newType} onChange={e => setNewType(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addType()}
            data-testid="new-intervention-type-input"
            placeholder="Add intervention type…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          <button onClick={addType} data-testid="add-intervention-type-btn"
            className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <button onClick={() => onSave({ intervention_types: intTypes })} disabled={saving} data-testid="save-interventions-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save Intervention Settings'}
      </button>
    </div>
  );
}

// ── STUDENT DATA TAB ─────────────────────────────────────────────────────────
function StudentDataTab({ settings: s, onSave, saving, msg, msgType }) {
  const [fields, setFields] = useState(s.custom_student_fields || []);
  const [riskConfig, setRiskConfig] = useState({ consecutive_absence_days: 3, ...s.risk_config });
  const [yearStartMonth, setYearStartMonth] = useState(s.year_start_month ?? 2);
  const [addingField, setAddingField] = useState(false);
  const [newField, setNewField] = useState({ label: '', type: 'text', options: '', required: false });
  const [absenceTypes, setAbsenceTypes] = useState([]);
  const [excludedTypes, setExcludedTypes] = useState(new Set(s.excluded_absence_types || []));

  useEffect(() => {
    axios.get(`${API}/attendance/types`, { withCredentials: true })
      .then(r => setAbsenceTypes(r.data.types || []))
      .catch(() => {});
  }, []);

  const toggleExclude = (type) => {
    setExcludedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const confirmAddField = () => {
    if (!newField.label.trim()) return;
    const field = {
      id: newField.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      label: newField.label.trim(),
      type: newField.type,
      options: newField.type === 'select' ? newField.options.split(',').map(o => o.trim()).filter(Boolean) : [],
      required: newField.required,
    };
    setFields(prev => [...prev, field]);
    setNewField({ label: '', type: 'text', options: '', required: false });
    setAddingField(false);
  };

  const handleSave = () => onSave({
    custom_student_fields: fields,
    risk_config: riskConfig,
    year_start_month: yearStartMonth,
    excluded_absence_types: [...excludedTypes],
  });

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Academic year */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Academic Year</h3>
        <p className="text-xs text-slate-400 mb-4">Used for year-based analytics and report grouping.</p>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Year Start Month</label>
          <select value={yearStartMonth} onChange={e => setYearStartMonth(+e.target.value)}
            data-testid="year-start-month-select"
            className="w-full max-w-xs px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Risk config */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Risk Indicator Config</h3>
        <p className="text-xs text-slate-400 mb-4">Control what triggers a risk flag in the Classroom Risk Radar.</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1 block">Consecutive Absence Days Flag</label>
            <p className="text-xs text-slate-400 mb-2">Students with this many consecutive absences are flagged.</p>
            <div className="flex items-center gap-3">
              <input type="range" min={1} max={10} value={riskConfig.consecutive_absence_days}
                onChange={e => setRiskConfig(p => ({ ...p, consecutive_absence_days: +e.target.value }))}
                data-testid="consecutive-absence-slider"
                className="flex-1 max-w-xs accent-rose-500" />
              <span className="text-sm font-bold text-rose-600 w-16">{riskConfig.consecutive_absence_days} {riskConfig.consecutive_absence_days === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Absence Types */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Absence Type Configuration</h3>
        <p className="text-xs text-slate-400 mb-4">
          Control which absence types count towards a student's attendance calculation.
          Toggle off any type to exclude it — excluded types won't reduce attendance percentage.
        </p>
        {absenceTypes.filter(t => t !== 'Present').length === 0 ? (
          <p className="text-sm text-slate-400 italic">No absence types found. Upload attendance data first to populate this list.</p>
        ) : (
          <div className="space-y-2">
            {absenceTypes.filter(t => t !== 'Present').map(type => {
              const isExcluded = excludedTypes.has(type);
              return (
                <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <p className={`text-sm font-medium ${isExcluded ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{type}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isExcluded ? 'Excluded from attendance calculation' : 'Counts towards absences'}
                    </p>
                  </div>
                  <button onClick={() => toggleExclude(type)} data-testid={`absence-type-toggle-${type.replace(/\s+/g, '-')}`}>
                    {isExcluded
                      ? <ToggleLeft size={28} className="text-slate-300" />
                      : <ToggleRight size={28} className="text-emerald-500" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom student fields */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Custom Student Fields</h3>
          <button onClick={() => setAddingField(true)} data-testid="add-student-field-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={13} /> Add Field
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Extra fields shown on every student's profile. Examples: Indigenous Status, EALD, NDIS, Year Advisor.</p>

        {fields.length > 0 ? (
          <div className="space-y-2 mb-4">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <User size={14} className="text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{f.label}</p>
                    <p className="text-xs text-slate-400">{f.type}{f.required ? ' · required' : ''}{f.type === 'select' && f.options.length > 0 ? ` · ${f.options.join(', ')}` : ''}</p>
                  </div>
                </div>
                <button onClick={() => setFields(prev => prev.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-rose-500 transition-colors p-1"><X size={14} /></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic mb-4">No custom fields defined yet.</p>
        )}

        {addingField && (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <p className="text-sm font-semibold text-slate-700">New Field</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Field Label</label>
                <input type="text" value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))}
                  data-testid="new-field-label-input"
                  placeholder="e.g. Indigenous Status"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Field Type</label>
                <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {newField.type === 'select' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Options (comma-separated)</label>
                <input type="text" value={newField.options} onChange={e => setNewField(p => ({ ...p, options: e.target.value }))}
                  placeholder="Yes, No, Prefer not to say"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="field-required" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} />
              <label htmlFor="field-required" className="text-xs text-slate-600">Required field</label>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmAddField} data-testid="confirm-add-field-btn"
                className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">Add Field</button>
              <button onClick={() => setAddingField(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} data-testid="save-student-data-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save Student Data Settings'}
      </button>
    </div>
  );
}

// ── GENERAL TAB ──────────────────────────────────────────────────────────────
function GeneralTab({ settings: s, onSave, saving, msg, msgType }) {
  const [schoolName, setSchoolName] = useState(s.school_name || '');
  const [schoolType, setSchoolType] = useState(s.school_type || 'both');
  const [currentTerm, setCurrentTerm] = useState(s.current_term || 'Term 1');
  const [currentYear, setCurrentYear] = useState(s.current_year || new Date().getFullYear());
  const [emailAuthEnabled, setEmailAuthEnabled] = useState(s.email_auth_enabled !== false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(s.google_auth_enabled !== false);
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setEmailAuthEnabled(s.email_auth_enabled !== false);
    setGoogleAuthEnabled(s.google_auth_enabled !== false);
  }, [s.email_auth_enabled]);

  const handleSave = () => onSave({ school_name: schoolName, school_type: schoolType, current_term: currentTerm, current_year: currentYear, email_auth_enabled: emailAuthEnabled, google_auth_enabled: googleAuthEnabled });

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) {
      setPwMsg({ text: 'New passwords do not match', type: 'error' }); return;
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg({ text: 'Password must be at least 8 characters', type: 'error' }); return;
    }
    setPwSaving(true);
    try {
      await axios.put(`${API}/auth/change-password`, { current_password: pwForm.current_password, new_password: pwForm.new_password }, { withCredentials: true });
      setPwMsg({ text: 'Password updated successfully', type: 'success' });
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      setPwMsg({ text: e.response?.data?.detail || 'Failed to update password', type: 'error' });
    } finally {
      setPwSaving(false);
      setTimeout(() => setPwMsg({ text: '', type: '' }), 4000);
    }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>School Context</h3>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">School Name</label>
          <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
            data-testid="general-school-name"
            placeholder="e.g. Riverside Community School"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">School Type</label>
          <div className="grid grid-cols-3 gap-2">
            {[{ value: 'primary', label: 'Primary', sub: 'K–6' }, { value: 'secondary', label: 'Secondary', sub: '7–12' }, { value: 'both', label: 'K–12', sub: 'All levels' }].map(opt => (
              <button key={opt.value} onClick={() => setSchoolType(opt.value)}
                className={`p-3 rounded-xl border text-left transition-all ${schoolType === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className={`text-xs mt-0.5 ${schoolType === opt.value ? 'text-white/60' : 'text-slate-400'}`}>{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Current Term</label>
          <div className="grid grid-cols-4 gap-2">
            {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => (
              <button key={t} onClick={() => setCurrentTerm(t)}
                className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${currentTerm === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Current Year</label>
          <input type="number" value={currentYear} onChange={e => setCurrentYear(+e.target.value)} min={2020} max={2040}
            className="w-32 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none" />
        </div>
      </div>

      {/* Your Role block removed — use User Management to change roles */}

      {/* Authentication */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Authentication</h3>
          <p className="text-xs text-slate-400 mt-0.5">Control how staff can sign in to WellTrack</p>
        </div>
        {[
          { key: 'email', label: 'Email & Password Login', desc: 'Staff sign in with an email and password. Passwords are set by admins in User Management.', state: emailAuthEnabled, setState: setEmailAuthEnabled, testid: 'email-auth-toggle' },
          { key: 'google', label: 'Google Login', desc: 'Staff sign in with their Google account. Requires valid Google OAuth credentials in server settings.', state: googleAuthEnabled, setState: setGoogleAuthEnabled, testid: 'google-auth-toggle' },
        ].map(opt => (
          <div key={opt.key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
            </div>
            <button onClick={() => opt.setState(p => !p)} data-testid={opt.testid}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${opt.state ? 'bg-slate-900' : 'bg-slate-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${opt.state ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Change own password */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Change Your Password</h3>
          <p className="text-xs text-slate-400 mt-0.5">Update the password for your own account</p>
        </div>
        {pwMsg.text && (
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${pwMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            <CheckCircle size={14} /> {pwMsg.text}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Current Password</label>
            <input type="password" value={pwForm.current_password} onChange={e => setPwForm(p => ({...p, current_password: e.target.value}))}
              placeholder="Leave blank if no password set yet" data-testid="current-password-input"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">New Password</label>
            <input type="password" value={pwForm.new_password} onChange={e => setPwForm(p => ({...p, new_password: e.target.value}))}
              placeholder="At least 8 characters" data-testid="new-password-input"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Confirm New Password</label>
            <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({...p, confirm: e.target.value}))}
              placeholder="Repeat new password" data-testid="confirm-password-input"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
          </div>
          <button onClick={handleChangePassword} disabled={pwSaving || !pwForm.new_password} data-testid="change-password-btn"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors">
            {pwSaving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {pwSaving ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} data-testid="save-general-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save General Settings'}
      </button>
    </div>
  );
}

function RoleSection() {
  const { user, setUser } = useAuth();
  const [msg, setMsg] = useState('');

  const updateRole = async (role) => {
    try {
      await axios.put(`${API}/auth/role`, { role }, { withCredentials: true });
      setUser(prev => ({ ...prev, role }));
      setMsg(`Role updated to ${role}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(e.response?.data?.detail || 'Failed to update role');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold">
          {ROLE_OPTIONS.find(r => r.value === user?.role)?.label || user?.role}
        </span>
        <p className="text-xs text-slate-400">Contact your administrator to change your role.</p>
      </div>
    );
  }

  return (
    <>
      {msg && <p className="text-sm text-emerald-600 mb-3">{msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => updateRole(opt.value)} data-testid={`role-btn-${opt.value}`}
            className={`text-left p-3 rounded-xl border transition-all ${user?.role === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
            <p className="text-sm font-semibold">{opt.label}</p>
            <p className={`text-xs mt-0.5 ${user?.role === opt.value ? 'text-white/60' : 'text-slate-400'}`}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </>
  );
}

// ── DATA TAB ──────────────────────────────────────────────────────────────────
function DataTab({ msg, msgType, setMsg, setMsgType }) {
  const [seeding, setSeeding] = useState(false);
  const [seedStudentCount, setSeedStudentCount] = useState('32');
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeInput, setWipeInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // 'students' | 'attendance'
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [csvLoading, setCsvLoading] = useState({});
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const fetchBackups = async () => {
    try {
      const res = await axios.get(`${API}/backups`, { withCredentials: true });
      setBackups(res.data.backups || []);
    } catch (e) { console.error(e); }
    finally { setBackupsLoading(false); }
  };

  useEffect(() => { fetchBackups(); }, []);

  const triggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await axios.post(`${API}/backups/trigger`, {}, { withCredentials: true });
      setMsgType('success');
      setMsg(`Backup created: ${res.data.filename} (${res.data.size_kb} KB)`);
      setTimeout(() => setMsg(''), 4000);
      await fetchBackups();
    } catch (e) {
      setMsgType('error'); setMsg('Backup failed'); setTimeout(() => setMsg(''), 3000);
    } finally { setTriggeringBackup(false); }
  };

  const downloadBackup = (filename) => {
    const a = document.createElement('a');
    a.href = `${API}/backups/download/${filename}`;
    a.download = filename;
    a.click();
  };

  const deleteBackup = async (filename) => {
    setDeletingBackup(filename);
    try {
      await axios.delete(`${API}/backups/${filename}`, { withCredentials: true });
      setBackups(prev => prev.filter(b => b.filename !== filename));
    } catch (e) {
      setMsgType('error'); setMsg('Delete failed'); setTimeout(() => setMsg(''), 3000);
    } finally { setDeletingBackup(null); }
  };

  const downloadCSV = async (endpoint, filename) => {
    setCsvLoading(prev => ({ ...prev, [endpoint]: true }));
    try {
      const res = await axios.get(`${API}/${endpoint}`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setMsgType('error'); setMsg('Export failed'); setTimeout(() => setMsg(''), 3000);
    } finally { setCsvLoading(prev => ({ ...prev, [endpoint]: false })); }
  };

  const seedData = async () => {
    const count = Math.max(8, Math.min(400, parseInt(seedStudentCount) || 32));
    setSeedStudentCount(String(count));
    setSeeding(true);
    try {
      const res = await axios.post(`${API}/settings/seed`, { student_count: count }, { withCredentials: true });
      setMsgType('success'); setMsg(`Demo data loaded: ${res.data.students} students, ${res.data.interventions} interventions`);
      setTimeout(() => setMsg(''), 5000);
    } catch (e) { console.error(e); } finally { setSeeding(false); }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/settings/export-all`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `welltrack_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setMsgType('success'); setMsg('Data exported successfully'); setTimeout(() => setMsg(''), 3000);
    } catch (e) { console.error(e); } finally { setExporting(false); }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text(); const data = JSON.parse(text);
      const res = await axios.post(`${API}/settings/restore`, data, { withCredentials: true });
      const counts = Object.entries(res.data.restored || {}).map(([k, v]) => `${v} ${k}`).join(', ');
      setMsgType('success'); setMsg(`Restored: ${counts}`); setTimeout(() => setMsg(''), 5000);
    } catch (e) {
      setMsgType('error'); setMsg(e.response?.data?.detail || 'Restore failed'); setTimeout(() => setMsg(''), 5000);
    } finally { setRestoring(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const wipeData = async () => {
    if (wipeInput !== 'DELETE') return;
    setWiping(true);
    try {
      await axios.delete(`${API}/settings/data`, { withCredentials: true });
      setShowWipeConfirm(false); setWipeInput('');
      setMsgType('success'); setMsg('All data wiped'); setTimeout(() => setMsg(''), 4000);
    } catch (e) { console.error(e); } finally { setWiping(false); }
  };

  const deleteTargetData = async () => {
    if (deleteInput !== 'DELETE' || !deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/settings/data/${deleteTarget}`, { withCredentials: true });
      setDeleteTarget(null); setDeleteInput('');
      const label = deleteTarget === 'students' ? 'Student data' : 'Attendance data';
      setMsgType('success'); setMsg(`${label} deleted`); setTimeout(() => setMsg(''), 4000);
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-3">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}
      {/* Demo Data */}
      <div className="p-4 bg-slate-50 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Load Demo Data</p>
            <p className="text-xs text-slate-400 mt-0.5">Reload sample students, screenings, interventions and alerts</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min="8" max="400" value={seedStudentCount}
              onChange={e => setSeedStudentCount(e.target.value)}
              onBlur={e => {
                const v = Math.max(8, Math.min(400, parseInt(e.target.value) || 32));
                setSeedStudentCount(String(v));
              }}
              data-testid="seed-student-count-input"
              className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center font-medium bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              title="Number of demo students (8–400)"
            />
            <span className="text-xs text-slate-400">students</span>
            <button onClick={seedData} disabled={seeding} data-testid="load-demo-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
              {seeding ? <Loader size={14} className="animate-spin" /> : <Database size={14} />}
              {seeding ? '…' : 'Load Demo Data'}
            </button>
          </div>
        </div>
      </div>
      {[
        { label: 'Export All Data', desc: 'Download a full JSON backup of all school data', action: exportData, loading: exporting, icon: <Download size={14} />, text: 'Export Backup', variant: 'default' },
      ].map(item => (
        <div key={item.label} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div>
            <p className="text-sm font-semibold text-slate-700">{item.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
          </div>
          <button onClick={item.action} disabled={item.loading} data-testid={`${item.label.toLowerCase().replace(/\s+/g, '-')}-btn`}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
            {item.loading ? <Loader size={14} className="animate-spin" /> : item.icon} {item.loading ? '…' : item.text}
          </button>
        </div>
      ))}

      {/* CSV Data Exports */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Export CSV Data</h3>
        <p className="text-xs text-slate-400 mb-4">Download individual data sets as CSV for use in Excel or other tools.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { endpoint: 'reports/students-csv', filename: 'students.csv', label: 'Student List', desc: 'All students with year level & class', testid: 'export-students-csv-btn' },
            { endpoint: 'reports/tier-summary-csv', filename: 'tier_summary.csv', label: 'Tier Summary', desc: 'MTSS tier, SAEBRS & attendance per student', testid: 'export-tier-csv-btn' },
            { endpoint: 'reports/screening-csv', filename: 'screening.csv', label: 'Screening Results', desc: 'Full SAEBRS screening data', testid: 'export-screening-csv-btn' },
            { endpoint: 'reports/interventions-csv', filename: 'interventions.csv', label: 'Interventions', desc: 'All intervention records & status', testid: 'export-interventions-csv-btn' },
          ].map(item => (
            <div key={item.endpoint} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
              </div>
              <button
                onClick={() => downloadCSV(item.endpoint, item.filename)}
                disabled={csvLoading[item.endpoint]}
                data-testid={item.testid}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 shrink-0 ml-2">
                {csvLoading[item.endpoint] ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                {csvLoading[item.endpoint] ? '…' : 'CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Automatic Backups */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Automatic Daily Backups</h3>
            <p className="text-xs text-slate-400 mt-0.5">JSON snapshots of all school data — saved to the server at midnight each day. Last 30 days kept.</p>
          </div>
          <button onClick={triggerBackup} disabled={triggeringBackup} data-testid="trigger-backup-btn"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60 shrink-0 ml-4">
            {triggeringBackup ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
            {triggeringBackup ? 'Creating…' : 'Run Now'}
          </button>
        </div>

        {backupsLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}</div>
        ) : backups.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg">
            No backups yet — click "Run Now" to create the first one.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {backups.map(b => (
              <div key={b.filename} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg" data-testid={`backup-item-${b.filename}`}>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{b.filename}</p>
                  <p className="text-xs text-slate-400">{new Date(b.created_at).toLocaleString()} · {b.size_kb} KB</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-3">
                  <button onClick={() => downloadBackup(b.filename)} data-testid={`download-backup-${b.filename}`}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors">
                    <Download size={13} />
                  </button>
                  {user?.role === 'admin' && (
                    <button onClick={() => deleteBackup(b.filename)} disabled={deletingBackup === b.filename} data-testid={`delete-backup-${b.filename}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60">
                      {deletingBackup === b.filename ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {user?.role === 'admin' && (
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div>
            <p className="text-sm font-semibold text-blue-700">Restore Data</p>
            <p className="text-xs text-blue-400 mt-0.5">Upload a WellTrack JSON backup file</p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreFile} className="hidden" data-testid="restore-file-input" />
            <button onClick={() => fileInputRef.current?.click()} disabled={restoring} data-testid="restore-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              {restoring ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />} {restoring ? 'Restoring…' : 'Restore Backup'}
            </button>
          </div>
        </div>
      )}

      {/* Targeted delete options */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Delete Specific Data</h3>
        <p className="text-xs text-slate-400 mb-4">Remove a specific category of data without affecting everything else.</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete Student Data</p>
              <p className="text-xs text-rose-400 mt-0.5">Removes all students, screenings, interventions, case notes and alerts</p>
            </div>
            <button onClick={() => { setDeleteTarget('students'); setDeleteInput(''); }} data-testid="delete-students-btn"
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shrink-0 ml-4">
              <Trash2 size={13} /> Delete Students
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete Attendance Data</p>
              <p className="text-xs text-rose-400 mt-0.5">Removes all uploaded absence records (calendar terms are kept)</p>
            </div>
            <button onClick={() => { setDeleteTarget('attendance'); setDeleteInput(''); }} data-testid="delete-attendance-btn"
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shrink-0 ml-4">
              <Trash2 size={13} /> Delete Attendance
            </button>
          </div>
        </div>
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

      {/* Targeted delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-rose-600" /></div>
              <h3 className="font-bold text-slate-900">
                Delete {deleteTarget === 'students' ? 'Student' : 'Attendance'} Data?
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              {deleteTarget === 'students'
                ? 'This will permanently delete all students, screenings, interventions, case notes, and alerts.'
                : 'This will permanently delete all uploaded attendance records. Calendar terms and school days are kept.'}
              {' '}Type <strong>DELETE</strong> to confirm.
            </p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type DELETE"
              data-testid="delete-target-confirm-input"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={deleteTargetData} disabled={deleteInput !== 'DELETE' || deleting}
                data-testid="confirm-delete-target-btn"
                className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setDeleteTarget(null); setDeleteInput(''); }}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showWipeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-rose-600" /></div>
              <h3 className="font-bold text-slate-900">Wipe All Data?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">This will permanently delete all students, screenings, interventions, and case notes. Type <strong>DELETE</strong> to confirm.</p>
            <input value={wipeInput} onChange={e => setWipeInput(e.target.value)} placeholder="Type DELETE"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={wipeData} disabled={wipeInput !== 'DELETE' || wiping}
                className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {wiping ? 'Wiping…' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setShowWipeConfirm(false); setWipeInput(''); }}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CALENDAR TAB ─────────────────────────────────────────────────────────────
function CalendarTab({ msg, msgType, setMsg, setMsgType }) {
  const { settings } = useSettings();
  const initYear = settings?.current_year || new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(initYear);
  const [availableYears, setAvailableYears] = useState([initYear]);
  const [terms, setTerms] = useState([]);
  const [nonSchoolDays, setNonSchoolDays] = useState([]);
  const [schoolDaysCount, setSchoolDaysCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newDay, setNewDay] = useState({ date: '', reason: '' });
  const [addingYear, setAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState('');
  const [confirmDeleteYear, setConfirmDeleteYear] = useState(null);

  const normalizeTerms = React.useCallback((loadedTerms, year) => {
    return [1, 2, 3, 4].map(n => {
      const existing = loadedTerms.find(t =>
        t.name === `Term ${n}` || t.name?.startsWith(`Term ${n} `) || t.name?.startsWith(`Term ${n}:`)
      ) || loadedTerms.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))[n - 1];
      return {
        id: existing?.id || `${year}-t${n}`,
        name: `Term ${n}`,
        year,
        start_date: existing?.start_date || '',
        end_date: existing?.end_date || '',
      };
    });
  }, []);

  const fetchTerms = React.useCallback(async (year) => {
    setLoading(true);
    try {
      const url = year ? `${API}/settings/terms?year=${year}` : `${API}/settings/terms`;
      const r = await axios.get(url, { withCredentials: true });
      const activeYear = r.data.active_year || year || initYear;
      setTerms(normalizeTerms(r.data.terms || [], activeYear));
      setNonSchoolDays(r.data.non_school_days || []);
      setSchoolDaysCount(r.data.school_days_count || 0);
      const yrs = r.data.available_years || [activeYear];
      // Merge with existing list so unsaved new years aren't wiped
      setAvailableYears(prev => [...new Set([...prev, ...yrs])].sort((a, b) => b - a));
      setSelectedYear(activeYear);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [initYear, normalizeTerms]);

  useEffect(() => { fetchTerms(initYear); }, []);

  const handleYearChange = (year) => fetchTerms(year);

  const addNewYear = () => {
    const max = Math.max(...availableYears, new Date().getFullYear());
    setNewYearInput(String(max + 1));
    setAddingYear(true);
  };

  const confirmNewYear = () => {
    const yr = parseInt(newYearInput, 10);
    if (!yr || yr < 2000 || yr > 2100) return;
    if (!availableYears.includes(yr)) {
      setAvailableYears(prev => [...new Set([...prev, yr])].sort((a, b) => b - a));
    }
    setSelectedYear(yr);
    setTerms(normalizeTerms([], yr));
    setSchoolDaysCount(0);
    setAddingYear(false);
    setNewYearInput('');
  };

  const deleteYear = async (yr) => {
    try {
      await axios.delete(`${API}/settings/terms?year=${yr}`, { withCredentials: true });
      const remaining = availableYears.filter(y => y !== yr);
      setAvailableYears(remaining);
      const next = remaining[0] || new Date().getFullYear();
      setConfirmDeleteYear(null);
      fetchTerms(next);
      setMsgType('success'); setMsg(`Year ${yr} deleted`);
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      setMsgType('error'); setMsg(e.response?.data?.detail || 'Delete failed');
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const updateTerm = (idx, field, value) =>
    setTerms(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));

  const calcDays = (term) => {
    if (!term.start_date || !term.end_date) return 0;
    const excluded = new Set(nonSchoolDays.map(d => d.date));
    let count = 0;
    const end = new Date(term.end_date);
    const cur = new Date(term.start_date);
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow !== 0 && dow !== 6 && !excluded.has(cur.toISOString().split('T')[0])) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const totalDays = terms.reduce((s, t) => s + calcDays(t), 0);

  const addDay = () => {
    if (!newDay.date) return;
    if (nonSchoolDays.some(d => d.date === newDay.date)) return;
    setNonSchoolDays(p => [...p, { ...newDay, id: Date.now().toString() }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDay({ date: '', reason: '' });
  };

  const save = async () => {
    // Validate filled terms
    const filledTerms = terms.filter(t => t.start_date && t.end_date);
    for (const t of filledTerms) {
      if (t.start_date > t.end_date) { setMsg(`${t.name}: start date must be before end date`); setMsgType('error'); return; }
    }
    setSaving(true);
    try {
      const res = await axios.put(`${API}/settings/terms`, {
        terms: filledTerms, non_school_days: nonSchoolDays, year: selectedYear,
      }, { withCredentials: true });
      setSchoolDaysCount(res.data.school_days_count || 0);
      setMsgType('success'); setMsg(res.data.message || 'Calendar saved');
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsgType('error'); setMsg(e.response?.data?.detail || 'Save failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setSaving(false); }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${parseInt(d)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]} ${y}`;
  };

  if (loading) return <div className="text-sm text-slate-400 py-8 text-center">Loading calendar…</div>;

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Year selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>School Year</h3>
            <p className="text-xs text-slate-400 mt-0.5">Each year's terms are stored independently — editing one year won't affect another.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap" data-testid="year-selector">
          {availableYears.map(y => (
            confirmDeleteYear === y ? (
              <div key={y} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-rose-50 text-xs text-rose-700 font-medium">
                <span>Delete {y}?</span>
                <button onClick={() => deleteYear(y)} className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors">Yes, delete</button>
                <button onClick={() => setConfirmDeleteYear(null)} className="px-2 py-0.5 rounded border border-rose-300 text-rose-600 text-xs font-semibold hover:bg-rose-100 transition-colors">Cancel</button>
              </div>
            ) : (
              <div key={y} className="group relative flex items-center">
                <button onClick={() => handleYearChange(y)} data-testid={`year-btn-${y}`}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${selectedYear === y ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {y}
                </button>
                <button onClick={() => setConfirmDeleteYear(y)} title={`Delete ${y}`}
                  className={`absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full w-4 h-4 flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white shadow-sm`}>
                  <X size={9} />
                </button>
              </div>
            )
          ))}
          {addingYear ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number" value={newYearInput} onChange={e => setNewYearInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmNewYear(); if (e.key === 'Escape') setAddingYear(false); }}
                className="w-24 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="2027" autoFocus
              />
              <button onClick={confirmNewYear} className="px-3 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">Add</button>
              <button onClick={() => setAddingYear(false)} className="px-3 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:border-slate-400 transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={addNewYear} data-testid="add-year-btn"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-dashed border-slate-300 text-slate-500 hover:border-slate-600 hover:text-slate-700 transition-colors">
              <Plus size={14} /> New Year
            </button>
          )}
        </div>
      </div>

      {/* Terms for selected year */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Term Dates — {selectedYear}</h3>
          {schoolDaysCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
              <CalendarDays size={12} /> {schoolDaysCount} school days
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">Weekends are excluded automatically. Students not in the absence file on a school day are counted as present.</p>

        <div className="space-y-3 mb-4">
          {terms.map((t, idx) => {
            const days = calcDays(t);
            return (
              <div key={t.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100" data-testid={`term-row-${t.id}`}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={14} className="text-slate-400 shrink-0" />
                  <span className="text-sm font-bold text-slate-800">{t.name}</span>
                  {days > 0 && (
                    <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {days} days
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Start date</label>
                    <input
                      type="date"
                      value={t.start_date}
                      onChange={e => updateTerm(idx, 'start_date', e.target.value)}
                      data-testid={`term-${idx + 1}-start`}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">End date</label>
                    <input
                      type="date"
                      value={t.end_date}
                      onChange={e => updateTerm(idx, 'end_date', e.target.value)}
                      data-testid={`term-${idx + 1}-end`}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Non-school days (global — apply across all years) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Non-School Days</h3>
        <p className="text-xs text-slate-400 mb-4">Public holidays, curriculum days, or any other day within a term that is not a school day. These apply globally across all years.</p>

        {nonSchoolDays.length === 0 && (
          <p className="text-sm text-slate-400 italic mb-4">No non-school days added yet.</p>
        )}

        {nonSchoolDays.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {nonSchoolDays.map(d => (
              <div key={d.id || d.date} className="flex items-center gap-3 px-3 py-2.5 bg-amber-50/60 border border-amber-100 rounded-xl" data-testid={`non-school-day-${d.date}`}>
                <Calendar size={13} className="text-amber-500 shrink-0" />
                <span className="text-sm font-semibold text-slate-700 w-28 shrink-0">{fmtDate(d.date)}</span>
                <span className="text-sm text-slate-500 flex-1 min-w-0 truncate">{d.reason || <span className="italic text-slate-300">No reason</span>}</span>
                <button onClick={() => setNonSchoolDays(p => p.filter(x => x.date !== d.date))}
                  className="text-slate-300 hover:text-rose-500 transition-colors shrink-0" data-testid={`delete-non-school-day-${d.date}`}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <input type="date" value={newDay.date}
            onChange={e => setNewDay(p => ({ ...p, date: e.target.value }))}
            data-testid="new-non-school-date"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
          <input type="text" placeholder="Reason (e.g. Australia Day, Curriculum Day)" value={newDay.reason}
            onChange={e => setNewDay(p => ({ ...p, reason: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && addDay()}
            data-testid="new-non-school-reason"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none" />
          <button onClick={addDay} data-testid="add-non-school-day-btn"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {totalDays > 0 ? `${totalDays} school days across ${terms.length} term${terms.length !== 1 ? 's' : ''} (${selectedYear})` : `No terms defined for ${selectedYear}`}
          </p>
          {nonSchoolDays.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{nonSchoolDays.length} non-school day{nonSchoolDays.length !== 1 ? 's' : ''} excluded globally</p>
          )}
        </div>
        <button onClick={save} disabled={saving} data-testid="save-calendar-btn"
          className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
          {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {saving ? 'Saving…' : `Save ${selectedYear} Calendar`}
        </button>
      </div>
    </div>
  );
}


// ── IMPORTS TAB ──────────────────────────────────────────────────────────────
function ImportsTab({ msg, msgType, setMsg, setMsgType, settings, onSave }) {
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [attFile, setAttFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attResult, setAttResult] = useState(null);
  const [photoZip, setPhotoZip] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoResult, setPhotoResult] = useState(null);
  const [detailsFile, setDetailsFile] = useState(null);
  const [importingDetails, setImportingDetails] = useState(false);
  const [detailsResult, setDetailsResult] = useState(null);
  const importRef = useRef(null);
  const attRef = useRef(null);
  const photoRef = useRef(null);
  const detailsRef = useRef(null);

  const parseAndImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      let rows = [];
      const lname = importFile.name.toLowerCase();
      if (lname.endsWith('.csv')) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('File appears empty');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        rows = lines.slice(1).map(line => {
          const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
        }).filter(r => Object.values(r).some(v => v));
      } else {
        throw new Error('Please upload a CSV file');
      }
      const res = await axios.post(`${API}/students/import`, { students: rows }, { withCredentials: true });
      setImportResult(res.data);
      setImportFile(null);
      if (importRef.current) importRef.current.value = '';
      setMsgType('success');
      setMsg(`Import complete: ${res.data.imported} new, ${res.data.updated || 0} updated, ${res.data.errors?.length || 0} errors`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || e.message || 'Import failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setImporting(false); }
  };

  const uploadAttendance = async () => {
    if (!attFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', attFile);
      const res = await axios.post(`${API}/attendance/upload`, fd, { withCredentials: true });
      setAttResult(res.data);
      setAttFile(null);
      if (attRef.current) attRef.current.value = '';
      setMsgType('success');
      setMsg(`Attendance uploaded: ${res.data.matched_students} students matched · ${res.data.processed} absence records processed`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Upload failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setUploading(false); }
  };

  const uploadStudentDetails = async () => {
    if (!detailsFile) return;
    setImportingDetails(true);
    try {
      const fd = new FormData();
      fd.append('file', detailsFile);
      const res = await axios.post(`${API}/students/import-student-details`, fd, { withCredentials: true });
      setDetailsResult(res.data);
      setDetailsFile(null);
      if (detailsRef.current) detailsRef.current.value = '';
      setMsgType('success');
      setMsg(`Student details imported: ${res.data.updated} updated · ${res.data.unmatched} unmatched`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Import failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setImportingDetails(false); }
  };

  const uploadPhotos = async () => {    if (!photoZip) return;
    setUploadingPhotos(true);
    setPhotoResult(null);
    try {
      const fd = new FormData();
      fd.append('file', photoZip);
      const res = await axios.post(`${API}/students/upload-photos`, fd, {
        withCredentials: true,
        onUploadProgress: () => {},
      });
      setPhotoResult(res.data);
      setPhotoZip(null);
      if (photoRef.current) photoRef.current.value = '';
      setMsgType('success');
      setMsg(`Photos uploaded: ${res.data.matched} matched · ${res.data.unmatched} unmatched`);
      setTimeout(() => setMsg(''), 8000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Photo upload failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setUploadingPhotos(false); }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Student Import */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Import Students</h3>
        <p className="text-xs text-slate-400 mb-1">Upload a CSV exported from your school system. Supports columns: <code className="bg-slate-100 px-1 rounded">Import Identifier, First Name, Preferred Name, Surname, Form Group, Year Level, User Status, Base Role</code></p>
        <p className="text-xs text-slate-400 mb-3">Students are matched by <strong>Import Identifier</strong> (column A) and updated if they already exist.</p>
        <details className="mb-4 group">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 select-none list-none flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
            How to export from Compass
          </summary>
          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-slate-600 space-y-1.5">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>In Compass, go to <strong>People Management</strong></li>
              <li>Set filters: <strong>User Status = Active</strong> and <strong>Base Role = Student</strong></li>
              <li>Click <strong>Export &amp; Stats</strong> → <strong>Users</strong> → <strong>Select Filtered People</strong></li>
              <li>Save the downloaded file as a <strong>.csv</strong> and upload it here</li>
            </ol>
          </div>
        </details>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={e => setImportFile(e.target.files?.[0] || null)} data-testid="import-students-file" />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <FileUp size={14} /> {importFile ? importFile.name : 'Choose CSV file'}
          </button>
          {importFile && (
            <button onClick={parseAndImport} disabled={importing} data-testid="run-import-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
        {importResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
            <p><strong>New:</strong> {importResult.imported} &nbsp; <strong>Updated:</strong> {importResult.updated || 0} &nbsp; <strong>Errors:</strong> {importResult.errors?.length || 0}</p>
            {importResult.errors?.length > 0 && (
              <ul className="text-rose-600 space-y-0.5">{importResult.errors.slice(0, 5).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {/* Student Details Import */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Import Student Details</h3>
        <p className="text-xs text-slate-400 mb-1">Upload the Student Table Full Data export to enrich profiles with teacher, gender, EAL status, Aboriginal status, and NCCD disability. Students are matched by <strong>STUDENT_KEY</strong>.</p>
        <p className="text-xs text-slate-400 mb-3">Accepts CSV. EAL and Aboriginal status will appear as tags on student profiles and the student list.</p>
        <details className="mb-4 group">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 select-none list-none flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
            How to export from Panorama
          </summary>
          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-slate-600 space-y-1.5">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>In Panorama, go to <strong>Your Students</strong> → <strong>Student View</strong></li>
              <li>Click <strong>Download</strong> → <strong>Data</strong> → <strong>Full Data</strong></li>
              <li>Select <strong>Download all rows as a text file</strong></li>
              <li>Upload the downloaded file here</li>
            </ol>
          </div>
        </details>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={detailsRef} type="file" accept=".csv" className="hidden" onChange={e => setDetailsFile(e.target.files?.[0] || null)} data-testid="details-file-input" />
          <button onClick={() => detailsRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <FileUp size={14} /> {detailsFile ? detailsFile.name : 'Choose CSV file'}
          </button>
          {detailsFile && (
            <button onClick={uploadStudentDetails} disabled={importingDetails} data-testid="upload-details-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {importingDetails ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {importingDetails ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
        {detailsResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1" data-testid="details-import-result">
            <p><strong>Students updated:</strong> {detailsResult.updated}</p>
            {detailsResult.unmatched > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-amber-800 font-semibold">⚠ {detailsResult.unmatched} STUDENT_KEY{detailsResult.unmatched !== 1 ? 's' : ''} had no match in the student database:</p>
                <p className="text-amber-700 font-mono break-all">{detailsResult.unmatched_keys?.join(', ')}</p>
                <p className="text-amber-600">Ensure students are imported first via <strong>Import Students</strong> above.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attendance Upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Upload Attendance</h3>
        <p className="text-xs text-slate-400 mb-1">Upload an exception-based attendance file. Only students with absences or exceptions need to be in the file — unlisted students are automatically marked as present.</p>
        <p className="text-xs text-slate-400 mb-3">Supports CSV or XLSX with columns: <code className="bg-slate-100 px-1 rounded">SussiId/ID, Date, AM, PM</code>. XLSX files are automatically converted. "Present" status = half-day.</p>
        <details className="mb-4 group">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 select-none list-none flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
            How to export from eCases
          </summary>
          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-slate-600 space-y-1.5">
            <ol className="list-decimal list-inside space-y-1.5">
              <li>In eCases, go to <strong>Reports</strong> → <strong>Student Reports</strong> → <strong>Attendance</strong> → <strong>Student Absence Details Report</strong></li>
              <li>Select your desired date range and <strong>Home Groups</strong></li>
              <li>Click <strong>Preview</strong></li>
              <li>Choose <strong>Export as XLSX</strong> and click <strong>Export</strong></li>
              <li>Upload the <strong>.xlsx file directly</strong> — no need to convert to CSV</li>
            </ol>
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
              <strong>Note:</strong> The CSV export option in eCases is currently bugged — use the XLSX export instead and upload it directly here.
            </p>
          </div>
        </details>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={attRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={e => setAttFile(e.target.files?.[0] || null)} data-testid="attendance-file-input" />
          <button onClick={() => attRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <FileUp size={14} /> {attFile ? attFile.name : 'Choose CSV or XLSX file'}
          </button>
          {attFile && (
            <button onClick={uploadAttendance} disabled={uploading} data-testid="upload-attendance-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          )}
        </div>
        {attResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1" data-testid="upload-att-result">
            <p><strong>Exception records processed:</strong> {attResult.processed} &nbsp; <strong>Students matched:</strong> {attResult.matched_students}</p>
            {attResult.alerts_generated > 0 && (
              <p className="text-amber-700"><strong>{attResult.alerts_generated}</strong> attendance alert{attResult.alerts_generated !== 1 ? 's' : ''} auto-generated — check the Alerts page.</p>
            )}
            {attResult.unmatched_students > 0 && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-amber-800 font-semibold">⚠ {attResult.unmatched_students} student ID{attResult.unmatched_students !== 1 ? 's' : ''} in the file had no match in the student database:</p>
                <p className="text-amber-700 font-mono break-all">{attResult.unmatched_ids?.join(', ')}</p>
                <p className="text-amber-600">Go to <strong>Import Students</strong> above and ensure these SussiId values are present.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Photos Upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
            <Image size={15} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Upload Student Photos</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a ZIP file containing student photos. Photos are matched by filename using the format{' '}
              <code className="bg-slate-100 px-1 rounded">LastName, FirstName.jpg</code>.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Photos can be organised into class/year folders inside the ZIP — folder names are ignored. Any <strong>Staff</strong> folder is automatically skipped.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={photoRef} type="file" accept=".zip" className="hidden"
            onChange={e => { setPhotoZip(e.target.files?.[0] || null); setPhotoResult(null); }}
            data-testid="photo-zip-input" />
          <button onClick={() => photoRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
            <FileUp size={14} /> {photoZip ? photoZip.name : 'Choose ZIP file'}
          </button>
          {photoZip && (
            <button onClick={uploadPhotos} disabled={uploadingPhotos} data-testid="upload-photos-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--wt-accent)' }}>
              {uploadingPhotos ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingPhotos ? 'Uploading…' : 'Upload Photos'}
            </button>
          )}
        </div>
        {uploadingPhotos && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader size={13} className="animate-spin text-indigo-500" />
            Processing ZIP — this may take a moment for large files…
          </div>
        )}
        {photoResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2" data-testid="photo-upload-result">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-emerald-700 font-semibold">{photoResult.matched} matched</span>
              {photoResult.unmatched > 0 && <span className="text-amber-700 font-semibold">{photoResult.unmatched} unmatched</span>}
              {photoResult.skipped_staff > 0 && <span className="text-slate-500">{photoResult.skipped_staff} staff skipped</span>}
            </div>
            {photoResult.unmatched_names?.length > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-amber-800 font-semibold">Unmatched filenames (no student found):</p>
                <ul className="text-amber-700 space-y-0.5 max-h-36 overflow-y-auto">
                  {photoResult.unmatched_names.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
                </ul>
                <p className="text-amber-600">Check that student names in the DB match the filename exactly (case-insensitive).</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── SCREENING SESSIONS TAB ───────────────────────────────────────────────────
const SCREENING_PERIODS = [
  'Term 1 - P1', 'Term 1 - P2',
  'Term 2 - P1', 'Term 2 - P2',
  'Term 3 - P1', 'Term 3 - P2',
  'Term 4 - P1', 'Term 4 - P2',
];

function ScreeningSessionsTab({ settings: s, onSave, saving, msg, msgType }) {
  const [activePeriod, setActivePeriod] = useState(s.active_screening_period || '');

  const handleSave = () => onSave({ active_screening_period: activePeriod });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Active Screening Period</h3>
        <p className="text-xs text-slate-400 mb-5">
          Select the current screening period. Only the selected period will appear in the Screening page — staff cannot accidentally screen for the wrong term.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {SCREENING_PERIODS.map(period => (
            <button
              key={period}
              onClick={() => setActivePeriod(prev => prev === period ? '' : period)}
              data-testid={`period-btn-${period.replace(/\s/g, '-').replace(/-+/g, '-')}`}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all text-center ${
                activePeriod === period
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              <span className="block text-xs font-medium opacity-60">{period.split(' - ')[0]}</span>
              <span className="block">{period.split(' - ')[1]}</span>
            </button>
          ))}
        </div>

        {activePeriod ? (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl mb-5">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Active period: {activePeriod}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Screeners will only see this period when completing a session.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700">No active screening period selected. Screeners will see a prompt to contact their administrator.</p>
          </div>
        )}

        {msg && (
          <div className={`flex items-center gap-2 rounded-xl p-3 mb-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
            <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
          </div>
        )}

        <button onClick={handleSave} disabled={saving} data-testid="save-screening-period-btn"
          className="w-full py-3 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
          {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          {saving ? 'Saving…' : 'Save Active Period'}
        </button>
      </div>
    </div>
  );
}

// ── INTEGRATIONS TAB ──────────────────────────────────────────────────────────
function IntegrationsTab({ settings: s, onSave, saving, msg, msgType }) {
  const [ollamaUrl, setOllamaUrl] = useState(s.ollama_url || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(s.ollama_model || 'llama3.2');
  const [aiEnabled, setAiEnabled] = useState(s.ai_suggestions_enabled !== false);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setOllamaUrl(s.ollama_url || 'http://localhost:11434');
    setOllamaModel(s.ollama_model || 'llama3.2');
    setAiEnabled(s.ai_suggestions_enabled !== false);
  }, [s.ollama_url, s.ollama_model, s.ai_suggestions_enabled]);

  const handleSave = () => onSave({ ollama_url: ollamaUrl, ollama_model: ollamaModel, ai_suggestions_enabled: aiEnabled });

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.get(`${API}/settings/test-ollama`, { withCredentials: true });
      const d = res.data;
      setTestResult({ ok: d.connected, msg: d.message });
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.detail || 'Test failed — check backend logs.' });
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* AI Suggestions toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>AI Intervention Suggestions</h3>
            <p className="text-xs text-slate-400 mt-0.5">When enabled, staff can request AI-generated intervention recommendations on student profiles via your local Ollama instance.</p>
          </div>
          <button onClick={() => setAiEnabled(p => !p)} data-testid="ai-suggestions-toggle">
            {aiEnabled ? <ToggleRight size={32} className="text-emerald-500" /> : <ToggleLeft size={32} className="text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Ollama config */}
      <div className={`bg-white border border-slate-200 rounded-xl p-6 space-y-4 transition-opacity ${!aiEnabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
          <Bot size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Ollama Configuration</h3>
        </div>
        <p className="text-xs text-slate-400">WellTrack connects to your local <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">Ollama</a> instance to generate intervention suggestions. Ollama must be running on the server that hosts WellTrack's backend.</p>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Ollama API URL</label>
          <p className="text-xs text-slate-400 mb-2">The URL where Ollama is running. Default: <code className="bg-slate-100 px-1 rounded">http://localhost:11434</code></p>
          <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} data-testid="ollama-url-input"
            placeholder="http://localhost:11434"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Model Name</label>
          <p className="text-xs text-slate-400 mb-2">The Ollama model to use for suggestions. Must be pulled first with <code className="bg-slate-100 px-1 rounded">ollama pull {ollamaModel}</code></p>
          <input type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} data-testid="ollama-model-input"
            placeholder="llama3.2"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={testConnection} disabled={testing} data-testid="test-ollama-btn"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-60">
            {testing ? <Loader size={14} className="animate-spin" /> : <Wifi size={14} />}
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{testResult.msg}</span>
          )}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} data-testid="save-integrations-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save Integration Settings'}
      </button>
    </div>
  );
}

// ── MAIN SETTINGS PAGE ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { settings, loadFullSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('Branding');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');

  useEffect(() => { loadFullSettings(); }, [loadFullSettings]);

  const saveSettings = async (patch) => {
    setSaving(true);
    try {
      await axios.put(`${API}/settings`, { ...settings, ...patch }, { withCredentials: true });
      await loadFullSettings();
      setMsgType('success'); setMsg('Saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsgType('error'); setMsg(e.response?.data?.detail || 'Failed to save');
      setTimeout(() => setMsg(''), 3000);
    } finally { setSaving(false); }
  };

  const tabProps = { settings, onSave: saveSettings, saving, msg, msgType };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Settings</h1>
        <p className="text-slate-500 mt-1">Customise WellTrack for your school</p>
      </div>

      <TabNav
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'General' && <GeneralTab {...tabProps} />}
      {activeTab === 'Branding' && <BrandingTab {...tabProps} />}
      {activeTab === 'MTSS & Screening' && <MTSSTab {...tabProps} />}
      {activeTab === 'Interventions' && <InterventionsTab {...tabProps} />}
      {activeTab === 'Student Data' && <StudentDataTab {...tabProps} />}
      {activeTab === 'Screening Sessions' && <ScreeningSessionsTab {...tabProps} />}
      {activeTab === 'Calendar' && <CalendarTab msg={msg} msgType={msgType} setMsg={setMsg} setMsgType={setMsgType} />}
      {activeTab === 'Imports' && <ImportsTab msg={msg} msgType={msgType} setMsg={setMsg} setMsgType={setMsgType} settings={settings} onSave={saveSettings} />}
      {activeTab === 'Integrations' && <IntegrationsTab {...tabProps} />}
      {activeTab === 'Data' && <DataTab msg={msg} msgType={msgType} setMsg={setMsg} setMsgType={setMsgType} />}
    </div>
  );
}
