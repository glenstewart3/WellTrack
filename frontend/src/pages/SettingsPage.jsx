import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  Settings, AlertTriangle, CheckCircle, Loader, School,
  Download, Upload, RefreshCw, Palette, Building2, Image, Plus, X,
  Sliders, ToggleLeft, ToggleRight, Tag, User, Shield, RotateCcw, Bot, Wifi, FileUp,
  Calendar, CalendarDays, BookOpen, Target, ClipboardCheck
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import FileDropZone from '../components/FileDropZone';

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
  { key: 'MTSS Thresholds',     icon: Sliders },
  { key: 'Interventions',       icon: Target },
  { key: 'Student Data',        icon: User },
  { key: 'Screening',           icon: ClipboardCheck },
  { key: 'Calendar',            icon: CalendarDays },
  { key: 'Imports',             icon: FileUp },
];

function TabNav({ active, onChange, featureFlags }) {
  const ff = featureFlags || {};
  const visibleTabs = TAB_CONFIG.filter(() => true);
  return (
    <div className="flex gap-1 mb-6 md:mb-8 p-1 md:p-1.5 bg-slate-100 rounded-2xl overflow-x-auto no-scrollbar max-w-full md:flex-wrap">
      {visibleTabs.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          data-testid={`settings-tab-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap shrink-0 ${
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
  const resetThresholds = () => setThresholds({ ...DEFAULT_THRESHOLDS });
  const handleSave = () => onSave({ tier_thresholds: thresholds });

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

      <button onClick={handleSave} disabled={saving} data-testid="save-mtss-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--wt-accent)' }}>
        {saving ? <Loader size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {saving ? 'Saving…' : 'Save MTSS Settings'}
      </button>
    </div>
  );
}

// ── INTERVENTIONS TAB ────────────────────────────────────────────────────────
function normalizeType(t) {
  if (typeof t === 'string') return {
    name: t, appointment_scheduling_enabled: false,
    appointment_config: { session_types: [], flags: [], rooms: [], outcome_ratings: [], statuses: [] },
  };
  const cfg = t.appointment_config || {};
  return {
    ...t,
    appointment_config: {
      session_types: cfg.session_types || [],
      flags: cfg.flags || [],
      rooms: cfg.rooms || [],
      outcome_ratings: cfg.outcome_ratings || [],
      statuses: cfg.statuses || [],
    },
  };
}

function ConfigList({ label, items, onChange, semanticKey }) {
  const [newVal, setNewVal] = useState('');
  const add = () => {
    const v = newVal.trim();
    if (!v) return;
    onChange([...items, { value: v }]);
    setNewVal('');
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const toggleTag = (i, tag) => onChange(items.map((item, idx) =>
    idx === i ? { ...item, [tag]: !item[tag] } : item
  ));
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 flex-wrap">
            <span className="flex-1 min-w-0 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 truncate">
              {item.value}
            </span>
            {semanticKey && (
              <button
                onClick={() => toggleTag(i, semanticKey)}
                title={`Mark as ${semanticKey === 'is_completed_equivalent' ? '"Completed" equivalent' : '"Improved" equivalent'}`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors shrink-0 ${
                  item[semanticKey]
                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                }`}
              >
                {item[semanticKey] ? '✓ Canonical' : 'Set canonical'}
              </button>
            )}
            <button onClick={() => remove(i)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder={`Add to ${label.toLowerCase()}…`}
          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400" />
        <button onClick={add} className="px-2 py-1 bg-slate-900 text-white rounded text-xs hover:bg-slate-800 transition-colors">
          <Plus size={11} />
        </button>
      </div>
    </div>
  );
}

function InterventionsTab({ settings: s, onSave, saving, msg, msgType, featureFlags }) {
  const ff = featureFlags || {};
  const [intTypes, setIntTypes] = useState(() => (s.intervention_types || []).map(normalizeType));
  const [newType, setNewType] = useState('');
  const [expanded, setExpanded] = useState({});

  const addType = () => {
    const v = newType.trim();
    if (!v || intTypes.some(t => t.name === v)) return;
    setIntTypes(prev => [...prev, normalizeType(v)]);
    setNewType('');
  };

  const removeType = (name) => setIntTypes(prev => prev.filter(t => t.name !== name));

  const toggleScheduling = (name) => setIntTypes(prev => prev.map(t =>
    t.name === name ? { ...t, appointment_scheduling_enabled: !t.appointment_scheduling_enabled } : t
  ));

  const updateConfig = (name, key, items) => setIntTypes(prev => prev.map(t =>
    t.name === name ? { ...t, appointment_config: { ...t.appointment_config, [key]: items } } : t
  ));

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Intervention Library</h3>
        <p className="text-xs text-slate-400 mb-4">Configure types and appointment scheduling per type.</p>
        <div className="space-y-2 mb-4">
          {intTypes.map(t => (
            <div key={t.name} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                <button onClick={() => setExpanded(p => ({ ...p, [t.name]: !p[t.name] }))}
                  className="flex-1 text-left text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span>{t.name}</span>
                  {t.appointment_scheduling_enabled && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-px bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                      <CalendarDays size={9} /> Scheduling
                    </span>
                  )}
                </button>
                {ff.appointments !== false && (
                <button
                  onClick={() => toggleScheduling(t.name)}
                  title="Enable/disable appointment scheduling for this type"
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    t.appointment_scheduling_enabled
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-500'
                  }`}
                >
                  <CalendarDays size={11} />
                  {t.appointment_scheduling_enabled ? 'Scheduling On' : 'Scheduling Off'}
                </button>
                )}
                <button onClick={() => removeType(t.name)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0">
                  <X size={14} />
                </button>
              </div>
              {t.appointment_scheduling_enabled && expanded[t.name] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-5 border-t border-slate-100">
                  <ConfigList label="Session Types" items={t.appointment_config.session_types}
                    onChange={items => updateConfig(t.name, 'session_types', items)} />
                  <ConfigList label="Rooms / Locations" items={t.appointment_config.rooms}
                    onChange={items => updateConfig(t.name, 'rooms', items)} />
                  <ConfigList label="Flags / Tags" items={t.appointment_config.flags}
                    onChange={items => updateConfig(t.name, 'flags', items)} />
                  <ConfigList label="Statuses"
                    items={t.appointment_config.statuses}
                    onChange={items => updateConfig(t.name, 'statuses', items)}
                    semanticKey="is_completed_equivalent" />
                  <ConfigList label="Outcome Ratings"
                    items={t.appointment_config.outcome_ratings}
                    onChange={items => updateConfig(t.name, 'outcome_ratings', items)}
                    semanticKey="is_improved_equivalent" />
                </div>
              )}
              {t.appointment_scheduling_enabled && !expanded[t.name] && (
                <button onClick={() => setExpanded(p => ({ ...p, [t.name]: true }))}
                  className="w-full text-xs text-blue-600 py-2 hover:bg-blue-50 transition-colors">
                  Configure session types, flags, rooms, outcomes, statuses →
                </button>
              )}
            </div>
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

      <button onClick={() => onSave({ intervention_types: intTypes })} disabled={saving}
        data-testid="save-interventions-btn"
        className="w-full py-3.5 text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2"
        style={{ backgroundColor: 'var(--wt-accent)' }}>
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
    api.get('/attendance/types')
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
function GeneralTab({ settings: s, onSave, saving, msg, msgType, featureFlags }) {
  const ff = featureFlags || {};
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
      await api.put('/auth/change-password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
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
          ...(ff.google_auth !== false ? [{ key: 'google', label: 'Google Login', desc: 'Staff sign in with their Google account. Requires valid Google OAuth credentials in server settings.', state: googleAuthEnabled, setState: setGoogleAuthEnabled, testid: 'google-auth-toggle' }] : []),
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
      await api.put('/auth/role', { role });
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
      const url = year ? `/settings/terms?year=${year}` : '/settings/terms';
      const r = await api.get(url);
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
      await api.delete(`/settings/terms?year=${yr}`);
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
      const res = await api.put('/settings/terms', {
        terms: filledTerms, non_school_days: nonSchoolDays, year: selectedYear,
      });
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
  const [importValid, setImportValid] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [attFile, setAttFile] = useState(null);
  const [attValid, setAttValid] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [attResult, setAttResult] = useState(null);
  const [photoZip, setPhotoZip] = useState(null);
  const [photoValid, setPhotoValid] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoResult, setPhotoResult] = useState(null);

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
      const res = await api.post('/students/import', { students: rows });
      setImportResult(res.data);
      setImportFile(null);
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
      const res = await api.post('/attendance/upload', fd);
      setAttResult(res.data);
      setAttFile(null);
      setMsgType('success');
      setMsg(`Attendance uploaded: ${res.data.matched_students} students matched · ${res.data.processed} absence records processed`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Upload failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setUploading(false); }
  };

  const uploadPhotos = async () => {    if (!photoZip) return;
    setUploadingPhotos(true);
    setPhotoResult(null);
    try {
      const fd = new FormData();
      fd.append('file', photoZip);
      const res = await api.post('/students/upload-photos', fd, {
        onUploadProgress: () => {},
      });
      setPhotoResult(res.data);
      setPhotoZip(null);
      setMsgType('success');
      setMsg(`Photos uploaded: ${res.data.matched} matched · ${res.data.unmatched} unmatched`);
      setTimeout(() => setMsg(''), 8000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Photo upload failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setUploadingPhotos(false); }
  };

  const [refreshingPhotos, setRefreshingPhotos] = useState(false);
  const refreshPhotos = async () => {
    setRefreshingPhotos(true);
    try {
      const res = await api.post('/students/refresh-photos');
      const { cleared_stale, relinked_orphans, files_on_disk } = res.data;
      setMsgType('success');
      setMsg(`Photo refresh: ${cleared_stale} stale link(s) cleared · ${relinked_orphans} file(s) re-linked · ${files_on_disk} on disk`);
      setTimeout(() => setMsg(''), 8000);
    } catch (e) {
      setMsgType('error');
      setMsg(e.response?.data?.detail || 'Photo refresh failed');
      setTimeout(() => setMsg(''), 5000);
    } finally { setRefreshingPhotos(false); }
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
        <p className="text-xs text-slate-400 mb-1">Upload a CSV exported from your school system. Supports columns: <code className="bg-slate-100 px-1 rounded">STKEY, FIRST_NAME, PREF_NAME, SURNAME, FAMILY, GENDER, BIRTHDATE, ENTRY, HOME_GROUP, SCHOOL_YEAR, KOORIE</code>.</p>
        <p className="text-xs text-slate-400 mb-3">Students are matched by <strong>STKEY</strong> and updated if they already exist. The <strong>ENTRY</strong> date is used so late-enrolled students aren't penalised in attendance reporting.</p>
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
        <FileDropZone
          accept=".csv"
          expectedKind="students"
          label="Drop your students CSV here or click to browse"
          file={importFile}
          onChange={(f, v) => { setImportFile(f); setImportValid(v); }}
          testIdPrefix="import-students"
        />
        {importFile && (
          <div className="mt-3 flex justify-end">
            <button onClick={parseAndImport} disabled={importing || importValid?.ok === false} data-testid="run-import-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}
        {importResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
            <p><strong>New:</strong> {importResult.imported} &nbsp; <strong>Updated:</strong> {importResult.updated || 0} &nbsp; <strong>Errors:</strong> {importResult.errors?.length || 0}</p>
            {importResult.errors?.length > 0 && (
              <ul className="text-rose-600 space-y-0.5">{importResult.errors.slice(0, 5).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}</ul>
            )}
          </div>
        )}
      </div>

      {/* Attendance Upload */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Upload Attendance</h3>
        <p className="text-xs text-slate-400 mb-1">Upload an exception-based attendance file. Only days where a student was absent or partially absent need appear — unlisted student-days are treated as fully present.</p>
        <p className="text-xs text-slate-400 mb-3">Supports CSV or XLSX. The new time-based schema uses columns <code className="bg-slate-100 px-1 rounded">STKEY, FIRST_NAME, PREF_NAME, SURNAME, ABSENCE_DATE, ABSENCE_COMMENT, AM_ATTENDED, AM_LATE_ARRIVAL, AM_EARLY_LEFT, PM_ATTENDED, PM_LATE_ARRIVAL, PM_EARLY_LEFT</code>. Times are expressed as HHMM (e.g. <code className="bg-slate-100 px-1 rounded">933</code> = 9:33 AM). The legacy <code className="bg-slate-100 px-1 rounded">ID, Date, AM, PM</code> format is still auto-detected.</p>
        <details className="mb-4 group">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 select-none list-none flex items-center gap-1.5">
            <span className="transition-transform group-open:rotate-90 inline-block">▶</span>
            How attendance % is calculated
          </summary>
          <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-slate-600 space-y-1.5">
            <p>The school day is <strong>8:50 AM – 3:20 PM</strong> (390 minutes total). Each record is converted to a <strong>present_pct</strong> between 0.0 and 1.0:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>AM_ATTENDED</code>: <strong>P</strong> = Present, <strong>L</strong> = Late (arrival time in <code>AM_LATE_ARRIVAL</code>), <strong>A</strong> = Absent. Same for PM.</li>
              <li>If <code>AM_ATTENDED</code> is <code>A</code>, the student missed the full morning (195 min).</li>
              <li><code>AM_LATE_ARRIVAL = 933</code> means they arrived at 9:33 AM → 43 min lost.</li>
              <li><code>AM_EARLY_LEFT = 1030</code> means they left at 10:30 AM → 95 min lost.</li>
              <li>Same logic applies to the PM session (12:05 PM – 3:20 PM).</li>
              <li>Attendance % uses each student's <strong>ENTRY date</strong> so late enrolees aren't penalised for days before their start.</li>
            </ul>
          </div>
        </details>
        <FileDropZone
          accept=".csv,.xlsx"
          expectedKind="attendance"
          label="Drop your attendance CSV or XLSX here or click to browse"
          file={attFile}
          onChange={(f, v) => { setAttFile(f); setAttValid(v); }}
          testIdPrefix="import-attendance"
        />
        {attFile && (
          <div className="mt-3 flex justify-end">
            <button onClick={uploadAttendance} disabled={uploading || attValid?.ok === false} data-testid="upload-attendance-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity" style={{ backgroundColor: 'var(--wt-accent)' }}>
              {uploading ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        )}
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
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Upload Photos</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload a ZIP file containing student and staff photos. Photos are matched by filename using the format{' '}
              <code className="bg-slate-100 px-1 rounded">LastName, FirstName.jpg</code>.
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Organise photos into class/year folders for students. Any file inside a <strong>Staff</strong> folder will be matched to an existing user account by name and saved as that user's profile picture.
            </p>
          </div>
        </div>
        <FileDropZone
          accept=".zip"
          expectedKind="photos"
          label="Drop your photos ZIP here or click to browse"
          file={photoZip}
          onChange={(f, v) => { setPhotoZip(f); setPhotoValid(v); setPhotoResult(null); }}
          testIdPrefix="import-photos"
        />
        {photoZip && (
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={refreshPhotos} disabled={refreshingPhotos} data-testid="refresh-photos-btn"
              className="flex items-center gap-2 px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              title="Clear stale photo links (for photos that no longer exist on disk) and re-link any orphan files back to their students.">
              {refreshingPhotos ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {refreshingPhotos ? 'Refreshing…' : 'Refresh photo links'}
            </button>
            <button onClick={uploadPhotos} disabled={uploadingPhotos || photoValid?.ok === false} data-testid="upload-photos-btn"
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: 'var(--wt-accent)' }}>
              {uploadingPhotos ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingPhotos ? 'Uploading…' : 'Upload Photos'}
            </button>
          </div>
        )}
        {!photoZip && (
          <div className="mt-3 flex justify-end">
            <button onClick={refreshPhotos} disabled={refreshingPhotos} data-testid="refresh-photos-btn-standalone"
              className="flex items-center gap-2 px-3 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              title="Clear stale photo links and re-link any orphan files back to their students.">
              {refreshingPhotos ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {refreshingPhotos ? 'Refreshing…' : 'Refresh photo links'}
            </button>
          </div>
        )}
        {uploadingPhotos && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Loader size={13} className="animate-spin text-indigo-500" />
            Processing ZIP — this may take a moment for large files…
          </div>
        )}
        {photoResult && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-2" data-testid="photo-upload-result">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-emerald-700 font-semibold">{photoResult.matched} student{photoResult.matched !== 1 ? 's' : ''} matched</span>
              {photoResult.unmatched > 0 && <span className="text-amber-700 font-semibold">{photoResult.unmatched} student{photoResult.unmatched !== 1 ? 's' : ''} unmatched</span>}
              {photoResult.matched_staff > 0 && <span className="text-indigo-700 font-semibold">{photoResult.matched_staff} staff matched</span>}
              {photoResult.unmatched_staff > 0 && <span className="text-amber-700 font-semibold">{photoResult.unmatched_staff} staff unmatched</span>}
            </div>
            {photoResult.unmatched_names?.length > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-amber-800 font-semibold">Unmatched student filenames:</p>
                <ul className="text-amber-700 space-y-0.5 max-h-36 overflow-y-auto">
                  {photoResult.unmatched_names.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
                </ul>
                <p className="text-amber-600">Check that student names in the DB match the filename exactly (case-insensitive).</p>
              </div>
            )}
            {photoResult.unmatched_staff_names?.length > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <p className="text-amber-800 font-semibold">Unmatched staff filenames:</p>
                <ul className="text-amber-700 space-y-0.5 max-h-36 overflow-y-auto">
                  {photoResult.unmatched_staff_names.map((n, i) => <li key={i} className="font-mono">{n}</li>)}
                </ul>
                <p className="text-amber-600">Staff are matched to user accounts by name. Add them in <strong>Administration → User Management</strong> first.</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// ── SCREENING TAB ─────────────────────────────────────────────────────────────
function buildScreeningPeriods(schoolType, frequencies) {
  /**
   * Build the list of screening period labels based on school_type +
   * per-term/semester frequency map.
   * schoolType: 'high_school' → uses semesters; anything else → uses terms.
   * frequencies: { 'Term 1': 2, 'Term 2': 2, ... } or { 'Semester 1': 3, ... }
   */
  const isHigh = schoolType === 'high_school';
  const groups = isHigh ? ['Semester 1', 'Semester 2']
                         : ['Term 1', 'Term 2', 'Term 3', 'Term 4'];
  const periods = [];
  for (const g of groups) {
    const count = Math.max(1, Math.min(10, parseInt(frequencies?.[g]) || 2));
    for (let i = 1; i <= count; i++) periods.push(`${g} - P${i}`);
  }
  return periods;
}

function ScreeningSessionsTab({ settings: s, onSave, saving, msg, msgType, featureFlags }) {
  const ff = featureFlags || {};
  const isHighSchool = s.school_type === 'high_school';
  const GROUPS = isHighSchool ? ['Semester 1', 'Semester 2']
                              : ['Term 1', 'Term 2', 'Term 3', 'Term 4'];

  // Default frequency: 2 per term, 3 per semester (high schools usually run more screens)
  const DEFAULT_FREQ = Object.fromEntries(GROUPS.map(g => [g, isHighSchool ? 3 : 2]));
  const [frequencies, setFrequencies] = useState({
    ...DEFAULT_FREQ,
    ...(s.screening_frequency || {}),
  });
  const SCREENING_PERIODS = buildScreeningPeriods(s.school_type, frequencies);

  const [activePeriod, setActivePeriod] = useState(s.active_screening_period || '');
  const [modules, setModules] = useState({ saebrs_plus: true, ...s.modules_enabled });

  // If the current active period no longer exists (because the frequency was reduced), clear it
  useEffect(() => {
    if (activePeriod && !SCREENING_PERIODS.includes(activePeriod)) {
      setActivePeriod('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frequencies]);

  const bumpFreq = (group, delta) => {
    setFrequencies(prev => {
      const next = Math.max(1, Math.min(10, (prev[group] || 2) + delta));
      return { ...prev, [group]: next };
    });
  };

  const handleSave = () => onSave({
    active_screening_period: activePeriod,
    modules_enabled: modules,
    screening_frequency: frequencies,
  });

  return (
    <div className="space-y-6">
      {/* ── Screening Frequency Config ──────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Screening Frequency</h3>
        <p className="text-xs text-slate-400 mb-5">
          Set how many screening periods you run in each {isHighSchool ? 'semester' : 'term'}. Changing the count updates the available periods below (e.g. 3 per {isHighSchool ? 'semester' : 'term'} → P1, P2, P3).
        </p>

        <div className={`grid gap-3 ${isHighSchool ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          {GROUPS.map(group => (
            <div key={group} className="border border-slate-200 rounded-xl p-4 bg-slate-50/60">
              <p className="text-sm font-semibold text-slate-700 mb-3">{group}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => bumpFreq(group, -1)}
                  disabled={(frequencies[group] || 2) <= 1}
                  data-testid={`freq-minus-${group.replace(/\s+/g,'-').toLowerCase()}`}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold"
                >−</button>
                <span className="flex-1 text-center text-2xl font-extrabold tabular-nums text-slate-900"
                      style={{ fontFamily: 'Manrope,sans-serif' }}
                      data-testid={`freq-count-${group.replace(/\s+/g,'-').toLowerCase()}`}>
                  {frequencies[group] || 2}
                </span>
                <button
                  type="button"
                  onClick={() => bumpFreq(group, 1)}
                  disabled={(frequencies[group] || 2) >= 10}
                  data-testid={`freq-plus-${group.replace(/\s+/g,'-').toLowerCase()}`}
                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-bold"
                >+</button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                {(frequencies[group] || 2) === 1 ? '1 screening' : `${frequencies[group] || 2} screenings`}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 mt-4">
          <strong>Total available periods:</strong> {SCREENING_PERIODS.length} across the {isHighSchool ? 'year' : 'year'}.
        </p>
      </div>

      {/* ── Active Screening Period ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Active Screening Period</h3>
        <p className="text-xs text-slate-400 mb-5">
          Select the current screening period. Only the selected period will appear in the Screening page — staff cannot accidentally screen for the wrong {isHighSchool ? 'semester' : 'term'}.
        </p>

        <div className={`grid ${isHighSchool ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'} gap-3 mb-6`}>
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
          {saving ? 'Saving…' : 'Save Screening Settings'}
        </button>
      </div>

      {/* Screening Modules */}
      {ff.saebrs_plus !== false && (
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
      )}
    </div>
  );
}

// ── INTEGRATIONS TAB ──────────────────────────────────────────────────────────
function IntegrationsTab({ settings: s, onSave, saving, msg, msgType, featureFlags }) {
  const ff = featureFlags || {};
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
      const res = await api.get('/settings/test-ollama');
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
  useDocumentTitle('Settings');
  const { settings, loadFullSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('General');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const featureFlags = settings.feature_flags || {};

  useEffect(() => { loadFullSettings(); }, [loadFullSettings]);

  const saveSettings = async (patch) => {
    setSaving(true);
    try {
      await api.put('/settings', { ...settings, ...patch });
      await loadFullSettings();
      setMsgType('success'); setMsg('Saved successfully');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsgType('error'); setMsg(e.response?.data?.detail || 'Failed to save');
      setTimeout(() => setMsg(''), 3000);
    } finally { setSaving(false); }
  };

  const tabProps = { settings, onSave: saveSettings, saving, msg, msgType, featureFlags };

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Settings</h1>
        <p className="text-slate-500 mt-1">Customise WellTrack for your school</p>
      </div>

      <TabNav
        active={activeTab}
        onChange={setActiveTab}
        featureFlags={featureFlags}
      />

      {activeTab === 'General' && <GeneralTab {...tabProps} />}
      {activeTab === 'Branding' && <BrandingTab {...tabProps} />}
      {activeTab === 'MTSS Thresholds' && <MTSSTab {...tabProps} />}
      {activeTab === 'Interventions' && <InterventionsTab {...tabProps} />}
      {activeTab === 'Student Data' && <StudentDataTab {...tabProps} />}
      {activeTab === 'Screening' && <ScreeningSessionsTab {...tabProps} />}
      {activeTab === 'Calendar' && <CalendarTab msg={msg} msgType={msgType} setMsg={setMsg} setMsgType={setMsgType} />}
      {activeTab === 'Imports' && <ImportsTab msg={msg} msgType={msgType} setMsg={setMsg} setMsgType={setMsgType} settings={settings} onSave={saveSettings} />}
    </div>
  );
}
