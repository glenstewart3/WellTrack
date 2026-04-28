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
import ReportBuilderPage from './pages/ReportBuilderPage';
import TermComparisonPage from './pages/TermComparisonPage';
import NotificationsPage from './pages/NotificationsPage';
import CalendarPage from './pages/CalendarPage';
import AuditLogPage from './pages/AuditLogPage';
import ActionPlansPage from './pages/ActionPlansPage';
import SALoginPage from './pages/sa/SALoginPage';
import SADashboardPage from './pages/sa/SADashboardPage';
import SASchoolsPage from './pages/sa/SASchoolsPage';
import SASchoolDetailPage from './pages/sa/SASchoolDetailPage';
import SASuperAdminsPage from './pages/sa/SASuperAdminsPage';
import SAAuditPage from './pages/sa/SAAuditPage';
import SAPlatformSettingsPage from './pages/sa/SAPlatformSettingsPage';
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
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "oklch(98.5% .005 95)" }}>
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

function SchoolNotFound() {
  const baseDomain = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "oklch(98.5% .005 95)" }}>
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>School not found</h1>
        <p className="text-slate-500 mb-6">
          This school portal doesn't exist or is no longer active. Check the URL or contact your WellTrack administrator.
        </p>
        <a
          href={`https://${baseDomain}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors"
        >
          Go to {baseDomain}
        </a>
      </div>
    </div>
  );
}

function SchoolSuspended({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "oklch(98.5% .005 95)" }}>
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>School unavailable</h1>
        <p className="text-slate-500 mb-6">{message || 'This school portal is currently unavailable. Please contact your WellTrack administrator.'}</p>
      </div>
    </div>
  );
}

function SchoolRouter() {
  const { loading: authLoading, user } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [schoolError, setSchoolError] = useState(null); // null = loading, false = ok, {status, message}

  useEffect(() => {
    api.get('/onboarding/status')
      .then(r => {
        setOnboardingDone(r.data.complete);
        setSchoolError(false);
      })
      .catch(err => {
        const status = err.response?.status;
        const detail = err.response?.data?.detail || '';
        if (status === 404) {
          setSchoolError({ status: 404, message: detail });
        } else if (status === 403) {
          setSchoolError({ status: 403, message: detail });
        } else if (status === 410) {
          setSchoolError({ status: 410, message: detail });
        } else {
          // Other errors (network, 500) — proceed normally
          setSchoolError(false);
          setOnboardingDone(true);
        }
      });
  }, []);

  if (authLoading || (schoolError === null && onboardingDone === null)) return <Spinner />;
  if (schoolError && schoolError.status === 404) return <SchoolNotFound />;
  if (schoolError && (schoolError.status === 403 || schoolError.status === 410)) return <SchoolSuspended message={schoolError.message} />;

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

  // If onboarding not done and no user, always send to /login.
  // (The old self-signup onboarding flow is deprecated — schools are now
  // provisioned via the Super Admin portal, which creates the admin account
  // upfront. After login, the SA-provisioned user completes the new onboarding.)
  if (!onboardingDone && !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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
        <Route path="reports" element={<ReportBuilderPage />} />
        <Route path="term-comparison" element={<TermComparisonPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="action-plans" element={<ActionPlansPage />} />
        <Route path="audit" element={<AuditLogPage />} />
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
            <Route path="platform" element={<SAPlatformSettingsPage />} />
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
                  <Route path="platform" element={<SAPlatformSettingsPage />} />
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
