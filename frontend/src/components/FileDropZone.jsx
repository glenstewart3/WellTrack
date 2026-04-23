import React, { useState, useRef, useCallback } from 'react';
import { FileUp, UploadCloud, CheckCircle, AlertTriangle, X } from 'lucide-react';

/**
 * Reusable drag-and-drop file zone with content-validation review.
 *
 * Props:
 *   accept            — input accept string (e.g. ".csv", ".zip", ".csv,.xlsx")
 *   expectedKind      — one of: 'students' | 'student_details' | 'attendance'
 *                       | 'photos' | 'users' — used for peek-at-headers check
 *   label             — placeholder text when idle
 *   file              — currently selected File | null
 *   onChange          — (file: File | null, validation: { ok, hint }) => void
 *   testIdPrefix      — base for data-testid attributes
 *   disabled          — disable interactions
 */
export default function FileDropZone({
  accept,
  expectedKind,
  label = 'Drop a file here or click to browse',
  file,
  onChange,
  testIdPrefix = 'drop',
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [validation, setValidation] = useState(null); // { ok, detected, hint }

  const handleFile = useCallback(async (f) => {
    if (!f) {
      onChange?.(null, null);
      setValidation(null);
      return;
    }
    const v = await reviewFile(f, expectedKind);
    setValidation(v);
    onChange?.(f, v);
  }, [expectedKind, onChange]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const clearFile = () => {
    if (inputRef.current) inputRef.current.value = '';
    handleFile(null);
  };

  const borderCls = dragOver
    ? 'border-indigo-400 bg-indigo-50'
    : validation?.ok === false
    ? 'border-amber-300 bg-amber-50/40'
    : file
    ? 'border-emerald-300 bg-emerald-50/40'
    : 'border-slate-300 bg-slate-50/40 hover:border-slate-400';

  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-5 transition-colors cursor-pointer ${borderCls} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        data-testid={`${testIdPrefix}-zone`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0] || null)}
          data-testid={`${testIdPrefix}-input`}
        />
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 border border-slate-200'}`}>
            {file ? <FileUp size={18} /> : <UploadCloud size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            {file ? (
              <>
                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-400">{accept}</p>
              </>
            )}
          </div>
          {file && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center wt-hover text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Remove file"
              data-testid={`${testIdPrefix}-remove`}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Validation summary */}
      {validation && file && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${validation.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}
          data-testid={`${testIdPrefix}-validation`}
        >
          {validation.ok ? <CheckCircle size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          <p className="leading-relaxed">{validation.hint}</p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const SIGNATURES = {
  students:         ['import identifier', 'first name', 'surname', 'year level', 'form group',
                     'stkey', 'pref_name', 'birthdate', 'home_group', 'school_year'],
  student_details:  ['student_key', 'student key', 'eal', 'aboriginal'],
  attendance:       ['absence date', 'absence_date', 'absence', 'reason', 'date',
                     'stkey', 'am_attended', 'pm_attended', 'am_late_arrival', 'pm_late_arrival'],
  users:            ['email', 'name', 'role'],
  staff:            ['sfkey', 'first_name', 'surname', 'e_mail', 'email',
                     'staff_status', 'payroll_class'],
};

async function reviewFile(file, expectedKind) {
  const name = (file.name || '').toLowerCase();

  // ZIP — photos
  if (expectedKind === 'photos') {
    if (name.endsWith('.zip')) {
      return { ok: true, detected: 'photos', hint: 'ZIP archive detected — ready to upload.' };
    }
    return { ok: false, detected: 'unknown', hint: `Expected a .zip archive of photos but got "${file.name}".` };
  }

  // All other kinds are CSV/XLSX — XLSX headers can't be peeked client-side,
  // so we trust the extension and let the backend validate.
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return { ok: true, detected: expectedKind, hint: 'Excel file detected — ready to upload.' };
  }
  if (!name.endsWith('.csv')) {
    return { ok: false, detected: 'unknown', hint: `Expected a CSV or XLSX file but got "${file.name}".` };
  }

  let headers = [];
  try {
    const chunk = await readFirstLines(file, 4096);
    // Find first non-empty line with comma-like content
    const firstLine = chunk.split(/\r?\n/).find(l => l.trim() && l.includes(',')) || '';
    headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  } catch {
    return { ok: false, detected: 'unknown', hint: 'Could not read file headers.' };
  }

  const detected = detectKind(headers);
  const expectedKeywords = SIGNATURES[expectedKind] || [];
  const matchCount = expectedKeywords.filter(k => headers.some(h => h.includes(k))).length;
  const ok = matchCount >= 2 || detected === expectedKind;

  if (ok) {
    return {
      ok: true,
      detected,
      hint: `${humanizeKind(detected || expectedKind)} file detected — ready to import.`,
    };
  }
  return {
    ok: false,
    detected,
    hint: detected && detected !== expectedKind
      ? `This looks like a ${humanizeKind(detected)} file, not ${humanizeKind(expectedKind)}. Did you mean to drop it in the ${humanizeKind(detected)} section?`
      : `Headers don't look like a ${humanizeKind(expectedKind)} export. Expected columns like: ${expectedKeywords.join(', ')}.`,
  };
}

function detectKind(headers) {
  // Score each kind and pick the best
  let best = { kind: null, score: 0 };
  for (const [kind, keywords] of Object.entries(SIGNATURES)) {
    const score = keywords.filter(k => headers.some(h => h.includes(k))).length;
    if (score > best.score) best = { kind, score };
  }
  return best.score >= 2 ? best.kind : null;
}

function humanizeKind(kind) {
  return ({
    students: 'Students',
    student_details: 'Student Details',
    attendance: 'Attendance',
    photos: 'Photos',
    users: 'Users',
    staff: 'Staff',
  })[kind] || 'the target';
}

async function readFirstLines(file, maxBytes = 4096) {
  const slice = file.slice(0, maxBytes);
  const text = await slice.text();
  return text;
}
