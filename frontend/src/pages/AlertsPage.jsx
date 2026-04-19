import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Bell, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, ThumbsUp, ThumbsDown, ArrowRight } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

const ALERT_TYPE_LABELS = {
  high_risk_saebrs: 'High Risk SAEBRS',
  tier_change: 'Tier Change',
  emotional_distress: 'Emotional Distress',
  low_attendance_80: 'Critical Attendance',
  low_attendance_90: 'Low Attendance',
  rapid_decline: 'Rapid Score Decline',
};

const ALERT_TYPE_COLORS = {
  high_risk_saebrs: 'bg-rose-100 text-rose-700 border-rose-200',
  emotional_distress: 'bg-purple-100 text-purple-700 border-purple-200',
  low_attendance_80: 'bg-rose-100 text-rose-700 border-rose-200',
  low_attendance_90: 'bg-amber-100 text-amber-700 border-amber-200',
  rapid_decline: 'bg-orange-100 text-orange-700 border-orange-200',
};

function AlertCard({ alert, canApprove, showResolved, onMarkRead, onResolve, onApprove, onReject, onClick }) {
  const showApprove = alert.alert_type === 'tier_change' && alert.status === 'pending' && canApprove;
  const showMarkRead = !alert.is_read;
  const showResolve = !showResolved && alert.status !== 'pending';
  const hasActions = showApprove || showMarkRead || showResolve;
  return (
    <div
      data-testid={`alert-card-${alert.alert_id}`}
      className={`bg-white border rounded-xl p-4 transition-all cursor-pointer hover:shadow-sm ${!alert.is_read ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${alert.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'}`}>
          <AlertTriangle size={14} className={alert.severity === 'high' ? 'text-rose-600' : 'text-amber-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900 text-sm">{alert.student_name}</span>
            <span className="text-xs text-slate-400">{alert.class_name}</span>
            {alert.alert_type && alert.alert_type !== 'tier_change' && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ALERT_TYPE_COLORS[alert.alert_type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
              </span>
            )}
            {!alert.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
          </div>
          <p className="text-sm text-slate-600">{alert.message}</p>
          <p className="text-xs text-slate-400 mt-1">{alert.created_at?.split('T')[0]}</p>
          {hasActions && (
            <div className="flex flex-wrap gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
              {showApprove && (
                <>
                  <button onClick={() => onApprove(alert.alert_id)} data-testid={`approve-tier-${alert.alert_id}`}
                    className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                    <ThumbsUp size={11} /> Approve
                  </button>
                  <button onClick={() => onReject(alert.alert_id)} data-testid={`reject-tier-${alert.alert_id}`}
                    className="text-xs px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1">
                    <ThumbsDown size={11} /> Reject
                  </button>
                </>
              )}
              {showMarkRead && (
                <button onClick={() => onMarkRead(alert.alert_id)}
                  className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                  Mark Read
                </button>
              )}
              {showResolve && (
                <button onClick={() => onResolve(alert.alert_id)}
                  className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors">
                  Resolve
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  useDocumentTitle('Alerts');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canDo } = usePermissions();
  const role = user?.role || '';
  const canApprove = user?.role === 'admin' || canDo('alerts.approve');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [activeTab, setActiveTab] = useState('early_warning');

  const load = async (resolved = false) => {
    try {
      const res = await api.get(`/alerts?resolved=${resolved}`);
      setAlerts(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(showResolved); }, [showResolved]);

  const markRead = async (id) => {
    await api.put(`/alerts/${id}/read`, {});
    setAlerts(prev => prev.map(a => a.alert_id === id ? { ...a, is_read: true } : a));
  };

  const resolve = async (id) => {
    await api.put(`/alerts/${id}/resolve`, {});
    setAlerts(prev => prev.filter(a => a.alert_id !== id));
  };

  const approveAlert = async (id) => {
    await api.put(`/alerts/${id}/approve`, {});
    setAlerts(prev => prev.filter(a => a.alert_id !== id));
  };

  const rejectAlert = async (id) => {
    await api.put(`/alerts/${id}/reject`, {});
    setAlerts(prev => prev.filter(a => a.alert_id !== id));
  };

  const markAllRead = async () => {
    await api.put('/alerts/read-all', {});
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  };

  // Separate alerts by type
  const earlyWarnings = alerts.filter(a => a.type === 'early_warning' || (!a.type && a.alert_type !== 'tier_change'));
  const tierChanges = alerts.filter(a => a.type === 'tier_change' || a.alert_type === 'tier_change');
  const activeList = activeTab === 'early_warning' ? earlyWarnings : tierChanges;

  const unread = alerts.filter(a => !a.is_read).length;
  const unreadEW = earlyWarnings.filter(a => !a.is_read).length;
  const unreadTC = tierChanges.filter(a => !a.is_read).length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Bell size={28} className="text-slate-600" /> Alerts
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Early Warnings', value: earlyWarnings.length, color: 'text-amber-600' },
          { label: 'Tier Changes', value: tierChanges.length, color: 'text-indigo-600' },
          { label: 'Unread', value: unread, color: 'text-rose-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`} style={{fontFamily:'Manrope,sans-serif'}}>{stat.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden border-b border-slate-200 mb-0 -mx-6 px-6 sm:mx-0 sm:px-0">
        {[
          { key: 'early_warning', label: 'Early Warnings', short: 'Warnings', count: unreadEW, Icon: AlertTriangle },
          { key: 'tier_change', label: 'Tier Changes', short: 'Tier Chg', count: unreadTC, Icon: TrendingUp },
        ].map(({ key, label, short, count, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} data-testid={`alerts-tab-${key}`}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            {count > 0 && <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold shrink-0">{count}</span>}
          </button>
        ))}
      </div>
      {/* Active/Resolved toggle */}
      <div className="flex items-center justify-end mb-5 mt-3">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setShowResolved(false)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${!showResolved ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Active
          </button>
          <button onClick={() => setShowResolved(true)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${showResolved ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Resolved
          </button>
        </div>
      </div>

      {/* Tier Changes special layout */}
      {activeTab === 'tier_change' && (
        <div className="space-y-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
          ) : tierChanges.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
              <TrendingUp size={40} className="mx-auto mb-3 text-indigo-300" />
              <p className="font-medium text-slate-600">No tier changes</p>
              <p className="text-sm text-slate-400 mt-1">No tier change alerts at this time</p>
            </div>
          ) : (
            tierChanges.map(alert => (
              <div key={alert.alert_id} data-testid={`alert-card-${alert.alert_id}`}
                className={`bg-white border rounded-xl p-4 transition-all ${!alert.is_read ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${(alert.to_tier || 3) > (alert.from_tier || 1) ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                    {(alert.to_tier || 3) > (alert.from_tier || 1)
                      ? <TrendingDown size={14} className="text-rose-600" />
                      : <TrendingUp size={14} className="text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button onClick={() => navigate(`/students/${alert.student_id}`)}
                        className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-sm">
                        {alert.student_name}
                      </button>
                      <span className="text-xs text-slate-400">{alert.class_name}</span>
                      {alert.from_tier && alert.to_tier && (
                        <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                          Tier {alert.from_tier} <ArrowRight size={10} /> Tier {alert.to_tier}
                          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${alert.to_tier > alert.from_tier ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {alert.to_tier > alert.from_tier ? 'Declined' : 'Improved'}
                          </span>
                        </span>
                      )}
                      {!alert.is_read && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />}
                    </div>
                    <p className="text-sm text-slate-600">{alert.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{alert.created_at?.split('T')[0]}</p>
                    {(alert.status === 'pending' && canApprove || !alert.is_read) && (
                      <div className="flex flex-wrap gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                        {alert.status === 'pending' && canApprove && (
                          <>
                            <button onClick={() => approveAlert(alert.alert_id)} data-testid={`approve-tier-${alert.alert_id}`}
                              className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                              <ThumbsUp size={11} /> Approve
                            </button>
                            <button onClick={() => rejectAlert(alert.alert_id)} data-testid={`reject-tier-${alert.alert_id}`}
                              className="text-xs px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1">
                              <ThumbsDown size={11} /> Reject
                            </button>
                          </>
                        )}
                        {!alert.is_read && (
                          <button onClick={() => markRead(alert.alert_id)}
                            className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                            Mark Read
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Early warnings list */}
      {activeTab === 'early_warning' && (
        <div className="space-y-3">
          {loading ? (
            [1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
          ) : earlyWarnings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
              <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-medium text-slate-600">No early warnings</p>
              <p className="text-sm text-slate-400 mt-1">All clear — no active early warnings at this time</p>
            </div>
          ) : (
            earlyWarnings.map(alert => (
              <AlertCard key={alert.alert_id} alert={alert} canApprove={canApprove} showResolved={showResolved}
                onMarkRead={markRead} onResolve={resolve} onApprove={approveAlert} onReject={rejectAlert}
                onClick={() => navigate(`/students/${alert.student_id}`)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
