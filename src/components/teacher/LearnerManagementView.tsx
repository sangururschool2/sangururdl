import React, { useState, useMemo, useEffect } from 'react';
import {
  Learner,
  Cohort,
  EDUCATION_LEVEL_BANDS,
  classifyEducationLevel,
} from '../../types';
import {
  parseLearnersExcel,
  downloadSampleLearnerTemplate,
  ParsedLearnerRow,
} from '../../services/excelService';
import {
  generatePrintableLoginSlipsPDF,
  generateSingleLoginSlipPDF,
} from '../../services/pdfReportGenerator';
import { useAuth } from '../../context/AuthContext';
import { getTeacherAuthHeaders } from '../../utils/authHeaders';
import { SchoolLogo } from '../common/SchoolLogo';
import { DigitalIdCardModal } from '../common/DigitalIdCardModal';
import {
  UserPlus,
  Upload,
  Download,
  Printer,
  Search,
  KeyRound,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  X,
  FileSpreadsheet,
  Check,
  Layers,
  GraduationCap,
  CreditCard,
} from 'lucide-react';

interface LearnerManagementViewProps {
  learners: Learner[];
  cohorts: Cohort[];
  onRefresh: () => Promise<void>;
  initialGradeFilter?: string;
}

export const LearnerManagementView: React.FC<LearnerManagementViewProps> = ({
  learners,
  cohorts,
  onRefresh,
  initialGradeFilter = 'all',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [schoolFilter, setSchoolFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>(initialGradeFilter || 'all');

  useEffect(() => {
    setGradeFilter(initialGradeFilter || 'all');
  }, [initialGradeFilter]);

  // Single Registration Modal
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [singleName, setSingleName] = useState('');
  const [singleSchoolName, setSingleSchoolName] = useState('Sangurur Comprehensive School');
  const [singleGrade, setSingleGrade] = useState('Grade 7');
  const [singleCohortId, setSingleCohortId] = useState(cohorts[0]?.id || '');
  const [singleGender, setSingleGender] = useState<'male' | 'female' | 'other'>('male');
  const [singleAge, setSingleAge] = useState<number | ''>(13);
  const [singleGuardian, setSingleGuardian] = useState('');
  const [singleCustomId, setSingleCustomId] = useState('');
  const [submittingSingle, setSubmittingSingle] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk Import Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCohortId, setBulkCohortId] = useState(cohorts[0]?.id || '');
  const [parsedRows, setParsedRows] = useState<ParsedLearnerRow[]>([]);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccessMessage, setBulkSuccessMessage] = useState<string | null>(null);
  const [bulkCreatedLearners, setBulkCreatedLearners] = useState<Learner[]>([]);

  const { teacherProfile, teacherToken } = useAuth();

  // Password Reset Confirmation & Success Modals
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmResetTarget, setConfirmResetTarget] = useState<Learner | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetSuccessModal, setResetSuccessModal] = useState<{
    learner: Learner;
    learnerName: string;
    digitalId: string;
    newInitialPassword: string;
    cohortName: string;
  } | null>(null);

  // Newly Created Learner Slip Modal
  const [newlyCreatedSlip, setNewlyCreatedSlip] = useState<{
    learner: Learner;
    cohortName: string;
    initialPassword: string;
  } | null>(null);

  // Digital Learner ID Card Modal
  const [idCardTarget, setIdCardTarget] = useState<{
    learner: Learner;
    cohortName: string;
  } | null>(null);

  // Stored password mapping for newly created learners
  const [newPasswordMap, setNewPasswordMap] = useState<Record<string, string>>({});

  const distinctSchools = useMemo(() => {
    const set = new Set<string>(['Sangurur Comprehensive School']);
    learners.forEach((lr) => {
      const s = (lr.schoolName || 'Sangurur Comprehensive School').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [learners]);

  // Filter learners
  const filteredLearners = learners.filter((lr) => {
    const lrSchool = (lr.schoolName || 'Sangurur Comprehensive School').trim();
    const assignedCohort = cohorts.find((c) => (lr.assignedCohortIds || []).includes(c.id));
    const lrTier = classifyEducationLevel(lr.grade, assignedCohort?.learningLevel);
    const matchesSearch =
      lr.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lr.learnerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lr.digitalId && lr.digitalId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lr.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lrSchool.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lr.grade && lr.grade.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCohort =
      cohortFilter === 'all' || (lr.assignedCohortIds || []).includes(cohortFilter);
    const matchesSchool = schoolFilter === 'all' || lrSchool === schoolFilter;
    const matchesGrade =
      gradeFilter === 'all' ||
      (gradeFilter.startsWith('level:')
        ? lrTier === gradeFilter.replace('level:', '')
        : (lr.grade || '').toLowerCase() === gradeFilter.toLowerCase());
    return matchesSearch && matchesCohort && matchesSchool && matchesGrade;
  });

  // Handle Single Learner Submission
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSingle(true);
    setSingleError(null);

    try {
      const headers = await getTeacherAuthHeaders(teacherToken);
      const res = await fetch('/api/learners/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fullName: singleName,
          schoolName: singleSchoolName.trim() || 'Sangurur Comprehensive School',
          grade: singleGrade,
          cohortId: singleCohortId,
          gender: singleGender,
          age: singleAge || undefined,
          guardianContact: singleGuardian,
          customDigitalId: singleCustomId || undefined,
          teacherId: teacherProfile?.uid || 'teacher_staff',
          teacherName: teacherProfile?.fullName || 'Staff Teacher',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create learner');
      }

      const assignedCohort = cohorts.find((c) => c.id === singleCohortId);
      const cohortName = assignedCohort ? `${assignedCohort.name} (${assignedCohort.code})` : 'Class Cohort';

      setNewPasswordMap((prev) => ({
        ...prev,
        [data.learner.id]: '123456789',
      }));

      setNewlyCreatedSlip({
        learner: data.learner,
        cohortName,
        initialPassword: '123456789',
      });

      await onRefresh();
      setShowSingleModal(false);
      setSingleName('');
      setSingleGuardian('');
      setSingleCustomId('');
    } catch (err: any) {
      setSingleError(err.message || 'Error registering learner');
    } finally {
      setSubmittingSingle(false);
    }
  };

  // Handle File Upload for Bulk Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFile(file);
    setBulkParsing(true);
    setBulkError(null);
    setBulkSuccessMessage(null);
    setBulkCreatedLearners([]);

    try {
      const rows = await parseLearnersExcel(file);

      const existingUsernames = new Set(learners.map((l) => l.username.toLowerCase()));
      const existingIds = new Set(learners.map((l) => l.learnerId.toLowerCase()));

      const annotated = rows.map((r) => {
        const errors = [...r.errors];
        if (r.username && existingUsernames.has(r.username.toLowerCase())) {
          errors.push(`Username '${r.username}' already exists`);
        }
        if (r.learnerId && existingIds.has(r.learnerId.toLowerCase())) {
          errors.push(`Admission ID '${r.learnerId}' already exists`);
        }
        return {
          ...r,
          errors,
          isValid: errors.length === 0,
        };
      });

      setParsedRows(annotated);
    } catch {
      setBulkError('Failed to parse file. Please upload a valid .xlsx or .csv template.');
    } finally {
      setBulkParsing(false);
    }
  };

  // Submit Bulk Import
  const handleBulkSubmit = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setBulkError('No valid rows to import.');
      return;
    }

    setBulkSubmitting(true);
    setBulkError(null);

    try {
      const headers = await getTeacherAuthHeaders(teacherToken);
      const res = await fetch('/api/learners/bulk-import', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cohortId: bulkCohortId,
          learners: validRows,
          teacherId: teacherProfile?.uid || 'teacher_staff',
          teacherName: teacherProfile?.fullName || 'Staff Teacher',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to import learners');

      const pwdMap: Record<string, string> = { ...newPasswordMap };
      (data.learners || []).forEach((lr: any) => {
        if (lr.initialPassword) pwdMap[lr.id] = lr.initialPassword;
      });
      setNewPasswordMap(pwdMap);
      setBulkCreatedLearners(data.learners || []);

      await onRefresh();
      setBulkSuccessMessage(
        `Successfully registered ${data.createdCount} learners with sequential Digital IDs and default password 123456789.`
      );
      setParsedRows([]);
      setBulkFile(null);
    } catch (err: any) {
      setBulkError(err.message || 'Import error');
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Confirmed Reset Learner Password
  const executeResetPassword = async (learner: Learner) => {
    setResettingId(learner.id);
    setActionError(null);
    try {
      const headers = await getTeacherAuthHeaders(teacherToken);
      const res = await fetch('/api/learners/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          learnerId: learner.id,
          teacherId: teacherProfile?.uid || 'teacher_staff',
          teacherName: teacherProfile?.fullName || 'Staff Teacher',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      const assignedCohort = cohorts.find((c) => (learner.assignedCohortIds || []).includes(c.id));
      const cohortName = assignedCohort ? `${assignedCohort.name} (${assignedCohort.code})` : 'Class Cohort';

      setNewPasswordMap((prev) => ({
        ...prev,
        [learner.id]: data.initialPassword || '123456789',
      }));

      setConfirmResetTarget(null);
      setResetSuccessModal({
        learner,
        learnerName: learner.fullName,
        digitalId: data.digitalId || learner.digitalId || learner.learnerId,
        newInitialPassword: data.initialPassword || '123456789',
        cohortName,
      });

      await onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Error resetting password');
      setConfirmResetTarget(null);
    } finally {
      setResettingId(null);
    }
  };

  // Generate Printable Login Slips
  const handleGenerateSlips = () => {
    const targetCohort = cohorts.find((c) => c.id === cohortFilter);
    const cohortName = targetCohort ? targetCohort.name : 'Sangurur School Cohorts';

    generatePrintableLoginSlipsPDF(
      filteredLearners,
      cohortName,
      newPasswordMap
    );
  };

  return (
    <div className="space-y-6">
      {/* Header and Action Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Learner Registration & Credentials
          </h2>
          <p className="text-xs text-slate-500">
            Register students individually or in bulk, generate secure credentials, and print access slips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setSingleCohortId(cohorts[0]?.id || '');
              setShowSingleModal(true);
            }}
            className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Single Learner</span>
          </button>

          <button
            onClick={() => {
              setBulkCohortId(cohorts[0]?.id || '');
              setParsedRows([]);
              setBulkFile(null);
              setBulkError(null);
              setBulkSuccessMessage(null);
              setShowBulkModal(true);
            }}
            className="py-2 px-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Excel / CSV Import</span>
          </button>

          <button
            onClick={handleGenerateSlips}
            disabled={filteredLearners.length === 0}
            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Login Slips (PDF)</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-center">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search name, ID, school, grade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:bg-white outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">School:</span>
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-600 outline-none"
          >
            <option value="all">All Schools ({distinctSchools.length})</option>
            {distinctSchools.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Grade:</span>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-600 outline-none"
          >
            <option value="all">All Grades & Levels</option>
            <optgroup label="Education Levels">
              {EDUCATION_LEVEL_BANDS.map((band) => (
                <option key={`level:${band.key}`} value={`level:${band.key}`}>
                  {band.label} ({band.shortRange})
                </option>
              ))}
            </optgroup>
            {EDUCATION_LEVEL_BANDS.map((band) => (
              <optgroup key={band.key} label={`${band.label} Grades`}>
                {band.grades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Cohort:</span>
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="w-full py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-600 outline-none"
          >
            <option value="all">All Cohorts ({learners.length})</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Learners Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 bg-slate-50/60">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-700">
              Showing {filteredLearners.length} Registered Learners
            </span>
            {(schoolFilter !== 'all' || gradeFilter !== 'all' || cohortFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSchoolFilter('all');
                  setGradeFilter('all');
                  setCohortFilter('all');
                }}
                className="text-[11px] font-bold text-emerald-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500">
            Passwords protected with server PBKDF2 hashing
          </span>
        </div>

        {filteredLearners.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No learners found matching these filters</p>
            <p>Adjust your school/grade filters or click "Add Single Learner" to register students.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Learner Name</th>
                  <th className="py-3 px-4">School & Grade</th>
                  <th className="py-3 px-4">Digital ID (Login Username)</th>
                  <th className="py-3 px-4">Enrolled Cohort</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Security & Password State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLearners.map((lr, idx) => {
                  const assignedCohort = cohorts.find((c) => (lr.assignedCohortIds || []).includes(c.id));
                  const assignedCohortNames = cohorts
                    .filter((c) => (lr.assignedCohortIds || []).includes(c.id))
                    .map((c) => c.code)
                    .join(', ');

                  const digitalId = lr.digitalId || lr.learnerId || lr.username;
                  const lrSchool = lr.schoolName || 'Sangurur Comprehensive School';
                  const tierKey = classifyEducationLevel(lr.grade, assignedCohort?.learningLevel);
                  const tierMeta = EDUCATION_LEVEL_BANDS.find((b) => b.key === tierKey);

                  return (
                    <tr key={lr.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-900 block">{lr.fullName}</strong>
                        <span className="text-[11px] text-slate-400 capitalize">
                          {lr.gender || 'Not specified'} • Age {lr.age || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block text-xs">{lrSchool}</span>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                            {lr.grade || assignedCohort?.learningLevel || 'Grade Unspecified'}
                          </span>
                          {tierMeta && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold text-[10px]">
                              {tierMeta.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs bg-blue-50 text-blue-900 border border-blue-200/80 px-2.5 py-1 rounded-md inline-block shadow-2xs">
                          {digitalId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {assignedCohortNames || 'No Cohort'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                          <span>{lr.status || 'ACTIVE'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {lr.mustChangePassword || lr.isFirstLogin ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] inline-block">
                              Must Change Password
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              Default: 123456789
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] inline-flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Personal Password Active</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() =>
                              setIdCardTarget({
                                learner: lr,
                                cohortName: assignedCohort ? `${assignedCohort.name} (${assignedCohort.code})` : 'Sangurur School Cohort',
                              })
                            }
                            className="py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1 shadow-2xs"
                            title="View & download official Digital ID Card"
                          >
                            <CreditCard className="w-3 h-3 text-blue-700" />
                            <span>ID Card</span>
                          </button>

                          <button
                            onClick={() => {
                              generateSingleLoginSlipPDF(
                                lr,
                                assignedCohort ? `${assignedCohort.name} (${assignedCohort.code})` : 'Sangurur School Cohort',
                                newPasswordMap[lr.id] || '123456789'
                              );
                            }}
                            className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1 shadow-2xs"
                            title="Print official login slip with Digital ID"
                          >
                            <Printer className="w-3 h-3 text-slate-600" />
                            <span>Print Slip</span>
                          </button>

                          <button
                            onClick={() => setConfirmResetTarget(lr)}
                            disabled={resettingId === lr.id}
                            className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1 shadow-2xs"
                            title="Reset password to default (123456789)"
                          >
                            <KeyRound className="w-3 h-3 text-amber-700" />
                            <span>{resettingId === lr.id ? 'Resetting...' : 'Reset'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SINGLE LEARNER REGISTRATION MODAL */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-emerald-800 p-5 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Register Individual Learner
                </h3>
                <p className="text-emerald-100 text-xs">
                  Sangurur Comprehensive School
                </p>
              </div>
              <button
                onClick={() => setShowSingleModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSingleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {singleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {singleError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter learner's full name"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    list="registered-schools-list"
                    placeholder="e.g. Sangurur Comprehensive School"
                    value={singleSchoolName}
                    onChange={(e) => setSingleSchoolName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                  <datalist id="registered-schools-list">
                    {distinctSchools.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Grade / Class *
                  </label>
                  <select
                    required
                    value={singleGrade}
                    onChange={(e) => setSingleGrade(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    {EDUCATION_LEVEL_BANDS.map((band) => (
                      <optgroup key={band.key} label={`${band.label} (${band.shortRange})`}>
                        {band.grades.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Cohort Assignment *
                </label>
                <select
                  required
                  value={singleCohortId}
                  onChange={(e) => setSingleCohortId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                >
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gender
                  </label>
                  <select
                    value={singleGender}
                    onChange={(e) => setSingleGender(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={25}
                    value={singleAge}
                    onChange={(e) => setSingleAge(Number(e.target.value) || '')}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Guardian Contact (Optional)
                </label>
                <input
                  type="text"
                  placeholder="+254 712 345 678"
                  value={singleGuardian}
                  onChange={(e) => setSingleGuardian(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>

              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <p className="font-bold flex items-center space-x-1.5 text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Mandatory Security Credentials Protocol:</span>
                </p>
                <ul className="list-disc list-inside text-[11px] text-emerald-800 space-y-0.5 pl-1">
                  <li><strong>Digital ID:</strong> Automatically generated sequential ID (e.g. <code className="font-mono bg-emerald-100/60 px-1 py-0.5 rounded">SG-LRN-2026-001</code>).</li>
                  <li><strong>Username:</strong> Digital ID serves as the student's login username.</li>
                  <li><strong>Initial Default Password:</strong> <code className="font-mono bg-emerald-100/60 px-1 py-0.5 rounded font-bold">123456789</code>.</li>
                  <li><strong>Security Protocol:</strong> Status is ACTIVE with <code className="font-mono">mustChangePassword = true</code>. Immediate mandatory password rotation on first login.</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="py-2 px-4 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSingle}
                  className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  {submittingSingle ? 'Creating...' : 'Register Learner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK IMPORT MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-blue-800 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Bulk Learner Registration (Excel / CSV)
                </h3>
                <p className="text-blue-100 text-xs">
                  Upload spreadsheet with preview, validation, and duplicate detection
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {bulkError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {bulkError}
                </div>
              )}

              {bulkSuccessMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{bulkSuccessMessage}</span>
                  </div>
                  {bulkCreatedLearners.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetCohort = cohorts.find((c) => c.id === bulkCohortId);
                        generatePrintableLoginSlipsPDF(
                          bulkCreatedLearners,
                          targetCohort ? `${targetCohort.name} (${targetCohort.code})` : 'Sangurur School Cohort',
                          newPasswordMap
                        );
                      }}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] flex items-center space-x-1.5 shrink-0 transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-300" />
                      <span>Print Imported Slips (PDF)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Step 1: Cohort Selection & Official Template */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Assign to Cohort:
                  </label>
                  <select
                    value={bulkCohortId}
                    onChange={(e) => setBulkCohortId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
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
                    Download Official Template:
                  </label>
                  <button
                    type="button"
                    onClick={downloadSampleLearnerTemplate}
                    className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition border border-slate-200"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-700" />
                    <span>Download Excel Template (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Step 2: File Upload */}
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="excelFileInput" className="cursor-pointer space-y-2 block">
                  <FileSpreadsheet className="w-10 h-10 text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    {bulkFile ? bulkFile.name : 'Click to select spreadsheet (.xlsx or .csv)'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Columns: Full Name (required), School Name, Grade, Learner ID, Gender, Age, Guardian Contact
                  </p>
                </label>
              </div>

              {/* Step 3: Validation Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">
                      Import Preview: {parsedRows.filter((r) => r.isValid).length} Valid •{' '}
                      {parsedRows.filter((r) => !r.isValid).length} Errors
                    </span>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Learner Name</th>
                          <th className="py-2 px-3">School & Grade</th>
                          <th className="py-2 px-3">ID / Code</th>
                          <th className="py-2 px-3">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={row.isValid ? 'bg-white' : 'bg-rose-50/50'}
                          >
                            <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-slate-900">{row.fullName}</td>
                            <td className="py-2 px-3 text-slate-600">
                              <span className="block font-semibold text-[11px]">{row.schoolName || 'Sangurur Comprehensive School'}</span>
                              {row.grade && (
                                <span className="text-[10px] text-emerald-700 font-bold">{row.grade}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{row.learnerId || '(Auto)'}</td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Ready to import</span>
                                </span>
                              ) : (
                                <span className="text-rose-700 font-medium">
                                  {row.errors.join(', ')}
                                </span>
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

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="py-2 px-4 text-xs text-slate-600 font-semibold"
              >
                Close
              </button>

              <button
                type="button"
                disabled={bulkSubmitting || parsedRows.filter((r) => r.isValid).length === 0}
                onClick={handleBulkSubmit}
                className="py-2.5 px-6 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition"
              >
                {bulkSubmitting
                  ? 'Importing Learners...'
                  : `Confirm & Import (${parsedRows.filter((r) => r.isValid).length} Learners)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEWLY CREATED LEARNER ACCESS SLIP MODAL */}
      {newlyCreatedSlip && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="inline-flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs mx-auto">
              <SchoolLogo className="w-16 h-16" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                Learner Registered Successfully
              </span>
              <h3 className="text-lg font-black text-slate-900">
                Official Digital ID Generated
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Student: <strong className="text-slate-800">{newlyCreatedSlip.learner.fullName}</strong>
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Digital ID (Username):</span>
                <span className="text-sm font-mono font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {newlyCreatedSlip.learner.digitalId || newlyCreatedSlip.learner.learnerId}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-xs text-slate-500 font-semibold">Initial Default Password:</span>
                <span className="text-sm font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {newlyCreatedSlip.initialPassword}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Assigned Cohort:</span>
                <span className="font-bold text-slate-800">{newlyCreatedSlip.cohortName}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Account Status:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  ACTIVE (Must Change Password)
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 text-left bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900">
              <strong>Mandatory Protocol:</strong> Upon first login with this Digital ID and default password (123456789), the learner will be blocked from the register until they configure their own private password.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  generateSingleLoginSlipPDF(
                    newlyCreatedSlip.learner,
                    newlyCreatedSlip.cohortName,
                    newlyCreatedSlip.initialPassword
                  );
                }}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print Official Login Slip (PDF)</span>
              </button>

              <button
                onClick={() => setNewlyCreatedSlip(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD RESET SUCCESS NOTIFICATION WITH PRINT SLIP */}
      {resetSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="inline-flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs mx-auto">
              <SchoolLogo className="w-14 h-14" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                Authorised Password Reset
              </span>
              <h3 className="text-base font-black text-slate-900">
                Password Reset to Default
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Learner: <strong className="text-slate-800">{resetSuccessModal.learnerName}</strong>
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-semibold">Digital ID:</span>
                <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                  {resetSuccessModal.digitalId}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Default Password:</span>
                <span className="font-mono font-black text-emerald-800 text-sm">
                  {resetSuccessModal.newInitialPassword}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              The learner must change this default password upon their next login. This action has been recorded in the institution audit log.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  generateSingleLoginSlipPDF(
                    resetSuccessModal.learner,
                    resetSuccessModal.cohortName,
                    resetSuccessModal.newInitialPassword
                  );
                }}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-md transition"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print Official Login Slip (PDF)</span>
              </button>

              <button
                onClick={() => setResetSuccessModal(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                Done & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PASSWORD RESET MODAL */}
      {confirmResetTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Confirm Password Reset
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Reset password for <strong>{confirmResetTarget.fullName}</strong> (
                  <span className="font-mono">{confirmResetTarget.digitalId || confirmResetTarget.learnerId}</span>) back to default <code className="font-mono font-bold">123456789</code>?
                </p>
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                  The learner will be required to set a new personal password immediately upon their next login, and this reset will be logged in the audit trail.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetTarget(null)}
                disabled={resettingId === confirmResetTarget.id}
                className="py-2 px-4 text-xs text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeResetPassword(confirmResetTarget)}
                disabled={resettingId === confirmResetTarget.id}
                className="py-2 px-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-xs"
              >
                {resettingId === confirmResetTarget.id ? 'Resetting...' : 'Reset to 123456789'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DIGITAL LEARNER ID CARD MODAL */}
      {idCardTarget && (
        <DigitalIdCardModal
          learner={idCardTarget.learner}
          cohortName={idCardTarget.cohortName}
          onClose={() => setIdCardTarget(null)}
        />
      )}
    </div>
  );
};
