import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle, Users, Target, Bell, ArrowUpRight, ArrowDownRight, ArrowRight,
  CheckCircle, Stethoscope, Clock, AlertCircle, TrendingUp, ClipboardCheck,
  Calendar, Radar as RadarIcon, Users2,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import useDocumentTitle from '../hooks/useDocumentTitle';

// ── Small presentational helpers ─────────────────────────────────────────────

const TIER_VAR = {
  1: { soft: 'var(--wt-tier1-soft)', fg: 'var(--wt-tier1-foreground)', border: 'var(--wt-tier1-border)', dot: 'var(--wt-tier1)' },
  2: { soft: 'var(--wt-tier2-soft)', fg: 'var(--wt-tier2-foreground)', border: 'var(--wt-tier2-border)', dot: 'var(--wt-tier2)' },
  3: { soft: 'var(--wt-tier3-soft)', fg: 'var(--wt-tier3-foreground)', border: 'var(--wt-tier3-border)', dot: 'var(--wt-tier3)' },
};

const TierBadge = ({ tier }) => {
  const t = TIER_VAR[tier] || TIER_VAR[1];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: t.soft, color: t.fg, borderColor: t.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.dot }} />
      Tier {tier}
    </span>
  );
};

const Trend = ({ value, positiveIsGood = true }) => {
  if (value == null) return null;
  const up = value > 0;
  const isGood = positiveIsGood ? up : !up;
  const t = isGood ? TIER_VAR[1] : TIER_VAR[3];
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: t.soft, color: t.fg }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {up ? '+' : ''}{value}
    </span>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aptAlerts, setAptAlerts] = useState({ overdue: 0, approaching: 0, caseReview: 0, dna: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [tierRes, alertRes, studRes] = await Promise.all([
          api.get('/analytics/tier-distribution'),
          api.get('/alerts?resolved=false'),
          api.get('/students/summary'),
        ]);
        setStats(tierRes.data);
        const allAlerts = alertRes.data;
        setTotalAlerts(allAlerts.length);
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

  const pieData = [
    { name: 'Tier 1', value: tier1Count, color: 'var(--wt-tier1)' },
    { name: 'Tier 2', value: tier2Count, color: 'var(--wt-tier2)' },
    { name: 'Tier 3', value: tier3Count, color: 'var(--wt-tier3)' },
    { name: 'Unscreened', value: unscreened, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || '';
  const termLabel = (() => {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const term = month < 4 ? 1 : month < 7 ? 2 : month < 10 ? 3 : 4;
    const start = new Date(now.getFullYear(), [0, 4, 7, 10][term - 1], 1);
    const weekNum = Math.max(1, Math.ceil((now - start) / (7 * 86400000)));
    return `Term ${term} · Week ${weekNum}`;
  })();

  const showAptAlerts = (user?.appointment_access || user?.role === 'admin' || user?.role === 'professional') &&
                       (aptAlerts.overdue + aptAlerts.approaching + aptAlerts.caseReview + aptAlerts.dna) > 0;

  // KPI cards config
  const kpis = [
    {
      label: 'Total students', value: totalStudents, icon: Users,
      iconBg: 'var(--wt-surface-muted)', iconFg: 'var(--wt-foreground)',
      onClick: () => navigate('/students'),
      testid: 'stat-card-total-students',
    },
    {
      label: 'Tier 1 wellbeing', value: `${tier1Pct}%`, icon: TrendingUp,
      iconBg: 'var(--wt-tier1-soft)', iconFg: 'var(--wt-tier1-foreground)',
      onClick: () => navigate('/students', { state: { filterTier: '1' } }),
      testid: 'stat-card-tier-1',
    },
    {
      label: 'Tier 2 watch', value: tier2Count, icon: ClipboardCheck,
      iconBg: 'var(--wt-tier2-soft)', iconFg: 'var(--wt-tier2-foreground)',
      onClick: () => navigate('/students', { state: { filterTier: '2' } }),
      testid: 'stat-card-tier-2-students',
    },
    {
      label: 'Tier 3 active', value: tier3Count, icon: AlertTriangle,
      iconBg: 'var(--wt-tier3-soft)', iconFg: 'var(--wt-tier3-foreground)',
      onClick: () => navigate('/students', { state: { filterTier: '3' } }),
      testid: 'stat-card-tier-3-students',
    },
  ];

  const cardStyle = {
    backgroundColor: 'var(--wt-card)',
    borderColor: 'var(--wt-border)',
  };

  const quickActions = [
    { label: 'New Screening', desc: 'Start SAEBRS session', icon: ClipboardCheck, primary: true, action: () => navigate('/screening') },
    { label: 'Class Radar',   desc: 'View risk indicators',  icon: RadarIcon,       action: () => navigate('/radar') },
    { label: 'Add Intervention', desc: 'Create support plan', icon: Target,         action: () => navigate('/interventions') },
    { label: 'MTSS Meeting',  desc: 'Prep meeting report',    icon: Users2,          action: () => navigate('/meeting') },
  ];

  return (
    <div className="px-4 py-6 lg:px-8 lg:py-8 space-y-6 fade-in">
      {/* ── Hero greeting ─────────────────────────────────────────────────── */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="wt-mono-label text-[10px]" style={{ color: 'var(--wt-muted-fg)' }}>
            {termLabel}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
            {greeting}{firstName ? `, ${firstName}.` : '.'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--wt-muted-fg)' }}>
            Here's how your school is feeling this week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/analytics')}
            data-testid="dashboard-this-week-btn"
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: 'var(--wt-surface)', borderColor: 'var(--wt-border)', color: 'var(--wt-foreground)' }}
          >
            <Calendar size={14} /> This week
          </button>
          <button
            onClick={() => navigate('/screening')}
            data-testid="dashboard-new-screening-btn"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            New screening <ArrowUpRight size={14} />
          </button>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
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
                <p className="wt-mono-label text-[10px]" style={{ color: 'var(--wt-muted-fg)' }}>{k.label}</p>
                <p className="text-3xl font-semibold tabular-nums" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                  {k.value}
                </p>
              </div>
              <div
                className="rounded-xl p-2.5 shrink-0"
                style={{ backgroundColor: k.iconBg, color: k.iconFg }}
              >
                <k.icon size={16} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Appointment Alerts strip ──────────────────────────────────────── */}
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
              <button
                onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-overdue"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier3-soft)', color: 'var(--wt-tier3-foreground)', border: '1px solid var(--wt-tier3-border)' }}
              >
                <AlertCircle size={12} />
                {aptAlerts.overdue} Review{aptAlerts.overdue > 1 ? 's' : ''} Overdue
              </button>
            )}
            {aptAlerts.approaching > 0 && (
              <button
                onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-approaching"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier2-soft)', color: 'var(--wt-tier2-foreground)', border: '1px solid var(--wt-tier2-border)' }}
              >
                <Clock size={12} />
                {aptAlerts.approaching} Review{aptAlerts.approaching > 1 ? 's' : ''} Due Soon
              </button>
            )}
            {aptAlerts.caseReview > 0 && (
              <button
                onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-case-review"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors"
              >
                <Target size={12} />
                {aptAlerts.caseReview} Case Review Recommended
              </button>
            )}
            {aptAlerts.dna > 0 && (
              <button
                onClick={() => navigate('/alerts')}
                data-testid="apt-alert-dna"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: 'var(--wt-tier3-soft)', color: 'var(--wt-tier3-foreground)', border: '1px solid var(--wt-tier3-border)' }}
              >
                <AlertTriangle size={12} />
                {aptAlerts.dna} DNA Alert{aptAlerts.dna > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Main grid: Recent Alerts (2/3) + Tier Distribution (1/3) ──────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Alerts */}
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
              className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--wt-muted-fg)' }}
              data-testid="dashboard-view-all-alerts"
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
            <div className="divide-y" style={{ borderColor: 'var(--wt-border)' }}>
              {alerts.map(alert => {
                const alertTier = alert.severity === 'high' ? 3 : 2;
                const t = TIER_VAR[alertTier];
                return (
                  <div
                    key={alert.alert_id}
                    onClick={() => navigate(`/students/${alert.student_id}`)}
                    className="flex items-center justify-between gap-3 py-3 cursor-pointer -mx-2 px-2 rounded-lg hover:bg-black/5 transition-colors"
                    data-testid={`alert-item-${alert.alert_id}`}
                    style={{ borderColor: 'var(--wt-border)' }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.dot }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--wt-foreground)' }}>{alert.student_name}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--wt-muted-fg)' }}>{alert.message}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <TierBadge tier={alertTier} />
                      <span className="wt-mono-label text-[10px]" style={{ color: 'var(--wt-muted-fg)' }}>
                        {alert.class_name || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tier Distribution donut */}
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
              <p className="wt-mono-label text-[9px]" style={{ color: 'var(--wt-muted-fg)' }}>Tier 1</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {[
              { tier: 1, count: tier1Count },
              { tier: 2, count: tier2Count },
              { tier: 3, count: tier3Count },
            ].map(row => (
              <div key={row.tier} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIER_VAR[row.tier].dot }} />
                  <TierBadge tier={row.tier} />
                </div>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--wt-foreground)' }}>{row.count}</span>
              </div>
            ))}
            {unscreened > 0 && (
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-xs font-medium" style={{ color: 'var(--wt-muted-fg)' }}>Unscreened</span>
                </div>
                <span className="tabular-nums font-semibold" style={{ color: 'var(--wt-foreground)' }}>{unscreened}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Students Needing Attention (watchlist) + Quick Actions ────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Watchlist */}
        <div className="rounded-2xl border p-5 lg:col-span-2" style={cardStyle}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
                Students needing attention
              </h3>
              <p className="text-xs" style={{ color: 'var(--wt-muted-fg)' }}>Tier 2 & Tier 3 watchlist</p>
            </div>
            <button
              onClick={() => navigate('/students')}
              className="text-xs font-medium hover:opacity-80"
              style={{ color: 'var(--wt-muted-fg)' }}
              data-testid="dashboard-all-students"
            >
              All students
            </button>
          </div>
          {students.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--wt-muted-fg)' }}>
              All students are screened at Tier 1 or not yet screened.
            </p>
          ) : (
            <div className="space-y-1">
              {students.map(s => {
                const initials = `${(s.first_name?.[0] || '')}${(s.last_name?.[0] || '')}`.toUpperCase();
                const tierNum = s.mtss_tier || 1;
                const avatarBg = TIER_VAR[tierNum]?.soft || 'var(--wt-surface-muted)';
                const avatarFg = TIER_VAR[tierNum]?.fg || 'var(--wt-foreground)';
                return (
                  <div
                    key={s.student_id}
                    onClick={() => navigate(`/students/${s.student_id}`)}
                    className="flex items-center gap-3 rounded-xl p-2 cursor-pointer transition-colors hover:bg-black/5"
                    data-testid={`student-row-${s.student_id}`}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: avatarBg, color: avatarFg, fontFamily: 'Manrope, sans-serif' }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--wt-foreground)' }}>
                        {s.first_name} {s.last_name}
                      </p>
                      <p className="truncate text-xs" style={{ color: 'var(--wt-muted-fg)' }}>
                        {s.class_name}{s.attendance_pct != null ? ` · ${s.attendance_pct}% attendance` : ''}
                      </p>
                    </div>
                    <TierBadge tier={tierNum} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border p-5" style={cardStyle}>
          <h3 className="text-base font-semibold mb-3" style={{ fontFamily: 'Manrope, sans-serif', color: 'var(--wt-foreground)' }}>
            Quick actions
          </h3>
          <div className="space-y-2">
            {quickActions.map(qa => (
              <button
                key={qa.label}
                onClick={qa.action}
                data-testid={`quick-action-${qa.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all hover:shadow-sm active:scale-[0.99] ${
                  qa.primary ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border'
                }`}
                style={qa.primary ? {} : cardStyle}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${qa.primary ? 'bg-white/10' : ''}`}
                  style={qa.primary ? {} : { backgroundColor: 'var(--wt-surface-muted)', color: 'var(--wt-foreground)' }}
                >
                  <qa.icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>{qa.label}</p>
                  <p className={`text-xs ${qa.primary ? 'text-white/60' : ''}`} style={qa.primary ? {} : { color: 'var(--wt-muted-fg)' }}>{qa.desc}</p>
                </div>
                <ArrowRight size={14} className={qa.primary ? 'text-white/60' : ''} style={qa.primary ? {} : { color: 'var(--wt-muted-fg)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
