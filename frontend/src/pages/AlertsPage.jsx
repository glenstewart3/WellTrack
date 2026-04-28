import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  Bell, CheckCircle, AlertTriangle, TrendingUp, TrendingDown,
  ThumbsUp, ThumbsDown, ArrowRight, Filter, ChevronRight, User
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { timeAgo } from '../utils/dateFmt';

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

const SEVERITY_COLORS = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

// ── Sort helper: newest first ────────────────────────────────────────────────
function sortByDate(list) {
  return [...list].sort((a, b) => {
    const da = a.created_at || '';
    const db = b.created_at || '';
    return db.localeCompare(da);
  });
}

// ── Group alerts by student ──────────────────────────────────────────────────
function groupByStudent(list) {
  const map = new Map();
  for (const a of list) {
    const key = a.student_id || a.student_name;
    if (!map.has(key)) {
      map.set(key, { student_id: a.student_id, student_name: a.student_name, class_name: a.class_name, alerts: [] });
    }
    map.get(key).alerts.push(a);
  }
  // Sort groups: students with unread alerts first, then by most recent alert
  return [...map.values()].sort((a, b) => {
    const aUnread = a.alerts.some(x => !x.is_read) ? 1 : 0;
    const bUnread = b.alerts.some(x => !x.is_read) ? 1 : 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    const aDate = a.alerts[0]?.created_at || '';
    const bDate = b.alerts[0]?.created_at || '';
    return bDate.localeCompare(aDate);
  });
}

// ── Single alert row ─────────────────────────────────────────────────────────
function AlertRow({ alert, canApprove, showResolved, onMarkRead, onResolve, onApprove, onReject, compact }) {
  const showApproveBtn = alert.alert_type === 'tier_change' && alert.status === 'pending' && canApprove;
  const showMarkRead = !alert.is_read;
  const showResolve = !showResolved && alert.status !== 'pending';
  const isTierChange = alert.alert_type === 'tier_change';

  return (
    <div className={`flex items-start gap-3 ${compact ? 'py-2.5' : 'py-3'}`}>
      <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
        isTierChange
          ? (alert.to_tier || 3) > (alert.from_tier || 1) ? 'bg-rose-100' : 'bg-emerald-100'
          : alert.severity === 'high' ? 'bg-rose-100' : 'bg-amber-100'
      }`}>
        {isTierChange
          ? (alert.to_tier || 3) > (alert.from_tier || 1)
            ? <TrendingDown size={13} className="text-rose-600" />
            : <TrendingUp size={13} className="text-emerald-600" />
          : <AlertTriangle size={13} className={alert.severity === 'high' ? 'text-rose-600' : 'text-amber-600'} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          {alert.alert_type && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${ALERT_TYPE_COLORS[alert.alert_type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
            </span>
          )}
          {isTierChange && alert.from_tier && alert.to_tier && (
            <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
              Tier {alert.from_tier} <ArrowRight size={9} /> Tier {alert.to_tier}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${alert.to_tier > alert.from_tier ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {alert.to_tier > alert.from_tier ? 'Declined' : 'Improved'}
              </span>
            </span>
          )}
          {alert.severity && !isTierChange && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low}`}>
              {alert.severity}
            </span>
          )}
          {!alert.is_read && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
          <span className="text-[11px] text-slate-400 ml-auto shrink-0">{timeAgo(alert.created_at)}</span>
        </div>
        <p className="text-sm text-slate-600 leading-snug">{alert.message}</p>
        {(showApproveBtn || showMarkRead || showResolve) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {showApproveBtn && (
              <>
                <button onClick={(e) => { e.stopPropagation(); onApprove(alert.alert_id); }} data-testid={`approve-tier-${alert.alert_id}`}
                  className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1">
                  <ThumbsUp size={11} /> Approve
                </button>
                <button onClick={(e) => { e.stopPropagation(); onReject(alert.alert_id); }} data-testid={`reject-tier-${alert.alert_id}`}
                  className="text-xs px-2.5 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-1">
                  <ThumbsDown size={11} /> Reject
                </button>
              </>
            )}
            {showMarkRead && (
              <button onClick={(e) => { e.stopPropagation(); onMarkRead(alert.alert_id); }}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                Mark Read
              </button>
            )}
            {showResolve && (
              <button onClick={(e) => { e.stopPropagation(); onResolve(alert.alert_id); }}
                className="text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-100 transition-colors">
                Resolve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student group card ───────────────────────────────────────────────────────
function StudentAlertGroup({ group, navigate, canApprove, showResolved, onMarkRead, onResolve, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(true);
  const unreadCount = group.alerts.filter(a => !a.is_read).length;
  const highCount = group.alerts.filter(a => a.severity === 'high').length;

  return (
    <div data-testid={`alert-group-${group.student_id}`}
      className={`bg-white border rounded-xl overflow-hidden transition-all ${unreadCount > 0 ? 'border-rose-200' : 'border-slate-200'}`}>
      {/* Student header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(e => !e)}>
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User size={14} className="text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); navigate(`/students/${group.student_id}`); }}
              className="font-semibold text-sm text-slate-900 hover:text-blue-600 transition-colors truncate">
              {group.student_name}
            </button>
            <span className="text-xs text-slate-400 shrink-0">{group.class_name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {highCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-bold">{highCount} high</span>
          )}
          {unreadCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadCount}</span>
          )}
          <span className="text-xs text-slate-400 font-medium">{group.alerts.length}</span>
          <ChevronRight size={14} className={`text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
      {/* Alert rows */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 divide-y divide-slate-100">
          {group.alerts.map(alert => (
            <AlertRow key={alert.alert_id} alert={alert} canApprove={canApprove} showResolved={showResolved}
              onMarkRead={onMarkRead} onResolve={onResolve} onApprove={onApprove} onReject={onReject} compact />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlertsPage() {
  useDocumentTitle('Alerts');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canDo } = usePermissions();
  const canApprove = user?.role === 'admin' || canDo('alerts.approve');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [activeTab, setActiveTab] = useState('early_warning');
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');

  const load = async (resolved = false) => {
    try {
      const res = await api.get(`/alerts?resolved=${resolved}`);
      setAlerts(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); load(showResolved); }, [showResolved]);

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

  // Separate alerts by tab
  const earlyWarnings = alerts.filter(a => a.type === 'early_warning' || (!a.type && a.alert_type !== 'tier_change'));
  const tierChanges = alerts.filter(a => a.type === 'tier_change' || a.alert_type === 'tier_change');
  const rawList = activeTab === 'early_warning' ? earlyWarnings : tierChanges;

  // Apply filters
  const filtered = useMemo(() => {
    let list = rawList;
    if (filterType !== 'all') list = list.filter(a => a.alert_type === filterType);
    if (filterSeverity !== 'all') list = list.filter(a => a.severity === filterSeverity);
    return sortByDate(list);
  }, [rawList, filterType, filterSeverity]);

  // Group
  const grouped = useMemo(() => groupByStudent(filtered), [filtered]);

  const unread = alerts.filter(a => !a.is_read).length;
  const unreadEW = earlyWarnings.filter(a => !a.is_read).length;
  const unreadTC = tierChanges.filter(a => !a.is_read).length;
  const highSeverityCount = alerts.filter(a => a.severity === 'high').length;

  // Unique alert types in current tab for filter dropdown
  const availableTypes = useMemo(() => {
    const types = [...new Set(rawList.map(a => a.alert_type).filter(Boolean))];
    return types.sort();
  }, [rawList]);

  const actionProps = { canApprove, showResolved, onMarkRead: markRead, onResolve: resolve, onApprove: approveAlert, onReject: rejectAlert };

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{fontFamily:'Manrope,sans-serif'}}>
            <Bell size={24} className="sm:hidden text-slate-600" />
            <Bell size={28} className="hidden sm:inline text-slate-600" /> Alerts
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            {unread > 0 ? <span className="text-rose-600 font-medium">{unread} unread alert{unread > 1 ? 's' : ''}</span> : 'All alerts read'}
            {highSeverityCount > 0 && <span className="text-rose-500 ml-2 text-xs font-medium">({highSeverityCount} high severity)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead} data-testid="mark-all-read-btn"
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors">
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-5">
        {[
          { label: 'Early Warnings', value: earlyWarnings.length, color: 'text-amber-600' },
          { label: 'Tier Changes', value: tierChanges.length, color: 'text-indigo-600' },
          { label: 'High Severity', value: highSeverityCount, color: 'text-rose-600' },
          { label: 'Unread', value: unread, color: 'text-rose-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 text-center">
            <p className={`text-xl sm:text-2xl font-bold ${stat.color}`} style={{fontFamily:'Manrope,sans-serif'}}>{stat.value}</p>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto overflow-y-hidden border-b border-slate-200 mb-0 -mx-4 sm:-mx-6 px-4 sm:px-6 md:mx-0 md:px-0 no-scrollbar">
        {[
          { key: 'early_warning', label: 'Early Warnings', short: 'Warnings', count: unreadEW, Icon: AlertTriangle },
          { key: 'tier_change', label: 'Tier Changes', short: 'Tier Chg', count: unreadTC, Icon: TrendingUp },
        ].map(({ key, label, short, count, Icon }) => (
          <button key={key} onClick={() => { setActiveTab(key); setFilterType('all'); setFilterSeverity('all'); }} data-testid={`alerts-tab-${key}`}
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${activeTab === key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{short}</span>
            {count > 0 && <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center font-bold shrink-0">{count}</span>}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-slate-400" />
          {activeTab === 'early_warning' && availableTypes.length > 1 && (
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
              <option value="all">All types</option>
              {availableTypes.map(t => (
                <option key={t} value={t}>{ALERT_TYPE_LABELS[t] || t}</option>
              ))}
            </select>
          )}
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10">
            <option value="all">All severities</option>
            <option value="high">High only</option>
            <option value="medium">Medium only</option>
            <option value="low">Low only</option>
          </select>
          {(filterType !== 'all' || filterSeverity !== 'all') && (
            <button onClick={() => { setFilterType('all'); setFilterSeverity('all'); }}
              className="text-xs text-slate-500 hover:text-slate-700 underline">Clear filters</button>
          )}
          <span className="text-xs text-slate-400">{filtered.length} alert{filtered.length !== 1 ? 's' : ''}{grouped.length > 0 ? ` across ${grouped.length} student${grouped.length !== 1 ? 's' : ''}` : ''}</span>
        </div>
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

      {/* Alert list — grouped by student */}
      <div className="space-y-3">
        {loading ? (
          [1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />)
        ) : grouped.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            {activeTab === 'early_warning' ? (
              <>
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400" />
                <p className="font-medium text-slate-600">No early warnings</p>
                <p className="text-sm text-slate-400 mt-1">
                  {filterType !== 'all' || filterSeverity !== 'all'
                    ? 'No alerts match your current filters. Try clearing them.'
                    : showResolved ? 'No resolved early warnings found.' : 'All clear — no active early warnings at this time.'}
                </p>
              </>
            ) : (
              <>
                <TrendingUp size={40} className="mx-auto mb-3 text-indigo-300" />
                <p className="font-medium text-slate-600">No tier changes</p>
                <p className="text-sm text-slate-400 mt-1">
                  {filterSeverity !== 'all'
                    ? 'No tier changes match your current filters.'
                    : showResolved ? 'No resolved tier changes found.' : 'No tier change alerts at this time.'}
                </p>
              </>
            )}
          </div>
        ) : (
          grouped.map(group => (
            <StudentAlertGroup key={group.student_id} group={group} navigate={navigate} {...actionProps} />
          ))
        )}
      </div>
    </div>
  );
}
