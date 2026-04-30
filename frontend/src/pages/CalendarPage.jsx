import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { useSettings } from '../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, ChevronLeft, ChevronRight, ClipboardCheck, Target,
  CalendarClock, BookOpen, Loader
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EVENT_TYPES = {
  screening: { color: 'bg-indigo-500', light: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: ClipboardCheck, label: 'Screening' },
  term: { color: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: BookOpen, label: 'Term' },
  intervention: { color: 'bg-amber-500', light: 'bg-amber-50 text-amber-700 border-amber-200', icon: Target, label: 'Intervention Review' },
  appointment: { color: 'bg-purple-500', light: 'bg-purple-50 text-purple-700 border-purple-200', icon: CalendarClock, label: 'Appointment' },
};

// Helper to get navigation path for an event
function getEventNavigation(e) {
  if (e.type === 'screening') return '/screening';
  if (e.type === 'appointment') return '/appointments';
  if (e.type === 'intervention') {
    // Extract student_id from event id (format: intv-{intervention_id})
    // We need to pass the student_id, which should be in the event data
    return e.student_id ? `/students/${e.student_id}?tab=interventions` : '/interventions';
  }
  if (e.type === 'term') return '/settings';
  return null;
}

function getMonthDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Monday = 0
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const days = [];
  // Pad days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: fmt(d), day: d.getDate(), current: false });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({ date: fmt(new Date(year, month, d)), day: d, current: true });
  }
  // Pad to fill last week
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({ date: fmt(dt), day: dt.getDate(), current: false });
    }
  }
  return days;
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return fmt(d);
}

export default function CalendarPage() {
  useDocumentTitle('Calendar');
  const { settings } = useSettings();
  const navigate = useNavigate();
  const today = todayStr();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    loadEvents();
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = async () => {
    setLoading(true);
    const evts = [];
    try {
      // Screening periods
      const sp = await api.get('/screening/periods').catch(() => ({ data: { periods: [] } }));
      for (const p of (sp.data?.periods || [])) {
        if (p.start_date) {
          evts.push({
            id: `sp-start-${p.period_id}`, date: p.start_date, type: 'screening',
            title: `${p.name} starts`, detail: `${p.start_date} – ${p.end_date}`, status: p.status,
          });
        }
        if (p.end_date) {
          evts.push({
            id: `sp-end-${p.period_id}`, date: p.end_date, type: 'screening',
            title: `${p.name} ends`, detail: p.status === 'active' ? 'Active' : p.status,
          });
        }
      }

      // Term dates from settings
      const terms = settings?.terms || [];
      for (const t of terms) {
        if (t.start) evts.push({ id: `term-start-${t.name}`, date: t.start, type: 'term', title: `${t.name} starts` });
        if (t.end) evts.push({ id: `term-end-${t.name}`, date: t.end, type: 'term', title: `${t.name} ends` });
      }

      // Interventions with review dates
      const ir = await api.get('/interventions?status=active').catch(() => ({ data: [] }));
      for (const intv of (Array.isArray(ir.data) ? ir.data : [])) {
        if (intv.review_date) {
          evts.push({
            id: `intv-${intv.intervention_id}`, date: intv.review_date, type: 'intervention',
            title: `${intv.student_name || 'Student'} - Intervention review`,
            detail: intv.intervention_type || 'Intervention',
            student_id: intv.student_id,
            intervention_id: intv.intervention_id,
          });
        }
      }

      // Appointments
      const appts = await api.get('/appointments/upcoming').catch(() => ({ data: [] }));
      for (const a of (Array.isArray(appts.data) ? appts.data : [])) {
        if (a.scheduled_date && a.scheduled_date >= fmt(new Date(year, month - 1, 1)) && a.scheduled_date <= fmt(new Date(year, month + 2, 0))) {
          evts.push({
            id: `appt-${a.appointment_id}`, date: a.scheduled_date, type: 'appointment',
            title: `${a.student_name || 'Student'} - ${a.session_type || 'Appointment'}`,
            detail: a.provider_name || a.location || 'Scheduled appointment',
          });
        }
      }

      // Support plan reviews
      const plans = await api.get('/action-plans?status=active').catch(() => ({ data: [] }));
      for (const p of (Array.isArray(plans.data) ? plans.data : [])) {
        if (p.review_date) {
          evts.push({
            id: `plan-${p.plan_id}`, date: p.review_date, type: 'intervention',
            title: `${p.student_name || 'Student'} - Support Plan Review`,
            detail: p.title || 'Support Plan Review',
            student_id: p.student_id,
            plan_id: p.plan_id,
          });
        }
      }
    } catch (e) { console.error(e); }
    finally { setEvents(evts); setLoading(false); }
  };

  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [events]);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <Calendar size={28} className="text-slate-600" /> Calendar
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Screening windows, term dates, intervention reviews & appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors">
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-3 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <button onClick={prev} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft size={18} className="text-slate-600" />
              </button>
              <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>
                {MONTHS[month]} {year}
              </h2>
              <button onClick={next} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>

            {loading && (
              <div className="py-8 text-center text-slate-400">
                <Loader size={18} className="animate-spin mx-auto mb-2" /> Loading events…
              </div>
            )}

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const dayEvents = eventsByDate[d.date] || [];
                const isToday = d.date === today;
                const isSelected = d.date === selectedDate;
                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(d.date === selectedDate ? null : d.date)}
                    className={`min-h-[90px] sm:min-h-[110px] lg:min-h-[120px] p-1.5 border-b border-r border-slate-100 cursor-pointer transition-colors ${
                      !d.current ? 'bg-slate-50/50' : 'hover:bg-slate-50'
                    } ${isSelected ? 'bg-blue-50 ring-1 ring-blue-300 ring-inset' : ''}`}
                  >
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-slate-900 text-white' : d.current ? 'text-slate-700' : 'text-slate-300'
                    }`}>
                      {d.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 4).map(e => {
                        const conf = EVENT_TYPES[e.type] || EVENT_TYPES.screening;
                        return (
                          <div 
                            key={e.id} 
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium leading-tight ${conf.color} text-white`}
                          >
                            <span className="truncate block">{e.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 4 && (
                        <div className="text-[10px] text-slate-400 font-medium pl-1">+{dayEvents.length - 4} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar — selected day detail + legend */}
        <div className="space-y-4 min-w-0 lg:min-w-[280px] lg:max-w-[320px]" style={{ scrollbarGutter: 'stable' }}>
          {/* Legend */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Event Types</h3>
            <div className="space-y-2">
              {Object.entries(EVENT_TYPES).map(([key, conf]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${conf.color}`} />
                  <span className="text-xs text-slate-600">{conf.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected date events */}
          {selectedDate && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">{selectedDate}</h3>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-slate-400">No events on this date</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(e => {
                    const conf = EVENT_TYPES[e.type] || EVENT_TYPES.screening;
                    const Icon = conf.icon;
                    const path = getEventNavigation(e);
                    return (
                      <div 
                        key={e.id} 
                        onClick={() => path && navigate(path)}
                        className={`flex items-start gap-2 p-2.5 rounded-lg border ${conf.light} ${path ? 'cursor-pointer hover:bg-opacity-80 hover:shadow-sm transition-all' : ''}`}
                      >
                        <Icon size={14} className="mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="text-xs font-semibold break-words leading-tight">{e.title}</p>
                          {e.detail && <p className="text-[11px] text-slate-600 mt-0.5 break-words">{e.detail}</p>}
                          {path && <p className="text-[10px] text-blue-600 mt-1">Click to view →</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h3>
            {(() => {
              const upcoming = events
                .filter(e => e.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 8);
              if (upcoming.length === 0) return <p className="text-xs text-slate-400">No upcoming events</p>;
              return (
                <div className="space-y-2">
                  {upcoming.map(e => {
                    const conf = EVENT_TYPES[e.type] || EVENT_TYPES.screening;
                    return (
                      <div key={e.id} className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${conf.color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{e.title}</p>
                          <p className="text-[10px] text-slate-400">{e.date}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
