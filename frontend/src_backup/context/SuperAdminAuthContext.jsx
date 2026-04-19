import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import saApi from '../api-superadmin';

const SAAuthContext = createContext(null);

export function SAAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await saApi.get('/auth/me');
      setAdmin(res.data);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const logout = async () => {
    try { await saApi.post('/auth/logout', {}); } catch {}
    setAdmin(null);
  };

  return (
    <SAAuthContext.Provider value={{ admin, setAdmin, loading, logout, checkAuth }}>
      {children}
    </SAAuthContext.Provider>
  );
}

export const useSAAuth = () => useContext(SAAuthContext) ?? { admin: null, loading: true, logout: () => {}, checkAuth: () => {} };
