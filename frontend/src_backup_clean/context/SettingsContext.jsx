import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const DEFAULTS = {
  platform_name: 'WellTrack',
  accent_color: '#0f172a',
  logo_base64: '',
  welcome_message: '',
  school_name: '',
  tier_thresholds: { saebrs_some_risk: 37, saebrs_high_risk: 24, attendance_some_risk: 90, attendance_high_risk: 80 },
  modules_enabled: { saebrs_plus: true },
  intervention_types: ['Counselling', 'Behaviour Support', 'Social Skills Groups', 'Mentoring', 'Academic Support', 'Attendance Intervention', 'Check-In/Check-Out', 'Parent Consultation', 'Peer Mentoring', 'Referral – External Services'],
  year_start_month: 2,
  custom_student_fields: [],
  risk_config: { consecutive_absence_days: 3 },
  feature_flags: {},
  school_status: 'active',
  trial_expires_at: null,
};

function applyAccent(color) {
  if (color) document.documentElement.style.setProperty('--wt-accent', color);
}

const SettingsCtx = createContext({ settings: DEFAULTS, loadFullSettings: () => {}, updateSettings: () => {} });

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    // Public fetch — no auth needed, loads branding immediately
    api.get('/public-settings')
      .then(r => {
        setSettings(prev => ({ ...prev, ...r.data }));
        applyAccent(r.data.accent_color);
      })
      .catch(() => {});
  }, []);

  const loadFullSettings = useCallback(async () => {
    try {
      const r = await api.get('/settings');
      setSettings(prev => ({ ...prev, ...r.data }));
      applyAccent(r.data.accent_color);
    } catch (e) {}
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }));
    if (patch.accent_color) applyAccent(patch.accent_color);
  }, []);

  return (
    <SettingsCtx.Provider value={{ settings, loadFullSettings, updateSettings }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);
