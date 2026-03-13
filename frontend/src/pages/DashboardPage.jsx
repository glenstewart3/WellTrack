import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { getTierColors } from '../utils/tierUtils';
import { AlertTriangle, Users, Target, Bell, TrendingUp, ArrowRight, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tierRes, alertRes, studRes] = await Promise.all([
          axios.get(`${API}/analytics/tier-distribution`, { withCredentials: true }),
          axios.get(`${API}/alerts?resolved=false`, { withCredentials: true }),
          axios.get(`${API}/students/summary`, { withCredentials: true }),
        ]);
        setStats(tierRes.data);
        setAlerts(alertRes.data.slice(0, 5));
        setStudents(studRes.data.filter(s => (s.mtss_tier || 0) >= 2).slice(0, 6));
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

  const unreadAlerts = alerts.filter(a => !a.is_read).length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 fade-in">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>
          Good morning, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-slate-500 mt-1">Here's your school's wellbeing overview for today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Students', value: stats?.total_students || 0, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50', action: () => navigate('/students') },
          { label: 'Tier 2 Students', value: tier.tier2 || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', action: () => navigate('/students') },
          { label: 'Tier 3 Students', value: tier.tier3 || 0, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', action: () => navigate('/students') },
          { label: 'Active Alerts', value: unreadAlerts, icon: Bell, color: 'text-indigo-600', bg: 'bg-indigo-50', action: () => navigate('/alerts') },
        ].map(card => (
          <button
            key={card.label}
            onClick={card.action}
            data-testid={`stat-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
            className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-slate-300 hover:shadow-sm transition-all duration-150 active:scale-[0.98]"
          >
            <div className={`w-9 h-9 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
              <card.icon size={18} className={card.color} />
            </div>
            <p className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{card.label}</p>
          </button>
        ))}
      </div>

      {/* Charts + Alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4" style={{fontFamily:'Manrope,sans-serif'}}>MTSS Tier Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({d.value})
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
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors ${!alert.is_read ? 'bg-rose-50/50' : ''}`}
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
          <div className="overflow-x-auto">
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                          Tier {s.mtss_tier}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.saebrs_risk === 'High Risk' ? 'bg-rose-100 text-rose-800' :
                          s.saebrs_risk === 'Some Risk' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'}`}>
                          {s.saebrs_risk}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`text-xs font-medium ${s.attendance_pct < 80 ? 'text-rose-600' : s.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {s.attendance_pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
