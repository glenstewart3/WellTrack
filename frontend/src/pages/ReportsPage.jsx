import React, { useState } from 'react';
import axios from 'axios';
import { FileText, Download, Loader } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const REPORTS = [
  {
    id: 'tier-summary',
    title: 'MTSS Tier Summary',
    description: 'All students with MTSS tier, SAEBRS risk, wellbeing score, and attendance rate',
    endpoint: '/reports/tier-summary-csv',
    filename: 'tier_summary.csv',
    badge: 'Core Report',
    badgeColor: 'bg-slate-900 text-white',
  },
  {
    id: 'students',
    title: 'Student Roster',
    description: 'Complete student list with enrolment details, year levels, and class assignments',
    endpoint: '/reports/students-csv',
    filename: 'students.csv',
    badge: 'Roster',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'screening',
    title: 'Screening Results',
    description: 'All SAEBRS screening results across all students and screening periods',
    endpoint: '/reports/screening-csv',
    filename: 'screening_results.csv',
    badge: 'Screening',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'interventions',
    title: 'Intervention Outcomes',
    description: 'All interventions with assigned staff, goals, status, and outcome ratings',
    endpoint: '/reports/interventions-csv',
    filename: 'interventions.csv',
    badge: 'Interventions',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
];

export default function ReportsPage() {
  const [downloading, setDownloading] = useState({});
  const [downloaded, setDownloaded] = useState({});

  const downloadCSV = async (report) => {
    setDownloading(prev => ({ ...prev, [report.id]: true }));
    try {
      const res = await axios.get(`${API}${report.endpoint}`, {
        withCredentials: true,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloaded(prev => ({ ...prev, [report.id]: true }));
      setTimeout(() => setDownloaded(prev => ({ ...prev, [report.id]: false })), 3000);
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(prev => ({ ...prev, [report.id]: false }));
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
          <FileText size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>Reports & Data Export</h1>
          <p className="text-sm text-slate-500">Export your MTSS data as CSV files</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <FileText size={16} className="text-slate-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-slate-700">CSV Export Format</p>
          <p className="text-xs text-slate-500 mt-0.5">All reports export as comma-separated values (CSV). These can be opened in Excel, Google Sheets, or any data analysis tool.</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4">
        {REPORTS.map(report => (
          <div key={report.id} className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between gap-4 hover:border-slate-300 hover:shadow-sm transition-all">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <FileText size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900" style={{fontFamily:'Manrope,sans-serif'}}>{report.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${report.badgeColor}`}>{report.badge}</span>
                </div>
                <p className="text-sm text-slate-500">{report.description}</p>
              </div>
            </div>
            <button
              onClick={() => downloadCSV(report)}
              disabled={downloading[report.id]}
              data-testid={`download-${report.id}`}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 transition-all ${
                downloaded[report.id]
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
              } disabled:opacity-60`}
            >
              {downloading[report.id] ? (
                <><Loader size={14} className="animate-spin" /> Exporting...</>
              ) : downloaded[report.id] ? (
                <><FileText size={14} /> Downloaded</>
              ) : (
                <><Download size={14} /> Export CSV</>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Export Tips */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 mb-3" style={{fontFamily:'Manrope,sans-serif'}}>Export Tips</h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex gap-2"><span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">1</span><p>Start with the <strong>MTSS Tier Summary</strong> for a complete picture of your school's wellbeing</p></div>
          <div className="flex gap-2"><span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">2</span><p>Use the <strong>Screening Results</strong> report to track changes across screening periods</p></div>
          <div className="flex gap-2"><span className="w-4 h-4 bg-emerald-100 text-emerald-700 rounded text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">3</span><p>The <strong>Intervention Outcomes</strong> report is useful for MTSS team meetings and compliance</p></div>
        </div>
      </div>
    </div>
  );
}
