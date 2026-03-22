import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const THEMES = {
  default:  { name: 'Slate',    swatch: '#0f172a' },
  ocean:    { name: 'Ocean',    swatch: '#0c4a6e' },
  forest:   { name: 'Forest',   swatch: '#14532d' },
  warm:     { name: 'Warm',     swatch: '#7c2d12' },
  dark:     { name: 'Dark',     swatch: '#1e293b' },
  midnight: { name: 'Midnight', swatch: '#1e1b4b' },
};

// Per-theme active nav color (overrides school accent_color)
export const THEME_NAV_ACTIVE = {
  default: null,
  ocean: '#0ea5e9',
  forest: '#22c55e',
  warm:   '#f97316',
  dark:   '#3b82f6',
  midnight: '#818cf8',
};

const ThemeContext = createContext({ theme: 'default', setTheme: () => {} });

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme || 'default');
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState('default');

  useEffect(() => {
    const t = user?.theme || 'default';
    setThemeState(t);
    applyTheme(t);
  }, [user]);

  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      await axios.put(`${API}/auth/preferences`, { theme: newTheme }, { withCredentials: true });
    } catch (e) {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
