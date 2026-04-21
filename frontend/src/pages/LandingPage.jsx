import React, { useState, useRef, useEffect } from 'react';
import {
  Shield, ArrowRight, Search, CheckCircle, Users, BarChart3,
  Target, ClipboardCheck, Loader2, XCircle, ShieldCheck, ChartLine, Heart,
  Sun, Moon,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = process.env.REACT_APP_BACKEND_URL || '';
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
const isRootDomain = window.location.hostname === BASE_DOMAIN || window.location.hostname === `www.${BASE_DOMAIN}`;
const API_BASE = isRootDomain ? '' : API;

const LANDING_THEME_KEY = 'welltrack_landing_theme';

export default function LandingPage() {
  useDocumentTitle('Welcome');
  const [showFinder, setShowFinder] = useState(false);
  const [slug, setSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(LANDING_THEME_KEY) === 'dark'; } catch { return false; }
  });
  const inputRef = useRef(null);

  useEffect(() => {
    if (showFinder) setTimeout(() => inputRef.current?.focus(), 100);
  }, [showFinder]);

  useEffect(() => {
    try { localStorage.setItem(LANDING_THEME_KEY, dark ? 'dark' : 'light'); } catch {}
    // Update the browser's theme-color meta so iOS status bar matches on webclip
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#fbfaf6');
  }, [dark]);

  const handleLookup = async () => {
    if (!slug.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const r = await fetch(`${API_BASE}/api/school-lookup?slug=${encodeURIComponent(slug.trim().toLowerCase())}`);
      const data = await r.json();
      setResult(data);
      if (data.exists) {
        setTimeout(() => {
          const isProduction = window.location.hostname === BASE_DOMAIN || window.location.hostname === `www.${BASE_DOMAIN}`;
          if (isProduction) {
            window.location.href = `https://${data.slug}.${BASE_DOMAIN}/login`;
          } else {
            window.location.href = `/login`;
          }
        }, 1200);
      }
    } catch {
      setResult({ exists: false }); // network error — treat as not found
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      data-landing-theme={dark ? 'dark' : 'light'}
      className="landing-page relative min-h-screen overflow-hidden"
      style={{ backgroundColor: dark ? '#0b1220' : '#fbfaf6', color: dark ? '#f1f5f9' : '#0f172a' }}
    >
      {/* Blurred color spots — brighter opacity in dark mode for visibility */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-20 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full blur-3xl"
             style={{ background: dark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.18)',
                      opacity: dark ? 0.9 : 0.6 }} />
        <div className="absolute right-[-6%] top-1/4 h-[360px] w-[360px] rounded-full blur-3xl"
             style={{ background: dark ? 'rgba(245, 158, 11, 0.30)' : 'rgba(245, 158, 11, 0.20)',
                      opacity: dark ? 0.75 : 0.4 }} />
        <div className="absolute bottom-[-3%] left-[-3%] h-[300px] w-[300px] rounded-full blur-3xl"
             style={{ background: dark ? 'rgba(244, 63, 94, 0.26)' : 'rgba(244, 63, 94, 0.16)',
                      opacity: dark ? 0.7 : 0.35 }} />
        <div className="absolute top-[55%] left-[60%] h-[380px] w-[380px] rounded-full blur-3xl"
             style={{ background: dark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.00)',
                      opacity: dark ? 0.65 : 0 }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dark ? 'bg-slate-100' : 'bg-slate-900'}`}>
            <Shield size={16} className={dark ? 'text-slate-900' : 'text-white'} />
          </div>
          <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', color: dark ? '#f1f5f9' : '#0f172a' }}>WellTrack</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(d => !d)}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            data-testid="landing-theme-toggle"
            className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
              dark ? 'bg-white/10 hover:bg-white/15 text-amber-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            onClick={() => setShowFinder(true)}
            data-testid="nav-login-btn"
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              dark ? 'bg-white text-slate-900 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            School Login
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 pt-12 lg:px-10 lg:pb-10 lg:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Multi-Tiered System of Supports
          </span>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6"
            style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}
          >
            Every student seen.<br />
            <span className="italic text-slate-500">no one missed.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            WellTrack helps schools screen, track and respond to student wellbeing across MTSS tiers &mdash; without the spreadsheet chaos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => setShowFinder(true)}
              data-testid="hero-login-btn"
              className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
            >
              <Search size={15} />
              Find Your School
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Tier cards */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {(() => {
            // Base (light) palette
            const lightTiers = [
              { tier: 'Tier 1', label: 'Universal', desc: 'Whole-school screening to see the picture early.', dotColor: '#10b981', bgColor: 'rgba(16,185,129,0.08)',  borderColor: 'rgba(16,185,129,0.2)',  fgColor: '#065f46' },
              { tier: 'Tier 2', label: 'Targeted',  desc: 'Small-group support with progress monitoring.',   dotColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.08)',  borderColor: 'rgba(245,158,11,0.2)',  fgColor: '#78350f' },
              { tier: 'Tier 3', label: 'Intensive', desc: 'Individual plans, alerts, and case coordination.', dotColor: '#f43f5e', bgColor: 'rgba(244,63,94,0.08)',   borderColor: 'rgba(244,63,94,0.2)',   fgColor: '#881337' },
            ];
            // Dark palette — same hues, luminance bumped ~10% for readability on navy bg
            const darkTiers = [
              { tier: 'Tier 1', label: 'Universal', desc: 'Whole-school screening to see the picture early.', dotColor: '#34d399', bgColor: 'rgba(52,211,153,0.14)',  borderColor: 'rgba(52,211,153,0.45)', fgColor: '#a7f3d0' },
              { tier: 'Tier 2', label: 'Targeted',  desc: 'Small-group support with progress monitoring.',   dotColor: '#fbbf24', bgColor: 'rgba(251,191,36,0.14)',  borderColor: 'rgba(251,191,36,0.45)', fgColor: '#fde68a' },
              { tier: 'Tier 3', label: 'Intensive', desc: 'Individual plans, alerts, and case coordination.', dotColor: '#fb7185', bgColor: 'rgba(251,113,133,0.14)', borderColor: 'rgba(251,113,133,0.45)', fgColor: '#fecdd3' },
            ];
            const tiers = dark ? darkTiers : lightTiers;
            return tiers.map(({ tier, label, desc, dotColor, bgColor, borderColor, fgColor }) => (
              <div key={tier} className="group relative overflow-hidden rounded-2xl p-6" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: fgColor, fontFamily: 'JetBrains Mono, monospace' }}>{tier}</span>
                </div>
                <p className="mt-3 text-2xl font-semibold" style={{ color: fgColor, fontFamily: 'Manrope, sans-serif' }}>{label}</p>
                <p className="mt-2 text-sm opacity-80" style={{ color: fgColor }}>{desc}</p>
              </div>
            ));
          })()}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 py-10 sm:grid-cols-3 lg:px-10">
          {[
            { icon: ShieldCheck, title: 'Evidence-based screening', desc: 'SAEBRS and self-report screening with automated risk classification across social, academic, and emotional domains.' },
            { icon: ChartLine, title: 'See change over time', desc: 'Trend lines per student, class, and year level — with clear tier movement and trajectory analysis.' },
            { icon: Heart, title: 'Built for staff', desc: 'Quick capture on tablet, calm interface, no jargon. Designed with teachers and wellbeing coordinators.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-7 transition-colors"
              style={{
                background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)',
                border: `1px solid ${dark ? 'rgba(148,163,184,0.16)' : 'rgba(180,170,150,0.28)'}`,
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: dark ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.10)',
                  color: dark ? '#6ee7b7' : '#047857',
                }}
              >
                <Icon size={20} />
              </div>
              <h3 className="font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: dark ? '#f1f5f9' : '#0f172a' }}>{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: dark ? '#94a3b8' : '#64748b' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-10 pb-16 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 p-10 text-white sm:p-14">
          {/* Subtle spots in CTA */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-[-20%] right-[-10%] h-[300px] w-[300px] rounded-full opacity-20 blur-3xl" style={{ background: '#10b981' }} />
            <div className="absolute bottom-[-15%] left-[-5%] h-[250px] w-[250px] rounded-full opacity-15 blur-3xl" style={{ background: '#f59e0b' }} />
          </div>
          <div className="relative grid gap-8 sm:grid-cols-2 sm:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: 'Manrope, sans-serif' }}>Bring calm to wellbeing.</h2>
              <p className="mt-3 text-white/60">Join the schools using WellTrack to act earlier, with less spreadsheet pain.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowFinder(true)}
                  data-testid="cta-login-btn"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Find Your School <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-white/70">
              {[
                'MTSS-aligned tier framework out of the box',
                'Privacy-first, role-based access controls',
                'Onboard a whole school in under a week',
                'Australian-built, locally hosted',
              ].map(text => (
                <li key={text} className="flex items-start gap-3">
                  <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-slate-300" />
            <span>&copy; {new Date().getFullYear()} WellTrack. Built for Australian schools.</span>
          </div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-slate-700">Privacy</a>
            <a href="#" className="hover:text-slate-700">Security</a>
            <a href="#" className="hover:text-slate-700">Contact</a>
          </div>
        </div>
      </footer>

      {/* School Finder Modal */}
      {showFinder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setShowFinder(false); setResult(null); setSlug(''); }}>
          <div
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md p-8 relative"
            onClick={e => e.stopPropagation()}
            data-testid="school-finder-modal"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Find your school</h2>
            <p className="text-slate-500 text-sm mb-6">Enter your school's tag to access your portal.</p>

            <div className="relative mb-4">
              <input
                ref={inputRef}
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="e.g. yourschool"
                data-testid="school-slug-input"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs font-mono">.{BASE_DOMAIN}</span>
            </div>

            {result && result.exists && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-emerald-700 text-sm" data-testid="school-found-msg">
                <CheckCircle size={16} />
                <span>Found: <strong>{result.name}</strong> — redirecting...</span>
              </div>
            )}

            {result && !result.exists && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm" data-testid="school-not-found-msg">
                <XCircle size={16} />
                <span>No school found with that tag. Check with your administrator.</span>
              </div>
            )}

            <button
              onClick={handleLookup}
              disabled={!slug.trim() || checking}
              data-testid="school-finder-submit"
              className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {checking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {checking ? 'Checking...' : 'Go to School Portal'}
            </button>

            <p className="text-center text-slate-400 text-xs mt-4">
              Your school URL will be <strong className="text-slate-600">{slug || 'yourschool'}.{BASE_DOMAIN}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
