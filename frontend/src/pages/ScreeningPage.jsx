import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ClipboardCheck, ChevronRight, ChevronLeft, CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import { getRiskColors } from '../utils/tierUtils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SOCIAL_ITEMS = [
  'Interacts positively with peers',
  'Gets along well with others',
  'Accepts correction or feedback without becoming upset',
  'Follows classroom rules and directions',
  'Shows respect for feelings and property of others',
  'Manages conflict with peers appropriately',
];
const ACADEMIC_ITEMS = [
  'Completes assigned class work',
  'Stays on task during lessons',
  'Is organised and prepared for learning',
  'Comes to class prepared with materials',
  'Shows motivation and interest in learning',
  'Works independently without adult support',
];
const EMOTIONAL_ITEMS = [
  'Controls emotional responses (e.g. anger, frustration)',
  'Does not appear sad or depressed',
  'Does not appear anxious or worried',
  'Does not appear socially withdrawn',
  'Handles frustration in an appropriate manner',
  'Does not overreact to situations',
  'Does not display excessive or persistent worrying',
];
const SELF_REPORT_ITEMS = [
  { text: 'I feel worried or stressed at school', reverse: true },
  { text: 'I feel confident doing schoolwork', reverse: false },
  { text: 'I feel safe at school', reverse: false },
  { text: 'I feel like I belong in my class', reverse: false },
  { text: 'I have friends at school', reverse: false },
  { text: 'There is an adult at school I trust', reverse: false },
  { text: 'Teachers care about me', reverse: false },
];

const TEACHER_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often'];
const STUDENT_SCALE = ['Not true for me', 'A little true', 'Mostly true', 'Very true'];

function ScaleSelector({ items, scale, values, onChange, colorKey }) {
  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={idx} className="bg-slate-50 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-800 mb-3">
            {typeof item === 'string' ? item : item.text}
            {typeof item === 'object' && item.reverse && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Reverse Scored</span>
            )}
          </p>
          <div className="flex gap-2 flex-wrap">
            {scale.map((label, val) => (
              <button
                key={val}
                onClick={() => onChange(idx, val)}
                data-testid={`scale-item-${idx}-val-${val}`}
                className={`flex-1 min-w-16 py-2 px-2 text-xs font-medium rounded-lg border transition-all ${
                  values[idx] === val
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                <span className="block font-bold text-base mb-0.5">{val}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function computeSaebrsRisk(total, social, academic, emotional) {
  const totalRisk = total >= 37 ? 'Low Risk' : total >= 24 ? 'Some Risk' : 'High Risk';
  const socialRisk = social >= 13 ? 'Low Risk' : social >= 8 ? 'Some Risk' : 'High Risk';
  const academicRisk = academic >= 10 ? 'Low Risk' : academic >= 6 ? 'Some Risk' : 'High Risk';
  const emotionalRisk = emotional >= 16 ? 'Low Risk' : emotional >= 12 ? 'Some Risk' : 'High Risk';
  return { totalRisk, socialRisk, academicRisk, emotionalRisk };
}

export default function ScreeningPage() {
  const [step, setStep] = useState('setup'); // setup, saebrs, saebrs_plus, complete
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [screeningPeriod, setScreeningPeriod] = useState('Term 2');
  const [students, setStudents] = useState([]);
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);
  const [screeningId, setScreeningId] = useState('');
  const [saebrsData, setSaebrsData] = useState({});
  const [plusData, setPlusData] = useState({});
  const [saving, setSaving] = useState(false);
  const [completedStudents, setCompletedStudents] = useState(new Set());
  const [mode, setMode] = useState('saebrs'); // saebrs or plus
  const [startError, setStartError] = useState('');

  const [socialItems, setSocialItems] = useState(new Array(6).fill(-1));
  const [academicItems, setAcademicItems] = useState(new Array(6).fill(-1));
  const [emotionalItems, setEmotionalItems] = useState(new Array(7).fill(-1));
  const [selfReportItems, setSelfReportItems] = useState(new Array(7).fill(-1));
  const [attendancePct, setAttendancePct] = useState('');

  useEffect(() => {
    axios.get(`${API}/classes`, { withCredentials: true })
      .then(r => { setClasses(r.data); if (r.data.length > 0) setSelectedClass(r.data[0].class_name); })
      .catch(console.error);
  }, []);

  const startScreening = async () => {
    if (!selectedClass) return;
    setStartError('');
    try {
      // Create screening session
      const sessionRes = await axios.post(`${API}/screening/sessions`, {
        screening_period: screeningPeriod,
        year: 2025,
        date: new Date().toISOString().split('T')[0],
        teacher_id: 'current_teacher',
        class_name: selectedClass,
        status: 'active',
      }, { withCredentials: true });
      setScreeningId(sessionRes.data.screening_id);

      // Get students
      const studRes = await axios.get(`${API}/students?class_name=${encodeURIComponent(selectedClass)}`, { withCredentials: true });
      setStudents(studRes.data);
      setCurrentStudentIdx(0);
      setSocialItems(new Array(6).fill(2));
      setAcademicItems(new Array(6).fill(2));
      setEmotionalItems(new Array(7).fill(2));
      setStep('saebrs');
    } catch (e) {
      console.error(e);
      setStartError(e.response?.data?.detail || 'Failed to start screening. Please try again.');
    }
  };

  const currentStudent = students[currentStudentIdx];

  const socialScore = socialItems.filter(v => v >= 0).reduce((a, b) => a + b, 0);
  const academicScore = academicItems.filter(v => v >= 0).reduce((a, b) => a + b, 0);
  const emotionalScore = emotionalItems.filter(v => v >= 0).reduce((a, b) => a + b, 0);
  const totalScore = socialScore + academicScore + emotionalScore;
  const risks = computeSaebrsRisk(totalScore, socialScore, academicScore, emotionalScore);

  const saveSaebrs = async () => {
    if (!currentStudent) return;
    setSaving(true);
    try {
      await axios.post(`${API}/screening/saebrs`, {
        student_id: currentStudent.student_id,
        screening_id: screeningId,
        social_items: socialItems,
        academic_items: academicItems,
        emotional_items: emotionalItems,
      }, { withCredentials: true });
      setSaebrsData(prev => ({ ...prev, [currentStudent.student_id]: true }));
      setStep('saebrs_plus');
      setSelfReportItems(new Array(7).fill(2));
      setAttendancePct('95');
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const savePlus = async () => {
    if (!currentStudent) return;
    setSaving(true);
    try {
      await axios.post(`${API}/screening/saebrs-plus`, {
        student_id: currentStudent.student_id,
        screening_id: screeningId,
        self_report_items: selfReportItems,
        attendance_pct: parseFloat(attendancePct) || 95,
      }, { withCredentials: true });
      setPlusData(prev => ({ ...prev, [currentStudent.student_id]: true }));
      setCompletedStudents(prev => new Set([...prev, currentStudent.student_id]));

      if (currentStudentIdx < students.length - 1) {
        setCurrentStudentIdx(prev => prev + 1);
        setSocialItems(new Array(6).fill(2));
        setAcademicItems(new Array(6).fill(2));
        setEmotionalItems(new Array(7).fill(2));
        setSelfReportItems(new Array(7).fill(2));
        setAttendancePct('95');
        setStep('saebrs');
      } else {
        setStep('complete');
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (step === 'setup') {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>New Screening Session</h1>
            <p className="text-sm text-slate-500">SAEBRS + SAEBRS+ Universal Screening</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              data-testid="screening-class-select"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white">
              {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name} — {c.teacher}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Screening Period</label>
            <div className="flex gap-3">
              {['Term 1', 'Term 2', 'Term 3'].map(t => (
                <button key={t} onClick={() => setScreeningPeriod(t)}
                  className={`flex-1 py-3 text-sm font-medium rounded-xl border transition-all ${screeningPeriod === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-600 space-y-1.5">
            <p className="font-semibold text-slate-700 mb-2">What to expect:</p>
            <p>1. For each student, complete the 19-item SAEBRS teacher rating scale</p>
            <p>2. Record student self-report responses (7 items) and attendance</p>
            <p>3. Scores are computed automatically with risk classifications</p>
          </div>

          <button onClick={startScreening} disabled={!selectedClass} data-testid="start-screening-btn"
            className="w-full bg-slate-900 text-white py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            <ClipboardCheck size={16} /> Begin Screening
          </button>

          {startError && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <p className="text-sm text-rose-700">{startError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="p-6 lg:p-8 max-w-xl mx-auto fade-in text-center">
        <div className="bg-white border border-emerald-200 rounded-2xl p-10">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{fontFamily:'Manrope,sans-serif'}}>Screening Complete!</h2>
          <p className="text-slate-500 mb-6">{completedStudents.size} students screened in {screeningPeriod}</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => { setStep('setup'); setCompletedStudents(new Set()); }}
              className="bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">
              Start New Screening
            </button>
            <a href="/students" className="text-sm text-slate-500 hover:text-slate-900 py-2">View Student Results →</a>
          </div>
        </div>
      </div>
    );
  }

  const totalItems = SOCIAL_ITEMS.length + ACADEMIC_ITEMS.length + EMOTIONAL_ITEMS.length;
  const filledItems = [...socialItems, ...academicItems, ...emotionalItems].filter(v => v >= 0).length;
  const progress = Math.round((filledItems / totalItems) * 100);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto fade-in">
      {/* Progress Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{screeningPeriod} · {selectedClass}</p>
            <h2 className="text-lg font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>
              {currentStudent?.first_name} {currentStudent?.last_name}
            </h2>
          </div>
          <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
            {currentStudentIdx + 1} / {students.length}
          </span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {students.map((s, i) => (
            <div key={s.student_id} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              completedStudents.has(s.student_id) ? 'bg-emerald-500 text-white' :
              i === currentStudentIdx ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
            }`} title={`${s.first_name} ${s.last_name}`}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* SAEBRS Form */}
      {step === 'saebrs' && (
        <div className="space-y-6">
          {/* Live score preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              <div>
                <p className="text-lg font-bold text-slate-900">{socialScore}/18</p>
                <p className="text-xs text-slate-400">Social</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(risks.socialRisk)}`}>{risks.socialRisk}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{academicScore}/18</p>
                <p className="text-xs text-slate-400">Academic</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(risks.academicRisk)}`}>{risks.academicRisk}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{emotionalScore}/21</p>
                <p className="text-xs text-slate-400">Emotional</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(risks.emotionalRisk)}`}>{risks.emotionalRisk}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">{totalScore}/57</p>
                <p className="text-xs text-slate-400">Total</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getRiskColors(risks.totalRisk)}`}>{risks.totalRisk}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 font-medium">Scale: 0=Never · 1=Rarely · 2=Sometimes · 3=Often</p>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">Social Behaviour (6 items)</h3>
            <ScaleSelector items={SOCIAL_ITEMS} scale={TEACHER_SCALE} values={socialItems}
              onChange={(i, v) => setSocialItems(prev => { const n = [...prev]; n[i] = v; return n; })} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">Academic Behaviour (6 items)</h3>
            <ScaleSelector items={ACADEMIC_ITEMS} scale={TEACHER_SCALE} values={academicItems}
              onChange={(i, v) => setAcademicItems(prev => { const n = [...prev]; n[i] = v; return n; })} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">Emotional Behaviour (7 items)</h3>
            <ScaleSelector items={EMOTIONAL_ITEMS} scale={TEACHER_SCALE} values={emotionalItems}
              onChange={(i, v) => setEmotionalItems(prev => { const n = [...prev]; n[i] = v; return n; })} />
          </div>

          <div className="sticky bottom-4">
            <button onClick={saveSaebrs} disabled={saving} data-testid="save-saebrs-btn"
              className="w-full bg-slate-900 text-white py-4 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg">
              {saving ? <Loader size={16} className="animate-spin" /> : null}
              Save SAEBRS & Continue to Wellbeing Self-Report
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* SAEBRS+ Form */}
      {step === 'saebrs_plus' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-900">SAEBRS+ Student Self-Report</p>
            <p className="text-xs text-indigo-600 mt-1">Record the student's own responses below. Scale: 0=Not true · 1=A little true · 2=Mostly true · 3=Very true</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-4 text-sm uppercase tracking-wider">Student Self-Report (7 items)</h3>
            <ScaleSelector items={SELF_REPORT_ITEMS} scale={STUDENT_SCALE} values={selfReportItems}
              onChange={(i, v) => setSelfReportItems(prev => { const n = [...prev]; n[i] = v; return n; })} />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Attendance Percentage (%)</label>
            <p className="text-xs text-slate-400 mb-3">Enter this student's attendance rate for the current term</p>
            <div className="flex items-center gap-3">
              <input type="number" min="0" max="100" value={attendancePct}
                onChange={e => setAttendancePct(e.target.value)}
                data-testid="attendance-pct-input"
                className="w-32 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 text-center font-bold" />
              <span className="text-slate-500 text-sm">%</span>
              <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                parseFloat(attendancePct) >= 95 ? 'bg-emerald-100 text-emerald-700' :
                parseFloat(attendancePct) >= 90 ? 'bg-amber-100 text-amber-700' :
                parseFloat(attendancePct) >= 80 ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>
                {parseFloat(attendancePct) >= 95 ? 'Excellent' : parseFloat(attendancePct) >= 90 ? 'Satisfactory' :
                parseFloat(attendancePct) >= 80 ? 'Below Target' : 'Critical'}
              </span>
            </div>
          </div>

          <div className="sticky bottom-4 flex gap-3">
            <button onClick={() => setStep('saebrs')}
              className="flex items-center gap-2 px-5 py-4 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={savePlus} disabled={saving} data-testid="save-plus-btn"
              className="flex-1 bg-slate-900 text-white py-4 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg">
              {saving ? <Loader size={16} className="animate-spin" /> : null}
              {currentStudentIdx < students.length - 1 ? 'Save & Next Student' : 'Save & Complete Screening'}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
