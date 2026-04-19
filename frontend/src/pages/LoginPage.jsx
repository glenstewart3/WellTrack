import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Shield, AlertCircle, Eye, EyeOff, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api';
import useDocumentTitle from '../hooks/useDocumentTitle';

const ERROR_MESSAGES = {
  access_denied: 'Access denied. Your account has not been registered. Please contact your school administrator.',
  auth_failed: 'Authentication failed. Please try again.',
  no_email: 'Could not retrieve your email from Google. Please try again.',
};

export default function LoginPage() {
  useDocumentTitle('Login');
  const location = useLocation();
  const { settings } = useSettings();
  const { theme } = useTheme();

  // Login page always renders in light mode for consistency with public/marketing pages
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'default');
    return () => {
      if (previous) root.setAttribute('data-theme', previous);
      else root.removeAttribute('data-theme');
    };
  }, []);

  const searchParams = new URLSearchParams(location.search);
  const errorCode = searchParams.get('error');
  const stateError = location.state?.error;

  const [accessError, setAccessError] = useState((errorCode && ERROR_MESSAGES[errorCode]) || stateError || '');
  const [mode, setMode] = useState('choose'); // 'choose' | 'email'
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const accent = settings.accent_color || '#0f172a';
  const emailAuthEnabled = settings.email_auth_enabled !== false;
  const googleAuthEnabled = settings.google_auth_enabled !== false;

  const handleGoogleLogin = () => {
    const baseDomain = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
    const isSubdomain = window.location.hostname.endsWith(`.${baseDomain}`);
    const base = isSubdomain ? '' : (process.env.REACT_APP_BACKEND_URL || '');
    window.location.href = `${base}/api/auth/google`;
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAccessError('');
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login-email', emailForm);
      const base = process.env.REACT_APP_BASE_PATH || '';
      window.location.href = `${base}/${res.data.redirect}`;
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;
      if (detail) {
        setAccessError(detail);
      } else if (!err.response) {
        setAccessError('Cannot reach the server. Check that the backend is running and ALLOWED_ORIGINS is configured correctly.');
      } else {
        setAccessError(`Login failed (HTTP ${status}). Please try again.`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f8fafc' }}>
      {/* Left panel */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16">
        <div className="max-w-md w-full mx-auto">
          {/* Logo + Brand */}
          <div className="mb-10">
            {(settings.logo_base64 || settings.logo_dark_base64) && (
              <img
                src={
                  (theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches))
                    ? (settings.logo_dark_base64 || settings.logo_base64)
                    : settings.logo_base64
                }
                alt="School logo"
                className="h-24 w-auto object-contain mb-6 mx-auto block"
              />
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: accent }}>
                <Shield size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{settings.platform_name || 'WellTrack'}</p>
                <p className="text-xs text-slate-400 font-medium">{settings.school_name || 'MTSS Student Wellbeing Platform'}</p>
              </div>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-4xl font-bold text-slate-900 mb-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            Welcome back
          </h1>
          <p className="text-slate-500 mb-8 text-base leading-relaxed">
            {settings.welcome_message || "Sign in to access your school's MTSS wellbeing platform."}
          </p>

          {/* Error */}
          {accessError && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5" data-testid="login-access-error">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-700">Sign In Error</p>
                <p className="text-xs text-rose-600 mt-0.5">{accessError}</p>
              </div>
            </div>
          )}

          {/* Email/password form */}
          {mode === 'email' ? (
            <div>
              <button onClick={() => { setMode('choose'); setAccessError(''); }} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
                <ArrowLeft size={14} /> Back
              </button>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      autoFocus
                      value={emailForm.email}
                      onChange={e => setEmailForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="your@email.com"
                      data-testid="email-login-input"
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Password</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={emailForm.password}
                      onChange={e => setEmailForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      data-testid="password-login-input"
                      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="email-login-submit"
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: accent }}
                >
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                  {submitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Google login — only when enabled */}
              {googleAuthEnabled && (
                <button onClick={handleGoogleLogin} data-testid="google-login-btn"
                  className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all duration-150 active:scale-[0.98]">
                  <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </button>
              )}

              {/* Divider between methods */}
              {googleAuthEnabled && emailAuthEnabled && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}

              {/* Email/password option */}
              {emailAuthEnabled && (
                <button onClick={() => setMode('email')} data-testid="email-login-btn"
                  className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all duration-150 active:scale-[0.98]">
                  <Mail size={16} className="text-slate-500" />
                  Sign in with email &amp; password
                </button>
              )}

              <p className="mt-6 text-xs text-slate-400 text-center">
                Secure access — only registered users can sign in.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex flex-1 bg-slate-900 flex-col justify-between p-12">
        <div />
        <div>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Tier 1', count: '100%', color: 'bg-emerald-500', desc: 'Universal' },
              { label: 'Tier 2', count: '20%',  color: 'bg-amber-400',  desc: 'Targeted' },
              { label: 'Tier 3', count: '5%',   color: 'bg-rose-500',   desc: 'Intensive' },
            ].map(item => (
              <div key={item.label} className="bg-white/10 rounded-xl p-4">
                <div className={`w-3 h-3 rounded-full ${item.color} mb-2`} />
                <p className="text-2xl font-bold text-white" style={{fontFamily:'Manrope,sans-serif'}}>{item.count}</p>
                <p className="text-xs text-white/60 mt-1">{item.label}</p>
                <p className="text-xs text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
          <h1 className="text-4xl font-bold text-white mb-3" style={{fontFamily:'Manrope,sans-serif'}}>
            Every student matters.
          </h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm">
            WellTrack helps your school identify students who need support before they fall through the cracks — using evidence-based SAEBRS screening and wellbeing analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {['Universal Screening', 'Early Intervention', 'Progress Monitoring', 'Data-Driven'].map(tag => (
            <span key={tag} className="text-xs text-white/50 bg-white/10 px-3 py-1 rounded-full">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
