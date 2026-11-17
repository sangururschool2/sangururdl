import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { DailyRegister, Learner, AttendanceStatus, UnderstandingLevel, WeeklyTimetableEntry, Cohort } from '../types';
import { getSchoolLogoArrayBuffer } from './logoAsset';

export interface ParsedLearnerRow {
  fullName: string;
  learnerId?: string;
  username?: string;
  gender?: string;
  age?: number;
  schoolName?: string;
  grade?: string;
  guardianContact?: string;
  initialPassword?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParsedAttendanceRow {
  rowNumber: number;
  date: string;
  learnerId?: string;
  learnerName?: string;
  cohortCode?: string;
  status: AttendanceStatus | '';
  topicTitle?: string;
  understandingLevel?: UnderstandingLevel;
  teacherNote?: string;
  isValid: boolean;
  errors: string[];
}

export function parseLearnersExcel(file: File): Promise<ParsedLearnerRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsed: ParsedLearnerRow[] = rows.map((row) => {
          const errors: string[] = [];
          const fullName = String(row['Full Name'] || row['FullName'] || row['Name'] || row['learner_name'] || '').trim();
          const learnerId = String(row['Learner ID'] || row['LearnerId'] || row['AdmissionNo'] || row['ID'] || '').trim();
          const username = String(row['Username'] || row['username'] || '').trim();
          const gender = String(row['Gender'] || row['gender'] || '').trim().toLowerCase();
          const ageNum = Number(row['Age'] || row['age']);
          const schoolName = String(
            row['School Name'] || row['School'] || row['schoolName'] || row['school'] || ''
          ).trim();
          const grade = String(
            row['Grade'] || row['Class'] || row['Level'] || row['grade'] || ''
          ).trim();
          const guardianContact = String(row['Guardian Contact'] || row['Phone'] || row['ParentPhone'] || '').trim();

          if (!fullName) {
            errors.push('Full name is required');
          } else if (fullName.length < 3) {
            errors.push('Full name must be at least 3 characters');
          }

          let normalizedGender: string | undefined = undefined;
          if (gender) {
            if (['m', 'male', 'boy'].includes(gender)) normalizedGender = 'male';
            else if (['f', 'female', 'girl'].includes(gender)) normalizedGender = 'female';
            else normalizedGender = 'other';
          }

          return {
            fullName,
            learnerId: learnerId || undefined,
            username: username || undefined,
            gender: normalizedGender,
            age: !isNaN(ageNum) && ageNum > 0 ? ageNum : undefined,
            schoolName: schoolName || undefined,
            grade: grade || undefined,
            guardianContact: guardianContact || undefined,
            isValid: errors.length === 0,
            errors,
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function formatValidYmd(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeExcelDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && !isNaN(raw) && raw > 20000 && raw < 90000) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return formatValidYmd(parsed.y, parsed.m, parsed.d);
    }
  }

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return formatValidYmd(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
  }

  const str = String(raw).trim();
  if (!str) return null;

  // Numeric serial string
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const parsed = XLSX.SSF.parse_date_code(Number(str));
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return formatValidYmd(parsed.y, parsed.m, parsed.d);
    }
  }

  // ISO YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s|T|$)/);
  if (isoMatch) {
    return formatValidYmd(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  // Kenyan/UK DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    // Prefer DD/MM/YYYY unless second > 12 (explicit MM/DD/YYYY)
    if (second <= 12) {
      return formatValidYmd(year, second, first);
    }
    return formatValidYmd(year, first, second);
  }

  // Text dates e.g. "14 Apr 2026", "14-Apr-2026", "April 14, 2026"
  const monthNames: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  };

  const dMonY = str.match(/^(\d{1,2})[\s-]+([a-zA-Z]+)[\s,-]+(\d{2,4})$/);
  if (dMonY) {
    const m = monthNames[dMonY[2].toLowerCase()];
    const y = dMonY[3].length === 2 ? 2000 + Number(dMonY[3]) : Number(dMonY[3]);
    if (m) return formatValidYmd(y, m, Number(dMonY[1]));
  }

  const monDY = str.match(/^([a-zA-Z]+)[\s-]+(\d{1,2})[\s,-]+(\d{2,4})$/);
  if (monDY) {
    const m = monthNames[monDY[1].toLowerCase()];
    const y = monDY[3].length === 2 ? 2000 + Number(monDY[3]) : Number(monDY[3]);
    if (m) return formatValidYmd(y, m, Number(monDY[2]));
  }

  return null;
}

function normalizeAttendanceStatus(raw: unknown): AttendanceStatus | '' {
  const val = String(raw || '').trim().toLowerCase();
  if (!val) return '';
  if (['present', 'p', '1', 'yes', 'y', 'attended', 'tick', '✓', '✔'].includes(val)) return 'present';
  if (['late', 'l', 'tardy'].includes(val)) return 'late';
  if (['absent', 'a', '0', 'no', 'n', 'x', 'missed', 'abs'].includes(val)) return 'absent';
  if (['excused', 'e', 'exc', 'permission', 'sick', 'medical', 'permitted'].includes(val)) return 'excused';
  return '';
}

function normalizeUnderstanding(raw: unknown): UnderstandingLevel | undefined {
  const val = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (val === 'excellent') return 'excellent';
  if (val === 'good') return 'good';
  if (val === 'fair') return 'fair';
  if (val === 'needs_support' || val === 'needssupport' || val === 'support') return 'needs_support';
  return undefined;
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickField(row: Record<string, unknown>, candidates: string[]): string {
  for (const key of Object.keys(row)) {
    const norm = normalizeHeaderKey(key);
    if (candidates.includes(norm)) {
      const val = String(row[key] ?? '').trim();
      if (val) return val;
    }
  }
  return '';
}

function pickRawField(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const key of Object.keys(row)) {
    const norm = normalizeHeaderKey(key);
    if (candidates.includes(norm)) {
      return row[key];
    }
  }
  return undefined;
}

export function parseAttendanceExcel(file: File): Promise<{
  rows: ParsedAttendanceRow[];
  detectedFormat: 'row' | 'matrix';
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Read raw 2D grid first so we can skip branded title/instruction rows above the table header
        const matrix2D: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: true,
        });

        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(matrix2D.length, 15); r++) {
          const cells = (matrix2D[r] || []).map((c) => normalizeHeaderKey(String(c ?? '')));
          const hasIdOrName = cells.some((c) =>
            ['digitalid', 'learnerid', 'admissionno', 'username', 'id', 'learnername', 'fullname', 'name'].includes(c)
          );
          const hasDateOrStatus =
            cells.some((c) => ['date', 'sessiondate', 'registerdate', 'status', 'attendancestatus', 'attendance'].includes(c)) ||
            (matrix2D[r] || []).some((c) => normalizeExcelDate(c) !== null);
          if (hasIdOrName && hasDateOrStatus) {
            headerRowIdx = r;
            break;
          }
        }

        const headerCells = (matrix2D[headerRowIdx] || []).map((c) => String(c ?? '').trim());
        const dateHeaderColumns: Array<{ colIdx: number; headerText: string; ymd: string }> = [];
        headerCells.forEach((hdr, colIdx) => {
          const parsedHdrDate = normalizeExcelDate(
            typeof matrix2D[headerRowIdx]?.[colIdx] === 'number'
              ? matrix2D[headerRowIdx][colIdx]
              : hdr
          );
          if (parsedHdrDate) {
            dateHeaderColumns.push({ colIdx, headerText: hdr, ymd: parsedHdrDate });
          }
        });

        const hasExplicitDateCol = headerCells.some((h) =>
          ['date', 'sessiondate', 'registerdate', 'day'].includes(normalizeHeaderKey(h))
        );

        // Multi-date matrix layout (e.g. Digital ID | Learner Name | 2026-04-06 | 2026-04-07 ...)
        if (!hasExplicitDateCol && dateHeaderColumns.length > 0) {
          const parsedMatrixRows: ParsedAttendanceRow[] = [];
          for (let r = headerRowIdx + 1; r < matrix2D.length; r++) {
            const rawRow = matrix2D[r] || [];
            if (rawRow.every((cell) => String(cell ?? '').trim() === '')) continue;

            const rowObj: Record<string, unknown> = {};
            headerCells.forEach((h, idx) => {
              if (h) rowObj[h] = rawRow[idx];
            });

            const learnerId = pickField(rowObj, ['digitalid', 'learnerid', 'admissionno', 'username', 'id']);
            const learnerName = pickField(rowObj, ['learnername', 'fullname', 'name', 'studentname']);
            const cohortCode = pickField(rowObj, ['cohortcode', 'cohort', 'class']);
            const topicTitle = pickField(rowObj, ['topiccovered', 'topictitle', 'topic', 'lesson', 'session']);
            const teacherNote = pickField(rowObj, ['teachernotes', 'teachernote', 'notes', 'note', 'remarks', 'holiday']);

            for (const dateCol of dateHeaderColumns) {
              const cellRaw = rawRow[dateCol.colIdx];
              const cellStr = String(cellRaw ?? '').trim();
              if (!cellStr) continue;

              const status = normalizeAttendanceStatus(cellRaw);
              const errors: string[] = [];
              if (!learnerId && !learnerName) {
                errors.push('Digital ID or Learner Name is required');
              }
              if (!status) {
                errors.push(`Unrecognized status "${cellStr}" for ${dateCol.ymd}`);
              }

              parsedMatrixRows.push({
                rowNumber: r + 1,
                date: dateCol.ymd,
                learnerId: learnerId || undefined,
                learnerName: learnerName || undefined,
                cohortCode: cohortCode || undefined,
                status,
                topicTitle: topicTitle || undefined,
                teacherNote: teacherNote || undefined,
                isValid: errors.length === 0,
                errors,
              });
            }
          }

          resolve({ rows: parsedMatrixRows, detectedFormat: 'matrix' });
          return;
        }

        // Standard Row-by-Row Register layout
        const parsedRows: ParsedAttendanceRow[] = [];
        for (let r = headerRowIdx + 1; r < matrix2D.length; r++) {
          const rawRow = matrix2D[r] || [];
          if (rawRow.every((cell) => String(cell ?? '').trim() === '')) continue;

          const rowObj: Record<string, unknown> = {};
          headerCells.forEach((h, idx) => {
            if (h) rowObj[h] = rawRow[idx];
          });

          const rawDate = pickRawField(rowObj, ['date', 'sessiondate', 'registerdate', 'day']);
          const normalizedDate = normalizeExcelDate(rawDate);
          const learnerId = pickField(rowObj, ['digitalid', 'learnerid', 'admissionno', 'username', 'id']);
          const learnerName = pickField(rowObj, ['learnername', 'fullname', 'name', 'studentname']);
          const cohortCode = pickField(rowObj, ['cohortcode', 'cohort', 'class']);
          const rawStatus = pickRawField(rowObj, ['attendancestatus', 'status', 'attendance', 'mark']);
          const status = normalizeAttendanceStatus(rawStatus);
          const topicTitle = pickField(rowObj, ['topiccovered', 'topictitle', 'topic', 'lesson', 'session']);
          const understandingLevel = normalizeUnderstanding(
            pickRawField(rowObj, ['understandinglevel', 'understanding'])
          );
          const teacherNote = pickField(rowObj, ['teachernotes', 'teachernote', 'notes', 'note', 'remarks', 'holiday']);

          const errors: string[] = [];
          if (!normalizedDate) {
            errors.push(
              rawDate
                ? `Invalid date "${String(rawDate)}" (use YYYY-MM-DD or DD/MM/YYYY)`
                : 'Date is required'
            );
          }
          if (!learnerId && !learnerName) {
            errors.push('Digital ID or Learner Name is required');
          }
          if (!status) {
            errors.push(
              rawStatus
                ? `Invalid status "${String(rawStatus)}" (use Present, Late, Absent, or Excused)`
                : 'Attendance Status is required'
            );
          }

          parsedRows.push({
            rowNumber: r + 1,
            date: normalizedDate || String(rawDate ?? '').trim(),
            learnerId: learnerId || undefined,
            learnerName: learnerName || undefined,
            cohortCode: cohortCode || undefined,
            status,
            topicTitle: topicTitle || undefined,
            understandingLevel,
            teacherNote: teacherNote || undefined,
            isValid: errors.length === 0,
            errors,
          });
        }

        resolve({ rows: parsedRows, detectedFormat: 'row' });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadAttendanceUploadTemplate(
  cohortLearners: Learner[] = [],
  cohortCode?: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sangurur Comprehensive School - SDLR';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Historical_Register');
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 16;
  worksheet.getRow(5).height = 10;

  const logoBuffer = await getSchoolLogoArrayBuffer();
  if (logoBuffer) {
    const imageId = workbook.addImage({
      buffer: logoBuffer,
      extension: 'png',
    });
    worksheet.addImage(imageId, {
      tl: { col: 0.1, row: 0.15 },
      ext: { width: 68, height: 68 },
    });
  }

  worksheet.mergeCells('B1:H1');
  worksheet.getCell('B1').value = 'SANGURUR COMPREHENSIVE SCHOOL — HISTORICAL ATTENDANCE TEMPLATE';
  worksheet.getCell('B1').font = { name: 'Lato', size: 13, bold: true, color: { argb: 'FF0F172A' } };

  worksheet.mergeCells('B2:H2');
  worksheet.getCell('B2').value = 'MOTTO: THINK, CODE, CHANGE THE WORLD • Use for April Holiday, August Holiday, or Past Session Registers';
  worksheet.getCell('B2').font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FF0F766E' } };

  worksheet.mergeCells('B3:H3');
  worksheet.getCell('B3').value = 'Valid Dates: YYYY-MM-DD or DD/MM/YYYY  |  Valid Statuses: Present, Late, Absent, Excused (or P, L, A, E)';
  worksheet.getCell('B3').font = { name: 'Lato', size: 9.5, color: { argb: 'FF1E3A8A' } };

  worksheet.mergeCells('B4:H4');
  worksheet.getCell('B4').value = `Target Cohort: ${cohortCode || 'Any Enrolled Cohort'} • Replace or add rows below before uploading`;
  worksheet.getCell('B4').font = { name: 'Lato', size: 9, color: { argb: 'FF475569' } };

  const headers = [
    'Date',
    'Digital ID',
    'Learner Name',
    'Cohort Code',
    'Attendance Status',
    'Topic Covered',
    'Understanding Level',
    'Teacher Notes',
  ];

  const headerRow = worksheet.getRow(6);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  if (cohortLearners.length > 0) {
    cohortLearners.forEach((lr) => {
      const row = worksheet.addRow([
        '',
        lr.digitalId || lr.learnerId,
        lr.fullName,
        cohortCode || '',
        '',
        '',
        '',
        '',
      ]);
      row.font = { name: 'Lato', size: 9.5 };
    });
  } else {
    // Provide clean blank entry rows ready for manual input
    for (let i = 0; i < 5; i++) {
      const row = worksheet.addRow(['', '', '', cohortCode || '', '', '', '', '']);
      row.font = { name: 'Lato', size: 9.5 };
    }
  }

  worksheet.columns = [
    { width: 15 },
    { width: 20 },
    { width: 26 },
    { width: 18 },
    { width: 18 },
    { width: 26 },
    { width: 20 },
    { width: 34 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const safeCode = (cohortCode || 'SDLR').replace(/[^a-zA-Z0-9_-]/g, '_');
  triggerExcelDownload(buffer as ArrayBuffer, `SDLR_Previous_Attendance_Template_${safeCode}.xlsx`);
}

function triggerExcelDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSampleLearnerTemplate() {
  const headers = [
    'Full Name',
    'School Name',
    'Grade',
    'Learner ID',
    'Gender',
    'Age',
    'Guardian Contact',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = [
    { wch: 28 },
    { wch: 30 },
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 10 },
    { wch: 20 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Learners_Template');
  XLSX.writeFile(wb, 'SDLR_Learner_Import_Template.xlsx');
}

export async function exportRegistersToExcel(registers: DailyRegister[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sangurur Comprehensive School - SDLR';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Register_Data');

  // Reserve clean top header rows for official branding & unmodified 1:1 logo
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 16;
  worksheet.getRow(5).height = 10;

  const logoBuffer = await getSchoolLogoArrayBuffer();
  if (logoBuffer) {
    const imageId = workbook.addImage({
      buffer: logoBuffer,
      extension: 'png',
    });
    worksheet.addImage(imageId, {
      tl: { col: 0.1, row: 0.15 },
      ext: { width: 72, height: 72 },
    });
  }

  worksheet.mergeCells('B1:N1');
  worksheet.getCell('B1').value = 'SANGURUR COMPREHENSIVE SCHOOL';
  worksheet.getCell('B1').font = { name: 'Lato', size: 14, bold: true, color: { argb: 'FF0F172A' } };

  worksheet.mergeCells('B2:N2');
  worksheet.getCell('B2').value = 'MOTTO: THINK, CODE, CHANGE THE WORLD';
  worksheet.getCell('B2').font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FF0F766E' } };

  worksheet.mergeCells('B3:N3');
  worksheet.getCell('B3').value = 'SANGURUR DIGITAL LEARNER REGISTER (SDLR) — OFFICIAL EXPORT';
  worksheet.getCell('B3').font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };

  worksheet.mergeCells('B4:N4');
  worksheet.getCell('B4').value = `Generated: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} (EAT) • Total Records: ${registers.length}`;
  worksheet.getCell('B4').font = { name: 'Lato', size: 9, color: { argb: 'FF475569' } };

  const headers = [
    '#',
    'Date',
    'Cohort Code',
    'Learner Name',
    'Digital ID',
    'Attendance Status',
    'Time (EAT)',
    'Topic Covered',
    'Understanding Level',
    'Reflection: Learned',
    'Reflection: Activity',
    'Reflection: Difficult',
    'Review Status',
    'Teacher Notes',
  ];

  const headerRow = worksheet.getRow(6);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  registers.forEach((r, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      r.date,
      r.cohortCode,
      r.learnerName,
      r.learnerId,
      r.status.toUpperCase(),
      r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—',
      r.didStudy === false
        ? `DID NOT STUDY (${r.nonStudyReason || 'Reason recorded'})`
        : r.learningAreaTitle
        ? `[${r.learningAreaTitle}] ${r.topicTitle || ''}`.trim()
        : r.topicTitle || '—',
      r.didStudy === false
        ? 'N/A (No Study)'
        : r.understandingLevel
        ? r.understandingLevel.toUpperCase().replace('_', ' ')
        : '—',
      r.reflectionLearned || '',
      r.reflectionActivity || '',
      r.reflectionDifficult || '',
      r.verificationStatus === 'verified' ? 'Verified' : r.verificationStatus === 'corrected' ? 'Corrected' : 'Pending',
      r.teacherNote || '',
    ]);
    row.font = { name: 'Lato', size: 9.5 };
  });

  worksheet.columns = [
    { width: 12 },
    { width: 14 },
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 28 },
    { width: 20 },
    { width: 32 },
    { width: 28 },
    { width: 28 },
    { width: 14 },
    { width: 28 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  triggerExcelDownload(buffer as ArrayBuffer, `${filename}.xlsx`);
}

export function exportRegistersToCSV(registers: DailyRegister[], filename: string) {
  const exportData = registers.map((r, idx) => ({
    'No': idx + 1,
    'Date': r.date,
    'Cohort': r.cohortCode,
    'LearnerName': r.learnerName,
    'LearnerID': r.learnerId,
    'Status': r.status,
    'Topic':
      r.didStudy === false
        ? `DID NOT STUDY (${r.nonStudyReason || 'Reason recorded'})`
        : r.learningAreaTitle
        ? `[${r.learningAreaTitle}] ${r.topicTitle || ''}`.trim()
        : r.topicTitle || '',
    'Understanding':
      r.didStudy === false ? 'N/A (No Study)' : r.understandingLevel || '',
    'Reflection': r.reflectionLearned || '',
    'TeacherNotes': r.teacherNote || '',
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportWeeklyTimetableToExcel(
  entries: WeeklyTimetableEntry[],
  cohort: Cohort,
  programmeTerm: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sangurur Comprehensive School - SDLR';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Weekly_Timetable');
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;
  worksheet.getRow(4).height = 16;
  worksheet.getRow(5).height = 10;

  const logoBuffer = await getSchoolLogoArrayBuffer();
  if (logoBuffer) {
    const imageId = workbook.addImage({
      buffer: logoBuffer,
      extension: 'png',
    });
    worksheet.addImage(imageId, {
      tl: { col: 0.1, row: 0.15 },
      ext: { width: 70, height: 70 },
    });
  }

  worksheet.mergeCells('B1:I1');
  worksheet.getCell('B1').value = `SANGURUR COMPREHENSIVE SCHOOL — WEEKLY TIMETABLE (${programmeTerm.toUpperCase()})`;
  worksheet.getCell('B1').font = { name: 'Lato', size: 13, bold: true, color: { argb: 'FF0F172A' } };

  worksheet.mergeCells('B2:I2');
  worksheet.getCell('B2').value = 'MOTTO: THINK, CODE, CHANGE THE WORLD • DIFFERENT TOPICS SCHEDULED PER WEEK';
  worksheet.getCell('B2').font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FF0F766E' } };

  worksheet.mergeCells('B3:I3');
  worksheet.getCell('B3').value = `Cohort: ${cohort.name} (${cohort.code}) • Programme: ${cohort.programme}`;
  worksheet.getCell('B3').font = { name: 'Lato', size: 9.5, bold: true, color: { argb: 'FF1E3A8A' } };

  worksheet.mergeCells('B4:I4');
  worksheet.getCell('B4').value = `Generated: ${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })} (EAT) • Weeks Scheduled: ${entries.length}`;
  worksheet.getCell('B4').font = { name: 'Lato', size: 9, color: { argb: 'FF475569' } };

  const headers = [
    'Week #',
    'Week Label & Theme',
    'Date Range',
    'Day',
    'Time Slot',
    'Topic Title',
    'Learning Area',
    'Practical Activity',
    'Facilitator',
  ];

  const headerRow = worksheet.getRow(6);
  headerRow.values = headers;
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Lato', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  entries.forEach((week) => {
    (week.topics || []).forEach((slot) => {
      const row = worksheet.addRow([
        `Week ${week.weekNumber}`,
        `${week.weekLabel} — ${week.weeklyTheme}`,
        `${week.startDate} to ${week.endDate}`,
        slot.dayOfWeek,
        slot.timeSlot,
        slot.topicTitle,
        slot.learningArea,
        slot.practicalActivity || '',
        slot.facilitator || cohort.teacherName || '',
      ]);
      row.font = { name: 'Lato', size: 9.5 };
    });
  });

  worksheet.columns = [
    { width: 12 },
    { width: 34 },
    { width: 24 },
    { width: 13 },
    { width: 16 },
    { width: 34 },
    { width: 22 },
    { width: 36 },
    { width: 22 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const safeTerm = programmeTerm.replace(/[^a-zA-Z0-9_-]/g, '_');
  triggerExcelDownload(buffer as ArrayBuffer, `SDLR_Weekly_Timetable_${cohort.code}_${safeTerm}.xlsx`);
}
