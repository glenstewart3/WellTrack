import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

// Defaults applied when role_feature_permissions is not yet saved in settings.
// Admin always bypasses all checks.
export const DEFAULT_FEATURE_PERMISSIONS = {
  teacher:    ['students.add_edit', 'case_notes.add_edit', 'interventions.add_edit', 'interventions.ai_suggest', 'screenings.submit', 'analytics.export'],
  screener:   ['screenings.submit'],
  wellbeing:  ['students.add_edit', 'case_notes.add_edit', 'case_notes.delete', 'interventions.add_edit', 'interventions.delete', 'interventions.ai_suggest', 'screenings.submit', 'alerts.approve', 'analytics.export', 'appointments.delete'],
  leadership: ['students.add_edit', 'students.archive', 'case_notes.add_edit', 'case_notes.delete', 'alerts.approve', 'attendance.upload', 'analytics.export', 'appointments.delete'],
};

export function usePermissions() {
  const { user } = useAuth();
  const { settings } = useSettings();

  const canDo = (action) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const saved = settings?.role_feature_permissions;
    // If never configured, fall back to hardcoded defaults
    const perms = saved?.[user.role] ?? DEFAULT_FEATURE_PERMISSIONS[user.role] ?? [];
    return perms.includes(action);
  };

  return { canDo };
}
