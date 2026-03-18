/**
 * PDF export utilities for WellTrack
 * Uses jsPDF + jsPDF-AutoTable for clean PDF generation
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const brandColor = [15, 23, 42]; // Slate-900 default; will be overridden

function getAccentRgb() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--wt-accent').trim() || '#0f172a';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r || 15, g || 23, b || 42];
}

export function exportStudentProfile(profileData) {
  const { student, saebrs_results, saebrs_plus_results, interventions, case_notes, attendance_pct, mtss_tier } = profileData;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accent = getAccentRgb();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WellTrack — Student Profile Report', W / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = 25;
  const name = `${student.first_name}${student.preferred_name ? ` (${student.preferred_name})` : ''} ${student.last_name}`;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(name, 14, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${student.year_level} · ${student.class_name} · ${student.teacher || '—'}`, 14, y);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, W - 14, y, { align: 'right' });
  y += 8;

  // Tier badge
  const tierColors = { 1: [34, 197, 94], 2: [245, 158, 11], 3: [239, 68, 68] };
  const tc = tierColors[mtss_tier] || [100, 100, 100];
  doc.setFillColor(...tc);
  doc.roundedRect(14, y, 30, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`MTSS Tier ${mtss_tier}`, 29, y + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 13;

  // Latest SAEBRS
  const latestSaebrs = saebrs_results?.[saebrs_results.length - 1];
  if (latestSaebrs) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Latest SAEBRS Screening', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Score', 'Risk Level']],
      body: [
        ['Total', `${latestSaebrs.total_score}/57`, latestSaebrs.risk_level],
        ['Social', `${latestSaebrs.social_score}/18`, latestSaebrs.social_risk],
        ['Academic', `${latestSaebrs.academic_score}/18`, latestSaebrs.academic_risk],
        ['Emotional', `${latestSaebrs.emotional_score}/21`, latestSaebrs.emotional_risk],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Attendance
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Attendance: ${attendance_pct ? attendance_pct.toFixed(1) + '%' : 'No data'}`, 14, y);
  y += 8;

  // Active Interventions
  const activeInts = interventions?.filter(i => i.status === 'active') || [];
  if (activeInts.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Active Interventions', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Staff', 'Frequency', 'Review Date', 'Goals']],
      body: activeInts.map(i => [i.intervention_type, i.assigned_staff, i.frequency || '—', i.review_date || '—', i.goals || '—']),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
      columnStyles: { 4: { cellWidth: 60 } },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // Case notes
  if (case_notes?.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Case Notes', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Staff', 'Type', 'Notes']],
      body: case_notes.map(n => [n.date, n.staff_member, n.note_type, n.notes]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
      columnStyles: { 3: { cellWidth: 90 } },
    });
  }

  const fname = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_profile_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fname);
}

export function exportInterventionsReport(interventions, students) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const accent = getAccentRgb();
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WellTrack — Interventions Report', W / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()} · Total: ${interventions.length} interventions`, 14, 23);
  doc.setTextColor(0, 0, 0);

  const getStudentName = (sid) => {
    const s = students.find(x => x.student_id === sid);
    return s ? `${s.first_name}${s.preferred_name ? ` (${s.preferred_name})` : ''} ${s.last_name}` : sid;
  };

  autoTable(doc, {
    startY: 28,
    head: [['Student', 'Type', 'Staff', 'Start', 'Review', 'Frequency', 'Status', 'Goals']],
    body: interventions.map(i => [
      getStudentName(i.student_id),
      i.intervention_type, i.assigned_staff,
      i.start_date || '—', i.review_date || '—',
      i.frequency || '—', i.status,
      (i.goals || '').substring(0, 60) + (i.goals?.length > 60 ? '...' : ''),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: accent },
    margin: { left: 14, right: 14 },
    tableWidth: W - 28,
  });

  doc.save(`interventions_report_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportMeetingReport(students, tierChanges) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accent = getAccentRgb();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WellTrack — MTSS Meeting Report', W / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = 25;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()} · ${students.length} students for discussion`, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  if (tierChanges?.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Tier Changes Since Last Screening', 14, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Student', 'Class', 'Prev Tier', 'Current Tier', 'Direction']],
      body: tierChanges.map(tc => {
        const s = tc.student;
        const name = s ? `${s.first_name}${s.preferred_name ? ` (${s.preferred_name})` : ''} ${s.last_name}` : '—';
        return [name, s?.class_name || '—', `Tier ${tc.previous_tier}`, `Tier ${tc.current_tier}`, tc.direction];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Students for Discussion', 14, y);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [['Student', 'Class', 'Tier', 'SAEBRS', 'Attendance', 'Interventions']],
    body: students.map(item => {
      const s = item.student;
      const name = s ? `${s.first_name}${s.preferred_name ? ` (${s.preferred_name})` : ''} ${s.last_name}` : '—';
      return [
        name, s?.class_name || '—', `Tier ${item.mtss_tier}`,
        item.saebrs ? `${item.saebrs.total_score}/57 (${item.saebrs.risk_level})` : '—',
        `${item.attendance_pct}%`,
        item.active_interventions?.map(i => i.intervention_type).join(', ') || 'None',
      ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: accent },
    margin: { left: 14, right: 14 },
    tableWidth: W - 28,
  });

  doc.save(`mtss_meeting_${new Date().toISOString().split('T')[0]}.pdf`);
}
