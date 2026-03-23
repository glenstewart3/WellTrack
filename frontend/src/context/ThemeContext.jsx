import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const THEMES = {
  default: { name: 'Light', swatch: '#f8fafc' },
  dark:    { name: 'Dark',  swatch: '#1e293b' },
};

// Active nav colour per theme
export const THEME_NAV_ACTIVE = {
  default: null,   // falls back to school accent_color
  dark:    '#3b82f6',
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
