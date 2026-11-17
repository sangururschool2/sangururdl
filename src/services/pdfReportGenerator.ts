import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyRegister, Cohort, Learner, WeeklyTimetableEntry } from '../types';
import { getSchoolLogoDataUrl } from './logoAsset';

interface HeaderOptions {
  doc: jsPDF;
  title: string;
  cohortName?: string;
  period?: string;
  logoDataUrl?: string | null;
}

function drawSchoolHeader({ doc, title, cohortName, period, logoDataUrl }: HeaderOptions): number {
  // Primary brand bar
  doc.setFillColor(15, 118, 110); // #0f766e Forest Green
  doc.rect(0, 0, 210, 7, 'F');

  // Secondary accent bar
  doc.setFillColor(30, 58, 138); // #1e3a8a Navy Blue
  doc.rect(0, 7, 210, 2.5, 'F');

  // Official Unmodified School Logo (1:1 aspect ratio, clean white background)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 14, 12, 19, 19);
  }

  const centerX = logoDataUrl ? 114 : 105;

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15.5);
  doc.text('SANGURUR COMPREHENSIVE SCHOOL', centerX, 19, { align: 'center' });

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('MOTTO: THINK, CODE, CHANGE THE WORLD', centerX, 25, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SANGURUR DIGITAL LEARNER REGISTER (SDLR) - OFFICIAL REPORT', centerX, 30, { align: 'center' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 34, 196, 34);

  // Report Specific Header
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title.toUpperCase(), 14, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const leftDetails = [
    cohortName ? `Cohort: ${cohortName}` : 'All Cohorts',
    period ? `Reporting Period: ${period}` : `Date: ${new Date().toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })}`,
  ];
  doc.text(leftDetails.join(' | '), 14, 48);

  const genDate = `Generated: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} (EAT)`;
  doc.text(genDate, 196, 48, { align: 'right' });

  return 53;
}

function drawSchoolFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 284, 196, 284);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Sangurur Comprehensive School • Think, Code, Change the World • Sangurur Digital Learner Register (SDLR)', 14, 290);
    doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: 'right' });
  }
}

// 1. Daily Attendance Report
export async function generateDailyAttendancePDF(registers: DailyRegister[], cohort: Cohort, dateStr: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Daily Attendance & Learning Report',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: dateStr,
    logoDataUrl,
  });

  const presentCount = registers.filter(r => r.status === 'present').length;
  const lateCount = registers.filter(r => r.status === 'late').length;
  const absentCount = registers.filter(r => r.status === 'absent').length;
  const excusedCount = registers.filter(r => r.status === 'excused').length;
  const total = registers.length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `Summary: Total: ${total} | Present: ${presentCount} | Late: ${lateCount} | Absent: ${absentCount} | Excused: ${excusedCount}`,
    14,
    startY
  );

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.learnerName,
    r.learnerId,
    r.status.toUpperCase(),
    r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' }) : '—',
    r.didStudy === false
      ? `DID NOT STUDY (${r.nonStudyReason || 'No study'})`
      : r.learningAreaTitle
      ? `${r.learningAreaTitle}: ${r.topicTitle || '—'}`
      : r.topicTitle || '—',
    r.didStudy === false
      ? 'N/A'
      : r.understandingLevel
      ? r.understandingLevel.toUpperCase().replace('_', ' ')
      : '—',
    r.verificationStatus === 'verified' ? 'Verified' : r.verificationStatus === 'corrected' ? 'Corrected' : 'Pending',
  ]);

  autoTable(doc, {
    startY: startY + 4,
    head: [['#', 'Learner Name', 'ID', 'Status', 'Time', 'Topic Covered', 'Understanding', 'Review']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Daily_Attendance_${cohort.code}_${dateStr}.pdf`);
}

// 2. Weekly Attendance Report
export async function generateWeeklyAttendancePDF(registers: DailyRegister[], cohort: Cohort, weekLabel: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Weekly Cohort Attendance Summary',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: weekLabel,
    logoDataUrl,
  });

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.date,
    r.learnerName,
    r.learnerId,
    r.status.toUpperCase(),
    r.didStudy === false
      ? `DID NOT STUDY (${r.nonStudyReason || 'No study'})`
      : r.topicTitle || '—',
    r.didStudy === false ? 'N/A' : r.understandingLevel?.toUpperCase().replace('_', ' ') || '—',
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Date', 'Learner Name', 'ID', 'Attendance', 'Topic Covered', 'Understanding']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Weekly_${cohort.code}_${weekLabel.replace(/\s+/g, '_')}.pdf`);
}

// 3. Monthly Attendance Report
export async function generateMonthlyAttendancePDF(registers: DailyRegister[], cohort: Cohort, monthLabel: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Monthly Attendance & Activity Register',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: monthLabel,
    logoDataUrl,
  });

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.date,
    r.learnerName,
    r.status.toUpperCase(),
    r.didStudy === false
      ? `DID NOT STUDY (${r.nonStudyReason || 'No study'})`
      : r.topicTitle || '—',
    r.didStudy === false
      ? 'N/A'
      : r.understandingLevel
      ? r.understandingLevel.toUpperCase().replace('_', ' ')
      : '—',
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Date', 'Learner Name', 'Status', 'Topic Covered', 'Understanding']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Monthly_${cohort.code}_${monthLabel.replace(/\s+/g, '_')}.pdf`);
}

// 4. Individual Learner Attendance Report
export async function generateIndividualAttendancePDF(registers: DailyRegister[], learner: Learner, cohortName: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Individual Learner Attendance Profile',
    cohortName,
    period: `All Sessions (${registers.length} Recorded)`,
    logoDataUrl,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Learner: ${learner.fullName} (Digital ID: ${learner.digitalId || learner.learnerId})`, 14, startY);

  const presentCount = registers.filter(r => r.status === 'present').length;
  const lateCount = registers.filter(r => r.status === 'late').length;
  const attendanceRate = registers.length > 0 ? Math.round(((presentCount + lateCount) / registers.length) * 100) : 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Attendance Rate: ${attendanceRate}% | Present: ${presentCount} | Late: ${lateCount} | Excused/Absent: ${registers.length - presentCount - lateCount}`, 14, startY + 5);

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.date,
    r.status.toUpperCase(),
    r.didStudy === false
      ? `DID NOT STUDY (${r.nonStudyReason || 'No study'})`
      : r.learningAreaTitle
      ? `${r.learningAreaTitle}: ${r.topicTitle || '—'}`
      : r.topicTitle || '—',
    r.didStudy === false
      ? 'N/A'
      : r.understandingLevel
      ? r.understandingLevel.toUpperCase().replace('_', ' ')
      : '—',
    r.reflectionLearned ? (r.reflectionLearned.slice(0, 50) + (r.reflectionLearned.length > 50 ? '...' : '')) : '—',
  ]);

  autoTable(doc, {
    startY: startY + 8,
    head: [['#', 'Date', 'Status', 'Topic Studied', 'Understanding', 'Learner Reflection']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Learner_${learner.digitalId || learner.learnerId}_Attendance.pdf`);
}

// 5. Cohort Attendance Report
export async function generateCohortAttendancePDF(registers: DailyRegister[], cohort: Cohort) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Cohort Master Attendance Dossier',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: cohort.startDate && cohort.endDate ? `${cohort.startDate} to ${cohort.endDate}` : 'All Dates',
    logoDataUrl,
  });

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.date,
    r.learnerName,
    r.learnerId,
    r.status.toUpperCase(),
    r.topicTitle || '—',
    r.verificationStatus === 'verified' ? 'Verified' : r.verificationStatus === 'corrected' ? 'Corrected' : 'Pending',
  ]);

  autoTable(doc, {
    startY,
    head: [['#', 'Date', 'Learner Name', 'Learner Code', 'Status', 'Topic Covered', 'Audit State']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138] },
    styles: { fontSize: 8 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Cohort_${cohort.code}_Master_Attendance.pdf`);
}

// 6. Curriculum Coverage Report
export async function generateCurriculumCoveragePDF(cohort: Cohort, topicsCoveredCount: number, totalTopics: number, registers: DailyRegister[]) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Curriculum Progression & Coverage Audit',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: 'Current Academic Term',
    logoDataUrl,
  });

  const percent = totalTopics > 0 ? Math.round((topicsCoveredCount / totalTopics) * 100) : 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Programme: ${cohort.programme} | Level: ${cohort.learningLevel}`, 14, startY);
  doc.text(`Curriculum Progress: ${topicsCoveredCount} of ${totalTopics} topics covered (${percent}%)`, 14, startY + 6);

  const coveredMap = new Map<string, { topicTitle: string; count: number; date: string }>();
  registers.forEach(r => {
    if (r.topicTitle) {
      const existing = coveredMap.get(r.topicTitle) || { topicTitle: r.topicTitle, count: 0, date: r.date };
      existing.count += 1;
      coveredMap.set(r.topicTitle, existing);
    }
  });

  const tableData = Array.from(coveredMap.entries()).map(([_, val], idx) => [
    idx + 1,
    val.topicTitle,
    val.date,
    val.count,
    val.count >= 3 ? 'Reinforced' : 'Introduced',
  ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [['#', 'Topic Title', 'First Session', 'Sessions Held', 'Exposure Level']],
    body: tableData.length > 0 ? tableData : [['—', 'No topics marked yet', '—', '0', '—']],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Curriculum_Coverage_${cohort.code}.pdf`);
}

// 7. Learner Understanding Report
export async function generateLearnerUnderstandingPDF(registers: DailyRegister[], cohort: Cohort) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Comprehensive Learner Understanding Assessment',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: 'Cumulative Data',
    logoDataUrl,
  });

  const excCount = registers.filter(r => r.understandingLevel === 'excellent').length;
  const goodCount = registers.filter(r => r.understandingLevel === 'good').length;
  const fairCount = registers.filter(r => r.understandingLevel === 'fair').length;
  const supportCount = registers.filter(r => r.understandingLevel === 'needs_support').length;
  const total = registers.filter(r => r.understandingLevel).length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `Total Assessments: ${total} | Excellent: ${excCount} | Good: ${goodCount} | Fair: ${fairCount} | Needs Support: ${supportCount}`,
    14,
    startY
  );

  const tableData = registers.filter(r => r.understandingLevel).map((r, idx) => [
    idx + 1,
    r.date,
    r.learnerName,
    r.topicTitle || '—',
    r.understandingLevel ? r.understandingLevel.toUpperCase().replace('_', ' ') : '—',
    r.reflectionDifficult || 'None logged',
  ]);

  autoTable(doc, {
    startY: startY + 5,
    head: [['#', 'Date', 'Learner', 'Topic', 'Self-Rated Understanding', 'Reported Difficulties']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Understanding_Report_${cohort.code}.pdf`);
}

// 8. Individual Learner Progress Report
export async function generateIndividualProgressPDF(learner: Learner, registers: DailyRegister[], cohortName: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Individual Academic & Practical Progress Dossier',
    cohortName,
    period: 'All Records',
    logoDataUrl,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Learner: ${learner.fullName} | Digital ID: ${learner.digitalId || learner.learnerId}`, 14, startY);

  const tableData = registers.map((r, idx) => [
    idx + 1,
    r.date,
    r.topicTitle || '—',
    r.status.toUpperCase(),
    r.understandingLevel ? r.understandingLevel.toUpperCase().replace('_', ' ') : '—',
    r.reflectionLearned ? (r.reflectionLearned.slice(0, 45) + (r.reflectionLearned.length > 45 ? '...' : '')) : '—',
    r.teacherNote ? r.teacherNote.slice(0, 30) : '—',
  ]);

  autoTable(doc, {
    startY: startY + 6,
    head: [['#', 'Date', 'Topic', 'Status', 'Understanding', 'Learner Reflection', 'Teacher Note']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138] },
    styles: { fontSize: 8 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Progress_${learner.digitalId || learner.learnerId}.pdf`);
}

// 9. Learners Requiring Additional Support Report
export async function generateSupportNeededPDF(registers: DailyRegister[], cohort: Cohort) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: 'Pedagogical Intervention: Learners Requiring Support',
    cohortName: `${cohort.name} (${cohort.code})`,
    period: 'Active Academic Watchlist',
    logoDataUrl,
  });

  const supportRegisters = registers.filter(r => r.understandingLevel === 'needs_support' || r.understandingLevel === 'fair');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text(`Action Required: ${supportRegisters.length} entries flagged with difficulty or needing guidance.`, 14, startY);
  doc.setTextColor(15, 23, 42);

  const tableData = supportRegisters.map((r, idx) => [
    idx + 1,
    r.date,
    r.learnerName,
    r.learnerId,
    r.topicTitle || '—',
    r.understandingLevel === 'needs_support' ? 'CRITICAL - NEEDS HELP' : 'FAIR - PRACTICE NEEDED',
    r.reflectionDifficult || r.reflectionTeacherExplain || 'Student flagged topic for teacher review.',
  ]);

  autoTable(doc, {
    startY: startY + 5,
    head: [['#', 'Date', 'Learner Name', 'ID', 'Topic Flagged', 'Assessment', 'Identified Challenge']],
    body: tableData.length > 0 ? tableData : [['—', '—', 'No intervention alerts found', '—', '—', '—', 'All learners performing well']],
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
  });

  drawSchoolFooter(doc);
  doc.save(`SDLR_Intervention_List_${cohort.code}.pdf`);
}

// 10. Printable Multi-Learner Credential & Login Slips
export async function generatePrintableLoginSlipsPDF(
  learners: Learner[],
  cohortName: string,
  defaultPasswordMap: Record<string, string> = {}
) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const pageWidth = 210;
  const slipHeight = 65;
  const slipMargin = 12;

  let currentY = 15;
  let slipsOnPage = 0;

  learners.forEach((learner) => {
    if (slipsOnPage >= 4) {
      doc.addPage();
      currentY = 15;
      slipsOnPage = 0;
    }

    const digitalId = learner.digitalId || learner.learnerId || learner.username;
    const initialPass = defaultPasswordMap[learner.id] || learner.initialPassword || '123456789';

    // Card border
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.6);
    doc.roundedRect(slipMargin, currentY, pageWidth - slipMargin * 2, slipHeight, 3, 3, 'S');

    // School header strip
    doc.setFillColor(15, 118, 110);
    doc.rect(slipMargin, currentY, pageWidth - slipMargin * 2, 8.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SANGURUR COMPREHENSIVE SCHOOL • THINK, CODE, CHANGE THE WORLD', slipMargin + 5, currentY + 5.8);
    doc.text('OFFICIAL LEARNER DIGITAL ID & ACCESS SLIP', pageWidth - slipMargin - 5, currentY + 5.8, { align: 'right' });

    // Unmodified Official Logo on Clean White Background
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', slipMargin + 4, currentY + 10, 13, 13);
    }

    const textStartX = logoDataUrl ? slipMargin + 20 : slipMargin + 6;

    // Learner Info
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`LEARNER: ${learner.fullName.toUpperCase()}`, textStartX, currentY + 15.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Status: ACTIVE  |  Assigned Cohort: ${cohortName}  |  Requires Password Change`, textStartX, currentY + 20.5);

    // Credentials Box
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(slipMargin + 6, currentY + 25, 114, 23, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(slipMargin + 6, currentY + 25, 114, 23, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text('DIGITAL ID (USERNAME):', slipMargin + 9, currentY + 33);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(digitalId, slipMargin + 52, currentY + 33);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text('DEFAULT PASSWORD:', slipMargin + 9, currentY + 42);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28);
    doc.text(initialPass, slipMargin + 52, currentY + 42);

    // Instructions Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 118, 110);
    doc.text('MANDATORY FIRST-LOGIN INSTRUCTIONS:', slipMargin + 124, currentY + 28.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('1. Login with your Digital ID and default password (123456789).', slipMargin + 124, currentY + 33.5);
    doc.text('2. You are immediately prompted to create a new private password.', slipMargin + 124, currentY + 38.5);
    doc.text('3. The default password becomes permanently invalid after this.', slipMargin + 124, currentY + 43.5);
    doc.text('4. Select your assigned cohort to load your curriculum register.', slipMargin + 124, currentY + 48.5);

    if (slipsOnPage < 3) {
      doc.setDrawColor(203, 213, 225);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(slipMargin, currentY + slipHeight + 3, pageWidth - slipMargin, currentY + slipHeight + 3);
      doc.setLineDashPattern([], 0);
    }

    currentY += slipHeight + 6;
    slipsOnPage++;
  });

  doc.save(`SDLR_DigitalID_Slips_${cohortName.replace(/\s+/g, '_')}.pdf`);
}

// 11. Single Printable Login Slip PDF
export async function generateSingleLoginSlipPDF(
  learner: Learner,
  cohortName: string,
  initialPassword: string = '123456789'
) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [140, 92],
  });

  const digitalId = learner.digitalId || learner.learnerId || learner.username;

  // Header band
  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, 140, 12, 'F');
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 12, 140, 1.8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('SANGURUR COMPREHENSIVE SCHOOL', 70, 5.8, { align: 'center' });
  doc.setFontSize(7);
  doc.text('MOTTO: THINK, CODE, CHANGE THE WORLD • LEARNER DIGITAL ID ACCESS SLIP', 70, 10, { align: 'center' });

  // Unmodified Official Logo on white area
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 10, 15.5, 14, 14);
  }

  const infoX = logoDataUrl ? 27 : 10;

  // Learner Name
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`LEARNER: ${learner.fullName.toUpperCase()}`, infoX, 21.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Account Status: ACTIVE  |  Cohort: ${cohortName}`, infoX, 26.8);

  // Credentials Panel
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(10, 32, 120, 25, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(10, 32, 120, 25, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('DIGITAL ID (LOGIN USERNAME):', 15, 41);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(digitalId, 75, 41);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text('DEFAULT PASSWORD:', 15, 51);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(185, 28, 28);
  doc.text(initialPassword, 75, 51);

  // Policy text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 118, 110);
  doc.text('MANDATORY SECURITY PROTOCOL:', 10, 63);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('• Access SDLR Learner Portal and enter your Digital ID and default password (123456789).', 10, 67.5);
  doc.text('• You will be immediately redirected to create your private password before accessing your register.', 10, 71.5);
  doc.text('• The default password becomes permanently invalid upon completion.', 10, 75.5);

  // Footer bar
  doc.setDrawColor(226, 232, 240);
  doc.line(10, 80, 130, 80);
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Sangurur Digital Learner Register (SDLR) • Official Security Credential', 70, 85, { align: 'center' });

  doc.save(`SDLR_Slip_${digitalId}.pdf`);
}

// 12. Digital Learner ID Card PDF
export async function generateDigitalIdCardPDF(learner: Learner, cohortName: string) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [110, 70],
  });

  const digitalId = learner.digitalId || learner.learnerId || learner.username;

  // Card border & white background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 110, 70, 'F');
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(1.2);
  doc.roundedRect(2, 2, 106, 66, 3, 3, 'S');

  // Official Logo in clean top-left white header
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 6, 5.5, 15, 15);
  }

  const headX = logoDataUrl ? 24 : 8;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('SANGURUR COMPREHENSIVE SCHOOL', headX, 11);

  doc.setTextColor(15, 118, 110);
  doc.setFontSize(7.5);
  doc.text('MOTTO: THINK, CODE, CHANGE THE WORLD', headX, 15.5);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('OFFICIAL DIGITAL LEARNER IDENTIFICATION CARD', headX, 19.5);

  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.5);
  doc.line(6, 22.5, 104, 22.5);

  // Learner Name & Details
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('LEARNER FULL NAME', 7, 28);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(learner.fullName.toUpperCase(), 7, 33.5);

  // Digital ID Box
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(7, 37, 96, 13, 2, 2, 'FD');

  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DIGITAL ID (USERNAME)', 10, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(digitalId, 10, 47.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 118, 110);
  doc.text(`STATUS: ${learner.status || 'ACTIVE'}`, 100, 44.5, { align: 'right' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Cohort: ${cohortName}`, 7, 56);

  // Bottom bar
  doc.setFillColor(15, 118, 110);
  doc.rect(2, 61, 106, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('SANGURUR DIGITAL LEARNER REGISTER (SDLR) • AFRICA/NAIROBI', 55, 65.5, { align: 'center' });

  doc.save(`SDLR_ID_Card_${digitalId}.pdf`);
}

// 13. Bootcamp / Programme Completion Certificate PDF
export async function generateBootcampCertificatePDF(
  learner: Learner,
  cohort: Cohort,
  issueDate?: string
) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4', // 297 x 210 mm
  });

  const digitalId = learner.digitalId || learner.learnerId || learner.username;
  const formattedDate =
    issueDate ||
    new Date().toLocaleDateString('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  // Clean White Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 297, 210, 'F');

  // Formal Double Frame Border
  doc.setDrawColor(15, 118, 110); // Forest Green
  doc.setLineWidth(2.2);
  doc.rect(10, 10, 277, 190, 'S');

  doc.setDrawColor(30, 58, 138); // Navy Blue
  doc.setLineWidth(0.7);
  doc.rect(14, 14, 269, 182, 'S');

  // Official Centered School Logo (1:1 aspect ratio, uncropped, clean white background)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', 134.5, 19, 28, 28);
  }

  const headerTopY = logoDataUrl ? 54 : 34;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SANGURUR COMPREHENSIVE SCHOOL', 148.5, headerTopY, { align: 'center' });

  doc.setTextColor(15, 118, 110);
  doc.setFontSize(10.5);
  doc.text('MOTTO: THINK, CODE, CHANGE THE WORLD', 148.5, headerTopY + 6.5, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(70, headerTopY + 11, 227, headerTopY + 11);

  // Certificate Title
  doc.setTextColor(30, 58, 138);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('CERTIFICATE OF COMPLETION', 148.5, headerTopY + 23, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('This official certificate is proudly awarded to', 148.5, headerTopY + 34, { align: 'center' });

  // Recipient Name
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(learner.fullName.toUpperCase(), 148.5, headerTopY + 46, { align: 'center' });

  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.6);
  doc.line(82, headerTopY + 49, 215, headerTopY + 49);

  doc.setTextColor(30, 58, 138);
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text(`Digital ID: ${digitalId}`, 148.5, headerTopY + 55.5, { align: 'center' });

  // Programme / Cohort Details
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    'for successfully participating in and completing the academic & practical training under',
    148.5,
    headerTopY + 65,
    { align: 'center' }
  );

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${cohort.name} (${cohort.code})`, 148.5, headerTopY + 73, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const programmeLine = [
    `Programme: ${cohort.programme}`,
    cohort.learningLevel ? `Level: ${cohort.learningLevel}` : null,
    cohort.curriculumSnapshot?.curriculumTitle ? `Curriculum: ${cohort.curriculumSnapshot.curriculumTitle}` : null,
  ]
    .filter(Boolean)
    .join('  •  ');
  doc.text(programmeLine, 148.5, headerTopY + 80, { align: 'center' });

  // Signatures & Date Footer
  const sigY = 175;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);

  doc.line(35, sigY, 95, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Head of Institution / Principal', 65, sigY + 5, { align: 'center' });

  doc.line(120, sigY, 177, sigY);
  doc.text(formattedDate, 148.5, sigY - 2, { align: 'center' });
  doc.text('Date Issued (Africa/Nairobi)', 148.5, sigY + 5, { align: 'center' });

  doc.line(202, sigY, 262, sigY);
  doc.text(cohort.teacherName || 'Cohort Facilitator', 232, sigY - 2, { align: 'center' });
  doc.text('Programme Instructor / Teacher', 232, sigY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Sangurur Digital Learner Register (SDLR) • Verified Academic Completion Credential',
    148.5,
    191,
    { align: 'center' }
  );

  doc.save(`SDLR_Certificate_${digitalId}_${cohort.code}.pdf`);
}

// 14. Weekly Holiday / Term Timetable PDF
export async function generateWeeklyTimetablePDF(
  entries: WeeklyTimetableEntry[],
  cohort: Cohort,
  programmeTerm: string
) {
  const logoDataUrl = await getSchoolLogoDataUrl();
  const doc = new jsPDF();
  const startY = drawSchoolHeader({
    doc,
    title: `Weekly Learning Timetable — ${programmeTerm}`,
    cohortName: `${cohort.name} (${cohort.code})`,
    period: `${entries.length} Scheduled Week${entries.length === 1 ? '' : 's'}`,
    logoDataUrl,
  });

  const rows: (string | number)[][] = [];
  entries.forEach((week) => {
    if (!week.topics || week.topics.length === 0) {
      rows.push([
        `Week ${week.weekNumber}\n${week.startDate} to ${week.endDate}`,
        '—',
        week.weekLabel,
        week.weeklyTheme || '—',
        '—',
        '—',
      ]);
    } else {
      week.topics.forEach((slot) => {
        rows.push([
          `Week ${week.weekNumber}\n${week.startDate} to ${week.endDate}`,
          `${slot.dayOfWeek}\n${slot.timeSlot}`,
          slot.topicTitle,
          slot.learningArea || week.weeklyTheme,
          slot.practicalActivity || '—',
          slot.facilitator || cohort.teacherName || 'Staff',
        ]);
      });
    }
  });

  autoTable(doc, {
    startY,
    head: [['Week & Dates', 'Day & Time', 'Scheduled Topic', 'Learning Area / Theme', 'Practical Activity', 'Facilitator']],
    body: rows.length > 0 ? rows : [['—', '—', 'No weekly timetable entries scheduled yet', '—', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 7.8, cellPadding: 2.3 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
      4: { cellWidth: 40 },
      5: { cellWidth: 20 },
    },
  });

  drawSchoolFooter(doc);
  const safeTerm = programmeTerm.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`SDLR_Weekly_Timetable_${cohort.code}_${safeTerm}.pdf`);
}
