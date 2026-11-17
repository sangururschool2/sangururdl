import React, { useState } from 'react';
import { Cohort, Learner, DailyRegister, AttendanceStatus } from '../../types';
import {
  verifyDailyRegister,
  correctAttendance,
  logTeacherAttendanceEntry,
} from '../../services/dataService';
import {
  exportRegistersToExcel,
  exportRegistersToCSV,
  parseAttendanceExcel,
  downloadAttendanceUploadTemplate,
  ParsedAttendanceRow,
} from '../../services/excelService';
import { generateDailyAttendancePDF } from '../../services/pdfReportGenerator';
import { SchoolLogo } from '../common/SchoolLogo';
import { useAuth } from '../../context/AuthContext';
import { getTeacherAuthHeaders } from '../../utils/authHeaders';
import {
  ClipboardCheck,
  Calendar,
  Search,
  Filter,
  CheckCircle,
  Clock,
  UserX,
  ShieldAlert,
  FileSpreadsheet,
  Printer,
  Edit3,
  X,
  AlertCircle,
  UserCheck,
  Upload,
  Download,
} from 'lucide-react';

interface AttendanceRegisterViewProps {
  cohorts: Cohort[];
  learners: Learner[];
  registers: DailyRegister[];
  currentTeacherId: string;
  currentTeacherName: string;
  onRefresh: () => Promise<void>;
}

export const AttendanceRegisterView: React.FC<AttendanceRegisterViewProps> = ({
  cohorts,
  learners,
  registers,
  currentTeacherId,
  currentTeacherName,
  onRefresh,
}) => {
  const { teacherToken } = useAuth();
  // Nairobi local date
  const nairobiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [selectedDate, setSelectedDate] = useState<string>(nairobiToday);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Correction Modal
  const [correctingRegister, setCorrectingRegister] = useState<DailyRegister | null>(null);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('present');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Manual Absent/Excused Logging Modal
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCohortId, setManualCohortId] = useState(cohorts[0]?.id || '');
  const [manualLearnerId, setManualLearnerId] = useState('');
  const [manualStatus, setManualStatus] = useState<'absent' | 'excused'>('absent');
  const [manualReason, setManualReason] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Historical / Previous Dates Excel Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCohortId, setUploadCohortId] = useState(cohorts[0]?.id || '');
  const [uploadSessionLabel, setUploadSessionLabel] = useState('April Holiday Attendance');
  const [uploadConflictMode, setUploadConflictMode] = useState<'skip' | 'overwrite'>('skip');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDetectedFormat, setUploadDetectedFormat] = useState<'row' | 'matrix' | null>(null);
  const [uploadParsedRows, setUploadParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<{
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    errors: string[];
    uploadedDates: string[];
  } | null>(null);

  // Filter registers
  const filteredRegisters = registers.filter((r) => {
    const matchesDate = !selectedDate || r.date === selectedDate;
    const matchesCohort = selectedCohortId === 'all' || r.cohortId === selectedCohortId;
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    const matchesSearch =
      r.learnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.learnerId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesDate && matchesCohort && matchesStatus && matchesSearch;
  });

  // Verify submission
  const handleVerify = async (r: DailyRegister) => {
    setActionError(null);
    try {
      await verifyDailyRegister(r.id, currentTeacherId);
      await onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Error verifying register');
    }
  };

  // Open correction modal
  const handleOpenCorrection = (r: DailyRegister) => {
    setCorrectingRegister(r);
    setNewStatus(r.status);
    setCorrectionReason('');
    setCorrectionError(null);
  };

  // Submit correction with audit trail
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingRegister) return;
    if (!correctionReason.trim()) {
      setCorrectionError('Please specify the pedagogical or administrative reason for this correction.');
      return;
    }

    setCorrectionError(null);
    setSubmittingCorrection(true);
    try {
      await correctAttendance(
        correctingRegister,
        newStatus,
        correctionReason.trim(),
        currentTeacherId,
        currentTeacherName
      );
      await onRefresh();
      setCorrectingRegister(null);
    } catch (err: any) {
      setCorrectionError(err.message || 'Error correcting attendance');
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // Submit manual absent/excused entry
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cohort = cohorts.find((c) => c.id === manualCohortId);
    const learner = learners.find((l) => l.id === manualLearnerId);

    if (!cohort || !learner) {
      setManualError('Please select both a valid cohort and learner.');
      return;
    }

    setManualError(null);
    setSubmittingManual(true);
    try {
      await logTeacherAttendanceEntry({
        cohortId: cohort.id,
        cohortCode: cohort.code,
        learnerDocId: learner.id,
        learnerId: learner.learnerId,
        learnerName: learner.fullName,
        date: selectedDate || nairobiToday,
        status: manualStatus,
        teacherId: currentTeacherId,
        teacherName: currentTeacherName,
        reason: manualReason || `Teacher marked ${manualStatus}`,
      });
      await onRefresh();
      setShowManualModal(false);
      setManualReason('');
      setManualLearnerId('');
    } catch (err: any) {
      setManualError(err.message || 'Error logging entry');
    } finally {
      setSubmittingManual(false);
    }
  };

  // Export Daily Attendance PDF
  const handleExportPDF = () => {
    const targetCohort = cohorts.find((c) => c.id === selectedCohortId) || {
      id: 'all',
      name: 'All School Cohorts',
      code: 'SCS-ALL',
      programme: 'General',
    } as Cohort;

    generateDailyAttendancePDF(filteredRegisters, targetCohort, selectedDate || nairobiToday);
  };

  // Export Excel
  const handleExportExcel = () => {
    exportRegistersToExcel(
      filteredRegisters,
      `SDLR_Attendance_Register_${selectedDate || 'all'}`
    );
  };

  // Historical Register Excel Upload Handlers
  const handleOpenUploadModal = () => {
    setUploadCohortId(selectedCohortId !== 'all' ? selectedCohortId : cohorts[0]?.id || '');
    setUploadFile(null);
    setUploadDetectedFormat(null);
    setUploadParsedRows([]);
    setUploadError(null);
    setUploadResult(null);
    setShowUploadModal(true);
  };

  const handleDownloadAttendanceTemplate = async () => {
    const targetCohort = cohorts.find((c) => c.id === uploadCohortId);
    const cohortLearners = learners.filter((l) =>
      uploadCohortId ? (l.assignedCohortIds || []).includes(uploadCohortId) : true
    );
    await downloadAttendanceUploadTemplate(cohortLearners, targetCohort?.code);
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setUploadParsing(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const { rows, detectedFormat } = await parseAttendanceExcel(file);
      if (rows.length === 0) {
        setUploadError(
          'No attendance rows were found in that sheet. Download the template to check expected column names.'
        );
        setUploadParsedRows([]);
        setUploadDetectedFormat(null);
        return;
      }

      // Cross-check learner match and future-date bounds client-side for immediate preview
      const cohortLearners = learners;
      const annotated = rows.map((r) => {
        const errs = [...r.errors];
        if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date > nairobiToday) {
          errs.push(`Future date ${r.date} cannot exceed today (${nairobiToday})`);
        }
        const byId = r.learnerId
          ? cohortLearners.find(
              (l) =>
                (l.digitalId || '').toLowerCase() === r.learnerId!.toLowerCase() ||
                l.learnerId.toLowerCase() === r.learnerId!.toLowerCase() ||
                l.username.toLowerCase() === r.learnerId!.toLowerCase()
            )
          : undefined;
        const byName =
          !byId && r.learnerName
            ? cohortLearners.find(
                (l) => l.fullName.trim().toLowerCase() === r.learnerName!.trim().toLowerCase()
              )
            : undefined;

        if (!byId && !byName) {
          errs.push(`Unmatched learner (${r.learnerId || r.learnerName || 'missing ID/name'})`);
        }

        return {
          ...r,
          learnerName: byId?.fullName || byName?.fullName || r.learnerName,
          learnerId: byId?.digitalId || byId?.learnerId || byName?.digitalId || byName?.learnerId || r.learnerId,
          errors: errs,
          isValid: errs.length === 0,
        };
      });

      setUploadDetectedFormat(detectedFormat);
      setUploadParsedRows(annotated);
    } catch {
      setUploadError('Could not read Excel file. Please upload a valid .xlsx, .xls, or .csv workbook.');
      setUploadParsedRows([]);
    } finally {
      setUploadParsing(false);
    }
  };

  const handleSubmitHistoricalUpload = async () => {
    const validRows = uploadParsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setUploadError('No valid attendance rows ready to upload.');
      return;
    }

    setUploadSubmitting(true);
    setUploadError(null);
    try {
      const headers = await getTeacherAuthHeaders(teacherToken);
      const res = await fetch('/api/attendance/bulk-upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cohortId: uploadCohortId || undefined,
          entries: validRows,
          conflictMode: uploadConflictMode,
          sessionLabel: uploadSessionLabel.trim() || undefined,
          teacherId: currentTeacherId,
          teacherName: currentTeacherName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload historical attendance register');
      }

      setUploadResult({
        createdCount: data.createdCount || 0,
        updatedCount: data.updatedCount || 0,
        skippedCount: data.skippedCount || 0,
        failedCount: data.failedCount || 0,
        errors: data.errors || [],
        uploadedDates: data.uploadedDates || [],
      });

      await onRefresh();
      if (data.uploadedDates?.length === 1) {
        setSelectedDate(data.uploadedDates[0]);
      } else if (data.uploadedDates?.length > 1) {
        setSelectedDate('');
      }
      if (uploadCohortId) {
        setSelectedCohortId(uploadCohortId);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading attendance sheet');
    } finally {
      setUploadSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5">
          <div className="bg-white p-0.5 rounded-xl border border-slate-200 shrink-0 hidden sm:block">
            <SchoolLogo className="w-12 h-12" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Live Attendance Register
              </span>
              <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              Daily Attendance & Session Verification
            </h2>
            <p className="text-xs text-slate-500">
              Monitor learner self-submissions, certify entries, mark absences, and correct attendance with full audit trails.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenUploadModal}
            className="py-2 px-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Previous Register (Excel)</span>
          </button>

          <button
            onClick={() => {
              setManualCohortId(cohorts[0]?.id || '');
              setManualLearnerId('');
              setManualError(null);
              setShowManualModal(true);
            }}
            className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Mark Absent / Excused</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={filteredRegisters.length === 0}
            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Daily PDF Report</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredRegisters.length === 0}
            className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar: Date, Cohort, Status, Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* Date Filter */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Register Date:
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(selectedDate ? '' : nairobiToday)}
              className="text-[10px] font-bold text-emerald-700 hover:underline"
            >
              {selectedDate ? 'Show All Dates' : 'Filter Today'}
            </button>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        {/* Cohort Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Cohort:
          </label>
          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">All Cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Status:
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>

        {/* Learner Name Search */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Learner Search:
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by learner name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
          <span className="text-xs font-bold text-slate-700">
            {filteredRegisters.length} Attendance Entries Logged
          </span>
          <span className="text-[11px] text-slate-500">
            Africa/Nairobi (EAT) Timestamps
          </span>
        </div>

        {filteredRegisters.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No registers match your filter</p>
            <p>Select another date or click "Mark Absent / Excused" to record attendance manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Learner</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Topic Covered</th>
                  <th className="py-3 px-4">Understanding</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRegisters.map((reg, idx) => (
                  <tr key={reg.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <strong className="text-slate-900 block">{reg.learnerName}</strong>
                      <span className="text-[11px] text-slate-500 font-mono">{reg.learnerId}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {reg.cohortCode}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-bold block text-slate-800">{reg.date}</span>
                      <span className="text-[10px] text-slate-400">
                        {reg.timestamp ? new Date(reg.timestamp).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi' }) : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                          reg.status === 'present'
                            ? 'bg-emerald-100 text-emerald-800'
                            : reg.status === 'late'
                            ? 'bg-amber-100 text-amber-800'
                            : reg.status === 'absent'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {reg.status}
                      </span>
                      {reg.didStudy === false && (
                        <span className="mt-1 block px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10px]">
                          Did Not Study
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[220px] font-medium text-slate-900">
                      {reg.didStudy === false ? (
                        <span className="text-amber-800 font-bold text-[11px]">
                          Reason: {reg.nonStudyReason || 'Did not study'}
                        </span>
                      ) : (
                        <div>
                          {reg.learningAreaTitle && (
                            <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                              {reg.learningAreaTitle}
                            </span>
                          )}
                          <span className="truncate block">{reg.topicTitle || '—'}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {reg.didStudy === false ? (
                        <span className="text-[11px] font-semibold text-slate-400">N/A (No Study)</span>
                      ) : (
                        <span className="font-bold text-blue-700 uppercase">
                          {reg.understandingLevel ? reg.understandingLevel.replace('_', ' ') : '—'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {reg.verificationStatus === 'verified' ? (
                        <span className="text-emerald-700 font-bold text-[11px] flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : reg.verificationStatus === 'corrected' ? (
                        <span className="text-blue-700 font-bold text-[11px]">Corrected</span>
                      ) : (
                        <span className="text-amber-700 font-bold text-[11px]">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      {reg.verificationStatus === 'pending_verification' && (
                        <button
                          onClick={() => handleVerify(reg)}
                          className="py-1 px-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-xs transition"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenCorrection(reg)}
                        className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        title="Correct attendance record"
                      >
                        <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                        <span>Correct</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CORRECTION MODAL WITH AUDIT TRAIL (Section 11 requirement) */}
      {correctingRegister && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Correct Attendance Record
                </h3>
                <p className="text-slate-300 text-xs">
                  Administrative Correction & Audit Trail
                </p>
              </div>
              <button
                onClick={() => setCorrectingRegister(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4">
              {correctionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{correctionError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <p>
                  <strong>Learner:</strong> {correctingRegister.learnerName} (
                  {correctingRegister.learnerId})
                </p>
                <p>
                  <strong>Session Date:</strong> {correctingRegister.date}
                </p>
                <p>
                  <strong>Current Status:</strong>{' '}
                  <span className="font-bold uppercase text-slate-900">
                    {correctingRegister.status}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Attendance Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as AttendanceStatus)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-900 outline-none"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Correction (Audit Log) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Student arrived at 08:35 due to school bus delay; marked Excused..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-slate-900 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  * Note: Your name ({currentTeacherName}) and timestamp will be permanently stored in the audit history.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectingRegister(null)}
                  className="py-2 px-4 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  {submittingCorrection ? 'Logging Correction...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUAL ABSENT / EXCUSED LOGGING MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-amber-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Record Absent or Excused Learner
                </h3>
                <p className="text-amber-100 text-xs">
                  Official Teacher Attendance Control
                </p>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              {manualError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cohort / Class *
                </label>
                <select
                  value={manualCohortId}
                  onChange={(e) => {
                    setManualCohortId(e.target.value);
                    setManualLearnerId('');
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Select Learner *
                </label>
                <select
                  required
                  value={manualLearnerId}
                  onChange={(e) => setManualLearnerId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                >
                  <option value="">Choose learner...</option>
                  {learners
                    .filter((l) =>
                      manualCohortId ? (l.assignedCohortIds || []).includes(manualCohortId) : true
                    )
                    .map((lr) => (
                      <option key={lr.id} value={lr.id}>
                        {lr.fullName} ({lr.learnerId})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Attendance Status *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualStatus('absent')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition ${
                      manualStatus === 'absent'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Absent (Unexcused)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualStatus('excused')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition ${
                      manualStatus === 'excused'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Excused (Medical / Permission)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Teacher Notes / Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Guardian informed school of hospital appointment..."
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-600 outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="py-2 px-4 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingManual || !manualLearnerId}
                  className="py-2.5 px-5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  {submittingManual ? 'Saving Entry...' : 'Record Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORICAL / PREVIOUS DATES EXCEL REGISTER UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-blue-900 p-5 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Upload Previous Dates Attendance Register (Excel)
                </h3>
                <p className="text-blue-200 text-xs">
                  Import past sessions such as April Holiday, August Holiday, or paper registers into Firestore
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {uploadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-900 font-extrabold text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Previous Dates Register Uploaded Successfully</span>
                  </div>
                  <p className="text-emerald-800">
                    <strong>{uploadResult.createdCount}</strong> new entries created •{' '}
                    <strong>{uploadResult.updatedCount}</strong> updated •{' '}
                    <strong>{uploadResult.skippedCount}</strong> skipped (already existed)
                    {uploadResult.failedCount > 0 ? ` • ${uploadResult.failedCount} failed` : ''}.
                  </p>
                  {uploadResult.uploadedDates.length > 0 && (
                    <p className="text-[11px] text-emerald-700 font-mono">
                      Dates synced: {uploadResult.uploadedDates.join(', ')}
                    </p>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="mt-2 p-2.5 bg-white border border-rose-200 rounded-lg text-[11px] text-rose-700 max-h-24 overflow-y-auto space-y-0.5">
                      {uploadResult.errors.map((errMsg, i) => (
                        <p key={i}>• {errMsg}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Cohort, Holiday/Session Label, Conflict Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Target Cohort *
                  </label>
                  <select
                    value={uploadCohortId}
                    onChange={(e) => setUploadCohortId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-600 outline-none"
                  >
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Used whenever a row does not specify a Cohort Code column.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Session / Holiday Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. April Holiday Attendance"
                    value={uploadSessionLabel}
                    onChange={(e) => setUploadSessionLabel(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-600 outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {[
                      'April Holiday Attendance',
                      'August Holiday Attendance',
                      'December Holiday Bootcamp',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setUploadSessionLabel(preset)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                          uploadSessionLabel === preset
                            ? 'bg-blue-50 border-blue-400 text-blue-800'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset.replace(' Attendance', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Duplicate Date Handling + Template Download */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    If a learner already has a record on that date:
                  </span>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="conflictMode"
                        checked={uploadConflictMode === 'skip'}
                        onChange={() => setUploadConflictMode('skip')}
                        className="accent-blue-700"
                      />
                      <span>Skip existing record</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="conflictMode"
                        checked={uploadConflictMode === 'overwrite'}
                        onChange={() => setUploadConflictMode('overwrite')}
                        className="accent-blue-700"
                      />
                      <span>Update existing (with audit log)</span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAttendanceTemplate}
                  className="py-2 px-3 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shrink-0 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel Template</span>
                </button>
              </div>

              {/* Step 2: File Picker */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-5 text-center space-y-2 transition bg-slate-50/50">
                <FileSpreadsheet className="w-8 h-8 text-blue-700 mx-auto" />
                <div>
                  <p className="font-bold text-slate-800">
                    {uploadFile ? uploadFile.name : 'Select Previous Register Excel / CSV Workbook'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Supports row-by-row sheets (Date, Digital ID / Learner Name, Status) or multi-date attendance grids (date columns).
                  </p>
                </div>
                <label className="inline-flex items-center space-x-1.5 py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl cursor-pointer transition shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadParsing ? 'Reading Workbook...' : 'Choose Excel File (.xlsx, .xls, .csv)'}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUploadFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Step 3: Preview Parsed Rows */}
              {uploadParsedRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">
                        Preview ({uploadParsedRows.length} entries
                        {uploadDetectedFormat === 'matrix' ? ' • Multi-Date Grid Detected' : ''})
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {uploadParsedRows.filter((r) => r.isValid).length} Valid
                      </span>
                      {uploadParsedRows.some((r) => !r.isValid) && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                          {uploadParsedRows.filter((r) => !r.isValid).length} Invalid
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Unique Dates: {new Set(uploadParsedRows.filter((r) => r.isValid).map((r) => r.date)).size}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Learner</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Topic / Notes</th>
                          <th className="py-2 px-3">Validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {uploadParsedRows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-rose-50/70'}>
                            <td className="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                              {row.date || '—'}
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 block">{row.learnerName || '—'}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{row.learnerId || 'No ID'}</span>
                            </td>
                            <td className="py-2 px-3 uppercase font-bold text-slate-800">
                              {row.status || '—'}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                              {row.topicTitle || row.teacherNote || uploadSessionLabel || '—'}
                            </td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="text-emerald-700 font-bold">Ready</span>
                              ) : (
                                <span className="text-rose-700 font-semibold">{row.errors.join('; ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <span className="text-[11px] text-slate-500">
                Uploaded historical records are marked verified and logged in the audit trail.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="py-2 px-4 text-xs text-slate-600 font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSubmitHistoricalUpload}
                  disabled={
                    uploadSubmitting ||
                    uploadParsedRows.filter((r) => r.isValid).length === 0
                  }
                  className="py-2.5 px-5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {uploadSubmitting
                      ? 'Uploading Register...'
                      : `Upload ${uploadParsedRows.filter((r) => r.isValid).length} Valid Entries`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
