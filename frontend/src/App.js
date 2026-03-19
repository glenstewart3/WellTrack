import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
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
import UserManagementPage from './pages/UserManagementPage';
import AttendancePage from './pages/AttendancePage';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading WellTrack…</p>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <DashboardLayout />;
}

function AppRouter() {
  const { loading: authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    axios.get(`${API}/onboarding/status`)
      .then(r => setOnboardingDone(r.data.complete))
      .catch(() => setOnboardingDone(true)); // fail-safe: assume complete
  }, []);

  if (authLoading || onboardingDone === null) return <Spinner />;

  // Gate all navigation behind onboarding
  if (!onboardingDone) {
    return (
      <Routes>
        <Route
          path="*"
          element={<OnboardingPage onComplete={() => setOnboardingDone(true)} />}
        />
      </Routes>
    );
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
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="meeting" element={<MeetingPrepPage />} />
        <Route path="reports" element={<Navigate to="/analytics" replace />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<UserManagementPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || '/'}>

          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  );
}
