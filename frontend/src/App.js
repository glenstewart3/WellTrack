import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import api from './api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { SAAuthProvider, useSAAuth } from './context/SuperAdminAuthContext';
import DashboardLayout from './components/DashboardLayout';
import SALayout from './components/SALayout';
import LandingPage from './pages/LandingPage';
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
import AdministrationPage from './pages/AdministrationPage';
import AttendancePage from './pages/AttendancePage';
import AppointmentsPage from './pages/AppointmentsPage';
import SALoginPage from './pages/sa/SALoginPage';
import SADashboardPage from './pages/sa/SADashboardPage';
import SASchoolsPage from './pages/sa/SASchoolsPage';
import SASchoolDetailPage from './pages/sa/SASchoolDetailPage';
import SASuperAdminsPage from './pages/sa/SASuperAdminsPage';
import SAAuditPage from './pages/sa/SAAuditPage';
import { SA_PATH_PREFIX } from './context/SABasePath';

// Detect which portal to show based on hostname
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const hostname = window.location.hostname;

function detectPortal() {
  // Production: admin.welltrack.com.au → SA portal
  if (hostname === `admin.${BASE_DOMAIN}`) return 'superadmin';
  // Production: welltrack.com.au or www.welltrack.com.au → landing page
  if (hostname === BASE_DOMAIN || hostname === `www.${BASE_DOMAIN}`) return 'landing';
  // Production: {slug}.welltrack.com.au → school portal
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) return 'school';
  // Dev/preview: no subdomain detection possible — use path-based routing
  return 'dev';
}

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-600 font-medium">Loading WellTrack...</p>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role === 'screener' && !location.pathname.startsWith('/screening')) {
    return <Navigate to="/screening" replace />;
  }
  return <DashboardLayout />;
}

function SAProtectedRoute() {
  const { admin, loading } = useSAAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!admin) return <Navigate to={`${SA_PATH_PREFIX}/login`} state={{ from: location }} replace />;
  return <SALayout />;
}

function SchoolRouter() {
  const { loading: authLoading, user } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    api.get('/onboarding/status')
      .then(r => setOnboardingDone(r.data.complete))
      .catch(() => { setOnboardingDone(true); });
  }, []);

  if (authLoading || onboardingDone === null) return <Spinner />;

  const defaultPath = user?.role === 'screener' ? '/screening' : '/dashboard';

  // If onboarding not done and user is logged in (SA-provisioned flow), show school setup
  if (!onboardingDone && user) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage onComplete={() => setOnboardingDone(true)} />} />
      </Routes>
    );
  }

  // If onboarding not done and no user, check if any users exist (has_users from status)
  // If users exist → show login first; if no users → show legacy onboarding
  if (!onboardingDone && !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<OnboardingPage onComplete={() => setOnboardingDone(true)} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute />}>
        <Route index element={<Navigate to={defaultPath} replace />} />
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
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="admin" element={<AdministrationPage />} />
        <Route path="users" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

// Production SA portal — only needs SAAuthProvider, no school providers
function SAPortalApp() {
  return (
    <SAAuthProvider>
      <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || '/'}>
        <Routes>
          <Route path="/login" element={<SALoginPage />} />
          <Route path="/" element={<SAProtectedRoute />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<SADashboardPage />} />
            <Route path="schools" element={<SASchoolsPage />} />
            <Route path="schools/:schoolId" element={<SASchoolDetailPage />} />
            <Route path="admins" element={<SASuperAdminsPage />} />
            <Route path="audit" element={<SAAuditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </SAAuthProvider>
  );
}

// Production landing page — no providers needed
function LandingApp() {
  return (
    <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || '/'}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// Production school portal — full providers
function SchoolPortalApp() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || '/'}>
            <Routes>
              <Route path="/*" element={<SchoolRouter />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

// Dev/preview — all portals via path-based routing, all providers loaded
function DevApp() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <ThemeProvider>
          <SAAuthProvider>
            <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || '/'}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/sa/login" element={<SALoginPage />} />
                <Route path="/sa" element={<SAProtectedRoute />}>
                  <Route index element={<Navigate to="/sa/dashboard" replace />} />
                  <Route path="dashboard" element={<SADashboardPage />} />
                  <Route path="schools" element={<SASchoolsPage />} />
                  <Route path="schools/:schoolId" element={<SASchoolDetailPage />} />
                  <Route path="admins" element={<SASuperAdminsPage />} />
                  <Route path="audit" element={<SAAuditPage />} />
                </Route>
                <Route path="/*" element={<SchoolRouter />} />
              </Routes>
            </BrowserRouter>
          </SAAuthProvider>
        </ThemeProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

const PORTAL = detectPortal();

export default function App() {
  if (PORTAL === 'superadmin') return <SAPortalApp />;
  if (PORTAL === 'landing') return <LandingApp />;
  if (PORTAL === 'school') return <SchoolPortalApp />;
  return <DevApp />;
}
