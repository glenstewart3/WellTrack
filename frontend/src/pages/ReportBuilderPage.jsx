import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api';
import {
  FileText, Download, Filter, Group, BarChart3, Calendar,
  ChevronDown, ChevronUp, Plus, X, Check, LayoutGrid,
  Users, Target, ClipboardCheck, School
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Available Data Fields ────────────────────────────────────────────────────
const DATA_FIELDS = [
  { id: 'student_name', label: 'Student Name', category: 'Student' },
  { id: 'class_name', label: 'Class', category: 'Student' },
  { id: 'year_level', label: 'Year Level', category: 'Student' },
  { id: 'mtss_tier', label: 'MTSS Tier', category: 'Risk' },
  { id: 'saebrs_total', label: 'SAEBRS Total', category: 'Risk' },
  { id: 'saebrs_emotional', label: 'SAEBRS Emotional', category: 'Risk' },
  { id: 'saebrs_social', label: 'SAEBRS Social', category: 'Risk' },
  { id: 'saebrs_academic', label: 'SAEBRS Academic', category: 'Risk' },
  { id: 'saebrs_risk', label: 'SAEBRS Risk Level', category: 'Risk' },
  { id: 'attendance_pct', label: 'Attendance %', category: 'Attendance' },
  { id: 'attendance_status', label: 'Attendance Status', category: 'Attendance' },
  { id: 'intervention_type', label: 'Intervention Type', category: 'Intervention' },
  { id: 'intervention_status', label: 'Intervention Status', category: 'Intervention' },
  { id: 'assigned_staff', label: 'Assigned Staff', category: 'Intervention' },
  { id: 'session_count', label: 'Session Count', category: 'Intervention' },
];

// ── Filter Operators ─────────────────────────────────────────────────────────
const FILTER_OPS = [
  { id: 'eq', label: 'Equals' },
  { id: 'ne', label: 'Not equals' },
  { id: 'gt', label: 'Greater than' },
  { id: 'lt', label: 'Less than' },
  { id: 'gte', label: 'Greater than or equal' },
  { id: 'lte', label: 'Less than or equal' },
  { id: 'contains', label: 'Contains' },
  { id: 'in', label: 'In list' },
];

// ── Report Builder Page ──────────────────────────────────────────────────────
export default function ReportBuilderPage() {
  useDocumentTitle('Report Builder');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canDo } = usePermissions();
  
  // Report configuration
  const [reportName, setReportName] = useState('');
  const [selectedFields, setSelectedFields] = useState(['student_name', 'class_name', 'mtss_tier']);
  const [filters, setFilters] = useState([]);
  const [groupBy, setGroupBy] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  // Data and UI state
  const [reportData, setReportData] = useState([]);
  const [groupedData, setGroupedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');

  // Group fields by category - must be before permission check
  const groupedFields = useMemo(() => {
    const groups = {};
    DATA_FIELDS.forEach(f => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, []);

  // Filtered fields for search
  const filteredFields = useMemo(() => {
    if (!fieldSearch) return groupedFields;
    const filtered = {};
    Object.entries(groupedFields).forEach(([cat, fields]) => {
      const matching = fields.filter(f => 
        f.label.toLowerCase().includes(fieldSearch.toLowerCase()) ||
        f.id.toLowerCase().includes(fieldSearch.toLowerCase())
      );
      if (matching.length) filtered[cat] = matching;
    });
    return filtered;
  }, [groupedFields, fieldSearch]);
  
  // Permission check - after all hooks
  if (!canDo('reports.view')) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">You don't have permission to access the report builder.</p>
      </div>
    );
  }

  // Generate report
  const generateReport = async () => {
    setLoading(true);
    try {
      const res = await api.post('/reports/custom', {
        fields: selectedFields,
        filters,
        group_by: groupBy,
        date_range: dateRange,
      });
      
      // Handle grouped response
      if (res.data?.grouped) {
        setGroupedData(res.data);
        setReportData([]);
      } else {
        setGroupedData(null);
        setReportData(res.data || []);
      }
    } catch (e) {
      console.error('Failed to generate report:', e);
    } finally {
      setLoading(false);
    }
  };

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const accent = [15, 23, 42];
    
    // Header
    doc.setFillColor(...accent);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text(reportName || 'Custom Report', 15, 17);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 22);
    
    const headers = selectedFields.map(f => DATA_FIELDS.find(df => df.id === f)?.label || f);
    
    if (groupedData) {
      // Export grouped data
      let startY = 30;
      groupedData.groups.forEach((group, idx) => {
        // Group header
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`${group.group_field}: ${group.group_key} (${group.count} students)`, 15, startY);
        startY += 8;
        
        // Group table
        const body = group.students.map(row => selectedFields.map(f => row[f] ?? '-'));
        autoTable(doc, {
          head: [headers],
          body,
          startY: startY,
          styles: { fontSize: 8, cellPadding: 1.5 },
          headStyles: { fillColor: accent, textColor: 255 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        startY = doc.lastAutoTable.finalY + 10;
      });
    } else {
      // Table
      const body = reportData.map(row => selectedFields.map(f => row[f] ?? '-'));
      autoTable(doc, {
        head: [headers],
        body,
        startY: 30,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: accent, textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }
    
    doc.save(`${reportName || 'report'}.pdf`);
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = selectedFields.map(f => DATA_FIELDS.find(df => df.id === f)?.label || f);
    let rows = [];
    
    if (groupedData) {
      // Export grouped data with group headers
      groupedData.groups.forEach(group => {
        rows.push([`${group.group_field}: ${group.group_key}`, `(${group.count} students)`, '', '']);
        group.students.forEach(row => {
          rows.push(selectedFields.map(f => {
            const val = row[f];
            return val === null || val === undefined ? '' : String(val).replace(/,/g, ';');
          }));
        });
        rows.push(['']); // Empty row between groups
      });
    } else {
      rows = reportData.map(row => selectedFields.map(f => {
        const val = row[f];
        return val === null || val === undefined ? '' : String(val).replace(/,/g, ';');
      }));
    }
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportName || 'report'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add filter
  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
  };

  // Update filter
  const updateFilter = (index, key, value) => {
    const updated = [...filters];
    updated[index][key] = value;
    setFilters(updated);
  };

  // Remove filter
  const removeFilter = (index) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  // Toggle field selection
  const toggleField = (fieldId) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(f => f !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  return (
    <div className="p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3" style={{ fontFamily: 'Manrope,sans-serif' }}>
            <BarChart3 size={28} className="text-slate-600" /> Report Builder
          </h1>
          <p className="text-slate-500 mt-1">Create custom reports with the data you need.</p>
        </div>
        <div className="flex items-center gap-2">
          {(reportData.length > 0 || groupedData) && (
              <>
                {canDo('reports.export') && (
                  <button
                    onClick={exportCSV}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
                  >
                    <Download size={16} /> CSV
                  </button>
                )}
                {canDo('reports.export_pdf') && (
                  <button
                    onClick={exportPDF}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <FileText size={16} /> PDF
                  </button>
                )}
              </>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-4">
          {/* Report Name */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Report Name</label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="e.g., Term 2 Risk Summary"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            />
          </div>

          {/* Fields Selection */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <LayoutGrid size={16} /> Data Fields
              </label>
              <button
                onClick={() => setShowFieldSelector(!showFieldSelector)}
                className="text-xs text-blue-600 font-medium hover:text-blue-800"
              >
                {showFieldSelector ? 'Done' : 'Edit Fields'}
              </button>
            </div>
            
            {showFieldSelector ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  placeholder="Search fields..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <div className="max-h-64 overflow-y-auto space-y-3">
                  {Object.entries(filteredFields).map(([category, fields]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{category}</p>
                      <div className="space-y-1">
                          {fields.map(field => (
                          <button
                            key={field.id}
                            onClick={() => toggleField(field.id)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                              selectedFields.includes(field.id)
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            {selectedFields.includes(field.id) ? <Check size={14} /> : <div className="w-3.5" />}
                            {field.label}
                          </button>
                        ))}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedFields.map(fieldId => {
                  const field = DATA_FIELDS.find(f => f.id === fieldId);
                  return (
                    <span
                      key={fieldId}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs"
                    >
                      {field?.label || fieldId}
                      <button
                        onClick={() => toggleField(fieldId)}
                        className="hover:text-rose-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
                {selectedFields.length === 0 && (
                  <p className="text-sm text-slate-400">No fields selected</p>
                )}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Filter size={16} /> Filters
              </label>
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:text-blue-800"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {filters.map((filter, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <select
                    value={filter.field}
                    onChange={(e) => updateFilter(i, 'field', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-200 rounded"
                  >
                    <option value="">Field...</option>
                    {DATA_FIELDS.map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(i, 'operator', e.target.value)}
                    className="px-2 py-1.5 text-sm border border-slate-200 rounded"
                  >
                    {FILTER_OPS.map(op => (
                      <option key={op.id} value={op.id}>{op.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(i, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-slate-200 rounded"
                  />
                  <button
                    onClick={() => removeFilter(i)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {filters.length === 0 && (
                <p className="text-sm text-slate-400">No filters applied</p>
              )}
            </div>
          </div>

          {/* Group By */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Group size={16} /> Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
            >
              <option value="">No grouping</option>
              {DATA_FIELDS.filter(f => ['Student', 'Risk', 'Attendance', 'Intervention'].includes(f.category)).map(f => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={generateReport}
            disabled={loading || selectedFields.length === 0}
            className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart3 size={18} /> Generate Report
              </>
            )}
          </button>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {reportData.length === 0 && !groupedData ? (
              <div className="p-16 text-center">
                <BarChart3 size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-500 mb-2">No report data yet</p>
                <p className="text-sm text-slate-400">Configure your report and click Generate</p>
              </div>
            ) : groupedData ? (
              // Grouped view
              <div className="overflow-x-auto">
                {groupedData.groups.map((group, groupIdx) => (
                  <div key={groupIdx} className="border-b border-slate-200 last:border-b-0">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">
                        {group.group_field}: {group.group_key}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">({group.count} students)</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {selectedFields.map(fieldId => {
                            const field = DATA_FIELDS.find(f => f.id === fieldId);
                            return (
                              <th key={fieldId} className="text-left py-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                {field?.label || fieldId}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {group.students.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                            {selectedFields.map(fieldId => (
                              <td key={fieldId} className="py-2 px-4 whitespace-nowrap">
                                {row[fieldId] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              // Non-grouped view
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {selectedFields.map(fieldId => {
                        const field = DATA_FIELDS.find(f => f.id === fieldId);
                        return (
                          <th key={fieldId} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                            {field?.label || fieldId}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                        {selectedFields.map(fieldId => (
                          <td key={fieldId} className="py-3 px-4 whitespace-nowrap">
                            {row[fieldId] ?? '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(reportData.length > 0 || groupedData) && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                {groupedData ? `${groupedData.total_students} students in ${groupedData.groups.length} groups` : `${reportData.length} records found`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
