import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSettings } from '../context/SettingsContext';
import { ClipboardCheck, User, ChevronRight, CheckCircle, ArrowLeft, X, AlertTriangle } from 'lucide-react';
import { F2SelfReportForm, isF2Student } from './EarlyYearsSelfReport';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── SAEBRS question banks ───────────────────────────────────────────────────
const SOCIAL_ITEMS = [
  'Interacts appropriately with peers',
  'Follows school rules',
  'Shows appropriate classroom behaviour',
  'Handles frustration appropriately',
  'Maintains appropriate peer relationships',
  'Respects personal space of others',
];
const ACADEMIC_ITEMS = [
  'Completes assigned tasks',
  'Organises materials and assignments',
  'Manages time effectively',
  'Follows directions',
  'Remains on task',
  'Participates in class activities',
];
const EMOTIONAL_ITEMS = [
  'Manages emotions appropriately',
  'Demonstrates positive self-concept',
  'Handles transitions effectively',
  'Shows persistence when challenged',
  'Displays appropriate affect',
  'Demonstrates emotional resilience',
  'Shows self-regulation skills',
];

const SELF_REPORT_ITEMS = [
  { q: 'I feel sad or unhappy at school', reverse: true },
  { q: 'I feel nervous or worried at school', reverse: false },
  { q: 'I feel angry or upset at school', reverse: false },
  { q: 'I feel like I belong at this school', reverse: false },
  { q: 'I have friends at school', reverse: false },
  { q: 'My teachers care about me', reverse: false },
  { q: 'I feel safe at school', reverse: false },
];

const RESPONSE_LABELS = ['Never', 'Sometimes', 'Often', 'Almost Always'];

const scrollTop = () => { const m = document.querySelector('main'); if (m) m.scrollTo({ top: 0, behavior: 'smooth' }); };

// ─── Score bar helper ─────────────────────────────────────────────────────────
function ScoreBar({ score, max, risk }) {
  const pct = Math.round((score / max) * 100);
  const col = risk === 'High Risk' ? 'bg-rose-500' : risk === 'Some Risk' ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500 mb-1">
        <span>{score}/{max}</span>
        <span className={`font-medium ${risk === 'High Risk' ? 'text-rose-600' : risk === 'Some Risk' ? 'text-amber-600' : 'text-emerald-600'}`}>{risk}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Mode selection ───────────────────────────────────────────────────────────
function ModeSelect({ onSelect, activePeriod }) {
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Screening</h1>
        <p className="text-slate-500 mt-1">Choose what you'd like to complete today</p>
      </div>

      {activePeriod ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-6 w-fit">
          <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">Active period: <span className="font-bold">{activePeriod}</span></p>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">No active screening period is set. Ask your administrator to set one in <strong>Settings → Screening Sessions</strong>.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <button onClick={() => onSelect('saebrs')} disabled={!activePeriod} data-testid="mode-saebrs-btn"
          className="bg-white border-2 border-slate-200 rounded-2xl p-7 text-left hover:border-slate-900 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <ClipboardCheck size={22} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>SAEBRS Screener</h2>
          <p className="text-sm text-slate-500">Teacher or ES staff completes SAEBRS for each student in a class. Resume any time — completed students are saved automatically.</p>
        </button>
        <button onClick={() => onSelect('self-report')} disabled={!activePeriod} data-testid="mode-self-report-btn"
          className="bg-white border-2 border-slate-200 rounded-2xl p-7 text-left hover:border-indigo-500 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            <User size={22} className="text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Student Self-Report</h2>
          <p className="text-sm text-slate-500">Sit with an individual student and complete the 7-item self-report together. Select a class, then pick a student.</p>
        </button>
      </div>
    </div>
  );
}

// ─── Class selector ───────────────────────────────────────────────────────────
function ClassSelect({ mode, activePeriod, onNext, onBack }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    axios.get(`${API}/classes`, { withCredentials: true })
      .then(r => setClasses(r.data))
      .catch(e => console.error(e))
      .finally(() => setLoadingClasses(false));
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-xl mx-auto fade-in">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="bg-white border border-slate-200 rounded-2xl p-7 space-y-5">
        <div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${mode === 'saebrs' ? 'bg-slate-900' : 'bg-indigo-600'}`}>
            {mode === 'saebrs' ? <ClipboardCheck size={18} className="text-white" /> : <User size={18} className="text-white" />}
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>
            {mode === 'saebrs' ? 'SAEBRS Screener' : 'Student Self-Report'}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">{activePeriod}</span>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-2 block">Select Class</label>
          {loadingClasses ? <p className="text-sm text-slate-400">Loading classes…</p> : (
            <div className="grid grid-cols-2 gap-2">
              {classes.map(c => (
                <button key={c.class_name} onClick={() => setSelectedClass(c.class_name)}
                  data-testid={`class-btn-${c.class_name}`}
                  className={`p-3 rounded-xl border text-left transition-all ${selectedClass === c.class_name ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
                  <p className="text-sm font-semibold">{c.class_name}</p>
                  <p className={`text-xs mt-0.5 ${selectedClass === c.class_name ? 'text-white/60' : 'text-slate-400'}`}>{c.teacher}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => selectedClass && onNext(selectedClass)}
          disabled={!selectedClass}
          data-testid="begin-screening-btn"
          className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── SAEBRS: student list + sequential screening ──────────────────────────────
function SAEBRSFlow({ className, period, onDone }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [screeningId] = useState(`scr_${Date.now()}`);
  const [completedStudents, setCompletedStudents] = useState(new Set());
  const [scores, setScores] = useState({ social: Array(6).fill(2), academic: Array(6).fill(2), emotional: Array(7).fill(2) });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const load = async () => {
      const [studRes, compRes] = await Promise.all([
        axios.get(`${API}/students?class_name=${encodeURIComponent(className)}&enrolment_status=active`, { withCredentials: true }),
        axios.get(`${API}/screening/completed?class_name=${encodeURIComponent(className)}&period=${encodeURIComponent(period)}&type=saebrs`, { withCredentials: true }),
      ]);
      setStudents(studRes.data);
      setCompletedStudents(new Set(compRes.data.completed || []));
      setLoading(false);
    };
    load().catch(e => { console.error(e); setLoading(false); });
  }, [className, period]);

  useEffect(() => {
    if (current === null) {
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [current]);

  const student = current !== null ? students[current] : null;

  const saveCurrentStudent = async () => {
    if (!student) return;
    setSaving(true); setSaveError('');
    try {
      await axios.post(`${API}/screening/saebrs`, {
        student_id: student.student_id,
        screening_id: screeningId,
        screening_period: period,
        social_items: scores.social,
        academic_items: scores.academic,
        emotional_items: scores.emotional,
        social_score: 0, academic_score: 0, emotional_score: 0, total_score: 0,
      }, { withCredentials: true });
      setCompletedStudents(prev => new Set([...prev, student.student_id]));
      setScores({ social: Array(6).fill(2), academic: Array(6).fill(2), emotional: Array(7).fill(2) });
      setCurrent(null);
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const openStudent = (i) => {
    setScores({ social: Array(6).fill(2), academic: Array(6).fill(2), emotional: Array(7).fill(2) });
    setSaveError('');
    setCurrent(i);
    scrollTop();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" /></div>;

  // Student list view
  if (current === null) {
    const allDone = completedStudents.size >= students.length && students.length > 0;
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>SAEBRS — {className}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">{period}</span>
              <span className="text-sm text-slate-500">{completedStudents.size} of {students.length} completed</span>
            </div>
          </div>
          <button onClick={onDone} data-testid="finish-saebrs-btn"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${allDone ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {allDone ? <CheckCircle size={15} /> : <X size={14} />}
            {allDone ? 'All Done' : 'Finish Session'}
          </button>
        </div>

        {!allDone && completedStudents.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
            <CheckCircle size={14} className="text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">Your progress is saved. You can close this page and come back later — completed students will still be ticked.</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {students.map((s, i) => {
            const done = completedStudents.has(s.student_id);
            return (
              <div key={s.student_id}
                className={`flex items-center justify-between px-5 py-4 border-b border-slate-50 last:border-0 transition-colors ${done ? 'bg-emerald-50/40' : 'hover:bg-slate-50 cursor-pointer'}`}
                onClick={() => !done && openStudent(i)}
                data-testid={`student-saebrs-row-${s.student_id}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                    {done ? <CheckCircle size={16} /> : s.first_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-slate-400">{s.year_level}</p>
                  </div>
                </div>
                {done
                  ? <span className="text-xs text-emerald-600 font-semibold">Completed</span>
                  : <ChevronRight size={16} className="text-slate-300" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // SAEBRS form for current student
  const setItem = (domain, idx, val) =>
    setScores(p => ({ ...p, [domain]: p[domain].map((v, i) => (i === idx ? val : v)) }));

  const sections = [
    { key: 'social', label: 'Social Behavior', items: SOCIAL_ITEMS, max: 18 },
    { key: 'academic', label: 'Academic Behavior', items: ACADEMIC_ITEMS, max: 18 },
    { key: 'emotional', label: 'Emotional Behavior', items: EMOTIONAL_ITEMS, max: 21 },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { setCurrent(null); scrollTop(); }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Back to class
        </button>
        <span className="text-slate-300">·</span>
        <span className="text-sm text-slate-500">{current + 1} / {students.length}</span>
        <span className="ml-auto px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">{period}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-7 mb-5">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
            <span className="text-lg font-bold text-white">{student.first_name[0]}{student.last_name[0]}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{student.first_name} {student.last_name}</h2>
            <p className="text-sm text-slate-500">{student.year_level} · {student.class_name}</p>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6">Rate each behaviour: 0 = Never, 1 = Sometimes, 2 = Often, 3 = Almost Always</p>

        {sections.map(sec => (
          <div key={sec.key} className="mb-7">
            <p className="text-sm font-semibold text-slate-700 mb-4 pb-2 border-b border-slate-100">{sec.label}</p>
            <div className="space-y-5">
              {sec.items.map((item, idx) => (
                <div key={idx}>
                  <p className="text-sm text-slate-700 mb-2 font-medium">{item}</p>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(v => (
                      <button key={v} onClick={() => setItem(sec.key, idx, v)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${scores[sec.key][idx] === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                        <span className="block">{v}</span>
                        <span className="block text-xs opacity-60">{RESPONSE_LABELS[v]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {saveError && <p className="text-sm text-rose-600 mt-3">{saveError}</p>}
      </div>

      <button onClick={saveCurrentStudent} disabled={saving} data-testid="save-saebrs-btn"
        className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
        {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle size={16} />}
        {saving ? 'Saving…' : 'Save & Return to List'}
      </button>
    </div>
  );
}

// ─── Self-Report: pick individual student ─────────────────────────────────────
function SelfReportFlow({ className, period, onDone }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [screeningId] = useState(`scr_sr_${Date.now()}`);
  const [completedStudents, setCompletedStudents] = useState(new Set());
  const [items, setItems] = useState(Array(7).fill(1));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const load = async () => {
      const [studRes, compRes] = await Promise.all([
        axios.get(`${API}/students?class_name=${encodeURIComponent(className)}&enrolment_status=active`, { withCredentials: true }),
        axios.get(`${API}/screening/completed?class_name=${encodeURIComponent(className)}&period=${encodeURIComponent(period)}&type=self_report`, { withCredentials: true }),
      ]);
      setStudents(studRes.data);
      setCompletedStudents(new Set(compRes.data.completed || []));
      setLoading(false);
    };
    load().catch(e => { console.error(e); setLoading(false); });
  }, [className, period]);

  useEffect(() => {
    if (current === null) {
      const main = document.querySelector('main');
      if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [current]);

  const student = current !== null ? students[current] : null;

  const save = async () => {
    if (!student) return;
    setSaving(true); setSaveError('');
    try {
      await axios.post(`${API}/screening/saebrs-plus`, {
        student_id: student.student_id,
        screening_id: screeningId,
        screening_period: period,
        self_report_items: items,
        attendance_pct: 100,
        social_domain: 0, academic_domain: 0, emotional_domain: 0, belonging_domain: 0,
        wellbeing_total: 0, wellbeing_tier: 1,
      }, { withCredentials: true });
      setCompletedStudents(prev => new Set([...prev, student.student_id]));
      setItems(Array(7).fill(1));
      setCurrent(null);
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full" /></div>;

  // Student picker
  if (current === null) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Self-Report — {className}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">{period}</span>
              <span className="text-sm text-slate-500">{completedStudents.size} of {students.length} completed</span>
            </div>
          </div>
          <button onClick={onDone} data-testid="finish-self-report-btn"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            <X size={14} /> Finish Session
          </button>
        </div>

        {completedStudents.size > 0 && completedStudents.size < students.length && (
          <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
            <CheckCircle size={14} className="text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700">Progress saved. You can return later — completed students will still be marked.</p>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {students.map((s, i) => {
            const done = completedStudents.has(s.student_id);
            return (
              <div key={s.student_id}
                onClick={() => !done && (setCurrent(i), setItems(Array(7).fill(1)), scrollTop())}
                data-testid={`select-student-${s.student_id}`}
                className={`flex items-center justify-between px-5 py-4 border-b border-slate-50 last:border-0 transition-colors ${done ? 'bg-emerald-50/40' : 'hover:bg-indigo-50 cursor-pointer'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {done ? <CheckCircle size={16} /> : s.first_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-slate-400">{s.year_level}</p>


                  </div>
                </div>
                {done
                  ? <span className="text-xs text-emerald-600 font-semibold">Completed</span>
                  : <ChevronRight size={16} className="text-slate-300" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // F-2 route: Foundation / Year 1 / Year 2 students get the illustrated screener
  if (current !== null && isF2Student(student?.year_level)) {
    return (
      <F2SelfReportForm
        student={student}
        period={period}
        screeningId={screeningId}
        onSave={(studentId) => {
          setCompletedStudents(prev => new Set([...prev, studentId]));
          setCurrent(null);
          scrollTop();
        }}
        onBack={() => { setCurrent(null); scrollTop(); }}
      />
    );
  }

  // Self-report form (Year 3–6)
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto fade-in">
      <button onClick={() => { setCurrent(null); scrollTop(); }}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to student list
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-7">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-lg font-bold text-white">{student.first_name[0]}{student.last_name[0]}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>{student.first_name} {student.last_name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-slate-500">Student Self-Report</p>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">{period}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-6 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
          Read each question aloud. Ask the student: "How often do you feel this way?"
          0 = Never, 1 = Sometimes, 2 = Often, 3 = Almost Always
        </p>

        <div className="space-y-5">
          {SELF_REPORT_ITEMS.map((item, idx) => (
            <div key={idx}>
              <p className="text-sm text-slate-700 mb-2 font-medium">{idx + 1}. {item.q}</p>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map(v => (
                  <button key={v} onClick={() => setItems(p => p.map((x, i) => i === idx ? v : x))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${items[idx] === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}>
                    <span className="block">{v}</span>
                    <span className="block text-xs opacity-60">{RESPONSE_LABELS[v]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {saveError && <p className="text-sm text-rose-600 mt-4">{saveError}</p>}

        <button onClick={save} disabled={saving} data-testid="save-self-report-btn"
          className="w-full mt-6 py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
          {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle size={16} />}
          {saving ? 'Saving…' : 'Save & Return to List'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Screening Page ──────────────────────────────────────────────────────
export default function ScreeningPage() {
  const { settings } = useSettings();
  const activePeriod = settings?.active_screening_period || '';
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');

  const handleModeSelect = (m) => { setMode(m); setStep('class'); };
  const handleClassSelect = (cls) => { setSelectedClass(cls); setStep('screen'); };
  const handleDone = () => { setStep('mode'); setMode(null); setSelectedClass(''); scrollTop(); };

  if (step === 'mode') return <ModeSelect onSelect={handleModeSelect} activePeriod={activePeriod} />;
  if (step === 'class') return <ClassSelect mode={mode} activePeriod={activePeriod} onNext={handleClassSelect} onBack={() => setStep('mode')} />;
  if (step === 'screen' && mode === 'saebrs') return <SAEBRSFlow className={selectedClass} period={activePeriod} onDone={handleDone} />;
  if (step === 'screen' && mode === 'self-report') return <SelfReportFlow className={selectedClass} period={activePeriod} onDone={handleDone} />;
  return null;
}
