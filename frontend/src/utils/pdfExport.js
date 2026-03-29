/**
 * PDF export utilities for WellTrack
 * Uses jsPDF + jsPDF-AutoTable for clean PDF generation
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const brandColor = [15, 23, 42]; // Slate-900 default; will be overridden

function getAccentRgb() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--wt-accent').trim();
  const hex = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#0f172a';
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Fetch an image URL and return a circular PNG data URL — center-cropped, full resolution. */
async function circularDataUrl(url, size = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Circular clip
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Center-crop: use the shorter dimension as the crop square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function exportStudentProfile(profileData) {
  const { student, saebrs_results, saebrs_plus_results, interventions, case_notes, attendance_pct, mtss_tier } = profileData;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accent = getAccentRgb();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  // Load circular photo (if available)
  let photoDataUrl = null;
  if (student.photo_url) {
    const fullUrl = `${process.env.REACT_APP_BACKEND_URL}${student.photo_url}`;
    photoDataUrl = await circularDataUrl(fullUrl);
  }

  // Header bar
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WellTrack — Student Profile Report', W / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Photo + student info block
  const PHOTO_MM = 26;        // photo size in mm
  const PHOTO_X = 14;
  const INFO_X = photoDataUrl ? PHOTO_X + PHOTO_MM + 5 : 14;

  y = 26;

  if (photoDataUrl) {
    doc.addImage(photoDataUrl, 'PNG', PHOTO_X, y - 3, PHOTO_MM, PHOTO_MM);
  }

  const name = `${student.first_name}${student.preferred_name ? ` (${student.preferred_name})` : ''} ${student.last_name}`;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(name, INFO_X, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`${student.year_level} · ${student.class_name} · ${student.teacher || '—'}`, INFO_X, y);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, W - 14, y, { align: 'right' });
  y += 7;

  // Tier badge
  const tierColors = { 1: [34, 197, 94], 2: [245, 158, 11], 3: [239, 68, 68] };
  const tc = tierColors[mtss_tier] || [100, 100, 100];
  doc.setFillColor(...tc);
  doc.roundedRect(INFO_X, y, 30, 7, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`MTSS Tier ${mtss_tier}`, INFO_X + 15, y + 4.5, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Ensure y clears the photo
  y = Math.max(y + 13, (photoDataUrl ? 26 - 3 + PHOTO_MM : 0) + 8);

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


function addChartImage(doc, imageDataUrl, y, W) {
  if (!imageDataUrl) return y;
  try {
    const imgProps = doc.getImageProperties(imageDataUrl);
    const imgW = W - 28;
    const imgH = (imgProps.height * imgW) / imgProps.width;
    const pageH = doc.internal.pageSize.getHeight();
    if (y + imgH > pageH - 15) { doc.addPage(); y = 20; }
    doc.addImage(imageDataUrl, 'JPEG', 14, y, imgW, imgH);
    return y + imgH + 8;
  } catch (e) { return y; }
}

export function exportAnalyticsReport(data, filterLabel = 'Whole School') {
  const { schoolData, attTrends, intOutcomes, absenceTypes, supportGaps, capturedImages = {} } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const accent = getAccentRgb();
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  const checkPage = (needed = 40) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = 20;
    }
  };

  const sectionTitle = (title) => {
    checkPage(15);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(title, 14, y);
    y += 6;
  };

  // Header bar
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('WellTrack — Analytics & Reports', W / 2, 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  y = 25;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${filterLabel}`, 14, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString()} · WellTrack MTSS Platform`, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  if (schoolData) {
    sectionTitle('Overview');

    // Chart image first for visual context
    if (capturedImages.overview) {
      y = addChartImage(doc, capturedImages.overview, y, W);
      checkPage(30);
    }

    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Total Students', schoolData.total_students],
        ['Screened', `${schoolData.screened_students} (${schoolData.screening_rate}%)`],
        ['Tier 1 (Low Risk)', schoolData.tier_distribution?.[1] || 0],
        ['Tier 2 (Emerging Risk)', schoolData.tier_distribution?.[2] || 0],
        ['Tier 3 (High Risk)', schoolData.tier_distribution?.[3] || 0],
        ['SAEBRS High Risk', schoolData.risk_distribution?.high || 0],
        ['SAEBRS Some Risk', schoolData.risk_distribution?.some || 0],
        ['SAEBRS Low Risk', schoolData.risk_distribution?.low || 0],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
    y = doc.lastAutoTable.finalY + 8;

    if (schoolData.domain_averages) {
      checkPage(40);
      sectionTitle('Average Wellbeing Domain Scores');
      autoTable(doc, {
        startY: y,
        head: [['Domain', 'Average Score']],
        body: Object.entries(schoolData.domain_averages).map(([k, v]) => [
          k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
          typeof v === 'number' ? v.toFixed(1) : '—',
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: accent },
        margin: { left: 14, right: 14 },
        tableWidth: W - 28,
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  if (attTrends) {
    checkPage(30);
    sectionTitle('Attendance');

    if (capturedImages.attendance) {
      y = addChartImage(doc, capturedImages.attendance, y, W);
      checkPage(30);
    }

    const chronic = attTrends.chronic_absentees || [];
    autoTable(doc, {
      startY: y,
      head: [['Metric', 'Value']],
      body: [
        ['Total School Days', attTrends.total_school_days || '—'],
        ['Chronic Absentees (<90%)', chronic.length],
        ['Critical Absentees (<80%)', chronic.filter(a => a.attendance_pct < 80).length],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
    y = doc.lastAutoTable.finalY + 8;

    if (attTrends.day_of_week?.length > 0) {
      checkPage(40);
      sectionTitle('Attendance Rate by Day of Week');
      autoTable(doc, {
        startY: y,
        head: [['Day', 'Attendance Rate']],
        body: attTrends.day_of_week.map(d => [d.day, `${d.attendance_rate}%`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: accent },
        margin: { left: 14, right: 14 },
        tableWidth: W - 28,
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (absenceTypes?.length > 0) {
      checkPage(40);
      sectionTitle('Absence Type Breakdown');
      autoTable(doc, {
        startY: y,
        head: [['Absence Type', 'Count', 'Excluded from Attendance Calc']],
        body: absenceTypes.slice(0, 15).map(a => [a.type, a.count, a.excluded ? 'Yes' : 'No']),
        styles: { fontSize: 9 },
        headStyles: { fillColor: accent },
        margin: { left: 14, right: 14 },
        tableWidth: W - 28,
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (chronic.length > 0) {
      checkPage(40);
      sectionTitle('Students with Low Attendance');
      autoTable(doc, {
        startY: y,
        head: [['Student', 'Class', 'Attendance %', 'Tier']],
        body: chronic.map(ca => {
          const s = ca.student;
          const name = s ? `${s.first_name}${s.preferred_name ? ` (${s.preferred_name})` : ''} ${s.last_name}` : '—';
          return [name, s?.class_name || '—', `${ca.attendance_pct}%`, `Tier ${ca.tier}`];
        }),
        styles: { fontSize: 9 },
        headStyles: { fillColor: accent },
        margin: { left: 14, right: 14 },
        tableWidth: W - 28,
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  // ── WELLBEING ─────────────────────────────────────────────────────────────
  if (capturedImages.wellbeing) {
    checkPage(30);
    sectionTitle('Wellbeing & SEL');
    y = addChartImage(doc, capturedImages.wellbeing, y, W);
  }

  // ── SUPPORT GAPS ──────────────────────────────────────────────────────────
  checkPage(30);
  sectionTitle('Support Gaps (Tier 2/3 Without Active Intervention)');

  if (capturedImages.support) {
    y = addChartImage(doc, capturedImages.support, y, W);
    checkPage(30);
  }
  if (supportGaps?.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Student', 'Class', 'Tier', 'SAEBRS Risk', 'Attendance %']],
      body: supportGaps.map(g => {
        const s = g.student;
        const name = s ? `${s.first_name}${s.preferred_name ? ` (${s.preferred_name})` : ''} ${s.last_name}` : '—';
        return [name, s?.class_name || '—', `Tier ${g.tier}`, g.saebrs_risk, `${g.attendance_pct}%`];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
    y = doc.lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 150, 80);
    doc.text('No support gaps — all Tier 2/3 students have active interventions assigned.', 14, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  // ── INTERVENTIONS ─────────────────────────────────────────────────────────
  if (intOutcomes?.length > 0) {
    checkPage(40);
    sectionTitle('Intervention Summary by Type');

    if (capturedImages.interventions) {
      y = addChartImage(doc, capturedImages.interventions, y, W);
      checkPage(40);
    }

    autoTable(doc, {
      startY: y,
      head: [['Type', 'Total', 'Active', 'Completed', 'Completion Rate']],
      body: intOutcomes.map(i => [i.type, i.total, i.active, i.completed, `${i.completion_rate}%`]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: accent },
      margin: { left: 14, right: 14 },
      tableWidth: W - 28,
    });
  }

  const fname = `welltrack_analytics_${filterLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fname);
}
