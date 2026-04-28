import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { ArrowLeft, Volume2, CheckCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ── Year level detection ──────────────────────────────────────────────────────
// Foundation, Year 1 and Year 2 get the illustrated early-years self-report.
// SIS imports zero-pad ("Year 01", "01"), so we normalise before matching.
export function isF2Student(yearLevel) {
  if (!yearLevel) return false;
  const yl = String(yearLevel).toLowerCase().trim();

  // Foundation / Prep aliases
  if (
    yl === 'foundation' || yl === 'prep' || yl === 'f' || yl === '0' || yl === '00' ||
    yl === 'reception' || yl === 'kindy' || yl === 'kinder' || yl === 'kindergarten' ||
    yl === 'pp' || yl === 'pre-primary' ||
    yl.startsWith('foundation') || yl.startsWith('prep/') || yl.startsWith('f/')
  ) return true;

  // Composite classes that include F / 1 / 2
  const COMPOSITE = new Set([
    '1/2', '2/1', 'year 1/2', 'year 2/1', 'yr 1/2', 'yr 2/1',
    'f/1', 'f-1', 'f/2', 'f-2', 'f/p', 'p/f', 'prep/1', '1/prep',
  ]);
  if (COMPOSITE.has(yl)) return true;

  // Extract the first integer mentioned anywhere in the string (covers
  // "Year 1", "Year 01", "Grade 2", "Yr 2", "y1", bare "1" / "02", etc.)
  const m = yl.match(/\d+/);
  if (m) {
    const n = parseInt(m[0], 10);
    if (n === 1 || n === 2) return true;
  }
  return false;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Raw answers: 0/1/2 (per user spec)
// Rescale: 0→0, 1→1.5, 2→3  (maps 3-pt to same range as Y3-6 4-pt)
// Positive Q4-Q7: invert after rescale (3 - rescaled) so "Always" → 3 for backend
function buildF2BackendItems(rawAnswers) {
  const RESCALE = [0, 1.5, 3];
  return rawAnswers.map((raw, idx) => {
    const rescaled = RESCALE[raw];
    return idx >= 3 ? 3 - rescaled : rescaled;
  });
}

// ── SVG Illustrations ─────────────────────────────────────────────────────────
// The 7 illustrations are served as static assets under /public/early-years/QN.svg.
// Keeping them out-of-JSX lets us accept either hand-written SVG or Illustrator
// exports (which use <style> blocks that don't map cleanly to JSX) and means
// future art swaps only need a file replace — no code changes.
const ILLUSTRATION_CLASS = 'w-full';
function Ill(n) {
  const Cmp = () => (
    <img
      src={`/early-years/Q${n}.svg`}
      alt=""
      className={ILLUSTRATION_CLASS}
      draggable={false}
      data-testid={`f2-illustration-q${n}`}
    />
  );
  Cmp.displayName = `IllQ${n}`;
  return Cmp;
}
const IllChildDesk      = Ill(1);
const IllButterflyTummy = Ill(2);
const IllAngryClassroom = Ill(3);
const IllArmsWide       = Ill(4);
const IllTwoKidsPlaying = Ill(5);
const IllTeacherChild   = Ill(6);
const IllSafetyBubble   = Ill(7);


// ── Question data ─────────────────────────────────────────────────────────────
const F2_QUESTIONS = [
  {
    id: 1, question: "Do you feel sad at school?",
    support: "Do you cry or feel unhappy at school?",
    Illustration: IllChildDesk,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😢', value: 2 }],
  },
  {
    id: 2, question: "Do you feel worried at school?",
    support: "Does your tummy feel funny or scared at school?",
    Illustration: IllButterflyTummy,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😟', value: 2 }],
  },
  {
    id: 3, question: "Do you feel angry at school?",
    support: "Do you feel like you want to yell or cry at school?",
    Illustration: IllAngryClassroom,
    options: [{ label: 'Never', emoji: '😊', value: 0 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😠', value: 2 }],
  },
  {
    id: 4, question: "Do you feel like you belong at school?",
    support: "Does school feel like a good place for you?",
    Illustration: IllArmsWide,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 5, question: "Do you have friends at school?",
    support: "Do you have someone to play with at break times?",
    Illustration: IllTwoKidsPlaying,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 6, question: "Do your teachers look after you?",
    support: "Does your teacher help you when you need it?",
    Illustration: IllTeacherChild,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
  {
    id: 7, question: "Do you feel safe at school?",
    support: "Do you feel okay and safe when you are here?",
    Illustration: IllSafetyBubble,
    options: [{ label: 'Never', emoji: '🙁', value: 2 }, { label: 'Sometimes', emoji: '😐', value: 1 }, { label: 'Always', emoji: '😊', value: 0 }],
  },
];

// ── Web Speech ────────────────────────────────────────────────────────────────
function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef(null);

  // Pick the highest-quality English voice available on this device/browser.
  // Priority: Google neural (Chrome) → Microsoft Natural/Online (Edge) →
  //           Apple Siri voices (Safari) → any local en voice → first en voice.
  const pickVoice = () => {
    const voices = window.speechSynthesis?.getVoices() || [];
    const en = voices.filter(v => v.lang.startsWith('en'));
    if (!en.length) return voices[0] || null;

    const SIRI_NAMES = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Veena', 'Serena', 'Nicky'];
    const checks = [
      v => /google/i.test(v.name) && !/hindi/i.test(v.name),
      v => /(natural|online)/i.test(v.name) && !v.localService,
      v => SIRI_NAMES.some(n => v.name.includes(n)),
      v => v.localService,
      () => true,
    ];
    for (const check of checks) {
      const match = en.find(check);
      if (match) return match;
    }
    return en[0];
  };

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => { voiceRef.current = pickVoice(); };
    load(); // available immediately on Firefox/Safari
    window.speechSynthesis.onvoiceschanged = load; // Chrome fires this async
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    if (speaking) { setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    const voice = voiceRef.current || pickVoice();
    if (voice) u.voice = voice;
    u.rate   = 0.82;  // slightly slower — better for F-2 comprehension
    u.pitch  = 1.05;  // warm, natural — avoids robotic or chipmunk extremes
    u.volume = 1;
    u.onstart = () => setSpeaking(true);
    u.onend   = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const stop = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  return { speaking, speak, stop };
}
export function F2SelfReportForm({ student, period, screeningId, onSave, onBack }) {
  const [answers, setAnswers] = useState(Array(7).fill(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { speaking, speak, stop } = useSpeech();
  const [activeQ, setActiveQ] = useState(null);

  // Stop speech when navigating away
  const handleBack = () => { stop(); onBack(); };

  const handleSpeak = (qIdx, q) => {
    const text = `${q.question} ${q.support}`;
    if (activeQ === qIdx && speaking) {
      stop();
      setActiveQ(null);
    } else {
      setActiveQ(qIdx);
      speak(text);
    }
  };

  const answeredCount = answers.filter(a => a !== null).length;
  const allAnswered = answeredCount === 7;

  const handleAnswer = (qIdx, value) => {
    setAnswers(prev => prev.map((a, i) => i === qIdx ? value : a));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const backendItems = buildF2BackendItems(answers);
      await api.post('/screening/saebrs-plus', {
        student_id: student.student_id,
        screening_id: screeningId,
        screening_period: period,
        self_report_items: backendItems,
        attendance_pct: 100,
        social_domain: 0, academic_domain: 0, emotional_domain: 0, belonging_domain: 0,
        wellbeing_total: 0, wellbeing_tier: 1,
      });
      onSave(student.student_id);
    } catch (e) {
      setSaveError(e.response?.data?.detail || 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const displayName = student.preferred_name && student.preferred_name !== student.first_name
    ? student.preferred_name
    : student.first_name;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="text-center">
            <p className="text-base font-bold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>{displayName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{period}</p>
          </div>
          {/* Progress badge */}
          <div className={`text-xs font-bold px-3 py-1 rounded-full ${allAnswered ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'}`}>
            {answeredCount}/7
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${(answeredCount / 7) * 100}%`, background: allAnswered ? '#10B981' : '#6366F1' }}
          />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-6 pb-12">
        {F2_QUESTIONS.map((q, qIdx) => {
          const Ill = q.Illustration;
          const answered = answers[qIdx] !== null;
          return (
            <div
              key={q.id}
              data-testid={`f2-question-${q.id}`}
              className={`bg-white rounded-3xl shadow-sm border-2 overflow-hidden mb-10 transition-all duration-300 ${answered ? 'border-emerald-200' : 'border-slate-100'}`}
            >
              {/* Illustration */}
              <div className="bg-gradient-to-br from-sky-50 to-amber-50 overflow-hidden">
                <Ill />
              </div>

              <div className="p-6 pt-5">
                {/* Question header */}
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Question {q.id}</span>
                  {/* Audio button */}
                  <button
                    onClick={() => handleSpeak(qIdx, q)}
                    data-testid={`f2-listen-q${q.id}`}
                    title={activeQ === qIdx && speaking ? 'Stop' : 'Listen to question'}
                    className={`flex items-center justify-center gap-1 text-xs font-semibold border rounded-full w-16 py-1 transition-colors ${
                      activeQ === qIdx && speaking
                        ? 'bg-indigo-100 border-indigo-400 text-indigo-700 ring-2 ring-indigo-300'
                        : 'border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-500'
                    }`}
                  >
                    <Volume2
                      size={12}
                      className={activeQ === qIdx && speaking ? 'animate-bounce' : ''}
                    />
                    {activeQ === qIdx && speaking ? 'Stop' : 'Listen'}
                  </button>
                </div>

                {/* Main question */}
                <h2
                  className="text-2xl font-extrabold text-slate-900 leading-snug mb-2"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {q.question}
                </h2>

                {/* Support question */}
                <p className="text-base text-slate-400 leading-relaxed mb-8">{q.support}</p>

                {/* Face buttons */}
                <div className="grid grid-cols-3 gap-3">
                  {q.options.map(opt => {
                    const selected = answers[qIdx] === opt.value;
                    return (
                      <button
                        key={opt.label}
                        data-testid={`f2-q${q.id}-${opt.label.toLowerCase()}`}
                        onClick={() => handleAnswer(qIdx, opt.value)}
                        className={`flex flex-col items-center py-5 px-2 rounded-2xl border-2 transition-all duration-150 active:scale-95 select-none ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 shadow-md scale-105'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-5xl mb-2 leading-none">{opt.emoji}</span>
                        <span className={`text-sm font-bold ${selected ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Answered tick */}
                {answered && (
                  <div className="flex items-center gap-1.5 mt-4 text-emerald-600">
                    <CheckCircle size={14} />
                    <span className="text-xs font-semibold">Answered</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Save */}
        {saveError && (
          <p className="text-sm text-rose-600 text-center mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{saveError}</p>
        )}
        <button
          data-testid="f2-save-btn"
          onClick={handleSave}
          disabled={!allAnswered || saving}
          className="w-full py-4 rounded-2xl text-lg font-extrabold text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: allAnswered ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : '#94A3B8' }}
        >
          {saving
            ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            : allAnswered
            ? <><CheckCircle size={20} /> All done! Save answers</>
            : `Answer all questions (${answeredCount}/7 done)`
          }
        </button>
      </div>
    </div>
  );
}
