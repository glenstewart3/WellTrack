import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Trash2, Database, AlertTriangle, CheckCircle, Loader,
  Download, Upload,
} from 'lucide-react';

/**
 * Data management panel — seed / export / restore / wipe.
 * Hosts its own banner message state so it can be dropped into any tab
 * (used by both Administration and — historically — Settings).
 */
export default function DataManagement() {
  const [seeding, setSeeding] = useState(false);
  const [seedStudentCount, setSeedStudentCount] = useState('32');
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [wipeInput, setWipeInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [csvLoading, setCsvLoading] = useState({});
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState(null);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState('success');
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const showMsg = (text, type = 'success', timeout = 4000) => {
    setMsgType(type);
    setMsg(text);
    if (timeout) setTimeout(() => setMsg(''), timeout);
  };

  const fetchBackups = async () => {
    try {
      const res = await api.get('/backups');
      setBackups(res.data.backups || []);
    } catch (e) { console.error(e); }
    finally { setBackupsLoading(false); }
  };

  useEffect(() => { fetchBackups(); }, []);

  const triggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await api.post('/backups/trigger', {});
      showMsg(`Backup created: ${res.data.filename} (${res.data.size_kb} KB)`);
      await fetchBackups();
    } catch { showMsg('Backup failed', 'error', 3000); }
    finally { setTriggeringBackup(false); }
  };

  const downloadBackup = (filename) => {
    const a = document.createElement('a');
    a.href = `${process.env.REACT_APP_BACKEND_URL}/api/backups/download/${filename}`;
    a.download = filename;
    a.click();
  };

  const deleteBackup = async (filename) => {
    setDeletingBackup(filename);
    try {
      await api.delete(`/backups/${filename}`);
      setBackups(prev => prev.filter(b => b.filename !== filename));
    } catch { showMsg('Delete failed', 'error', 3000); }
    finally { setDeletingBackup(null); }
  };

  const downloadCSV = async (endpoint, filename) => {
    setCsvLoading(prev => ({ ...prev, [endpoint]: true }));
    try {
      const res = await api.get(`/${endpoint}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { showMsg('Export failed', 'error', 3000); }
    finally { setCsvLoading(prev => ({ ...prev, [endpoint]: false })); }
  };

  const seedData = async () => {
    const count = Math.max(8, Math.min(400, parseInt(seedStudentCount) || 32));
    setSeedStudentCount(String(count));
    setSeeding(true);
    try {
      const res = await api.post('/settings/seed', { student_count: count });
      showMsg(`Demo data loaded: ${res.data.students} students, ${res.data.interventions} interventions`, 'success', 5000);
    } catch (e) { console.error(e); } finally { setSeeding(false); }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/settings/export-all', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url;
      a.download = `welltrack_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showMsg('Data exported successfully', 'success', 3000);
    } catch (e) { console.error(e); } finally { setExporting(false); }
  };

  const handleRestoreFile = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text(); const data = JSON.parse(text);
      const res = await api.post('/settings/restore', data);
      const counts = Object.entries(res.data.restored || {}).map(([k, v]) => `${v} ${k}`).join(', ');
      showMsg(`Restored: ${counts}`, 'success', 5000);
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Restore failed', 'error', 5000);
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const wipeData = async () => {
    if (wipeInput !== 'DELETE') return;
    setWiping(true);
    try {
      await api.delete('/settings/data');
      setShowWipeConfirm(false); setWipeInput('');
      showMsg('All data wiped');
    } catch (e) { console.error(e); } finally { setWiping(false); }
  };

  const deleteTargetData = async () => {
    if (deleteInput !== 'DELETE' || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/settings/data/${deleteTarget}`);
      setDeleteTarget(null); setDeleteInput('');
      const label = deleteTarget === 'students' ? 'Student data' : 'Attendance data';
      showMsg(`${label} deleted`);
    } catch (e) { console.error(e); } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-3">
      {msg && (
        <div className={`flex items-center gap-2 rounded-xl p-4 ${msgType === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle size={15} className={msgType === 'error' ? 'text-rose-600' : 'text-emerald-600'} />
          <p className={`text-sm ${msgType === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg}</p>
        </div>
      )}

      {/* Demo Data */}
      <div className="p-4 bg-slate-50 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Load Demo Data</p>
            <p className="text-xs text-slate-400 mt-0.5">Reload sample students, screenings, interventions and alerts</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number" min="8" max="400" value={seedStudentCount}
              onChange={e => setSeedStudentCount(e.target.value)}
              onBlur={e => {
                const v = Math.max(8, Math.min(400, parseInt(e.target.value) || 32));
                setSeedStudentCount(String(v));
              }}
              data-testid="seed-student-count-input"
              className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center font-medium bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              title="Number of demo students (8–400)"
            />
            <span className="text-xs text-slate-400">students</span>
            <button onClick={seedData} disabled={seeding} data-testid="load-demo-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60">
              {seeding ? <Loader size={14} className="animate-spin" /> : <Database size={14} />}
              {seeding ? '…' : 'Load Demo Data'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-semibold text-slate-700">Export All Data</p>
          <p className="text-xs text-slate-400 mt-0.5">Download a full JSON backup of all school data</p>
        </div>
        <button onClick={exportData} disabled={exporting} data-testid="export-all-data-btn"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 self-start sm:self-auto">
          {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />} {exporting ? '…' : 'Export Backup'}
        </button>
      </div>

      {/* CSV Data Exports */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Export CSV Data</h3>
        <p className="text-xs text-slate-400 mb-4">Download individual data sets as CSV for use in Excel or other tools.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { endpoint: 'reports/students-csv', filename: 'students.csv', label: 'Student List', desc: 'All students with year level & class', testid: 'export-students-csv-btn' },
            { endpoint: 'reports/tier-summary-csv', filename: 'tier_summary.csv', label: 'Tier Summary', desc: 'MTSS tier, SAEBRS & attendance per student', testid: 'export-tier-csv-btn' },
            { endpoint: 'reports/screening-csv', filename: 'screening.csv', label: 'Screening Results', desc: 'Full SAEBRS screening data', testid: 'export-screening-csv-btn' },
            { endpoint: 'reports/interventions-csv', filename: 'interventions.csv', label: 'Interventions', desc: 'All intervention records & status', testid: 'export-interventions-csv-btn' },
          ].map(item => (
            <div key={item.endpoint} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{item.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">{item.desc}</p>
              </div>
              <button
                onClick={() => downloadCSV(item.endpoint, item.filename)}
                disabled={csvLoading[item.endpoint]}
                data-testid={item.testid}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 shrink-0">
                {csvLoading[item.endpoint] ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                {csvLoading[item.endpoint] ? '…' : 'CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Automatic Backups */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Manrope,sans-serif' }}>Automatic Daily Backups</h3>
            <p className="text-xs text-slate-400 mt-0.5">JSON snapshots of all school data — saved to the server at midnight each day. Last 30 days kept.</p>
          </div>
          <button onClick={triggerBackup} disabled={triggeringBackup} data-testid="trigger-backup-btn"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60 shrink-0 self-start sm:self-auto">
            {triggeringBackup ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
            {triggeringBackup ? 'Creating…' : 'Run Now'}
          </button>
        </div>

        {backupsLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}</div>
        ) : backups.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg">
            No backups yet — click "Run Now" to create the first one.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            {backups.map(b => (
              <div key={b.filename} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg gap-2" data-testid={`backup-item-${b.filename}`}>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{b.filename}</p>
                  <p className="text-xs text-slate-400 truncate">{new Date(b.created_at).toLocaleString()} · {b.size_kb} KB</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => downloadBackup(b.filename)} data-testid={`download-backup-${b.filename}`}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition-colors">
                    <Download size={13} />
                  </button>
                  {user?.role === 'admin' && (
                    <button onClick={() => deleteBackup(b.filename)} disabled={deletingBackup === b.filename} data-testid={`delete-backup-${b.filename}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-60">
                      {deletingBackup === b.filename ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {user?.role === 'admin' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div>
            <p className="text-sm font-semibold text-blue-700">Restore Data</p>
            <p className="text-xs text-blue-400 mt-0.5">Upload a WellTrack JSON backup file</p>
          </div>
          <div className="self-start sm:self-auto">
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestoreFile} className="hidden" data-testid="restore-file-input" />
            <button onClick={() => fileInputRef.current?.click()} disabled={restoring} data-testid="restore-data-btn"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              {restoring ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />} {restoring ? 'Restoring…' : 'Restore Backup'}
            </button>
          </div>
        </div>
      )}

      {/* Targeted delete options */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Manrope,sans-serif' }}>Delete Specific Data</h3>
        <p className="text-xs text-slate-400 mb-4">Remove a specific category of data without affecting everything else.</p>
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete Student Data</p>
              <p className="text-xs text-rose-400 mt-0.5">Removes all students, screenings, interventions, case notes and alerts</p>
            </div>
            <button onClick={() => { setDeleteTarget('students'); setDeleteInput(''); }} data-testid="delete-students-btn"
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shrink-0 self-start sm:self-auto">
              <Trash2 size={13} /> Delete Students
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-rose-50 rounded-xl border border-rose-100">
            <div>
              <p className="text-sm font-semibold text-rose-700">Delete Attendance Data</p>
              <p className="text-xs text-rose-400 mt-0.5">Removes all uploaded absence records (calendar terms are kept)</p>
            </div>
            <button onClick={() => { setDeleteTarget('attendance'); setDeleteInput(''); }} data-testid="delete-attendance-btn"
              className="flex items-center gap-2 px-3 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shrink-0 self-start sm:self-auto">
              <Trash2 size={13} /> Delete Attendance
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
        <div>
          <p className="text-sm font-semibold text-rose-700">Delete All Data</p>
          <p className="text-xs text-rose-400 mt-0.5">Permanently removes all students, screenings, and interventions</p>
        </div>
        <button onClick={() => setShowWipeConfirm(true)} data-testid="wipe-data-btn"
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors self-start sm:self-auto">
          <Trash2 size={14} /> Wipe All Data
        </button>
      </div>

      {/* Targeted delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-rose-600" /></div>
              <h3 className="font-bold text-slate-900">
                Delete {deleteTarget === 'students' ? 'Student' : 'Attendance'} Data?
              </h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              {deleteTarget === 'students'
                ? 'This will permanently delete all students, screenings, interventions, case notes, and alerts.'
                : 'This will permanently delete all uploaded attendance records. Calendar terms and school days are kept.'}
              {' '}Type <strong>DELETE</strong> to confirm.
            </p>
            <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type DELETE"
              data-testid="delete-target-confirm-input"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={deleteTargetData} disabled={deleteInput !== 'DELETE' || deleting}
                data-testid="confirm-delete-target-btn"
                className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setDeleteTarget(null); setDeleteInput(''); }}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showWipeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-rose-600" /></div>
              <h3 className="font-bold text-slate-900">Wipe All Data?</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">This will permanently delete all students, screenings, interventions, and case notes. Type <strong>DELETE</strong> to confirm.</p>
            <input value={wipeInput} onChange={e => setWipeInput(e.target.value)} placeholder="Type DELETE"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm mb-4 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={wipeData} disabled={wipeInput !== 'DELETE' || wiping}
                className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 transition-colors">
                {wiping ? 'Wiping…' : 'Confirm Delete'}
              </button>
              <button onClick={() => { setShowWipeConfirm(false); setWipeInput(''); }}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
