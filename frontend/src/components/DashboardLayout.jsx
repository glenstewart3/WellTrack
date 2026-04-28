import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES, THEME_NAV_ACTIVE } from '../context/ThemeContext';
import {
  LayoutDashboard, ClipboardCheck, Users, Radar, BarChart3,
  Target, Users2, Bell, Settings, LogOut,
  Menu, X, Shield, UserCog, Check, Sun, Moon, CalendarClock,
  Calendar, CalendarDays, AlertTriangle, FileText, Inbox
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/screening', icon: ClipboardCheck, label: 'Screening', roles: ['teacher', 'screener', 'wellbeing', 'leadership', 'admin'] },
  { path: '/students', icon: Users, label: 'Students' },
  { path: '/radar', icon: Radar, label: 'Class Risk Radar' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/interventions', icon: Target, label: 'Interventions' },
  { path: '/appointments', icon: CalendarClock, label: 'Appointments', featureFlag: 'appointments' },
  { path: '/attendance', icon: CalendarDays, label: 'Attendance', roles: ['leadership', 'admin'] },
  { path: '/meeting', icon: Users2, label: 'MTSS Meeting' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/notifications', icon: Inbox, label: 'Notifications' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/audit', icon: Shield, label: 'Audit Log', adminOnly: true },
  { path: '/admin', icon: UserCog, label: 'Administration', adminOnly: true },
];

const roleLabels = { teacher: 'Teacher', screener: 'Screener', wellbeing: 'Wellbeing Staff', professional: 'Professional', leadership: 'Leadership', admin: 'Administrator' };
const roleBadgeColors = { teacher: 'bg-blue-100 text-blue-700', screener: 'bg-indigo-100 text-indigo-700', wellbeing: 'bg-purple-100 text-purple-700', professional: 'bg-violet-100 text-violet-700', leadership: 'bg-emerald-100 text-emerald-700', admin: 'bg-slate-100 text-slate-700' };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { settings, loadFullSettings } = useSettings();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const userMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  useEffect(() => { loadFullSettings(); }, [loadFullSettings]);

  const accent = settings.accent_color || '#0f172a';
  // Use theme-specific nav active color when not on default theme (use RESOLVED so system-dark matches force-dark)
  const activeNavColor = THEME_NAV_ACTIVE[resolvedTheme] || accent;
  // Sidebar: match page bg (warm cream) in light, dark surface in dark
  const sidebarClass = resolvedTheme === 'dark' ? 'wt-sidebar' : '';
  const sidebarStyle = resolvedTheme === 'dark' ? {} : { backgroundColor: 'var(--wt-page-bg)', borderColor: 'var(--wt-header-border)' };

  // Trial banner: show if school is on trial and expires within 14 days
  const featureFlags = settings.feature_flags || {};
  const schoolStatus = settings.school_status;
  const trialExpiresAt = settings.trial_expires_at;
  let trialDaysLeft = null;
  if (schoolStatus === 'trial' && trialExpiresAt) {
    const diff = new Date(trialExpiresAt) - new Date();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  const showTrialBanner = schoolStatus === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 14 && !trialBannerDismissed;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [alertCount, setAlertCount] = useState(0);

  // ── Alerts visibility ──────────────────────────────────────────────────────
  // Admins always see alerts; for other roles we check the same role_permissions
  // map used by the sidebar so a user who can't open /alerts also doesn't see
  // the top-right bell (or its badge).
  const canViewAlerts = (() => {
    if (user?.role === 'admin') return true;
    const rolePerms = settings?.role_permissions;
    if (rolePerms?.[user?.role]) return rolePerms[user.role].includes('alerts');
    return true; // no custom perms yet → default-allow, same as sidebar
  })();

  useEffect(() => {
    if (!canViewAlerts) { setAlertCount(0); return; }
    api.get('/alerts?resolved=false')
      .then(r => setAlertCount(Array.isArray(r.data) ? r.data.filter(a => !a.is_read).length : 0))
      .catch(() => {});
  }, [canViewAlerts]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: resolvedTheme === 'dark' ? '#f1f5f9' : '#0f172a' }}
            >
              <Shield size={16} style={{ color: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff' }} />
            </div>
            <p className="font-extrabold" style={{ fontFamily: 'Manrope,sans-serif', fontSize: '1.1rem', color: 'var(--wt-foreground)' }}>
              {settings.platform_name || 'WellTrack'}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 sidebar-scroll overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.filter(item => {
            if (item.adminOnly && user?.role !== 'admin') return false;
            // Feature flag gate — if a flag is explicitly set to false, hide the item
            if (item.featureFlag && featureFlags[item.featureFlag] === false) return false;
            if (user?.role === 'admin') return true;
            // Use saved role_permissions if available
            const rolePerms = settings?.role_permissions;
            if (rolePerms?.[user?.role]) {
              const pageKey = item.path.replace('/', '');
              return rolePerms[user.role].includes(pageKey);
            }
            // Fallback: screener-only restriction
            if (user?.role === 'screener') return item.path === '/screening';
            if (item.roles && !item.roles.includes(user?.role)) return false;
            return true;
          }).map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={(e) => {
                if (path === '/screening') {
                  e.preventDefault();
                  navigate('/screening', { state: { resetKey: Date.now() } });
                }
                setMobileOpen(false);
              }}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              style={({ isActive }) => isActive ? { backgroundColor: activeNavColor } : {}}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive ? 'text-white shadow-sm' : 'text-slate-600 sidebar-nav-hover hover:text-slate-900'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-600">{user?.name?.[0] || 'U'}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name || 'User'}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-600'}`}>
              {roleLabels[user?.role] || 'User'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden" style={{ backgroundColor: 'var(--wt-page-bg, #f8fafc)' }}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-60 border-r shrink-0 ${sidebarClass}`} style={sidebarStyle}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className={`relative z-10 flex flex-col w-60 h-full shadow-xl border-r ${sidebarClass}`} style={sidebarStyle}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="relative border-b px-4 lg:px-6 py-3 flex items-center gap-4 shrink-0" style={{ backgroundColor: 'var(--wt-header-bg)', borderColor: 'var(--wt-header-border)' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300"
            data-testid="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>
          {/* Mobile-only centered WellTrack logo (hidden when sidebar drawer is open) */}
          {!mobileOpen && (
            <div
              className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none"
              data-testid="mobile-header-logo"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: resolvedTheme === 'dark' ? '#f1f5f9' : '#0f172a' }}
              >
                <Shield size={13} style={{ color: resolvedTheme === 'dark' ? '#0f172a' : '#ffffff' }} />
              </div>
              <span
                className="font-extrabold text-[15px]"
                style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}
              >
                {settings.platform_name || 'WellTrack'}
              </span>
            </div>
          )}
          <div className="flex-1" />
          {/* School name (right side of top bar) — desktop + tablet only. Hidden on mobile
              where the centered WellTrack logo already identifies the platform. */}
          {settings.school_name && (
            <div className="hidden lg:flex items-center gap-2 min-w-0 mr-2" data-testid="topbar-school-name">
              <span className="truncate font-semibold text-sm" style={{ fontFamily: 'Manrope,sans-serif', color: 'var(--wt-foreground)' }}>
                {settings.school_name}
              </span>
            </div>
          )}
          {/* Alert indicator — hidden when the user's role doesn't have access to /alerts */}
          {canViewAlerts && (
            <NavLink to="/alerts" className="relative p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300 transition-colors" data-testid="alert-bell" aria-label="Alerts">
              <Bell size={18} data-testid="alerts-bell-button" />
              {alertCount > 0 && (
                <span
                  data-testid="alert-badge"
                  className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
                >
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </NavLink>
          )}
          {/* User avatar + click dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(p => !p)}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400"
              data-testid="user-menu-trigger"
            >
              {user?.picture ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-slate-600">{user?.name?.[0] || 'U'}</span>
                </div>
              )}
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full pt-1 z-50" data-testid="user-menu-dropdown">
                <div className="w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 overflow-hidden">
                  {/* Theme selector */}
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-400 mb-2">Appearance</p>
                    <div className="flex items-center gap-2">
                      {[
                        { key: 'system',  title: 'System (follows device)',   background: 'linear-gradient(135deg, #f8fafc 50%, #1e293b 50%)', border: '#94a3b8', checkColor: '#3b82f6' },
                        { key: 'default', title: 'Light',                     background: '#f8fafc',                                            border: '#e2e8f0', checkColor: '#1e293b', icon: <Sun  size={11} color="#94a3b8" /> },
                        { key: 'dark',    title: 'Dark',                      background: '#1e293b',                                            border: '#334155', checkColor: '#f1f5f9', icon: <Moon size={11} color="#94a3b8" /> },
                      ].map(({ key, title, background, border, checkColor, icon }) => (
                        <button
                          key={key}
                          onClick={() => setTheme(key)}
                          title={title}
                          data-testid={`theme-swatch-${key}`}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 overflow-hidden shrink-0"
                          style={{
                            background,
                            border: `2px solid ${theme === key ? '#3b82f6' : border}`,
                            boxShadow: theme === key ? '0 0 0 2.5px rgba(59,130,246,0.25)' : 'none',
                          }}
                        >
                          {theme === key
                            ? <Check size={10} strokeWidth={3.5} color={checkColor} />
                            : (icon ?? null)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => { navigate('/settings'); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    data-testid="user-menu-settings"
                  >
                    <Settings size={15} className="text-slate-400 shrink-0" />
                    Settings
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => { navigate('/admin'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      data-testid="user-menu-admin"
                    >
                      <UserCog size={15} className="text-slate-400 shrink-0" />
                      Administration
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                    data-testid="user-menu-signout"
                  >
                    <LogOut size={15} className="shrink-0" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Trial expiry banner */}
        {showTrialBanner && (
          <div
            data-testid="trial-expiry-banner"
            className="flex items-center justify-between px-4 lg:px-6 py-2.5 text-sm font-medium"
            style={{ backgroundColor: '#fef3c7', color: '#92400e', borderBottom: '1px solid #fde68a' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                Your WellTrack trial expires in <strong>{trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''}</strong>. Contact us to upgrade your plan.
              </span>
            </div>
            <button
              onClick={() => setTrialBannerDismissed(true)}
              className="p-1 rounded hover:bg-amber-200/60 transition-colors shrink-0"
              data-testid="trial-banner-dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto relative">
          {/* Subtle tier-color ambient blurs with slow drift */}
          {resolvedTheme !== 'dark' ? (
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
              {/* Top row */}
              <div className="wt-blur-drift-a absolute -top-32 right-[10%] md:right-[18%] h-[280px] w-[280px] md:h-[460px] md:w-[460px] rounded-full opacity-35 blur-3xl" style={{ background: 'rgba(34, 197, 94, 0.38)' }} />
              {/* Mid row */}
              <div className="wt-blur-drift-b absolute top-1/3 right-[-12%] md:right-[-6%] h-[260px] w-[260px] md:h-[400px] md:w-[400px] rounded-full opacity-30 blur-3xl" style={{ background: 'rgba(245, 158, 11, 0.34)' }} />
              <div className="wt-blur-drift-c hidden md:block absolute top-1/2 left-[28%] h-[300px] w-[300px] rounded-full opacity-25 blur-3xl" style={{ background: 'rgba(168, 85, 247, 0.18)' }} />
              {/* Bottom row */}
              <div className="wt-blur-drift-d absolute bottom-[-8%] left-[-4%] md:left-[6%] h-[260px] w-[260px] md:h-[380px] md:w-[380px] rounded-full opacity-25 blur-3xl" style={{ background: 'rgba(239, 68, 68, 0.28)' }} />
              <div className="wt-blur-drift-e hidden md:block absolute bottom-[-10%] right-[22%] h-[320px] w-[320px] rounded-full opacity-30 blur-3xl" style={{ background: 'rgba(16, 185, 129, 0.24)' }} />
            </div>
          ) : (
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
              {/* Dark-mode blurs: same tier colours, brighter opacity so they
                  read on the navy surface, same slow drift animations */}
              <div className="wt-blur-drift-a absolute -top-32 right-[10%] md:right-[18%] h-[280px] w-[280px] md:h-[460px] md:w-[460px] rounded-full opacity-55 blur-3xl" style={{ background: 'rgba(52, 211, 153, 0.30)' }} />
              <div className="wt-blur-drift-b absolute top-1/3 right-[-12%] md:right-[-6%] h-[260px] w-[260px] md:h-[400px] md:w-[400px] rounded-full opacity-50 blur-3xl" style={{ background: 'rgba(251, 191, 36, 0.26)' }} />
              <div className="wt-blur-drift-c hidden md:block absolute top-1/2 left-[28%] h-[300px] w-[300px] rounded-full opacity-40 blur-3xl" style={{ background: 'rgba(167, 139, 250, 0.22)' }} />
              <div className="wt-blur-drift-d absolute bottom-[-8%] left-[-4%] md:left-[6%] h-[260px] w-[260px] md:h-[380px] md:w-[380px] rounded-full opacity-45 blur-3xl" style={{ background: 'rgba(251, 113, 133, 0.24)' }} />
              <div className="wt-blur-drift-e hidden md:block absolute bottom-[-10%] right-[22%] h-[320px] w-[320px] rounded-full opacity-50 blur-3xl" style={{ background: 'rgba(34, 211, 238, 0.20)' }} />
            </div>
          )}
          <div className="relative z-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
