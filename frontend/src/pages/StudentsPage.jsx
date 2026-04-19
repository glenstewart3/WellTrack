import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { getTierColors, getRiskColors } from '../utils/tierUtils';
import { Search, Users, Upload, Download, X, CheckCircle, AlertTriangle, Loader, ChevronRight, UserPlus, Archive, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Trash2, Camera } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';
import useDocumentTitle from '../hooks/useDocumentTitle';

const CSV_TEMPLATE = `first_name,last_name,year_level,class_name,teacher,gender,date_of_birth
Emma,Smith,Year 3,Year 3A,Ms Thompson,Female,2014-03-15
Liam,Johnson,Year 5,Year 5B,Mr Rodriguez,Male,2012-08-22
Olivia,Williams,Year 7,Year 7C,Ms Chen,Female,2010-05-10`;

const REQUIRED_COLS = ['first_name', 'last_name', 'year_level', 'class_name', 'teacher'];

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line, idx) => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] || '' }), { _row: idx + 2 });
  });
  return { headers, rows };
}

function ImportModal({ onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'welltrack_students_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setParseError('');
    setParsed(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length > 0) {
        setParseError(`CSV missing required columns: ${missing.join(', ')}`);
        return;
      }
      setParsed({ headers, rows, fileName: file.name });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const doImport = async () => {
    if (!parsed) return;
    setImporting(true);
    try {
      const res = await api.post('/students/import', { students: parsed.rows });
      setResult(res.data);
      if (res.data.imported > 0) onSuccess();
    } catch (e) {
      setParseError(e.response?.data?.detail || 'Import failed. Please try again.');
    }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>Import Students</h3>
            <p className="text-xs text-slate-400 mt-0.5">Upload a CSV file to add students in bulk</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Template download */}
          <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
            <div>
              <p className="text-sm font-semibold text-slate-700">CSV Template</p>
              <p className="text-xs text-slate-400 mt-0.5">Required: first_name, last_name, year_level, class_name, teacher</p>
            </div>
            <button onClick={downloadTemplate} data-testid="download-template-btn"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              <Download size={14} /> Download Template
            </button>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              data-testid="csv-drop-zone"
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver ? 'border-slate-500 bg-slate-50' : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              <Upload size={24} className="mx-auto mb-3 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">.csv files only</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                data-testid="csv-file-input"
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
              <AlertTriangle size={15} className="text-rose-600 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {parsed && !result && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">
                  Preview — <span className="text-slate-500 font-normal">{parsed.fileName}</span>
                </p>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{parsed.rows.length} rows</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-52">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                      <tr>
                        {REQUIRED_COLS.map(h => (
                          <th key={h} className="text-left py-2 px-3 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 8).map((row, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          {REQUIRED_COLS.map(h => (
                            <td key={h} className={`py-2 px-3 ${row[h] ? 'text-slate-700' : 'text-rose-400 italic'}`}>
                              {row[h] || 'missing'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 8 && (
                  <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50">+{parsed.rows.length - 8} more rows not shown</p>
                )}
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              <div className={`flex items-start gap-3 rounded-xl p-4 border ${result.imported > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <CheckCircle size={18} className={result.imported > 0 ? 'text-emerald-600 mt-0.5 shrink-0' : 'text-amber-600 mt-0.5 shrink-0'} />
                <div>
                  <p className={`text-sm font-semibold ${result.imported > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {result.imported} of {result.total} students imported successfully
                  </p>
                  {result.errors.length > 0 && (
                    <p className="text-xs text-amber-700 mt-0.5">{result.errors.length} rows skipped due to errors</p>
                  )}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="border border-rose-200 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 px-3 py-2 border-b border-rose-100">
                    <p className="text-xs font-semibold text-rose-700">Import Errors</p>
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 last:border-0">
                        <span className="text-xs text-slate-400">Row {e.row}</span>
                        <span className="text-xs font-medium text-slate-700">{e.name || '—'}</span>
                        <span className="text-xs text-rose-600 ml-auto">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          {!result ? (
            <>
              <button onClick={doImport} disabled={!parsed || importing} data-testid="confirm-import-btn"
                className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {importing ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                {importing ? 'Importing...' : `Import ${parsed ? parsed.rows.length : 0} Students`}
              </button>
              <button onClick={onClose}
                className="flex-1 bg-slate-100 text-slate-700 py-3 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={onClose} data-testid="import-done-btn"
              className="flex-1 bg-slate-900 text-white py-3 text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  useDocumentTitle('Students');
  const navigate = useNavigate();
  const { canDo } = usePermissions();
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({ first_name: '', last_name: '', year_level: '', class_name: '', teacher: '', gender: '', date_of_birth: '' });
  const [addStudentSaving, setAddStudentSaving] = useState(false);
  const [addStudentError, setAddStudentError] = useState('');
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoUploadRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('active');
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [filterChronicOnly, setFilterChronicOnly] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Apply tier filter passed via navigation state (e.g. from Dashboard stat cards)
  useEffect(() => {
    if (location.state?.filterTier) {
      setFilterTier(location.state.filterTier);
      // Clear the state so back-navigation doesn't re-apply it
      window.history.replaceState({}, '');
    }
  }, []);

  const loadStudents = async () => {
    try {
      const [studRes, clsRes] = await Promise.all([
        api.get(`/students/summary?status=${filterStatus}`),
        api.get('/classes'),
      ]);
      setStudents(studRes.data);
      setClasses(clsRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadStudents(); }, [filterStatus]);

  const filtered = students.filter(s => {
    const name = `${s.first_name} ${s.preferred_name || ''} ${s.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchClass = !filterClass || s.class_name === filterClass;
    const matchTier = !filterTier || String(s.mtss_tier) === filterTier;
    const matchChronic = !filterChronicOnly || (s.attendance_pct !== null && s.attendance_pct < 90);
    return matchSearch && matchClass && matchTier && matchChronic;
  }).sort((a, b) => {
    if (!sortField) return (b.mtss_tier || 0) - (a.mtss_tier || 0);
    let aVal, bVal;
    switch (sortField) {
      case 'student': aVal = `${a.last_name} ${a.first_name}`.toLowerCase(); bVal = `${b.last_name} ${b.first_name}`.toLowerCase(); break;
      case 'class': aVal = (a.class_name || '').toLowerCase(); bVal = (b.class_name || '').toLowerCase(); break;
      case 'year': aVal = parseInt((a.year_level || '').replace(/\D/g, '') || '0'); bVal = parseInt((b.year_level || '').replace(/\D/g, '') || '0'); break;
      case 'tier': aVal = a.mtss_tier || 99; bVal = b.mtss_tier || 99; break;
      case 'attend': aVal = a.attendance_pct ?? 100; bVal = b.attendance_pct ?? 100; break;
      case 'saebrs': aVal = a.saebrs_total ?? -1; bVal = b.saebrs_total ?? -1; break;
      case 'interventions': aVal = a.intervention_count || 0; bVal = b.intervention_count || 0; break;
      default: return 0;
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const addSingleStudent = async () => {
    if (!addStudentForm.first_name || !addStudentForm.last_name || !addStudentForm.year_level || !addStudentForm.class_name || !addStudentForm.teacher) {
      setAddStudentError('Please fill all required fields (*)'); return;
    }
    setAddStudentSaving(true); setAddStudentError('');
    try {
      await api.post('/students', addStudentForm);
      setShowAddStudent(false);
      setAddStudentForm({ first_name: '', last_name: '', year_level: '', class_name: '', teacher: '', gender: '', date_of_birth: '' });
      loadStudents();
    } catch (e) { setAddStudentError(e.response?.data?.detail || 'Failed to add student'); }
    finally { setAddStudentSaving(false); }
  };

  const openEdit = (s, e) => {
    e.stopPropagation();
    setEditStudent(s);
    setEditForm({ first_name: s.first_name || '', preferred_name: s.preferred_name || '', last_name: s.last_name || '', year_level: s.year_level || '', class_name: s.class_name || '', teacher: s.teacher || '', gender: s.gender || '', date_of_birth: s.date_of_birth || '' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editForm.first_name || !editForm.last_name) { setEditError('First and last name are required'); return; }
    setEditSaving(true); setEditError('');
    try {
      await api.put(`/students/${editStudent.student_id}`, editForm);
      setEditStudent(null);
      loadStudents();
    } catch (e) { setEditError(e.response?.data?.detail || 'Update failed'); }
    finally { setEditSaving(false); }
  };

  const removePhoto = async () => {
    if (!editStudent?.student_id) return;
    setRemovingPhoto(true);
    try {
      await api.delete(`/students/${editStudent.student_id}/photo`);
      setEditStudent(prev => ({ ...prev, photo_url: null }));
      loadStudents();
    } catch (e) { setEditError(e.response?.data?.detail || 'Failed to remove photo'); }
    finally { setRemovingPhoto(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editStudent?.student_id) return;
    if (photoUploadRef.current) photoUploadRef.current.value = '';
    setUploadingPhoto(true);
    setEditError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/students/${editStudent.student_id}/photo`, fd);
      setEditStudent(prev => ({ ...prev, photo_url: res.data.photo_url }));
      loadStudents();
    } catch (e) { setEditError(e.response?.data?.detail || 'Photo upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map(s => s.student_id)));
  };

  const archiveSelected = async () => {
    if (!window.confirm(`Archive ${selectedIds.size} student(s)? They will be hidden from the active list.`)) return;
    setArchiving(true);
    try {
      await api.put('/students/bulk-archive', { student_ids: [...selectedIds] });
      setSelectedIds(new Set());
      loadStudents();
    } catch (e) { console.error(e); }
    finally { setArchiving(false); }
  };

  const reactivateSelected = async () => {
    if (!window.confirm(`Reactivate ${selectedIds.size} student(s)? They will return to the active list.`)) return;
    setReactivating(true);
    try {
      await api.put('/students/bulk-reactivate', { student_ids: [...selectedIds] });
      setSelectedIds(new Set());
      loadStudents();
    } catch (e) { console.error(e); }
    finally { setReactivating(false); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Students</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-slate-500">{students.length} {filterStatus === 'archived' ? 'archived' : 'enrolled'} students</p>
            {filterStatus === 'active' && (() => {
              const chronicCount = students.filter(s => s.attendance_pct !== null && s.attendance_pct < 90).length;
              return chronicCount > 0 ? (
                <button
                  onClick={() => setFilterChronicOnly(f => !f)}
                  data-testid="chronic-absentee-summary-chip"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${filterChronicOnly ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                >
                  <AlertTriangle size={12} />
                  {chronicCount} chronic absentee{chronicCount !== 1 ? 's' : ''}
                </button>
              ) : null;
            })()}
          </div>
        </div>
        <div className="flex gap-2">
          {filterStatus === 'active' && canDo('students.add_edit') && (
            <button onClick={() => setShowAddStudent(true)} data-testid="add-student-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
              <UserPlus size={15} /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Import moved to Settings > Imports */}

      {/* Add Student Modal */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>Add Student</h3>
              <button onClick={() => setShowAddStudent(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            {addStudentError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-4">{addStudentError}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">First Name *</label>
                  <input value={addStudentForm.first_name} onChange={e => setAddStudentForm(p => ({...p, first_name: e.target.value}))}
                    data-testid="add-student-first-name" placeholder="Emma"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Last Name *</label>
                  <input value={addStudentForm.last_name} onChange={e => setAddStudentForm(p => ({...p, last_name: e.target.value}))}
                    data-testid="add-student-last-name" placeholder="Smith"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Year Level *</label>
                  <input value={addStudentForm.year_level} onChange={e => setAddStudentForm(p => ({...p, year_level: e.target.value}))}
                    placeholder="Year 5"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Class *</label>
                  <input value={addStudentForm.class_name} onChange={e => setAddStudentForm(p => ({...p, class_name: e.target.value}))}
                    placeholder="5A"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Teacher *</label>
                <input value={addStudentForm.teacher} onChange={e => setAddStudentForm(p => ({...p, teacher: e.target.value}))}
                  placeholder="Ms Thompson"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Gender</label>
                  <select value={addStudentForm.gender} onChange={e => setAddStudentForm(p => ({...p, gender: e.target.value}))}
                    className="w-full h-[42px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none">
                    <option value="">Not specified</option>
                    <option>Male</option><option>Female</option><option>Non-binary</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-slate-500 block mb-1">Date of Birth</label>
                  <input type="date" value={addStudentForm.date_of_birth} onChange={e => setAddStudentForm(p => ({...p, date_of_birth: e.target.value}))}
                    placeholder="dd/mm/yyyy"
                    className="w-full max-w-full h-[42px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none appearance-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={addSingleStudent} disabled={addStudentSaving} data-testid="confirm-add-student-btn"
                className="flex-1 bg-slate-900 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {addStudentSaving ? <Loader size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {addStudentSaving ? 'Adding…' : 'Add Student'}
              </button>
              <button onClick={() => setShowAddStudent(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-slate-500 font-medium">Status:</span>
        {[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }].map(opt => (
          <button key={opt.value} onClick={() => { setFilterStatus(opt.value); setSelectedIds(new Set()); }}
            data-testid={`status-filter-${opt.value}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === opt.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-36">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="student-search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400"
          />
        </div>
        <select
          value={filterClass}
          onChange={e => setFilterClass(e.target.value)}
          data-testid="filter-class"
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white hidden sm:block"
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
        </select>
        <select
          value={filterTier}
          onChange={e => setFilterTier(e.target.value)}
          data-testid="filter-tier"
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 bg-white hidden sm:block"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1 (Low Risk)</option>
          <option value="2">Tier 2 (Emerging)</option>
          <option value="3">Tier 3 (High Risk)</option>
          <option value="">Not Screened</option>
        </select>
        <button
          onClick={() => setFilterChronicOnly(f => !f)}
          data-testid="filter-chronic-toggle"
          title="Show only students with attendance below 90%"
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors shrink-0 hidden sm:flex ${
            filterChronicOnly
              ? 'bg-rose-600 text-white border-rose-600'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle size={14} />
          Chronic Absence
        </button>
        {/* Edit mode toggle — shown if they can edit or archive */}
        {(canDo('students.add_edit') || canDo('students.archive')) && (
        <button
          onClick={() => { setBulkEditMode(m => !m); setSelectedIds(new Set()); }}
          data-testid="bulk-edit-toggle"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shrink-0 ${
            bulkEditMode
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {bulkEditMode ? 'Done' : 'Edit'}
        </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={40} className="mb-3" />
            <p className="font-medium">No students found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {bulkEditMode && (
                    <th className="py-3 px-3 w-8">
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 cursor-pointer" />
                    </th>
                  )}
                  {[
                    { key: 'student', label: 'Student', cls: '' },
                    { key: 'class', label: 'Class', cls: 'hidden sm:table-cell' },
                    { key: 'year', label: 'Year', cls: 'hidden md:table-cell' },
                    { key: 'tier', label: 'Tier', cls: '' },
                    { key: 'saebrs', label: 'SAEBRS', cls: 'hidden md:table-cell' },
                    { key: null, label: 'Wellbeing', cls: 'hidden lg:table-cell' },
                    { key: 'attend', label: 'Attend.', cls: '' },
                    { key: 'interventions', label: 'Interventions', cls: 'hidden sm:table-cell' },
                  ].map(({ key, label, cls }) => (
                    <th key={label}
                      onClick={() => key && handleSort(key)}
                      className={`text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider ${cls} ${key ? 'cursor-pointer select-none hover:text-slate-700 transition-colors' : ''}`}>
                      <span className="flex items-center gap-1">
                        {label}
                        {key && (sortField === key
                          ? (sortDir === 'asc' ? <ArrowUp size={12} className="text-slate-700" /> : <ArrowDown size={12} className="text-slate-700" />)
                          : <ArrowUpDown size={11} className="text-slate-300" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-14"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const colors = getTierColors(s.mtss_tier);
                  return (
                    <tr
                      key={s.student_id}
                      onClick={(e) => bulkEditMode ? openEdit(s, e) : navigate(`/students/${s.student_id}`)}
                      className={`border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${selectedIds.has(s.student_id) ? 'bg-indigo-50/50' : ''}`}
                      data-testid={`student-row-${s.student_id}`}
                    >
                      {bulkEditMode && (
                        <td className="py-3 px-3 w-8" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.has(s.student_id)}
                            onChange={e => toggleSelect(s.student_id, e)}
                            className="rounded border-slate-300 cursor-pointer" />
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                            {s.photo_url
                              ? <img src={`${process.env.REACT_APP_BACKEND_URL}${s.photo_url}`} alt="" className="w-full h-full object-cover" />
                              : <span className="text-xs font-semibold text-slate-600">{s.first_name[0]}{s.last_name[0]}</span>
                            }
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-slate-900 text-xs sm:text-sm leading-tight">
                              {s.first_name}{s.preferred_name && s.preferred_name !== s.first_name ? ` (${s.preferred_name})` : ''} {s.last_name}
                            </span>
                            {(s.eal_status && s.eal_status !== 'Not EAL') || s.aboriginal_status === 'Aboriginal' ? (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {s.eal_status && s.eal_status !== 'Not EAL' && (
                                  <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                                    {s.eal_status.includes('< 5') ? 'EAL <5yr' : s.eal_status.includes('>=5') ? 'EAL 5-7yr' : s.eal_status.includes('Fee') ? 'EAL Fee' : 'EAL'}
                                  </span>
                                )}
                                {s.aboriginal_status === 'Aboriginal' && (
                                  <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold bg-teal-100 text-teal-700">Aboriginal</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 text-sm hidden sm:table-cell">{s.class_name}</td>
                      <td className="py-3 px-4 text-slate-600 text-sm hidden md:table-cell">{s.year_level}</td>
                      <td className="py-3 px-4">
                        {s.mtss_tier ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                            T{s.mtss_tier}
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColors(s.saebrs_risk)}`}>
                          {s.saebrs_risk === 'Not Screened' ? '—' : s.saebrs_risk || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {s.wellbeing_tier ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getTierColors(s.wellbeing_tier).badge}`}>
                            T{s.wellbeing_tier} ({s.wellbeing_total}/66)
                          </span>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-medium ${s.attendance_pct !== null && s.attendance_pct < 80 ? 'text-rose-600' : s.attendance_pct !== null && s.attendance_pct < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {s.attendance_pct !== null ? `${s.attendance_pct}%` : '—'}
                          </span>
                          {s.attendance_pct !== null && s.attendance_pct < 90 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-px rounded text-[10px] font-bold bg-rose-100 text-rose-700 leading-none"
                              data-testid={`chronic-badge-${s.student_id}`}
                              title={`Chronic absence: ${s.attendance_pct}% attendance (below 90%)`}
                            >
                              <AlertTriangle size={9} />
                              CA
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        {s.active_interventions > 0 ? (
                          <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-medium">{s.active_interventions}</span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <ChevronRight size={15} className="text-slate-400" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      {editStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900 text-lg" style={{fontFamily:'Manrope,sans-serif'}}>Edit Student</h3>
              <button onClick={() => setEditStudent(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            {editError && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3 mb-4">{editError}</div>}
            {/* Clickable photo avatar — click to upload/replace, X to remove */}
            <div className="flex flex-col items-center mb-5 gap-1.5">
              <input ref={photoUploadRef} type="file" accept="image/*" className="hidden"
                onChange={handlePhotoUpload} data-testid="edit-modal-photo-input" />
              <div className="relative group">
                <button
                  onClick={() => photoUploadRef.current?.click()}
                  disabled={uploadingPhoto || removingPhoto}
                  className="w-20 h-20 rounded-2xl overflow-hidden block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:cursor-not-allowed"
                  data-testid="edit-modal-photo-area"
                >
                  {editStudent?.photo_url
                    ? <img src={`${process.env.REACT_APP_BACKEND_URL}${editStudent.photo_url}`} alt="" className="w-full h-full object-cover" data-testid="edit-modal-photo" />
                    : <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                        <span className="text-2xl font-bold text-slate-400">{editForm.first_name?.[0]}{editForm.last_name?.[0]}</span>
                      </div>
                  }
                  {/* hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-2xl">
                    <Camera size={20} className="text-white" />
                  </div>
                  {/* uploading overlay */}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-2xl">
                      <Loader size={20} className="text-white animate-spin" />
                    </div>
                  )}
                </button>
                {/* X remove button */}
                {editStudent?.photo_url && !uploadingPhoto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removePhoto(); }}
                    disabled={removingPhoto}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                    data-testid="remove-photo-btn"
                  >
                    {removingPhoto ? <Loader size={9} className="animate-spin" /> : <X size={10} />}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {editStudent?.photo_url ? 'Click photo to replace' : 'Click to add photo'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">First Name *</label>
                  <input value={editForm.first_name} onChange={e => setEditForm(p => ({...p, first_name: e.target.value}))}
                    data-testid="edit-first-name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Last Name *</label>
                  <input value={editForm.last_name} onChange={e => setEditForm(p => ({...p, last_name: e.target.value}))}
                    data-testid="edit-last-name"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Preferred Name</label>
                <input value={editForm.preferred_name} onChange={e => setEditForm(p => ({...p, preferred_name: e.target.value}))}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Year Level *</label>
                  <input value={editForm.year_level} onChange={e => setEditForm(p => ({...p, year_level: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Class *</label>
                  <input value={editForm.class_name} onChange={e => setEditForm(p => ({...p, class_name: e.target.value}))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Teacher *</label>
                <input value={editForm.teacher} onChange={e => setEditForm(p => ({...p, teacher: e.target.value}))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Gender</label>
                  <select value={editForm.gender} onChange={e => setEditForm(p => ({...p, gender: e.target.value}))}
                    className="w-full h-[42px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none">
                    <option value="">Not specified</option>
                    <option>Male</option><option>Female</option><option>Non-binary</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="text-xs text-slate-500 block mb-1">Date of Birth</label>
                  <input type="date" value={editForm.date_of_birth} onChange={e => setEditForm(p => ({...p, date_of_birth: e.target.value}))}
                    placeholder="dd/mm/yyyy"
                    className="w-full max-w-full h-[42px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none appearance-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={saveEdit} disabled={editSaving} data-testid="confirm-edit-student-btn"
                className="flex-1 bg-slate-900 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {editSaving && <Loader size={14} className="animate-spin" />}
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditStudent(null)}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk action bar — only shown in edit mode */}
      {bulkEditMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl px-5 py-3 flex items-center gap-4 shadow-xl">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          {filterStatus === 'archived' ? (
            canDo('students.archive') && (
              <button onClick={reactivateSelected} disabled={reactivating} data-testid="bulk-reactivate-btn"
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                {reactivating ? <Loader size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                {reactivating ? 'Reactivating…' : 'Reactivate'}
              </button>
            )
          ) : (
            canDo('students.archive') && (
              <button onClick={archiveSelected} disabled={archiving} data-testid="bulk-archive-btn"
                className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60">
                {archiving ? <Loader size={13} className="animate-spin" /> : <Archive size={13} />}
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            )
          )}
          <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
