import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Users, Target, ArrowUpRight, ArrowDownRight, ArrowRight,
  CheckCircle, Stethoscope, Clock, AlertCircle, TrendingUp, ClipboardCheck, Calendar,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import useDocumentTitle from '../hooks/useDocumentTitle';

// Tier CSS-var palette
const TIER_VAR = {
  1: { solid: 'var(--wt-tier1)', soft: 'var(--wt-tier1-soft)', fg: 'var(--wt-tier1-foreground)', border: 'var(--wt-tier1-border)' },
  2: { solid: 'var(--wt-tier2)', soft: 'var(--wt-tier2-soft)', fg: 'var(--wt-tier2-foreground)', border: 'var(--wt-tier2-border)' },
  3: { solid: 'var(--wt-tier3)', soft: 'var(--wt-tier3-soft)', fg: 'var(--wt-tier3-foreground)', border: 'var(--wt-tier3-border)' },
};

const TierBadge = ({ tier }) => {
  const t = TIER_VAR[tier] || TIER_VAR[1];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: t.soft, color: t.fg, borderColor: t.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.solid }} />
      Tier {tier}
    </span>
  );
};

const TrendChip = ({ delta, suffix = '', positiveIsGood = true }) => {
  if (delta == null || delta === 0) return <span className="wt-mono-label text-[10px]" style={{ color: 'var(--wt-muted-fg)' }}>—</span>;
  const up = delta > 0;
  const isGood = positiveIsGood ? up : !up;
  const t = isGood ? TIER_VAR[1] : TIER_VAR[3];
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: t.soft, color: t.fg }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {up ? '+' : ''}{delta}{suffix}
    </span>
  );
};

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [movement, setMovement] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aptAlerts, setAptAlerts] = useState({ overdue: 0, approaching: 0, caseReview: 0, dna: 0 });
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const [tierRes, moveRes, alertRes, studRes, termsRes] = await Promise.all([
          api.get('/analytics/tier-distribution'),
          api.get('/analytics/tier-movement?limit=8'),
          api.get('/alerts?resolved=false'),
          api.get('/students/summary'),
          api.get(`/settings/terms?year=${currentYear}`).catch(() => ({ data: { terms: [] } })),
        ]);
        setStats(tierRes.data);
        setMovement(moveRes.data);
        setTerms(termsRes.data?.terms || []);
        const allAlerts = alertRes.data;
        setAlerts(allAlerts.slice(0, 5));
        setStudents(studRes.data.filter(s => (s.mtss_tier || 0) >= 2).slice(0, 6));

        if (user?.appointment_access || user?.role === 'admin' || user?.role === 'professional') {
          try {
            const ongoingRes = await api.get('/appointments/ongoing');
            const ongoing = ongoingRes.data || [];
            const today = new Date().toISOString().split('T')[0];
            const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
            setAptAlerts({
              overdue:     ongoing.filter(i => i.review_overdue).length,
              approaching: ongoing.filter(i => {
                const rd = i.review_date;
                return rd && rd > today && rd <= in7days;
              }).length,
              caseReview:  ongoing.filter(i => i.case_review_recommended).length,
              dna:         allAlerts.filter(a => a.alert_type === 'dna_consecutive' && a.status !== 'resolved').length,
            });
          } catch { /* appointments access may not be enabled */ }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--wt-surface-muted)' }} />)}
      </div>
    );
  }

  const tier = stats?.tier_distribution || {};
  const totalStudents = stats?.total_students || 0;
  const tier1Count = tier.tier1 || 0;
  const tier2Count = tier.tier2 || 0;
  const tier3Count = tier.tier3 || 0;
  const unscreened = tier.unscreened || 0;
  const screenedTotal = tier1Count + tier2Count + tier3Count;
  const tier1Pct = screenedTotal ? Math.round((tier1Count / screenedTotal) * 100) : 0;

  // Week-over-week deltas
  const curr = movement?.current;
  const prev = movement?.previous;
  const delta = (k) => (curr && prev ? (curr[k] || 0) - (prev[k] || 0) : null);

  const pieData = [
    { name: 'Tier 1', value: tier1Count, color: 'var(--wt-tier1)' },
    { name: 'Tier 2', value: tier2Count, color: 'var(--wt-tier2)' },
    { name: 'Tier 3', value: tier3Count, color: 'var(--wt-tier3)' },
    { name: 'Unscreened', value: unscreened, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  // Format movement for chart (one point per screening event)
  const movementData = (movement?.events || []).map(e => ({
    label: e.label,
    tier1: e.tier1,
    tier2: e.tier2,
    tier3: e.tier3,
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || '';
  const termLabel = (() => {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const today = new Date(todayStr + 'T00:00:00');
    // Find the term that contains today
    const active = (terms || []).find(t =>
      t.start_date && t.end_date && todayStr >= t.start_date && todayStr <= t.end_date
    );
    if (!active) {
      // If terms are configured but today is outside them → School Holidays
      const anyTerm = (terms || []).some(t => t.start_date && t.end_date);
      if (anyTerm) return 'School Holidays';
      // No terms configured at all → show friendly date
      return new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    const start = new Date(active.start_date + 'T00:00:00');
    const diffDays = Math.floor((today - start) / (24 * 3600 * 1000));
    const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
    // Extract term number from name ("Term 1", "Term 2: ...") or fallback
    const match = (active.name || '').match(/Term\s*(\d+)/i);
    const termNum = match ? match[1] : '';
    return termNum ? `Term ${termNum} · Week ${weekNum}` : `Week ${weekNum}`;
  })();

  const showAptAlerts = (user?.appointment_access || user?.role === 'admin' || user?.role === 'professional') &&
                       (aptAlerts.overdue + aptAlerts.approaching + aptAlerts.caseReview + aptAlerts.dna) > 0;

  const kpis = [
    {
      label: 'Total students', value: totalStudents, icon: Users,
      iconBg: 'var(--wt-surface-muted)', iconFg: 'var(--wt-foreground)',
      delta: null, suffix: '',
      onClick: () => navigate('/students'),
      testid: 'stat-card-total-students',
    },
    {
      label: 'Tier 1', value: tier1Count, icon: TrendingUp,
      iconBg: 'var(--wt-tier1-soft)', iconFg: 'var(--wt-tier1-foreground)',
      delta: delta('tier1'), suffix: '', positiveIsGood: true,
      onClick: () => navigate('/students', { state: { filterTier: '1' } }),
      testid: 'stat-card-tier-1',
    },
    {
      label: 'Tier 2', value: tier2Count, icon: ClipboardCheck,
      iconBg: 'var(--wt-tier2-soft)', iconFg: 'var(--wt-tier2-foreground)',
      delta: delta('tier2'), suffix: '', positiveIsGood: false,
      onClick: () => navigate('/students', { state: { filterTier: '2' } }),
      testid: 'stat-card-tier-2-students',
    },
    {
      label: 'Tier 3', value: tier3Count, icon: AlertTriangle,
      iconBg: 'var(--wt-tier3-soft)', iconFg: 'var(--wt-tier3-foreground)',
      delta: delta('tier3'), suffix: '', positiveIsGood: false,
      onClick: () => navigate('/students', { state: { filterTier: '3' } }),
      testid: 'stat-card-tier-3-students',
    },
  ];

  const cardStyle = { backgroundColor: 'var(--wt-card)', borderColor: 'var(--wt-border)' };

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 space-y-6 fade-in">
      {/* ── Hero greeting ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">{termLabel}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)', fontWeight: 800 }}>
            {greeting}{firstName ? `, ${firstName}.` : '.'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A snapshot of your school's wellbeing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/screening')}
            data-testid="dashboard-new-screening-btn"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            New screening <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <button
            key={k.label}
            onClick={k.onClick}
            data-testid={k.testid}
            className="group relative overflow-hidden rounded-2xl border p-5 text-left transition-all hover:shadow-sm active:scale-[0.99]"
            style={cardStyle}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-3xl font-bold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                  {k.value}
                </p>
                <p className="text-sm font-medium text-slate-700">{k.label}</p>
              </div>
              <div className="rounded-xl p-2.5 shrink-0" style={{ backgroundColor: k.iconBg, color: k.iconFg }}>
                <k.icon size={16} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <TrendChip delta={k.delta} suffix={k.suffix} positiveIsGood={k.positiveIsGood !== false} />
              <span className="text-xs text-slate-400">vs last screening</span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Appointment Alerts strip ──────────────────────────────────── */}
      {showAptAlerts && (
        <div className="rounded-2xl border p-5" style={cardStyle}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} style={{ color: 'var(--wt-muted-fg)' }} />
              <h2 className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                Appointment Alerts
              </h2>
            </div>
            <button
              onClick={() => navigate('/appointments')}
              className="text-xs font-medium hover:opacity-80 flex items-center gap-1"
              style={{ color: 'var(--wt-muted-fg)' }}
            >
              View <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {aptAlerts.overdue > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')} data-testid="apt-alert-overdue"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier3-soft)', color: 'var(--wt-tier3-foreground)', border: '1px solid var(--wt-tier3-border)' }}>
                <AlertCircle size={12} /> {aptAlerts.overdue} Review{aptAlerts.overdue > 1 ? 's' : ''} Overdue
              </button>
            )}
            {aptAlerts.approaching > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')} data-testid="apt-alert-approaching"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier2-soft)', color: 'var(--wt-tier2-foreground)', border: '1px solid var(--wt-tier2-border)' }}>
                <Clock size={12} /> {aptAlerts.approaching} Review{aptAlerts.approaching > 1 ? 's' : ''} Due Soon
              </button>
            )}
            {aptAlerts.caseReview > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')} data-testid="apt-alert-case-review"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors">
                <Target size={12} /> {aptAlerts.caseReview} Case Review Recommended
              </button>
            )}
            {aptAlerts.dna > 0 && (
              <button onClick={() => navigate('/alerts')} data-testid="apt-alert-dna"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier3-soft)', color: 'var(--wt-tier3-foreground)', border: '1px solid var(--wt-tier3-border)' }}>
                <AlertTriangle size={12} /> {aptAlerts.dna} DNA Alert{aptAlerts.dna > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tier Movement (2/3) + Tier Distribution donut (1/3) ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border p-5 lg:col-span-2" style={cardStyle}>
          <div className="mb-4 flex items-start justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                Tier movement
              </h3>
              <p className="text-xs" style={{ color: 'var(--wt-muted-fg)' }}>
                Share of students by tier · last {movementData.length || 8} screenings
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--wt-muted-fg)' }}>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--wt-tier1)' }} /> Tier 1</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--wt-tier2)' }} /> Tier 2</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--wt-tier3)' }} /> Tier 3</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={movementData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fill-tier1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--wt-tier1)" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="var(--wt-tier1)" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="fill-tier2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--wt-tier2)" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="var(--wt-tier2)" stopOpacity="0.05" />
                  </linearGradient>
                  <linearGradient id="fill-tier3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--wt-tier3)" stopOpacity="0.30" />
                    <stop offset="100%" stopColor="var(--wt-tier3)" stopOpacity="0.05" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--wt-border)" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--wt-muted-fg)' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--wt-muted-fg)' }} width={32} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--wt-border)', fontSize: '12px', backgroundColor: 'var(--wt-card)' }}
                />
                <Area type="monotone" dataKey="tier1" stroke="var(--wt-tier1)" strokeWidth={2} fill="url(#fill-tier1)" />
                <Area type="monotone" dataKey="tier2" stroke="var(--wt-tier2)" strokeWidth={2} fill="url(#fill-tier2)" />
                <Area type="monotone" dataKey="tier3" stroke="var(--wt-tier3)" strokeWidth={2} fill="url(#fill-tier3)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border p-5" style={cardStyle}>
          <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
            Tier distribution
          </h3>
          <p className="text-xs" style={{ color: 'var(--wt-muted-fg)' }}>
            Across {totalStudents} student{totalStudents === 1 ? '' : 's'}
          </p>
          <div className="relative mx-auto mt-2 h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [v, name]}
                  contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--wt-border)', fontSize: '12px', backgroundColor: 'var(--wt-card)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>{tier1Pct}%</p>
              <p className="text-xs font-medium text-slate-500">Tier 1</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { tier: 1, count: tier1Count },
              { tier: 2, count: tier2Count },
              { tier: 3, count: tier3Count },
            ].map(row => (
              <div key={row.tier} className="flex items-center justify-between text-xs">
                <TierBadge tier={row.tier} />
                <span className="tabular-nums font-semibold" style={{ color: 'var(--wt-foreground)' }}>{row.count}</span>
              </div>
            ))}
            {unscreened > 0 && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-xs font-medium" style={{ color: 'var(--wt-muted-fg)' }}>Unscreened</span>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--wt-foreground)' }}>{unscreened}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Alerts (2/3) + Watchlist (1/3) ─────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border p-5 lg:col-span-2" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                Recent alerts
              </h3>
              <p className="text-xs" style={{ color: 'var(--wt-muted-fg)' }}>Needs attention this week</p>
            </div>
            <button
              onClick={() => navigate('/alerts')}
              data-testid="dashboard-view-all-alerts"
              className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--wt-muted-fg)' }}
            >
              View all
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10" style={{ color: 'var(--wt-muted-fg)' }}>
              <CheckCircle size={32} className="mb-2" style={{ color: 'var(--wt-tier1)' }} />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            <div>
              {alerts.map((alert, idx) => {
                const alertTier = alert.severity === 'high' ? 3 : 2;
                const t = TIER_VAR[alertTier];
                return (
                  <div
                    key={alert.alert_id}
                    onClick={() => navigate(`/students/${alert.student_id}`)}
                    data-testid={`alert-item-${alert.alert_id}`}
                    className="flex items-center justify-between gap-3 py-3 cursor-pointer transition-colors hover:opacity-80"
                    style={idx > 0 ? { borderTop: '1px solid var(--wt-border)' } : {}}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.solid }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--wt-foreground)' }}>{alert.student_name}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--wt-muted-fg)' }}>{alert.message}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <TierBadge tier={alertTier} />
                      {alert.class_name && (
                        <span className="text-xs font-medium" style={{ color: 'var(--wt-muted-fg)' }}>
                          {alert.class_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Watchlist — Lovable style: avatar, name, Year · Class, tier badge */}
        <div className="rounded-2xl border p-5" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
              Watchlist
            </h3>
            <button
              onClick={() => navigate('/students')}
              data-testid="dashboard-all-students"
              className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--wt-muted-fg)' }}
            >
              All students
            </button>
          </div>
          {students.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--wt-muted-fg)' }}>
              No students on the watchlist.
            </p>
          ) : (
            <div className="space-y-3">
              {students.map(s => {
                const initials = `${(s.first_name?.[0] || '')}${(s.last_name?.[0] || '')}`.toUpperCase();
                const tierNum = s.mtss_tier || 1;
                const avatarBg = TIER_VAR[tierNum]?.soft || 'var(--wt-surface-muted)';
                const avatarFg = TIER_VAR[tierNum]?.fg || 'var(--wt-foreground)';
                return (
                  <button
                    key={s.student_id}
                    onClick={() => navigate(`/students/${s.student_id}`)}
                    data-testid={`student-row-${s.student_id}`}
                    className="flex w-full items-center gap-3 rounded-xl p-2 -m-2 text-left transition-colors hover:bg-black/5"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: avatarBg, color: avatarFg, fontFamily: 'Manrope, sans-serif' }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--wt-foreground)' }}>
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--wt-muted-fg)' }}>
                        {s.year_level ? `Year ${s.year_level}` : ''}{s.year_level && s.class_name ? ' · ' : ''}{s.class_name || ''}
                      </p>
                    </div>
                    <TierBadge tier={tierNum} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
