import React, { useState, useRef, useEffect } from 'react';
import {
  Shield, ArrowRight, Search, CheckCircle, Users, BarChart3,
  Target, ClipboardCheck, Loader2, XCircle
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = process.env.REACT_APP_BACKEND_URL || '';
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || 'welltrack.com.au';
// On root domain in production, use relative paths
const isRootDomain = window.location.hostname === BASE_DOMAIN || window.location.hostname === `www.${BASE_DOMAIN}`;
const API_BASE = isRootDomain ? '' : API;

export default function LandingPage() {
  useDocumentTitle('Welcome');
  const [showFinder, setShowFinder] = useState(false);
  const [slug, setSlug] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showFinder) setTimeout(() => inputRef.current?.focus(), 100);
  }, [showFinder]);

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
          // In production, redirect to the school's subdomain
          // In dev/preview, redirect to /login on the same host (middleware handles tenant via DEFAULT_TENANT_SLUG)
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
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-16 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/10 backdrop-blur border border-white/10 rounded-xl flex items-center justify-center">
            <Shield size={18} className="text-emerald-400" />
          </div>
          <span className="font-bold text-lg tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>WellTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFinder(true)}
            data-testid="nav-login-btn"
            className="px-5 py-2.5 text-sm font-semibold bg-white text-slate-900 rounded-full hover:bg-emerald-400 hover:text-slate-900 transition-all"
          >
            School Login
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 lg:px-16 pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-blue-500/6 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-emerald-400 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Multi-Tiered System of Supports
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Every student seen.{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              No one missed.
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            WellTrack helps schools identify students who need support before they fall through the cracks &mdash;
            using evidence-based SAEBRS screening, attendance analytics, and tiered intervention tracking.
          </p>
          <div className="flex items-center justify-center">
            <button
              onClick={() => setShowFinder(true)}
              data-testid="hero-login-btn"
              className="group px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl text-sm font-bold hover:bg-emerald-400 transition-all flex items-center gap-2.5 shadow-lg shadow-emerald-500/20"
            >
              <Search size={16} />
              Find Your School
              <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-16 py-20 bg-slate-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold text-center mb-3" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Built for Australian schools
          </h2>
          <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
            A complete wellbeing platform aligned to MTSS, SAEBRS, and Department of Education frameworks.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ClipboardCheck, title: 'Universal Screening', desc: 'SAEBRS and SAEBRS+ self-report screening with automated risk classification across social, academic, and emotional domains.', color: 'text-emerald-400 bg-emerald-500/10' },
              { icon: BarChart3, title: 'Data Analytics', desc: 'Real-time tier distribution, attendance trends, screening history, and class risk radar — all in one dashboard.', color: 'text-blue-400 bg-blue-500/10' },
              { icon: Target, title: 'Intervention Tracking', desc: 'Log, monitor, and review targeted and intensive interventions with case notes, progress tracking, and MTSS meeting prep.', color: 'text-amber-400 bg-amber-500/10' },
              { icon: Users, title: 'Multi-Tenant SaaS', desc: 'Each school gets its own isolated database and subdomain. Super Admins manage all schools from a central portal.', color: 'text-violet-400 bg-violet-500/10' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={20} />
                </div>
                <h3 className="font-bold text-white mb-2 text-sm">{title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-16 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold text-center mb-14" style={{ fontFamily: 'Manrope, sans-serif' }}>
            How WellTrack works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Screen', desc: 'Teachers complete SAEBRS rating scales. Students complete self-reports. Results are automatically scored and classified.' },
              { step: '02', title: 'Identify', desc: 'WellTrack calculates MTSS tiers using screening, attendance, and wellbeing data. At-risk students are surfaced instantly.' },
              { step: '03', title: 'Support', desc: 'Track interventions, log case notes, schedule appointments, and prepare for MTSS team meetings — all in one place.' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 text-sm font-bold">{step}</span>
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-16 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl lg:text-3xl font-bold mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Ready to get started?
          </h2>
          <p className="text-slate-400 mb-8">
            Contact your WellTrack administrator for school access, or log in to your school portal below.
          </p>
          <button
            onClick={() => setShowFinder(true)}
            data-testid="cta-login-btn"
            className="px-8 py-4 bg-emerald-500 text-slate-900 rounded-2xl text-sm font-bold hover:bg-emerald-400 transition-all inline-flex items-center gap-2"
          >
            <Search size={16} /> Find Your School
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 lg:px-16 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <Shield size={14} className="text-slate-600" />
            <span>&copy; {new Date().getFullYear()} WellTrack. All rights reserved.</span>
          </div>
          <p className="text-slate-600 text-xs">MTSS Wellbeing Platform for Australian Schools</p>
        </div>
      </footer>

      {/* School Finder Modal */}
      {showFinder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => { setShowFinder(false); setResult(null); setSlug(''); }}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-md p-8 relative"
            onClick={e => e.stopPropagation()}
            data-testid="school-finder-modal"
          >
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Find your school</h2>
            <p className="text-slate-400 text-sm mb-6">Enter your school's tag to access your portal.</p>

            <div className="relative mb-4">
              <input
                ref={inputRef}
                value={slug}
                onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="e.g. yourschool"
                data-testid="school-slug-input"
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-mono">.{BASE_DOMAIN}</span>
            </div>

            {result && result.exists && (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4 text-emerald-400 text-sm" data-testid="school-found-msg">
                <CheckCircle size={16} />
                <span>Found: <strong>{result.name}</strong> — redirecting...</span>
              </div>
            )}

            {result && !result.exists && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm" data-testid="school-not-found-msg">
                <XCircle size={16} />
                <span>No school found with that tag. Check with your administrator.</span>
              </div>
            )}

            <button
              onClick={handleLookup}
              disabled={!slug.trim() || checking}
              data-testid="school-finder-submit"
              className="w-full bg-emerald-500 text-slate-900 py-3.5 rounded-xl text-sm font-bold hover:bg-emerald-400 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
            >
              {checking ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {checking ? 'Checking...' : 'Go to School Portal'}
            </button>

            <p className="text-center text-slate-600 text-xs mt-4">
              Your school URL will be <strong className="text-slate-400">{slug || 'yourschool'}.{BASE_DOMAIN}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
