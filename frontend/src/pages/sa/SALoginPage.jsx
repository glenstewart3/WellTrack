import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useSAAuth } from '../../context/SuperAdminAuthContext';
import saApi from '../../api-superadmin';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function SALoginPage() {
  useDocumentTitle('Sign in · Super Admin');
  const { admin, checkAuth } = useSAAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading'); // 'loading' | 'bootstrap' | 'login'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // SA portal respects system dark mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.setAttribute(
      'data-theme',
      mq.matches ? 'dark' : 'default',
    );
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (admin) { navigate('/sa/dashboard', { replace: true }); return; }
    saApi.post('/auth/bootstrap', { name: '__check__', email: 'x', password: '12345678' })
      .then(() => setMode('bootstrap'))
      .catch(err => {
        if (err.response?.status === 403) setMode('login');
        else if (err.response?.status === 400) setMode('bootstrap');
        else setMode('login');
      });
  }, [admin, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'bootstrap') {
        await saApi.post('/auth/bootstrap', form);
        await saApi.post('/auth/login-email', { email: form.email, password: form.password });
      } else {
        await saApi.post('/auth/login-email', { email: form.email, password: form.password });
      }
      await checkAuth();
      navigate('/sa/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-300/20 focus:border-slate-400 dark:focus:border-slate-600';

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--wt-page-bg)' }}>
        <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--wt-page-bg)' }}
      data-testid="sa-login-page"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield size={26} className="text-white dark:text-slate-900" />
          </div>
          <h1
            className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            WellTrack
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 font-semibold">
            Super Admin Portal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {mode === 'bootstrap' ? 'Create First Super Admin' : 'Sign In'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {mode === 'bootstrap'
                ? 'Set up the first administrator for the WellTrack platform.'
                : 'Enter your credentials to access the admin portal.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300 text-sm bg-rose-50 dark:bg-rose-950/40 rounded-lg p-3 mb-4 border border-rose-200 dark:border-rose-900" data-testid="sa-login-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'bootstrap' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserPlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    required
                    className={inputCls}
                    data-testid="sa-name-input"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
              <div className="relative">
                <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@yourschool.edu.au"
                  required
                  className={inputCls}
                  data-testid="sa-email-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === 'bootstrap' ? 'Min 8 characters' : 'Your password'}
                  required
                  minLength={8}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-300/20 focus:border-slate-400 dark:focus:border-slate-600"
                  data-testid="sa-password-input"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-900 dark:bg-slate-100 hover:opacity-90 text-white dark:text-slate-900 font-semibold py-3 rounded-xl text-sm transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              data-testid="sa-login-submit"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {mode === 'bootstrap' ? 'Create Account & Sign In' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">WellTrack Platform Administration</p>
      </div>
    </div>
  );
}
