import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme, THEMES, THEME_NAV_ACTIVE } from '../context/ThemeContext';
import {
  LayoutDashboard, ClipboardCheck, Users, Radar, BarChart3,
  Target, Users2, Bell, Settings, LogOut,
  Menu, X, Shield, UserCog, CalendarDays, Check, Sun, Moon, CalendarClock
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/screening', icon: ClipboardCheck, label: 'Screening', roles: ['teacher', 'screener', 'wellbeing', 'leadership', 'admin'] },
  { path: '/students', icon: Users, label: 'Students' },
  { path: '/radar', icon: Radar, label: 'Class Risk Radar' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics & Reports' },
  { path: '/interventions', icon: Target, label: 'Interventions' },
  { path: '/appointments', icon: CalendarClock, label: 'Appointments' },
  { path: '/attendance', icon: CalendarDays, label: 'Attendance', roles: ['leadership', 'admin'] },
  { path: '/meeting', icon: Users2, label: 'MTSS Meeting' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/admin', icon: UserCog, label: 'Administration', adminOnly: true },
];

const roleLabels = { teacher: 'Teacher', screener: 'Screener', wellbeing: 'Wellbeing Staff', professional: 'Professional', leadership: 'Leadership', admin: 'Administrator' };
const roleBadgeColors = { teacher: 'bg-blue-100 text-blue-700', screener: 'bg-indigo-100 text-indigo-700', wellbeing: 'bg-purple-100 text-purple-700', professional: 'bg-violet-100 text-violet-700', leadership: 'bg-emerald-100 text-emerald-700', admin: 'bg-slate-100 text-slate-700' };

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
  const sidebarClass = theme === 'dark' ? 'wt-sidebar' : 'bg-white border-slate-200';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    api.get('/alerts?resolved=false')
      .then(r => setAlertCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => {});
  }, []);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-slate-100">
        {(() => {
          const logo = theme === 'dark'
            ? (settings.logo_dark_base64 || settings.logo_base64)
            : settings.logo_base64;
          return logo ? (
            <img src={logo} alt="School logo" className="w-full h-14 object-contain mx-auto mb-4" />
          ) : null;
        })()}
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
          <NavLink to="/alerts" className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors" data-testid="alert-bell">
            <Bell size={18} />
            {alertCount > 0 && (
              <span
                data-testid="alert-badge"
                className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
              >
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
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

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
