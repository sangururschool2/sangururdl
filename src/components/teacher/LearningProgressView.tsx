import React, { useState, useEffect } from 'react';
import { Cohort, Learner, DailyRegister } from '../../types';
import {
  generateIndividualProgressPDF,
  generateBootcampCertificatePDF,
} from '../../services/pdfReportGenerator';
import { SchoolLogo } from '../common/SchoolLogo';
import {
  getMasteryCertifications,
  setMasteryCertification,
} from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp,
  User,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Printer,
  ChevronRight,
  Filter,
  Brain,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

interface LearningProgressViewProps {
  cohorts: Cohort[];
  learners: Learner[];
  registers: DailyRegister[];
}

export const LearningProgressView: React.FC<LearningProgressViewProps> = ({
  cohorts,
  learners,
  registers,
}) => {
  const { teacherProfile } = useAuth();
  const [selectedCohortId, setSelectedCohortId] = useState<string>(cohorts[0]?.id || 'all');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(learners[0]?.id || '');
  const [certifiedMasteryIds, setCertifiedMasteryIds] = useState<Set<string>>(new Set());
  const [savingMastery, setSavingMastery] = useState(false);
  const [masteryError, setMasteryError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCohortId === 'all' && cohorts.length > 0) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [cohorts]);

  useEffect(() => {
    let active = true;
    async function loadCerts() {
      const hasSchoolWideAccess =
        teacherProfile?.role === 'admin' ||
        teacherProfile?.role === 'super_admin' ||
        teacherProfile?.uid === 'teacher_default_staff';
      const certs = await getMasteryCertifications(
        undefined,
        hasSchoolWideAccess ? undefined : cohorts.map((c) => c.id)
      );
      if (!active) return;
      const setIds = new Set(
        certs.filter((c) => c.certified).map((c) => `${c.cohortId}::${c.learnerId}`)
      );
      setCertifiedMasteryIds(setIds);
    }
    loadCerts();
    return () => {
      active = false;
    };
  }, [cohorts, teacherProfile?.uid, teacherProfile?.role]);

  // Current cohort object
  const activeCohort = cohorts.find((c) => c.id === selectedCohortId) || (selectedCohortId !== 'all' ? cohorts[0] : undefined);

  // Learners in this cohort
  const cohortLearners = learners.filter(
    (l) => selectedCohortId === 'all' || (l.assignedCohortIds || []).includes(selectedCohortId)
  );

  // Selected learner
  const activeLearner = cohortLearners.find((l) => l.id === selectedLearnerId) || cohortLearners[0];

  // Registers for active learner scoped to selected cohort
  const learnerRegisters = registers.filter(
    (r) =>
      r.learnerDocId === activeLearner?.id &&
      (selectedCohortId === 'all' || r.cohortId === selectedCohortId)
  );

  // Calculate separate 4 indicators (Section 12 requirement):
  // 1. Attendance Rate
  const totalSessions = learnerRegisters.length;
  const presentSessions = learnerRegisters.filter((r) => r.status === 'present' || r.status === 'late').length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

  // 2. Topic Exposure (exact curriculum topic count; never fabricate a fallback)
  const totalCurriculumTopics = activeCohort?.curriculumSnapshot?.learningAreas
    ? activeCohort.curriculumSnapshot.learningAreas.reduce(
        (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
        0
      )
    : cohorts.reduce(
        (cAcc, c) =>
          cAcc +
          (c.curriculumSnapshot?.learningAreas.reduce(
            (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
            0
          ) || 0),
        0
      );
  const uniqueTopicsCovered = new Set(learnerRegisters.map((r) => r.topicId).filter(Boolean)).size;
  const topicExposurePercent =
    totalCurriculumTopics > 0
      ? Math.min(100, Math.round((uniqueTopicsCovered / totalCurriculumTopics) * 100))
      : 0;

  // 3. Learner-Reported Understanding
  const understandingWeights: Record<string, number> = {
    excellent: 100,
    good: 75,
    fair: 50,
    needs_support: 25,
  };
  const understandingValues = learnerRegisters
    .map((r) => (r.understandingLevel ? understandingWeights[r.understandingLevel] : null))
    .filter((v): v is number => v !== null);

  const avgUnderstanding =
    understandingValues.length > 0
      ? Math.round(understandingValues.reduce((a, b) => a + b, 0) / understandingValues.length)
      : 0;

  // 4. Teacher-Verified Mastery (Persisted in Firestore)
  const effectiveCohortId = activeCohort?.id || activeLearner?.assignedCohortIds?.[0] || 'general';
  const masteryKey = activeLearner ? `${effectiveCohortId}::${activeLearner.id}` : '';
  const isMasteryCertified = masteryKey ? certifiedMasteryIds.has(masteryKey) : false;

  const toggleMasteryCertification = async () => {
    if (!activeLearner || !masteryKey) return;
    setSavingMastery(true);
    setMasteryError(null);
    const nextCertified = !isMasteryCertified;

    try {
      await setMasteryCertification({
        cohortId: effectiveCohortId,
        learnerId: activeLearner.id,
        learnerName: activeLearner.fullName,
        certified: nextCertified,
        teacherId: teacherProfile?.uid || 'teacher_staff',
        teacherName: teacherProfile?.fullName || 'Staff Teacher',
      });

      const next = new Set(certifiedMasteryIds);
      if (nextCertified) {
        next.add(masteryKey);
      } else {
        next.delete(masteryKey);
      }
      setCertifiedMasteryIds(next);
    } catch (err: any) {
      setMasteryError(err.message || 'Failed to update mastery certification');
    } finally {
      setSavingMastery(false);
    }
  };

  const handleExportPDF = () => {
    if (!activeLearner) return;
    generateIndividualProgressPDF(
      activeLearner,
      learnerRegisters,
      activeCohort ? `${activeCohort.name} (${activeCohort.code})` : 'Sangurur Comprehensive'
    );
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
                Curriculum Mastery & Progress Monitor
              </span>
              <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
              Individual Learner Academic Dossier
            </h2>
            <p className="text-xs text-slate-500">
              Multi-dimensional evaluation: Attendance vs. Topic Exposure vs. Self-Rated Understanding vs. Teacher Mastery.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (!activeLearner) return;
              const targetCohort = activeCohort || cohorts[0] || ({
                id: 'general',
                name: 'Sangurur Academic Programme',
                code: 'SCS-PROG',
                programme: 'Computing & Digital Literacy',
                description: '',
                learningLevel: 'Junior Secondary',
                startDate: '',
                endDate: '',
                teacherId: '',
                teacherName: teacherProfile?.fullName || 'Sangurur Faculty',
                status: 'active',
                createdAt: '',
              } as Cohort);
              generateBootcampCertificatePDF(activeLearner, targetCohort);
            }}
            disabled={!activeLearner}
            className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Completion Certificate (PDF)</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!activeLearner || learnerRegisters.length === 0}
            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Export Learner Dossier (PDF)</span>
          </button>
        </div>
      </div>

      {masteryError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{masteryError}</span>
        </div>
      )}

      {/* Cohort and Learner Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Cohort:
          </span>
          <select
            value={selectedCohortId}
            onChange={(e) => {
              setSelectedCohortId(e.target.value);
              setSelectedLearnerId('');
            }}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
          >
            <option value="all">All Cohorts</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Select Learner:
          </span>
          <select
            value={activeLearner?.id || ''}
            onChange={(e) => setSelectedLearnerId(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
          >
            {cohortLearners.length === 0 ? (
              <option value="">No learners in cohort</option>
            ) : (
              cohortLearners.map((lr) => (
                <option key={lr.id} value={lr.id}>
                  {lr.fullName} ({lr.digitalId || lr.learnerId})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* FOUR INDEPENDENT INDICATORS (Section 12 requirement) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Indicator 1: Attendance Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">1. Attendance Rate</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-slate-900">{attendanceRate}%</span>
            <span className="text-xs text-slate-500">({presentSessions}/{totalSessions} sessions)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Physical classroom presence recorded via digital register.
          </p>
        </div>

        {/* Indicator 2: Topic Exposure */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">2. Topic Exposure</span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-blue-700">{topicExposurePercent}%</span>
            <span className="text-xs text-slate-500">({uniqueTopicsCovered}/{totalCurriculumTopics} Topics)</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Curriculum lessons covered with classroom participation.
          </p>
        </div>

        {/* Indicator 3: Learner-Reported Understanding */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">3. Self-Rated Understanding</span>
            <Brain className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-amber-600">{avgUnderstanding}%</span>
            <span className="text-xs text-slate-500">
              {avgUnderstanding >= 75 ? 'Strong' : avgUnderstanding >= 50 ? 'Moderate' : 'Needs Help'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Aggregated student reflection and comprehension ratings.
          </p>
        </div>

        {/* Indicator 4: Teacher-Verified Mastery (Independent certification) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">4. Teacher Mastery</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <span
              className={`text-sm font-black uppercase px-2.5 py-1 rounded-full ${
                isMasteryCertified
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isMasteryCertified ? 'Certified Mastered' : 'Under Assessment'}
            </span>
          </div>
          <button
            onClick={toggleMasteryCertification}
            disabled={savingMastery || !activeLearner}
            className={`w-full py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-50 ${
              isMasteryCertified
                ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {savingMastery
              ? 'Saving...'
              : isMasteryCertified
              ? 'Revoke Certification'
              : 'Certify Topic Mastery'}
          </button>
        </div>
      </div>

      {/* Detailed Learning Log for Selected Learner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/60">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Session History for {activeLearner?.fullName}
            </h3>
            <p className="text-xs text-slate-500">
              Admission ID: {activeLearner?.learnerId} • Username: {activeLearner?.username}
            </p>
          </div>
        </div>

        {learnerRegisters.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No session records logged for this learner</p>
            <p>Records will appear as the student completes their daily digital register.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Topic Covered</th>
                  <th className="py-3 px-4">Understanding Level</th>
                  <th className="py-3 px-4">Learner Reflection</th>
                  <th className="py-3 px-4">Difficulties / Question</th>
                  <th className="py-3 px-4">Teacher Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {learnerRegisters.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{reg.date}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold uppercase text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {reg.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{reg.topicTitle || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold uppercase text-blue-700">
                        {reg.understandingLevel ? reg.understandingLevel.replace('_', ' ') : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs text-slate-600">{reg.reflectionLearned || '—'}</td>
                    <td className="py-3 px-4 max-w-xs text-rose-700 font-medium">
                      {reg.reflectionDifficult || reg.reflectionTeacherExplain || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 italic">{reg.teacherNote || 'None'}</td>
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
