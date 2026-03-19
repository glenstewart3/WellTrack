import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  LayoutDashboard, ClipboardCheck, Users, Radar, BarChart3,
  Target, Users2, Bell, Settings, LogOut,
  Menu, X, Shield, UserCog, CalendarDays
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
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { loadFullSettings(); }, [loadFullSettings]);

  const accent = settings.accent_color || '#0f172a';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {settings.logo_base64 ? (
            <img src={settings.logo_base64} alt="School logo" className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-100" />
          ) : (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
              <Shield size={17} className="text-white" />
            </div>
          )}
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
            if (item.roles && !item.roles.includes(user?.role)) return false;
            return true;
          }).map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMobileOpen(false)}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              style={({ isActive }) => isActive ? { backgroundColor: accent } : {}}
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
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-slate-200 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex flex-col w-60 bg-white h-full shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center gap-4 shrink-0">
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
          {user?.picture ? (
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-slate-600">{user?.name?.[0] || 'U'}</span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
