import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, CheckCircle, AlertTriangle, Filter } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ALERT_TYPE_LABELS = {
  high_risk_saebrs: 'High Risk SAEBRS',
  low_attendance_80: 'Critical Attendance (<80%)',
  low_attendance_90: 'Low Attendance (<90%)',
  emotional_distress: 'Emotional Distress',
  rapid_decline: 'Rapid Score Decline',
};

const ALERT_TYPE_COLORS = {
  high_risk_saebrs: 'bg-rose-100 text-rose-700 border-rose-200',
  low_attendance_80: 'bg-rose-100 text-rose-700 border-rose-200',
  low_attendance_90: 'bg-amber-100 text-amber-700 border-amber-200',
  emotional_distress: 'bg-purple-100 text-purple-700 border-purple-200',
  rapid_decline: 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const load = async (resolved = false) => {
    try {
      const res = await axios.get(`${API}/alerts?resolved=${resolved}`, { withCredentials: true });
      setAlerts(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(showResolved); }, [showResolved]);

  const markRead = async (id) => {
    await axios.put(`${API}/alerts/${id}/read`, {}, { withCredentials: true });
    setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, is_read: true } : a));
  };

  const resolve = async (id) => {
    await axios.put(`${API}/alerts/${id}/resolve`, {}, { withCredentials: true });
    setAlerts(prev => prev.filter(a => a.alert_id !== id));
  };

  const markAllRead = async () => {
    await axios.put(`${API}/alerts/read-all`, {}, { withCredentials: true });
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  };

  const filtered = alerts.filter(a => {
    const matchType = !filterType || a.alert_type === filterType;
    const matchSev = !filterSeverity || a.severity === filterSeverity;
    return matchType && matchSev;
  });

  const unread = alerts.filter(a => !a.is_read).length;
  const alertTypes = [...new Set(alerts.map(a => a.alert_type))];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Bell size={28} className="text-slate-600" /> Early Warning Alerts
          </h1>
          <p className="text-slate-500 mt-1">
            {unread > 0 ? <span className="text-rose-600 font-medium">{unread} unread alert{unread > 1 ? 's' : ''}</span> : 'All alerts read'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} data-testid="mark-all-read-btn"
              className="px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors">
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setShowResolved(false)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${!showResolved ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Active
          </button>
          <button onClick={() => setShowResolved(true)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${showResolved ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Resolved
          </button>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
          <option value="">All Types</option>
          {alertTypes.map(t => <option key={t} value={t}>{ALERT_TYPE_LABELS[t] || t}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white">
          <option value="">All Severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
        </select>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Active', value: alerts.length, color: 'text-slate-900' },
          { label: 'High Severity', value: alerts.filter(a => a.severity === 'high').length, color: 'text-rose-600' },
          { label: 'Unread', value: unread, color: 'text-amber-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`} style={{fontFamily:'Manrope,sans-serif'}}>{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-slate-600">No alerts found</p>
            <p className="text-sm text-slate-400 mt-1">All clear — no active warnings at this time</p>
          </div>
        ) : (
          filtered.map(alert => (
            <div
              key={alert.alert_id}
              data-testid={`alert-card-${alert.alert_id}`}
              className={`bg-white border rounded-xl p-4 transition-all ${!alert.is_read ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-lg ${alert.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                  <AlertTriangle size={14} className={alert.severity === 'high' ? 'text-rose-600' : 'text-amber-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <button
                      onClick={() => navigate(`/students/${alert.student_id}`)}
                      className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-sm"
                    >
                      {alert.student_name}
                    </button>
                    <span className="text-xs text-slate-400">{alert.class_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ALERT_TYPE_COLORS[alert.alert_type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                    </span>
                    {!alert.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-600">{alert.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{alert.created_at?.split('T')[0]}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {!alert.is_read && (
                    <button onClick={() => markRead(alert.alert_id)}
                      className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                      Mark Read
                    </button>
                  )}
                  {!showResolved && (
                    <button onClick={() => resolve(alert.alert_id)}
                      className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors">
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
