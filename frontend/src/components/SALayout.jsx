import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSAAuth } from '../context/SuperAdminAuthContext';
import {
  LayoutDashboard, School, Shield, ScrollText, LogOut,
  Menu, X, ChevronDown, Settings
} from 'lucide-react';

const navItems = [
  { path: '/sa/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/sa/schools', icon: School, label: 'Schools' },
  { path: '/sa/admins', icon: Shield, label: 'Super Admins' },
  { path: '/sa/audit', icon: ScrollText, label: 'Audit Log' },
];

export default function SALayout() {
  const { admin, logout } = useSAAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/sa/login');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide">WellTrack</span>
            <span className="block text-[10px] font-medium text-blue-300 uppercase tracking-widest">Super Admin</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto" data-testid="sa-sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-blue-600/20 text-blue-300'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-700/50">
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
            data-testid="sa-user-menu-button"
          >
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-bold shrink-0">
              {(admin?.name || 'S')[0].toUpperCase()}
            </div>
            <span className="truncate flex-1 text-left">{admin?.name || 'Admin'}</span>
            <ChevronDown size={14} />
          </button>
          {userMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
              <div className="px-3 py-2 border-b border-slate-600">
                <p className="text-xs text-slate-400">{admin?.email}</p>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-600/50" data-testid="sa-logout-button">
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex" data-testid="sa-layout">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-slate-800 border-r border-slate-700 flex-col fixed inset-y-0 z-30">
        <Sidebar />
      </aside>
      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-800 border-r border-slate-700 flex flex-col z-50">
            <Sidebar />
          </aside>
        </div>
      )}
      {/* Main content */}
      <div className="flex-1 lg:ml-60">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 h-14 flex items-center px-4 lg:px-6 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden mr-3 text-slate-500 hover:text-slate-800">
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-slate-400 mr-3 hidden sm:inline">{admin?.email}</span>
        </header>
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
