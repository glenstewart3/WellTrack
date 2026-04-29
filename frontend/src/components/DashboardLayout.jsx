import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES, THEME_NAV_ACTIVE } from '../context/ThemeContext';
import {
  LayoutDashboard, ClipboardCheck, Users, Radar, BarChart3,
  Target, Users2, Bell, Settings, LogOut,
  Menu, X, Shield, UserCog, Check, Sun, Moon, CalendarClock,
  Calendar, CalendarDays, AlertTriangle, FileText, Inbox, ClipboardList,
  MoreHorizontal
} from 'lucide-react';

// Simple flat list of nav items
const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/screening', icon: ClipboardCheck, label: 'Screening', roles: ['teacher', 'screener', 'wellbeing', 'leadership', 'admin'] },
  { path: '/students', icon: Users, label: 'Students' },
  { path: '/radar', icon: Radar, label: 'Class Risk Radar' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/interventions', icon: Target, label: 'Interventions' },
  { path: '/action-plans', icon: ClipboardList, label: 'Support Plans' },
  { path: '/appointments', icon: CalendarClock, label: 'Appointments', featureFlag: 'appointments' },
  { path: '/meeting', icon: Users2, label: 'MTSS Meeting' },
  { path: '/attendance', icon: CalendarDays, label: 'Attendance', roles: ['leadership', 'admin'] },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/audit', icon: Shield, label: 'Audit Log', adminOnly: true },
  { path: '/admin', icon: UserCog, label: 'Administration', adminOnly: true },
];

// SidebarContent is defined OUTSIDE the main component to have stable identity
const SidebarContent = memo(function SidebarContent({ 
  user, 
  settings, 
  activeNavColor, 
  sidebarClass, 
  sidebarStyle, 
  onClose
}) {
  const navigate = useNavigate();
  const featureFlags = settings.feature_flags || {};
  
  const roleLabels = { teacher: 'Teacher', screener: 'Screener', wellbeing: 'Wellbeing Staff', professional: 'Professional', leadership: 'Leadership', admin: 'Administrator' };
  const roleBadgeColors = { teacher: 'bg-blue-100 text-blue-700', screener: 'bg-indigo-100 text-indigo-700', wellbeing: 'bg-purple-100 text-purple-700', professional: 'bg-violet-100 text-violet-700', leadership: 'bg-emerald-100 text-emerald-700', admin: 'bg-slate-100 text-slate-700' };
  
  const visibleItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'admin') return false;
    if (item.featureFlag && featureFlags[item.featureFlag] === false) return false;
    if (user?.role === 'admin') return true;
    const rolePerms = settings?.role_permissions;
    if (rolePerms?.[user?.role]) {
      const pageKey = item.path.replace('/', '');
      return rolePerms[user.role].includes(pageKey);
    }
    if (user?.role === 'screener') return item.path === '/screening';
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  });
  
  return (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: sidebarClass ? '#f1f5f9' : '#0f172a' }}
          >
            <Shield size={14} style={{ color: sidebarClass ? '#0f172a' : '#ffffff' }} />
          </div>
          <p className="font-extrabold" style={{ fontFamily: 'Manrope,sans-serif', fontSize: '1.1rem', color: 'var(--wt-foreground)' }}>
            {settings.platform_name || 'WellTrack'}
          </p>
        </div>
      </div>

      {/* Nav - Simple flat list */}
      <nav className="flex-1 px-3 py-3 sidebar-scroll overflow-y-auto">
        <div className="space-y-0.5">
          {visibleItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={(e) => {
                if (path === '/screening') {
                  e.preventDefault();
                  navigate('/screening', { state: { resetKey: Date.now() } });
                }
                onClose?.();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive 
                    ? 'text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-100/50 hover:text-slate-900'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: activeNavColor } : {}}
            >
              <Icon size={17} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3">
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
});

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { settings, loadFullSettings } = useSettings();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
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
  const [notifCount, setNotifCount] = useState(0);

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

  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(r => setNotifCount(r.data?.count || 0))
      .catch(() => {});
  }, []);


  return (
    <div className="flex h-dvh overflow-hidden" style={{ backgroundColor: 'var(--wt-page-bg, #f8fafc)' }}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-56 border-r shrink-0 ${sidebarClass}`} style={sidebarStyle}>
        <SidebarContent 
          user={user} 
          settings={settings} 
          activeNavColor={activeNavColor}
          sidebarClass={sidebarClass}
          sidebarStyle={sidebarStyle}
        />
      </aside>

      {/* Mobile Overlay - Always rendered but hidden via CSS to prevent mount/unmount issues */}
      <div 
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <aside 
          className={`absolute left-0 top-0 bottom-0 w-60 shadow-xl border-r transform transition-transform duration-200 ease-out ${sidebarClass}`} 
          style={{ ...sidebarStyle, transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
        >
          <SidebarContent 
            user={user} 
            settings={settings} 
            activeNavColor={activeNavColor}
            sidebarClass={sidebarClass}
            sidebarStyle={sidebarStyle}
            onClose={() => setMobileOpen(false)}
          />
        </aside>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar - desktop only hamburger, mobile has bottom nav */}
        <header className="relative border-b px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2 sm:gap-4 shrink-0" style={{ backgroundColor: 'var(--wt-header-bg)', borderColor: 'var(--wt-header-border)' }}>
          {/* Desktop hamburger for collapsing sidebar (future feature) - hidden on mobile since we have bottom nav */}
          <button
            onClick={() => setMobileOpen(true)}
            className="hidden lg:flex relative z-20 p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300"
            style={{ touchAction: 'manipulation' }}
            data-testid="desktop-menu-btn"
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
                className="font-extrabold text-[15px] hidden sm:inline"
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
          {/* Calendar icon */}
          <NavLink to="/calendar" className="relative p-1.5 sm:p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300 transition-colors" aria-label="Calendar">
            <Calendar size={18} />
          </NavLink>
          {/* Notifications icon */}
          <NavLink to="/notifications" className="relative p-1.5 sm:p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300 transition-colors" aria-label="Notifications">
            <Inbox size={18} />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </NavLink>
          {/* Alert indicator — hidden when the user's role doesn't have access to /alerts */}
          {canViewAlerts && (
            <NavLink to="/alerts" className="relative p-1.5 sm:p-2 rounded-lg wt-hover text-slate-600 dark:text-slate-300 transition-colors" data-testid="alert-bell" aria-label="Alerts">
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
          <div className="relative z-10 pb-16 lg:pb-0">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation - Mobile & Tablet only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 z-40" style={{ backgroundColor: 'var(--wt-header-bg)', borderColor: 'var(--wt-header-border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around py-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
              style={({ isActive }) => isActive ? { color: activeNavColor } : {}}
            >
              <LayoutDashboard size={22} />
              <span className="text-[10px] font-medium">Home</span>
            </NavLink>
            <NavLink
              to="/students"
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
              style={({ isActive }) => isActive ? { color: activeNavColor } : {}}
            >
              <Users size={22} />
              <span className="text-[10px] font-medium">Students</span>
            </NavLink>
            <NavLink
              to="/screening"
              onClick={(e) => {
                e.preventDefault();
                navigate('/screening', { state: { resetKey: Date.now() } });
              }}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
              style={({ isActive }) => isActive ? { color: activeNavColor } : {}}
            >
              <ClipboardCheck size={22} />
              <span className="text-[10px] font-medium">Screening</span>
            </NavLink>
            {canViewAlerts && (
              <NavLink
                to="/alerts"
                className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                style={({ isActive }) => isActive ? { color: activeNavColor } : {}}
              >
                <Bell size={22} />
                {alertCount > 0 && (
                  <span className="absolute top-0 right-1 min-w-[14px] h-[14px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
                <span className="text-[10px] font-medium">Alerts</span>
              </NavLink>
            )}
            <button
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${moreOpen ? 'text-blue-600' : 'text-slate-500'}`}
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* More Sheet - slides up from bottom */}
        <div 
          className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${moreOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!moreOpen}
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div 
            className={`absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-200 ease-out ${moreOpen ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ backgroundColor: 'var(--wt-header-bg)', maxHeight: '70vh' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1" onClick={() => setMoreOpen(false)}>
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between" style={{ borderColor: 'var(--wt-header-border)' }}>
              <h3 className="font-semibold text-slate-900">Menu</h3>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            {/* Menu items grid */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { path: '/radar', icon: Radar, label: 'Risk Radar' },
                  { path: '/analytics', icon: BarChart3, label: 'Analytics' },
                  { path: '/reports', icon: FileText, label: 'Reports' },
                  { path: '/interventions', icon: Target, label: 'Interventions' },
                  { path: '/action-plans', icon: ClipboardList, label: 'Support Plans' },
                  ...(settings?.feature_flags?.appointments !== false ? [{ path: '/appointments', icon: CalendarClock, label: 'Appointments' }] : []),
                  { path: '/meeting', icon: Users2, label: 'MTSS Meeting' },
                  ...(user?.role === 'leadership' || user?.role === 'admin' ? [{ path: '/attendance', icon: CalendarDays, label: 'Attendance' }] : []),
                  { path: '/settings', icon: Settings, label: 'Settings' },
                  ...(user?.role === 'admin' ? [
                    { path: '/audit', icon: Shield, label: 'Audit Log' },
                    { path: '/admin', icon: UserCog, label: 'Admin' },
                  ] : []),
                ].map(({ path, icon: Icon, label }) => (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => `flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100 text-slate-600'}`}
                  >
                    <Icon size={22} />
                    <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
