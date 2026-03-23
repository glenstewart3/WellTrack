import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES, THEME_NAV_ACTIVE } from '../context/ThemeContext';
import {
  LayoutDashboard, ClipboardCheck, Users, Radar, BarChart3,
  Target, Users2, Bell, Settings, LogOut,
  Menu, X, Shield, UserCog, CalendarDays, Check
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/screening', icon: ClipboardCheck, label: 'Screening', roles: ['teacher', 'screener', 'wellbeing', 'leadership', 'admin'] },
  { path: '/students', icon: Users, label: 'Students' },
  { path: '/radar', icon: Radar, label: 'Class Risk Radar' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics & Reports' },
  { path: '/interventions', icon: Target, label: 'Interventions' },
  { path: '/attendance', icon: CalendarDays, label: 'Attendance', roles: ['leadership', 'admin'] },
  { path: '/meeting', icon: Users2, label: 'MTSS Meeting' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/users', icon: UserCog, label: 'User Management', adminOnly: true },
];

const roleLabels = { teacher: 'Teacher', screener: 'Screener', wellbeing: 'Wellbeing Staff', leadership: 'Leadership', admin: 'Administrator' };
const roleBadgeColors = { teacher: 'bg-blue-100 text-blue-700', screener: 'bg-indigo-100 text-indigo-700', wellbeing: 'bg-purple-100 text-purple-700', leadership: 'bg-emerald-100 text-emerald-700', admin: 'bg-slate-100 text-slate-700' };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { settings, loadFullSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
  // Use theme-specific nav active color when not on default theme
  const activeNavColor = THEME_NAV_ACTIVE[theme] || accent;
  // Only apply wt-sidebar class for non-default themes (avoids overriding role badge colors on default)
  const sidebarClass = theme !== 'default' ? 'wt-sidebar' : 'bg-white border-slate-200';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-slate-100">
        {settings.logo_base64 && (
          <img src={settings.logo_base64} alt="School logo" className="w-full h-14 object-contain mx-auto mb-4" />
        )}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: accent }}>
            <Shield size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{settings.platform_name || 'WellTrack'}</p>
            <p className="text-xs text-slate-400">{settings.school_name || 'MTSS Wellbeing Platform'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 sidebar-scroll overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.filter(item => {
            if (item.adminOnly && user?.role !== 'admin') return false;
            if (user?.role === 'screener') return item.path === '/screening';
            if (item.roles && !item.roles.includes(user?.role)) return false;
            return true;
          }).map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              style={({ isActive }) => isActive ? { backgroundColor: activeNavColor } : {}}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
        {/* Theme picker */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs mb-2 px-1" style={{ color: 'var(--wt-sidebar-text-muted, #94a3b8)' }}>Appearance</p>
          <div className="flex gap-1.5 flex-wrap px-1">
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                title={t.name}
                data-testid={`theme-swatch-${key}`}
                className="w-6 h-6 rounded-full transition-all duration-150 hover:scale-110 relative flex items-center justify-center"
                style={{
                  backgroundColor: t.swatch,
                  outline: theme === key ? '2px solid white' : '2px solid transparent',
                  outlineOffset: '2px',
                  boxShadow: theme === key ? `0 0 0 3px ${t.swatch}` : 'none',
                }}
              >
                {theme === key && <Check size={10} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden" style={{ backgroundColor: 'var(--wt-page-bg)' }}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col w-60 border-r shrink-0 ${sidebarClass}`}>
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className={`relative z-10 flex flex-col w-60 h-full shadow-xl border-r ${sidebarClass}`}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="border-b px-4 lg:px-6 py-3 flex items-center gap-4 shrink-0" style={{ backgroundColor: 'var(--wt-header-bg)', borderColor: 'var(--wt-header-border)' }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            data-testid="mobile-menu-btn"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          {/* Alert indicator */}
          <NavLink to="/alerts" className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
            <Bell size={18} />
          </NavLink>
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
                      onClick={() => { navigate('/users'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      data-testid="user-menu-users"
                    >
                      <UserCog size={15} className="text-slate-400 shrink-0" />
                      User Management
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
