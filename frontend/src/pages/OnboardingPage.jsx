import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  Shield, CheckCircle, Loader, AlertTriangle,
  Upload, Database, FileJson, ArrowRight, Building2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STEP_LABELS = ['Your School', 'Data Setup', 'Ready'];

function StepProgress({ stepIndex }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < stepIndex ? 'bg-emerald-500 text-white' :
              i === stepIndex ? 'bg-slate-900 text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < stepIndex ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i === stepIndex ? 'text-slate-900' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < stepIndex ? 'bg-emerald-300' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OnboardingPage({ onComplete }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const accent = settings.accent_color || '#0f172a';
  const [step, setStep] = useState('welcome');
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('both');
  const [currentTerm, setCurrentTerm] = useState('Term 1');
  const [dataChoice, setDataChoice] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  // Move past welcome once user logs in
  useEffect(() => {
    if (user && step === 'welcome') setStep('school');
  }, [user, step]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google`;
  };

  const handleSchoolNext = () => {
    if (!schoolName.trim()) { setError('Please enter your school name'); return; }
    setError('');
    setStep('data');
  };

  const handleComplete = async () => {
    if (!dataChoice) { setError('Please choose how to set up your data'); return; }
    if (dataChoice === 'restore' && !restoreFile) { setError('Please select a backup file to restore'); return; }
    setLoading(true);
    setError('');
    try {
      if (dataChoice === 'demo') {
        await axios.post(`${API}/settings/seed`, {}, { withCredentials: true });
      } else if (dataChoice === 'restore' && restoreFile) {
        const text = await restoreFile.text();
        const data = JSON.parse(text);
        await axios.post(`${API}/settings/restore`, data, { withCredentials: true });
      }
      await axios.post(`${API}/onboarding/complete`, {
        school_name: schoolName.trim(),
        school_type: schoolType,
        current_term: currentTerm,
        current_year: new Date().getFullYear(),
      }, { withCredentials: true });
      setStep('complete');
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail;
      setError(msg || (e.response ? `Setup failed (${e.response.status}). Please try again.` : 'Connection lost — the server may be restarting. Please refresh and try again.'));
    } finally {
      setLoading(false);
    }
  };

  // ─── WELCOME STEP ────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <div className="min-h-screen flex">
        {/* Left — CTA */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16 bg-white">
          <div className="max-w-md w-full mx-auto">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow">
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>WellTrack</p>
                <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">MTSS Student Wellbeing Platform</p>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-3 leading-tight" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Set up your school's platform
            </h1>
            <p className="text-slate-500 mb-8 leading-relaxed">
              WellTrack helps you identify, support, and monitor every student's wellbeing using the evidence-based SAEBRS framework. Get set up in under 2 minutes.
            </p>

            <div className="space-y-2.5 mb-8">
              {[
                'Universal SAEBRS screening for every class',
                'Automatic Tier 1, 2 & 3 risk classification',
                'Intervention tracking and progress monitoring',
                'School-wide analytics and CSV reports',
              ].map(f => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            <button
              onClick={handleGoogleLogin}
              data-testid="onboarding-google-btn"
              className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 rounded-xl px-6 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.018 17.64 11.71 17.64 9.2z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" />
              </svg>
              Get Started with Google
            </button>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Your Google account will be registered as the first school administrator.
            </p>
          </div>
        </div>

        {/* Right — Feature preview panel */}
        <div className="hidden lg:flex w-[42%] bg-slate-900 flex-col justify-between p-12">
          <div />
          <div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'Tier 1 — Low Risk', count: '~70%', color: 'bg-emerald-500' },
                { label: 'Tier 2 — Emerging', count: '~20%', color: 'bg-amber-400' },
                { label: 'Tier 3 — High Risk', count: '~8%', color: 'bg-rose-500' },
                { label: '4 Terms / Year', count: 'Year-round', color: 'bg-blue-500' },
              ].map(item => (
                <div key={item.label} className="bg-white/8 rounded-xl p-4 border border-white/10">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} mb-2`} />
                  <p className="text-xl font-bold text-white" style={{ fontFamily: 'Manrope,sans-serif' }}>{item.count}</p>
                  <p className="text-xs text-white/50 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Evidence-based support<br />for every student.
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm">
              Built on the SAEBRS framework — the gold standard in school-wide behavioural and wellbeing screening used in thousands of schools worldwide.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['SAEBRS', 'MTSS Framework', 'Wellbeing Analytics', 'Progress Monitoring'].map(tag => (
              <span key={tag} className="text-xs text-white/40 bg-white/10 px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── SCHOOL / DATA / COMPLETE — Centered card layout ────────────────────
  const stepIndex = { school: 0, data: 1, complete: 2 }[step] ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-900 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>WellTrack</span>
        </div>

        {step !== 'complete' && <StepProgress stepIndex={stepIndex} />}

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-5">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        )}

        {/* ── SCHOOL STEP ── */}
        {step === 'school' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Tell us about your school
            </h2>
            <p className="text-slate-500 text-sm mb-6">You can change all of these from Settings at any time.</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">School Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSchoolNext()}
                  placeholder="e.g. Riverside Community School"
                  data-testid="school-name-input"
                  autoFocus
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">School Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'primary', label: 'Primary', sub: 'K – Year 6' },
                    { value: 'secondary', label: 'Secondary', sub: 'Year 7 – 12' },
                    { value: 'both', label: 'K–12', sub: 'All year levels' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSchoolType(opt.value)}
                      data-testid={`school-type-${opt.value}`}
                      className={`p-3 rounded-xl border text-left transition-all ${schoolType === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className={`text-xs mt-0.5 ${schoolType === opt.value ? 'text-white/60' : 'text-slate-400'}`}>{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Current Term</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => (
                    <button
                      key={t}
                      onClick={() => setCurrentTerm(t)}
                      className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${currentTerm === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSchoolNext}
              data-testid="school-next-btn"
              className="mt-6 w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── DATA STEP ── */}
        {step === 'data' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
              How would you like to start?
            </h2>
            <p className="text-slate-500 text-sm mb-6">Choose how to populate your WellTrack platform.</p>

            <div className="space-y-3 mb-6">
              {/* Demo */}
              <button
                onClick={() => setDataChoice('demo')}
                data-testid="data-choice-demo"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'demo' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'demo' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <Database size={17} className={dataChoice === 'demo' ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Load Demo Data</p>
                    <p className="text-xs text-slate-500 mt-0.5">32 sample students across 4 classes, 2 terms of screening data, interventions and analytics. Perfect for exploring the platform.</p>
                  </div>
                  {dataChoice === 'demo' && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>

              {/* Restore */}
              <button
                onClick={() => { setDataChoice('restore'); setTimeout(() => fileRef.current?.click(), 50); }}
                data-testid="data-choice-restore"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'restore' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'restore' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <FileJson size={17} className={dataChoice === 'restore' ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Restore from Backup</p>
                    <p className="text-xs mt-0.5">
                      {restoreFile
                        ? <span className="text-emerald-600 font-medium">{restoreFile.name} selected</span>
                        : <span className="text-slate-500">Upload a previous WellTrack JSON backup file.</span>
                      }
                    </p>
                  </div>
                  {dataChoice === 'restore' && restoreFile && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                className="hidden"
                data-testid="restore-file-onboarding"
                onChange={e => { if (e.target.files?.[0]) setRestoreFile(e.target.files[0]); }}
              />

              {/* Blank */}
              <button
                onClick={() => setDataChoice('blank')}
                data-testid="data-choice-blank"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'blank' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'blank' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <Building2 size={17} className={dataChoice === 'blank' ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Start from Scratch</p>
                    <p className="text-xs text-slate-500 mt-0.5">Begin with a blank platform. Import students via CSV or add them manually.</p>
                  </div>
                  {dataChoice === 'blank' && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setStep('school'); setError(''); }}
                className="px-5 py-3.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!dataChoice || loading}
                data-testid="complete-onboarding-btn"
                className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Setting up…' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {/* ── COMPLETE STEP ── */}
        {step === 'complete' && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-10 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Manrope,sans-serif' }}>
              {schoolName} is ready!
            </h2>
            <p className="text-slate-500 mb-1 text-sm">
              {dataChoice === 'demo' && 'Demo data loaded — explore with 32 sample students.'}
              {dataChoice === 'restore' && 'Your backup data has been restored successfully.'}
              {dataChoice === 'blank' && 'Your blank platform is set up. Start by importing or adding students.'}
            </p>
            <p className="text-xs text-slate-400 mb-8">
              Invite staff from User Management · Set up classes and screenings from Settings
            </p>
            <button
              onClick={() => { onComplete?.(); window.location.href = '/dashboard'; }}
              data-testid="go-to-dashboard-btn"
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
