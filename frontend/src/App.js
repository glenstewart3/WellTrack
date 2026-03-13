import React, { useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScreeningPage from './pages/ScreeningPage';
import StudentsPage from './pages/StudentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import ClassroomRadarPage from './pages/ClassroomRadarPage';
import AnalyticsPage from './pages/AnalyticsPage';
import InterventionsPage from './pages/InterventionsPage';
import AlertsPage from './pages/AlertsPage';
import MeetingPrepPage from './pages/MeetingPrepPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// AuthCallback: handles the session_id from OAuth redirect
function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use useRef to prevent double execution under React StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const sessionId = params.get('session_id');

    if (!sessionId) {
      navigate('/login');
      return;
    }

    axios.post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true })
      .then(res => {
        setUser(res.data);
        navigate('/dashboard', { state: { user: res.data } });
      })
      .catch(() => navigate('/login'));
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Signing you in...</p>
      </div>
    </div>
  );
}

// ProtectedRoute: checks auth and wraps with layout
function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <DashboardLayout />;
}

// AppRouter: synchronously checks for session_id BEFORE routing
function AppRouter() {
  const location = useLocation();

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check URL fragment synchronously during render to handle OAuth callback
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="screening" element={<ScreeningPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/:studentId" element={<StudentProfilePage />} />
        <Route path="radar" element={<ClassroomRadarPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="interventions" element={<InterventionsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="meeting" element={<MeetingPrepPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}
