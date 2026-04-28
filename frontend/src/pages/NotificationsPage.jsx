import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Bell, CheckCircle, Inbox, Loader, ExternalLink, Check } from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { timeAgo } from '../utils/dateFmt';

const TYPE_ICONS = {
  task_assigned: { bg: 'bg-blue-100', color: 'text-blue-600', label: 'Task Assigned' },
  task_completed: { bg: 'bg-emerald-100', color: 'text-emerald-600', label: 'Task Completed' },
  mention: { bg: 'bg-purple-100', color: 'text-purple-600', label: 'Mention' },
  team_added: { bg: 'bg-indigo-100', color: 'text-indigo-600', label: 'Team' },
};

function NotificationCard({ notification, onMarkRead, onNavigate }) {
  const style = TYPE_ICONS[notification.type] || { bg: 'bg-slate-100', color: 'text-slate-600', label: notification.type || 'Notification' };

  return (
    <div
      data-testid={`notification-${notification.notification_id}`}
      className={`bg-white border rounded-xl p-4 transition-all ${!notification.is_read ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${style.bg}`}>
          <Bell size={14} className={style.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.color}`}>
              {style.label}
            </span>
            {!notification.is_read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
            <span className="text-[11px] text-slate-400 ml-auto">{timeAgo(notification.created_at)}</span>
          </div>
          {notification.title && <p className="text-sm font-medium text-slate-900">{notification.title}</p>}
          <p className="text-sm text-slate-600 leading-snug">{notification.message}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {!notification.is_read && (
              <button
                onClick={() => onMarkRead(notification.notification_id)}
                className="text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1"
              >
                <Check size={11} /> Mark Read
              </button>
            )}
            {notification.related_student_id && (
              <button
                onClick={() => onNavigate(`/students/${notification.related_student_id}`)}
                className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1"
              >
                <ExternalLink size={11} /> View Student
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  useDocumentTitle('Notifications');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const load = async () => {
    try {
      const res = await api.get(`/notifications?unread_only=${filter === 'unread'}&limit=100`);
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`, {});
    setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all', {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <Inbox size={28} className="text-slate-600" /> Notifications
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            {unreadCount > 0
              ? <span className="text-blue-600 font-medium">{unreadCount} unread</span>
              : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors">
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            All
          </button>
          <button onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            Unread
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />)
        ) : notifications.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-slate-600">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {filter === 'unread' ? 'You\'re all caught up!' : 'Notifications from task assignments, mentions, and team updates will appear here.'}
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <NotificationCard key={n.notification_id} notification={n} onMarkRead={markRead} onNavigate={navigate} />
          ))
        )}
      </div>
    </div>
  );
}
