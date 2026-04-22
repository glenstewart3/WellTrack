import React, { useState, useRef } from 'react';
import api from '../api';
import {
  Shield, CheckCircle, Loader, AlertTriangle,
  Database, FileJson, ArrowRight, Building2,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

function StepProgress({ steps, stepIndex }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < stepIndex ? 'bg-emerald-500 text-white' :
              i === stepIndex ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' :
              'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
            }`}>
              {i < stepIndex ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i === stepIndex ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 ${i < stepIndex ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-700'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OnboardingPage({ onComplete }) {
  useDocumentTitle('Setup');
  // SA-provisioned flow ONLY — user is always logged in when reaching this page
  const steps = ['Your School', 'Data Setup', 'Ready'];

  const [step, setStep] = useState('school');

  // School
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState('both');
  const [currentTerm, setCurrentTerm] = useState('Term 1');

  // Data
  const [dataChoice, setDataChoice] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [demoStudentCount, setDemoStudentCount] = useState(32);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const stepMap = { school: 0, data: 1, complete: 2 };
  const stepIndex = stepMap[step] ?? 0;

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
      await api.post('/onboarding/school-setup', {
        school_name: schoolName.trim(),
        school_type: schoolType,
        current_term: currentTerm,
        current_year: new Date().getFullYear(),
      });

      if (dataChoice === 'demo') {
        await api.post('/settings/seed', { student_count: demoStudentCount });
      } else if (dataChoice === 'restore' && restoreFile) {
        const text = await restoreFile.text();
        const data = JSON.parse(text);
        await api.post('/settings/restore', data);
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

  const cardBase = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm';
  const inputBase = 'w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-slate-300/20 focus:border-slate-400 dark:focus:border-slate-600';
  const labelBase = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5';
  const helpText = 'text-slate-500 dark:text-slate-400';
  const mutedBtn = 'px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors';
  const primaryBtn = 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 py-3.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-[oklch(98.5%_.005_95)] dark:bg-slate-950" data-testid="onboarding-page">
      <div className="w-full max-w-xl">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-900 dark:bg-slate-100">
            <Shield size={15} className="text-white dark:text-slate-900" />
          </div>
          <span className="font-bold text-slate-900 dark:text-slate-100 text-lg" style={{ fontFamily: 'Manrope,sans-serif' }}>WellTrack</span>
        </div>

        {step !== 'complete' && <StepProgress steps={steps} stepIndex={stepIndex} />}

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3 mb-5">
            <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          </div>
        )}

        {/* SCHOOL STEP */}
        {step === 'school' && (
          <div className={cardBase}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
              Tell us about your school
            </h2>
            <p className={`${helpText} text-sm mb-6`}>You can change all of these from Settings at any time.</p>

            <div className="space-y-5">
              <div>
                <label className={labelBase}>School Name</label>
                <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSchoolNext()}
                  placeholder="e.g. Riverside Community School" data-testid="school-name-input" autoFocus
                  className={inputBase} />
              </div>

              <div>
                <label className={`${labelBase} mb-2`}>School Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'primary', label: 'Primary', sub: 'K - Year 6' },
                    { value: 'secondary', label: 'Secondary', sub: 'Year 7 - 12' },
                    { value: 'both', label: 'K-12', sub: 'All year levels' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setSchoolType(opt.value)}
                      data-testid={`school-type-${opt.value}`}
                      className={`p-3 rounded-xl border text-left transition-all ${schoolType === opt.value
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className={`text-xs mt-0.5 ${schoolType === opt.value ? 'text-white/60 dark:text-slate-900/60' : 'text-slate-400 dark:text-slate-500'}`}>{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`${labelBase} mb-2`}>Current Term</label>
                <div className="grid grid-cols-4 gap-2">
                  {['Term 1', 'Term 2', 'Term 3', 'Term 4'].map(t => (
                    <button key={t} onClick={() => setCurrentTerm(t)}
                      className={`py-2.5 text-sm font-medium rounded-xl border transition-all ${currentTerm === t
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSchoolNext} data-testid="school-next-btn"
                className={`flex-1 ${primaryBtn}`}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* DATA STEP */}
        {step === 'data' && (
          <div className={cardBase}>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
              How would you like to start?
            </h2>
            <p className={`${helpText} text-sm mb-6`}>Choose how to populate your WellTrack platform.</p>

            <div className="space-y-3 mb-6">
              {/* Demo */}
              <button onClick={() => setDataChoice('demo')} data-testid="data-choice-demo"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'demo'
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'demo' ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Database size={17} className={dataChoice === 'demo' ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Load Demo Data</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sample students across 4 classes, 2 terms of screening data, interventions and analytics.</p>
                  </div>
                  {dataChoice === 'demo' && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
              {dataChoice === 'demo' && (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-200 shrink-0">Number of demo students:</label>
                  <input type="number" min="8" max="400" value={demoStudentCount}
                    onChange={e => setDemoStudentCount(Math.max(8, Math.min(2000, parseInt(e.target.value) || 32)))}
                    data-testid="demo-student-count-input"
                    className="w-24 px-3 py-1.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">(8 - 2,000)</span>
                </div>
              )}

              {/* Restore */}
              <button onClick={() => { setDataChoice('restore'); setTimeout(() => fileRef.current?.click(), 50); }}
                data-testid="data-choice-restore"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'restore'
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'restore' ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <FileJson size={17} className={dataChoice === 'restore' ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Restore from Backup</p>
                    <p className="text-xs mt-0.5">
                      {restoreFile
                        ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{restoreFile.name} selected</span>
                        : <span className="text-slate-500 dark:text-slate-400">Upload a previous WellTrack JSON backup file.</span>}
                    </p>
                  </div>
                  {dataChoice === 'restore' && restoreFile && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
              <input ref={fileRef} type="file" accept=".json" className="hidden" data-testid="restore-file-onboarding"
                onChange={e => { if (e.target.files?.[0]) setRestoreFile(e.target.files[0]); }} />

              {/* Blank */}
              <button onClick={() => setDataChoice('blank')} data-testid="data-choice-blank"
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${dataChoice === 'blank'
                  ? 'border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-500'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${dataChoice === 'blank' ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <Building2 size={17} className={dataChoice === 'blank' ? 'text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Start from Scratch</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Begin with a blank platform. Import students via CSV or add them manually.</p>
                  </div>
                  {dataChoice === 'blank' && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-0.5" />}
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep('school'); setError(''); }} className={mutedBtn}>
                Back
              </button>
              <button onClick={handleComplete} disabled={!dataChoice || loading} data-testid="complete-onboarding-btn"
                className={`flex-1 ${primaryBtn}`}>
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Setting up...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}

        {/* COMPLETE STEP */}
        {step === 'complete' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 p-10 shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2" style={{ fontFamily: 'Manrope,sans-serif' }}>
              {schoolName} is ready!
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-1 text-sm">
              {dataChoice === 'demo' && `Demo data loaded - explore with ${demoStudentCount} sample students.`}
              {dataChoice === 'restore' && 'Your backup data has been restored successfully.'}
              {dataChoice === 'blank' && 'Your blank platform is set up. Start by importing or adding students.'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-8">
              Invite staff from User Management. Enable Google login from Settings.
            </p>
            <button onClick={() => {
                onComplete?.();
                const base = process.env.REACT_APP_BASE_PATH || '';
                window.location.href = `${base}/dashboard`;
              }}
              data-testid="go-to-dashboard-btn"
              className={`w-full ${primaryBtn}`}>
              Go to Dashboard <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
