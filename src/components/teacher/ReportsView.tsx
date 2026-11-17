import React, { useState } from 'react';
import { Cohort, Learner, DailyRegister } from '../../types';
import {
  generateDailyAttendancePDF,
  generateWeeklyAttendancePDF,
  generateMonthlyAttendancePDF,
  generateIndividualAttendancePDF,
  generateCohortAttendancePDF,
  generateCurriculumCoveragePDF,
  generateLearnerUnderstandingPDF,
  generateIndividualProgressPDF,
  generateSupportNeededPDF,
} from '../../services/pdfReportGenerator';
import { exportRegistersToExcel, exportRegistersToCSV } from '../../services/excelService';
import { SchoolLogo } from '../common/SchoolLogo';
import {
  FileSpreadsheet,
  Printer,
  Download,
  Calendar,
  Filter,
  CheckCircle,
  FileText,
  Clock,
  BookOpen,
  AlertTriangle,
  Award,
} from 'lucide-react';

interface ReportsViewProps {
  cohorts: Cohort[];
  learners: Learner[];
  registers: DailyRegister[];
}

type ReportType =
  | 'daily_attendance'
  | 'weekly_attendance'
  | 'monthly_attendance'
  | 'individual_attendance'
  | 'cohort_attendance'
  | 'curriculum_coverage'
  | 'learner_understanding'
  | 'individual_progress'
  | 'support_needed';

export const ReportsView: React.FC<ReportsViewProps> = ({
  cohorts,
  learners,
  registers,
}) => {
  const nairobiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [selectedReport, setSelectedReport] = useState<ReportType>('daily_attendance');
  const [selectedCohortId, setSelectedCohortId] = useState<string>(cohorts[0]?.id || 'all');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(learners[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<string>(nairobiToday);

  const allCohortsPlaceholder: Cohort = {
    id: 'all',
    name: 'All School Cohorts',
    code: 'SCS-ALL',
    programme: 'All Institutional Programmes',
    description: 'School-wide cohort summary',
    learningLevel: 'All Grades',
    startDate: '',
    endDate: '',
    teacherId: '',
    teacherName: 'Sangurur Faculty',
    status: 'active',
    createdAt: '',
  };

  const activeCohort: Cohort =
    selectedCohortId === 'all'
      ? allCohortsPlaceholder
      : cohorts.find((c) => c.id === selectedCohortId) || allCohortsPlaceholder;

  const cohortFilteredLearners = learners.filter(
    (l) => selectedCohortId === 'all' || (l.assignedCohortIds || []).includes(selectedCohortId)
  );
  const activeLearner =
    cohortFilteredLearners.find((l) => l.id === selectedLearnerId) || cohortFilteredLearners[0];

  // Compute 7-day inclusive window ending on selectedDate
  const getWeeklyBounds = (endDateStr: string) => {
    const endMs = Date.parse(`${endDateStr}T00:00:00Z`);
    if (Number.isNaN(endMs)) return { startStr: endDateStr, endStr: endDateStr };
    const startMs = endMs - 6 * 24 * 60 * 60 * 1000;
    const startStr = new Date(startMs).toISOString().slice(0, 10);
    return { startStr, endStr: endDateStr };
  };

  // Filter registers based on report type
  const getReportData = (): DailyRegister[] => {
    switch (selectedReport) {
      case 'daily_attendance':
        return registers.filter(
          (r) =>
            r.date === selectedDate &&
            (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
        );
      case 'weekly_attendance': {
        const { startStr, endStr } = getWeeklyBounds(selectedDate);
        return registers.filter(
          (r) =>
            r.date >= startStr &&
            r.date <= endStr &&
            (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
        );
      }
      case 'monthly_attendance': {
        const monthPrefix = selectedDate.slice(0, 7);
        return registers.filter(
          (r) =>
            r.date.startsWith(monthPrefix) &&
            (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
        );
      }
      case 'individual_attendance':
      case 'individual_progress':
        return registers.filter(
          (r) =>
            r.learnerDocId === activeLearner?.id &&
            (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
        );
      case 'support_needed':
        return registers.filter(
          (r) =>
            (r.understandingLevel === 'needs_support' || r.understandingLevel === 'fair') &&
            (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
        );
      case 'cohort_attendance':
      case 'curriculum_coverage':
      case 'learner_understanding':
      default:
        return registers.filter(
          (r) => selectedCohortId === 'all' || r.cohortId === selectedCohortId
        );
    }
  };

  const reportData = getReportData();

  // Export PDF Dispatcher
  const handleExportPDF = () => {
    switch (selectedReport) {
      case 'daily_attendance':
        generateDailyAttendancePDF(reportData, activeCohort, selectedDate);
        break;
      case 'weekly_attendance': {
        const { startStr, endStr } = getWeeklyBounds(selectedDate);
        generateWeeklyAttendancePDF(reportData, activeCohort, `${startStr} to ${endStr}`);
        break;
      }
      case 'monthly_attendance':
        generateMonthlyAttendancePDF(reportData, activeCohort, `Month of ${selectedDate.slice(0, 7)}`);
        break;
      case 'individual_attendance':
        if (activeLearner) {
          generateIndividualAttendancePDF(reportData, activeLearner, activeCohort.name);
        }
        break;
      case 'cohort_attendance':
        generateCohortAttendancePDF(reportData, activeCohort);
        break;
      case 'curriculum_coverage': {
        const totalTopics =
          selectedCohortId === 'all'
            ? cohorts.reduce(
                (cAcc, c) =>
                  cAcc +
                  (c.curriculumSnapshot?.learningAreas.reduce(
                    (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
                    0
                  ) || 0),
                0
              )
            : activeCohort?.curriculumSnapshot?.learningAreas.reduce(
                (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
                0
              ) || 0;
        const coveredCount = new Set(reportData.map((r) => r.topicId).filter(Boolean)).size;
        generateCurriculumCoveragePDF(activeCohort, coveredCount, totalTopics, reportData);
        break;
      }
      case 'learner_understanding':
        generateLearnerUnderstandingPDF(reportData, activeCohort);
        break;
      case 'individual_progress':
        if (activeLearner) {
          generateIndividualProgressPDF(activeLearner, reportData, activeCohort.name);
        }
        break;
      case 'support_needed':
        generateSupportNeededPDF(reportData, activeCohort);
        break;
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    exportRegistersToExcel(reportData, `SDLR_${selectedReport}_${selectedCohortId}`);
  };

  // Export CSV
  const handleExportCSV = () => {
    exportRegistersToCSV(reportData, `SDLR_${selectedReport}_${selectedCohortId}`);
  };

  const reportList = [
    {
      id: 'daily_attendance' as ReportType,
      title: '1. Daily Attendance Report',
      desc: 'Attendance statuses, topics, and timestamps for specific date.',
    },
    {
      id: 'weekly_attendance' as ReportType,
      title: '2. Weekly Attendance Report',
      desc: '7-day summary of cohort sessions and presence.',
    },
    {
      id: 'monthly_attendance' as ReportType,
      title: '3. Monthly Attendance Report',
      desc: 'Comprehensive monthly attendance dossier.',
    },
    {
      id: 'individual_attendance' as ReportType,
      title: '4. Individual Learner Attendance Report',
      desc: 'Student-specific attendance rate and history.',
    },
    {
      id: 'cohort_attendance' as ReportType,
      title: '5. Cohort Attendance Report',
      desc: 'Master class attendance dossier across term.',
    },
    {
      id: 'curriculum_coverage' as ReportType,
      title: '6. Curriculum Coverage Report',
      desc: 'Learning areas, topics covered, and exposure %.',
    },
    {
      id: 'learner_understanding' as ReportType,
      title: '7. Learner Understanding Report',
      desc: 'Self-ratings: Excellent, Good, Fair, Support.',
    },
    {
      id: 'individual_progress' as ReportType,
      title: '8. Individual Learner Progress Report',
      desc: 'Student reflections, mastery, and teacher notes.',
    },
    {
      id: 'support_needed' as ReportType,
      title: '9. Learners Requiring Support Report',
      desc: 'Flagged students needing intervention.',
    },
  ];

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
                Official Reporting Dossier
              </span>
              <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              Reports & Multi-Format Exports
            </h2>
            <p className="text-xs text-slate-500">
              Generate print-ready PDFs formatted with the official school logo, motto (Think, Code, Change the World), dates, and totals, or export branded Excel/CSV.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Generate PDF Report</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {reportList.map((rep) => {
          const isSelected = selectedReport === rep.id;
          return (
            <div
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-emerald-700 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <h4 className="font-extrabold text-slate-900 text-xs">{rep.title}</h4>
              <p className="text-[11px] text-slate-500 mt-1">{rep.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Parameters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Target Cohort:
          </label>
          <select
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
          >
            <option value="all">All School Cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {(selectedReport === 'daily_attendance' ||
          selectedReport === 'weekly_attendance' ||
          selectedReport === 'monthly_attendance') && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Reference Date:
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
            />
          </div>
        )}

        {(selectedReport === 'individual_attendance' ||
          selectedReport === 'individual_progress') && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Select Learner:
            </label>
            <select
              value={activeLearner?.id || ''}
              onChange={(e) => setSelectedLearnerId(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
            >
              {cohortFilteredLearners.length === 0 ? (
                <option value="">No learners in cohort</option>
              ) : (
                cohortFilteredLearners.map((lr) => (
                  <option key={lr.id} value={lr.id}>
                    {lr.fullName} ({lr.digitalId || lr.learnerId})
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      {/* Live Table Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center space-x-3 bg-slate-50/60">
          <div className="bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
            <SchoolLogo className="w-9 h-9" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800">
              Live Preview: {reportData.length} Records in Selection
            </span>
            <p className="text-[11px] text-slate-500">
              Institution: Sangurur Comprehensive School • Motto: THINK, CODE, CHANGE THE WORLD
            </p>
          </div>
        </div>

        {reportData.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-1">
            <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No records found for current parameters</p>
            <p>Try switching date or cohort to preview records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Learner Name</th>
                  <th className="py-2.5 px-3">Cohort</th>
                  <th className="py-2.5 px-3">Attendance</th>
                  <th className="py-2.5 px-3">Topic Covered</th>
                  <th className="py-2.5 px-3">Understanding</th>
                  <th className="py-2.5 px-3">Learner Reflection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportData.slice(0, 15).map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{r.date}</td>
                    <td className="py-2 px-3 font-bold text-slate-900">{r.learnerName}</td>
                    <td className="py-2 px-3">{r.cohortCode}</td>
                    <td className="py-2 px-3">
                      <span className="font-bold uppercase text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 max-w-[150px] truncate">{r.topicTitle || '—'}</td>
                    <td className="py-2 px-3 font-bold text-blue-700 uppercase">
                      {r.understandingLevel ? r.understandingLevel.replace('_', ' ') : '—'}
                    </td>
                    <td className="py-2 px-3 max-w-xs truncate text-slate-500">
                      {r.reflectionLearned || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
