import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

export const THEMES = {
  default: { name: 'Light',  swatch: '#f8fafc' },
  dark:    { name: 'Dark',   swatch: '#1e293b' },
  system:  { name: 'System', swatch: null },
};

// Active nav colour per theme (resolved theme, not 'system')
export const THEME_NAV_ACTIVE = {
  default: null,      // falls back to school accent_color
  dark:    '#3b82f6',
};

const ThemeContext = createContext({ theme: 'default', setTheme: () => {} });

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

function applyTheme(theme) {
  const resolved = theme === 'system' ? getSystemTheme() : (theme || 'default');
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState('default');

  useEffect(() => {
    const t = user?.theme || 'system';
    setThemeState(t);
    applyTheme(t);
  }, [user]);

  // Re-apply whenever the OS preference changes (only active when theme === 'system')
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      await api.put('/auth/preferences', { theme: newTheme });
    } catch (e) {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
