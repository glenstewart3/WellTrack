import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Shield, CheckCircle, Loader, AlertTriangle,
  Upload, Database, FileJson, ArrowRight, Building2,
  User, Mail, Lock, Eye, EyeOff,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STEP_LABELS = ['Admin Account', 'Your School', 'Data Setup', 'Ready'];

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
  const navigate = useNavigate();
  const [step, setStep] = useState('account');

  // Admin account
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // School
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('both');
  const [currentTerm, setCurrentTerm] = useState('Term 1');

  // Data
  const [dataChoice, setDataChoice] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const stepIndex = { account: 0, school: 1, data: 2, complete: 3 }[step] ?? 0;

  const handleAccountNext = () => {
    if (!adminName.trim()) { setError('Please enter your name'); return; }
    if (!adminEmail.trim() || !adminEmail.includes('@')) { setError('Please enter a valid email address'); return; }
    if (adminPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (adminPassword !== adminConfirm) { setError('Passwords do not match'); return; }
    setError('');
    setStep('school');
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
      // Create admin account + save school settings + get session cookie
      await axios.post(`${API}/onboarding/setup`, {
        admin_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
        school_name: schoolName.trim(),
        school_type: schoolType,
        current_term: currentTerm,
        current_year: new Date().getFullYear(),
      }, { withCredentials: true });

      // Now authenticated — seed/restore if needed
      if (dataChoice === 'demo') {
        await axios.post(`${API}/settings/seed`, {}, { withCredentials: true });
      } else if (dataChoice === 'restore' && restoreFile) {
        const text = await restoreFile.text();
        const data = JSON.parse(text);
        await axios.post(`${API}/settings/restore`, data, { withCredentials: true });
      }
      setStep('complete');
    } catch (e) {
      const detail = e.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail;
      setError(msg || (e.response ? `Setup failed (${e.response.status}). Please try again.` : 'Connection lost — please refresh and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-12 px-4">
      <div className="w-full max-w-xl">
        {/* Brand */}
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

        {/* ── ACCOUNT STEP ── */}
        {step === 'account' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Create your admin account
            </h2>
            <p className="text-slate-500 text-sm mb-6">This will be the primary administrator account for your WellTrack platform.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" value={adminName} onChange={e => setAdminName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAccountNext()}
                    placeholder="e.g. Sarah Johnson" autoFocus data-testid="admin-name-input"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                    placeholder="admin@yourschool.edu" data-testid="admin-email-input"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? 'text' : 'password'} value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="At least 8 characters" data-testid="admin-password-input"
                    className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type={showPw ? 'text' : 'password'} value={adminConfirm}
                    onChange={e => setAdminConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAccountNext()}
                    placeholder="Repeat your password" data-testid="admin-confirm-input"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>
            </div>

            <button onClick={handleAccountNext} data-testid="account-next-btn"
              className="mt-6 w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              Continue <ArrowRight size={16} />
            </button>
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
                <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSchoolNext()}
                  placeholder="e.g. Riverside Community School" data-testid="school-name-input" autoFocus
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">School Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'primary', label: 'Primary', sub: 'K – Year 6' },
                    { value: 'secondary', label: 'Secondary', sub: 'Year 7 – 12' },
                    { value: 'both', label: 'K–12', sub: 'All year levels' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setSchoolType(opt.value)}
                      data-testid={`school-type-${opt.value}`}
                      className={`p-3 rounded-xl border text-left transition-all ${schoolType === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
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
                    <button key={t} onClick={() => setCurrentTerm(t)}
                      className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${currentTerm === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setStep('account'); setError(''); }}
                className="px-5 py-3.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                Back
              </button>
              <button onClick={handleSchoolNext} data-testid="school-next-btn"
                className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                Continue <ArrowRight size={16} />
              </button>
            </div>
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
              <button onClick={() => setDataChoice('demo')} data-testid="data-choice-demo"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'demo' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'demo' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <Database size={17} className={dataChoice === 'demo' ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Load Demo Data</p>
                    <p className="text-xs text-slate-500 mt-0.5">32 sample students across 4 classes, 2 terms of screening data, interventions and analytics.</p>
                  </div>
                  {dataChoice === 'demo' && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>

              <button onClick={() => { setDataChoice('restore'); setTimeout(() => fileRef.current?.click(), 50); }}
                data-testid="data-choice-restore"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'restore' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'restore' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                    <FileJson size={17} className={dataChoice === 'restore' ? 'text-white' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">Restore from Backup</p>
                    <p className="text-xs mt-0.5">
                      {restoreFile
                        ? <span className="text-emerald-600 font-medium">{restoreFile.name} selected</span>
                        : <span className="text-slate-500">Upload a previous WellTrack JSON backup file.</span>}
                    </p>
                  </div>
                  {dataChoice === 'restore' && restoreFile && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" data-testid="restore-file-onboarding"
                onChange={e => { if (e.target.files?.[0]) setRestoreFile(e.target.files[0]); }} />

              <button onClick={() => setDataChoice('blank')} data-testid="data-choice-blank"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'blank' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
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
              <button onClick={() => { setStep('school'); setError(''); }}
                className="px-5 py-3.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                Back
              </button>
              <button onClick={handleComplete} disabled={!dataChoice || loading} data-testid="complete-onboarding-btn"
                className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
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
              Invite staff from User Management · Enable Google login from Settings → General
            </p>
            <button onClick={() => { onComplete?.(); navigate('/dashboard', { replace: true }); }}
              data-testid="go-to-dashboard-btn"
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
