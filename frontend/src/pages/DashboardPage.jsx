import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { getTierColors } from '../utils/tierUtils';
import { AlertTriangle, Users, Target, Bell, TrendingUp, ArrowRight, CheckCircle, Stethoscope, Clock, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import useDocumentTitle from '../hooks/useDocumentTitle';

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

        // Load appointment alerts if user has access
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
      <div className="p-8 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl animate-pulse border border-slate-100" />)}
      </div>
    );
  }

  const tier = stats?.tier_distribution || {};
  const pieData = [
    { name: 'Tier 1', value: tier.tier1 || 0, color: '#10b981' },
    { name: 'Tier 2', value: tier.tier2 || 0, color: '#f59e0b' },
    { name: 'Tier 3', value: tier.tier3 || 0, color: '#f43f5e' },
    { name: 'Unscreened', value: tier.unscreened || 0, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">Here's your school's wellbeing overview for today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: stats?.total_students || 0, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', action: () => navigate('/students') },
          { label: 'Tier 2 Students', value: tier.tier2 || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', action: () => navigate('/students', { state: { filterTier: '2' } }) },
          { label: 'Tier 3 Students', value: tier.tier3 || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', action: () => navigate('/students', { state: { filterTier: '3' } }) },
          { label: 'Active Alerts', value: totalAlerts, icon: Bell, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', action: () => navigate('/alerts') },
        ].map(card => (
          <button
            key={card.label}
            onClick={card.action}
            data-testid={`stat-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`${card.bg} border ${card.border} rounded-xl p-5 text-left hover:shadow-md transition-all duration-150 active:scale-[0.98] group`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-4xl font-bold text-slate-900 leading-none" style={{fontFamily:'Manrope,sans-serif'}}>{card.value}</p>
                <p className="text-sm text-slate-500 mt-2 font-medium">{card.label}</p>
              </div>
              <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                <card.icon size={19} className={card.color} />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Appointment Alerts (only if user has appointment access) */}
      {(user?.appointment_access || user?.role === 'admin' || user?.role === 'professional') && (aptAlerts.overdue + aptAlerts.approaching + aptAlerts.caseReview + aptAlerts.dna) > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Appointment Alerts</h2>
            </div>
            <button onClick={() => navigate('/appointments')} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View <ArrowRight size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {aptAlerts.overdue > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-overdue"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium hover:bg-rose-100 transition-colors">
                <AlertCircle size={12} />
                {aptAlerts.overdue} Review{aptAlerts.overdue > 1 ? 's' : ''} Overdue
              </button>
            )}
            {aptAlerts.approaching > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-approaching"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
                <Clock size={12} />
                {aptAlerts.approaching} Review{aptAlerts.approaching > 1 ? 's' : ''} Due Soon
              </button>
            )}
            {aptAlerts.caseReview > 0 && (
              <button onClick={() => navigate('/appointments?tab=ongoing')}
                data-testid="apt-alert-case-review"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors">
                <Target size={12} />
                {aptAlerts.caseReview} Case Review Recommended
              </button>
            )}
            {aptAlerts.dna > 0 && (
              <button onClick={() => navigate('/alerts')}
                data-testid="apt-alert-dna"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors">
                <AlertTriangle size={12} />
                {aptAlerts.dna} DNA Alert{aptAlerts.dna > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Charts + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <h2 className="text-base font-semibold text-slate-900 mb-4 shrink-0" style={{fontFamily:'Manrope,sans-serif'}}>MTSS Tier Distribution</h2>
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 shrink-0">
            {pieData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                {d.name} <span className="font-semibold text-slate-800">({d.value})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Recent Alerts</h2>
            <button onClick={() => navigate('/alerts')} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <CheckCircle size={32} className="mb-2 text-emerald-400" />
              <p className="text-sm">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <div
                  key={alert.alert_id}
                  onClick={() => navigate(`/students/${alert.student_id}`)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${!alert.is_read ? 'bg-rose-50' : ''}`}
                  data-testid={`alert-item-${alert.alert_id}`}
                >
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${alert.severity === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{alert.student_name}</p>
                    <p className="text-xs text-slate-500 truncate">{alert.message}</p>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{alert.class_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Students needing attention */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Students Needing Attention</h2>
          <button onClick={() => navigate('/students')} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </button>
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">All students are screened at Tier 1 or not yet screened.</p>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden divide-y divide-slate-100 -mx-6">
              {students.map(s => {
                const colors = getTierColors(s.mtss_tier);
                return (
                  <div
                    key={s.student_id}
                    onClick={() => navigate(`/students/${s.student_id}`)}
                    className="flex items-center justify-between gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    data-testid={`student-row-${s.student_id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.class_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colors.badge}`}>
                        T{s.mtss_tier}
                      </span>
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        s.saebrs_risk === 'High Risk' ? 'bg-rose-100 text-rose-700' :
                        s.saebrs_risk === 'Some Risk' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'}`}>
                        {s.saebrs_risk === 'High Risk' ? 'High' : s.saebrs_risk === 'Some Risk' ? 'Some' : 'Low'}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${s.attendance_pct < 80 ? 'text-rose-600' : s.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {s.attendance_pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Class</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tier</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">SAEBRS Risk</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => {
                    const colors = getTierColors(s.mtss_tier);
                    return (
                      <tr
                        key={s.student_id}
                        onClick={() => navigate(`/students/${s.student_id}`)}
                        className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                        data-testid={`student-row-${s.student_id}`}
                      >
                        <td className="py-3 px-2 font-medium text-slate-900">{s.first_name} {s.last_name}</td>
                        <td className="py-3 px-2 text-slate-500">{s.class_name}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${colors.badge}`}>
                            Tier {s.mtss_tier}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            s.saebrs_risk === 'High Risk' ? 'bg-rose-100 text-rose-800' :
                            s.saebrs_risk === 'Some Risk' ? 'bg-amber-100 text-amber-800' :
                            'bg-emerald-100 text-emerald-800'}`}>
                            {s.saebrs_risk}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-sm font-medium tabular-nums ${s.attendance_pct < 80 ? 'text-rose-600' : s.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {s.attendance_pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'New Screening', desc: 'Start SAEBRS session', color: 'bg-slate-900 text-white', action: () => navigate('/screening') },
          { label: 'Class Radar', desc: 'View risk indicators', color: 'bg-white border border-slate-200 text-slate-900', action: () => navigate('/radar') },
          { label: 'Add Intervention', desc: 'Create support plan', color: 'bg-white border border-slate-200 text-slate-900', action: () => navigate('/interventions') },
          { label: 'MTSS Meeting', desc: 'Prep meeting report', color: 'bg-white border border-slate-200 text-slate-900', action: () => navigate('/meeting') },
        ].map(item => (
          <button
            key={item.label}
            onClick={item.action}
            data-testid={`quick-action-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={`${item.color} rounded-xl p-4 text-left hover:shadow-sm transition-all duration-150 active:scale-[0.98]`}
          >
            <p className="text-sm font-semibold" style={{fontFamily:'Manrope,sans-serif'}}>{item.label}</p>
            <p className={`text-xs mt-0.5 ${item.color.includes('slate-900') ? 'text-white/60' : 'text-slate-500'}`}>{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
