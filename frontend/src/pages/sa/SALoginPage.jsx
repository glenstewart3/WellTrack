import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useSAAuth } from '../../context/SuperAdminAuthContext';
import saApi from '../../api-superadmin';

export default function SALoginPage() {
  const { admin, checkAuth } = useSAAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading'); // 'loading' | 'bootstrap' | 'login'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4" data-testid="sa-login-page">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">WellTrack</h1>
          <p className="text-sm text-blue-300 uppercase tracking-widest mt-1 font-medium">Super Admin Portal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-white">
              {mode === 'bootstrap' ? 'Create First Super Admin' : 'Sign In'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'bootstrap'
                ? 'Set up the first administrator for the WellTrack platform.'
                : 'Enter your credentials to access the admin portal.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-900/20 rounded-lg p-3 mb-4 border border-red-800/30" data-testid="sa-login-error">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'bootstrap' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Full Name</label>
                <div className="relative">
                  <UserPlus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Your full name"
                    required
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    data-testid="sa-name-input"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Email</label>
              <div className="relative">
                <Shield size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@yourschool.edu.au"
                  required
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="sa-email-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={mode === 'bootstrap' ? 'Min 8 characters' : 'Your password'}
                  required
                  minLength={8}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  data-testid="sa-password-input"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
              data-testid="sa-login-submit"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {mode === 'bootstrap' ? 'Create Account & Sign In' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">WellTrack Platform Administration</p>
      </div>
    </div>
  );
}
