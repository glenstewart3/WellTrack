import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

export const THEMES = {
  default: { name: 'Light',  swatch: '#f8fafc' },
  dark:    { name: 'Dark',   swatch: '#1e293b' },
  system:  { name: 'System', swatch: null },
};

// Active nav colour per RESOLVED theme ('dark' | 'default') — never 'system'
export const THEME_NAV_ACTIVE = {
  default: null,      // falls back to school accent_color
  dark:    '#0f172a',
};

const ThemeContext = createContext({ theme: 'default', resolvedTheme: 'default', setTheme: () => {} });

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default';
}

function resolve(theme) {
  return theme === 'system' ? getSystemTheme() : (theme || 'default');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', resolve(theme));
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState('default');
  const [resolvedTheme, setResolvedTheme] = useState('default');

  useEffect(() => {
    const t = user?.theme || 'system';
    setThemeState(t);
    applyTheme(t);
    setResolvedTheme(resolve(t));
  }, [user]);

  // Re-apply whenever the OS preference changes (only active when theme === 'system')
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyTheme('system');
      setResolvedTheme(getSystemTheme());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    setResolvedTheme(resolve(newTheme));
    try {
      await api.put('/auth/preferences', { theme: newTheme });
    } catch (e) {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
