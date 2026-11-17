import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Cohort, DailyRegister, TeacherFeedback, WeeklyTimetableEntry } from '../../types';
import { DailyRegisterModal } from './DailyRegisterModal';
import { CohortSelectModal } from './CohortSelectModal';
import { SchoolLogo } from '../common/SchoolLogo';
import { DigitalIdCardModal } from '../common/DigitalIdCardModal';
import {
  Calendar,
  CheckCircle2,
  Clock,
  BookOpen,
  TrendingUp,
  Smile,
  Meh,
  Frown,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Layers,
  GraduationCap,
  KeyRound,
  Lock,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  CalendarDays,
  History,
  Edit3,
} from 'lucide-react';

interface LearnerDashboardProps {
  forceOpenCohortSelect?: boolean;
  onCohortSelected?: () => void;
}

export const LearnerDashboard: React.FC<LearnerDashboardProps> = ({
  forceOpenCohortSelect = false,
  onCohortSelected,
}) => {
  const { learnerProfile, learnerToken, changeLearnerPassword } = useAuth();

  const [activeCohort, setActiveCohort] = useState<Cohort | null>(null);
  const [assignedCohorts, setAssignedCohorts] = useState<Cohort[]>([]);
  const [showCohortModal, setShowCohortModal] = useState<boolean>(forceOpenCohortSelect);
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [registerModalDate, setRegisterModalDate] = useState<string | undefined>(undefined);
  const [showIdCardModal, setShowIdCardModal] = useState<boolean>(false);
  const [showRoadmap, setShowRoadmap] = useState<boolean>(false);
  const [showAllHistory, setShowAllHistory] = useState<boolean>(false);

  // Change Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  const [registers, setRegisters] = useState<DailyRegister[]>([]);
  const [feedbackList, setFeedbackList] = useState<TeacherFeedback[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<WeeklyTimetableEntry[]>([]);
  const [showAllWeeksTimetable, setShowAllWeeksTimetable] = useState<boolean>(false);
  const [cohortLoadError, setCohortLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const nairobiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const nairobiYesterday = (() => {
    const [y, m, d] = nairobiToday.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  })();

  const openRegisterForDate = (targetDate?: string) => {
    setRegisterModalDate(targetDate);
    setShowRegisterModal(true);
  };

  // Load strictly assigned cohorts via authenticated backend API
  useEffect(() => {
    async function initLearnerCohorts() {
      if (!learnerProfile || !learnerToken) return;
      setLoading(true);
      setCohortLoadError(null);
      try {
        const res = await fetch('/api/learner/cohorts', {
          headers: { Authorization: `Bearer ${learnerToken}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load assigned cohorts');
        }

        const list: Cohort[] = data.cohorts || [];
        setAssignedCohorts(list);

        if (list.length > 0 && !forceOpenCohortSelect) {
          const preferred = list.find((c) => c.status === 'active') || list[0];
          setActiveCohort(preferred);
        } else {
          setShowCohortModal(true);
          setLoading(false);
        }
      } catch (err: any) {
        setCohortLoadError(err.message || 'Error loading assigned cohorts');
        setLoading(false);
      }
    }
    initLearnerCohorts();
  }, [learnerProfile, learnerToken, forceOpenCohortSelect]);

  // Load scoped registers and feedback once cohort is selected
  useEffect(() => {
    async function loadData() {
      if (!learnerProfile || !learnerToken || !activeCohort) return;
      setLoading(true);
      try {
        const [regRes, fbRes, ttRes] = await Promise.all([
          fetch(`/api/learner/registers?cohortId=${encodeURIComponent(activeCohort.id)}`, {
            headers: { Authorization: `Bearer ${learnerToken}` },
          }),
          fetch('/api/learner/feedback', {
            headers: { Authorization: `Bearer ${learnerToken}` },
          }),
          fetch(`/api/learner/timetable?cohortId=${encodeURIComponent(activeCohort.id)}`, {
            headers: { Authorization: `Bearer ${learnerToken}` },
          }),
        ]);
        const regJson = await regRes.json();
        const fbJson = await fbRes.json();
        const ttJson = ttRes.ok ? await ttRes.json() : { entries: [] };
        if (regRes.ok) setRegisters(regJson.registers || []);
        if (fbRes.ok) setFeedbackList(fbJson.feedback || []);
        setTimetableEntries(ttJson.entries || []);
      } catch (err) {
        console.error('Error loading learner dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [learnerProfile, learnerToken, activeCohort]);

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPwd === '123456789') {
      setPwdError('New password cannot be the default initial password (123456789).');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('New password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match.');
      return;
    }

    setSavingPwd(true);
    try {
      await changeLearnerPassword(newPwd, currentPwd);
      setPwdSuccess('Password updated successfully.');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwdSuccess(null);
      }, 1200);
    } catch (err: any) {
      setPwdError(err.message || 'Could not update password');
    } finally {
      setSavingPwd(false);
    }
  };

  // Check if register already submitted today
  const todaySubmission = registers.find((r) => r.date === nairobiToday);

  // Calculate totals and metrics
  const totalSubmissions = registers.length;
  const presentCount = registers.filter((r) => r.status === 'present').length;
  const lateCount = registers.filter((r) => r.status === 'late').length;

  const excellentCount = registers.filter((r) => r.understandingLevel === 'excellent').length;
  const goodCount = registers.filter((r) => r.understandingLevel === 'good').length;
  const fairCount = registers.filter((r) => r.understandingLevel === 'fair').length;
  const needsSupportCount = registers.filter((r) => r.understandingLevel === 'needs_support').length;

  // Curriculum exposure (exact topic count, no hardcoded 10 fallback)
  const totalCohortTopics =
    activeCohort?.curriculumSnapshot?.learningAreas.reduce(
      (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
      0
    ) || 0;
  const coveredTopicIds = new Set(registers.map((r) => r.topicId).filter(Boolean) as string[]);
  const uniqueTopicsCovered = coveredTopicIds.size;
  const progressPercent =
    totalCohortTopics > 0 ? Math.min(100, Math.round((uniqueTopicsCovered / totalCohortTopics) * 100)) : 0;

  const displayedRegisters = showAllHistory ? registers : registers.slice(0, 10);

  return (
    <div className="flex-1 flex flex-col lg:flex-row relative w-full">
      {/* Left Student Welcome & Actions Panel (matching Teacher Navigation sidebar) */}
      <aside className="w-full lg:w-72 xl:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 shrink-0 flex flex-col justify-between lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="p-4 space-y-4">
          <p className="px-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Student Portal
          </p>

          {/* Welcome Box Card */}
          <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 rounded-2xl p-4 text-white shadow-md relative overflow-hidden space-y-3">
            <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center space-x-3">
              <div className="bg-white p-1 rounded-xl shadow-xs shrink-0">
                <SchoolLogo className="w-11 h-11" />
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-white/15 rounded-full text-[10px] font-semibold ring-1 ring-white/20">
                  <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
                  <span className="truncate">Sangurur SDLR</span>
                </div>
                <h1 className="text-lg font-black tracking-tight leading-snug mt-1 truncate">
                  Welcome, {learnerProfile?.fullName}!
                </h1>
              </div>
            </div>

            <div className="relative z-10 bg-black/20 border border-white/15 rounded-xl p-3 text-xs space-y-1 text-emerald-100">
              <p className="flex justify-between gap-2">
                <span className="text-emerald-200/80">Digital ID:</span>
                <strong className="text-white font-mono">{learnerProfile?.learnerId}</strong>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-emerald-200/80 shrink-0">Cohort:</span>
                <strong className="text-white text-right truncate">
                  {activeCohort?.name || 'No Cohort Assigned'}
                  {activeCohort?.code ? ` (${activeCohort.code})` : ''}
                </strong>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-emerald-200/80 shrink-0">Programme:</span>
                <span className="text-white/95 font-medium text-right truncate">
                  {activeCohort?.programme || '—'}
                </span>
              </p>
            </div>

            {/* Prominent Daily Register Action */}
            <div className="relative z-10 pt-1">
              {!activeCohort ? (
                <div className="bg-white/15 border border-white/25 rounded-xl p-3 text-xs text-amber-100">
                  No active cohort is assigned to your account yet. Please contact your class teacher.
                </div>
              ) : activeCohort.status !== 'active' ? (
                <div className="bg-white/15 border border-white/25 rounded-xl p-3 text-xs text-amber-100">
                  This cohort is archived. Daily register submissions are closed.
                </div>
              ) : todaySubmission ? (
                <div className="bg-white/15 border border-white/25 rounded-xl p-3 space-y-2">
                  <div className="flex items-center space-x-1.5 text-emerald-200 text-[11px] font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>Register Submitted Today</span>
                  </div>
                  <p className="text-xs font-black text-white">
                    Status: {todaySubmission.status.toUpperCase()}
                    {todaySubmission.didStudy === false ? ' (DID NOT STUDY)' : ''}
                  </p>
                  <p className="text-[11px] text-emerald-100 line-clamp-2">
                    {todaySubmission.didStudy === false
                      ? `Reason: ${todaySubmission.nonStudyReason || 'Did not study'}`
                      : `Area/Topic: ${todaySubmission.topicTitle || 'Session Recorded'}`}
                  </p>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <button
                      onClick={() => openRegisterForDate(nairobiToday)}
                      className="w-full text-xs bg-white text-emerald-900 font-bold px-3 py-2 rounded-xl shadow-xs hover:bg-emerald-50 transition text-center"
                    >
                      View Today’s Register
                    </button>
                    <button
                      onClick={() => openRegisterForDate(nairobiYesterday)}
                      className="w-full text-xs bg-black/25 hover:bg-black/35 text-white border border-white/25 font-bold px-3 py-1.5 rounded-xl transition flex items-center justify-center space-x-1.5"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Mark Previous Day</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openRegisterForDate(nairobiToday)}
                    className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-xs sm:text-sm ring-2 ring-amber-300/40"
                  >
                    <Calendar className="w-4 h-4 text-slate-950 shrink-0" />
                    <span>MARK TODAY'S REGISTER</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    onClick={() => openRegisterForDate(nairobiYesterday)}
                    className="w-full text-xs bg-black/25 hover:bg-black/35 text-white border border-white/25 font-bold px-3 py-2 rounded-xl transition flex items-center justify-center space-x-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mark / Update Previous Day</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Student Quick Actions Navigation */}
          <nav className="space-y-1">
            {assignedCohorts.length > 0 && (
              <button
                onClick={() => setShowCohortModal(true)}
                className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
              >
                <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">
                  {assignedCohorts.length > 1
                    ? `Switch Cohort (${assignedCohorts.length})`
                    : 'View Cohort Details'}
                </span>
              </button>
            )}

            <button
              onClick={() => setShowIdCardModal(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
            >
              <CreditCard className="w-4 h-4 text-blue-700 shrink-0" />
              <span className="truncate">My Digital ID Card</span>
            </button>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all"
            >
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">Change Password</span>
            </button>
          </nav>
        </div>

        {/* Institutional Footer matching Teacher Sidebar */}
        <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex items-center space-x-2.5">
          <div className="bg-white p-0.5 rounded-lg border border-slate-200 shrink-0">
            <SchoolLogo className="w-10 h-10" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="font-bold text-slate-700 truncate">Sangurur Comprehensive</p>
            <p className="text-[11px] text-emerald-700 font-medium">Think, Code, Change the World</p>
            <p className="text-[10px] text-slate-400">Africa/Nairobi (EAT)</p>
          </div>
        </div>
      </aside>

      {/* Main Student Content Area */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {cohortLoadError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{cohortLoadError}</span>
          </div>
        )}

      {/* Grid: 3 Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Today's Status & Attendance Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Today's Attendance
            </span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">
              {todaySubmission ? todaySubmission.status.toUpperCase() : 'PENDING'}
            </span>
            <span className="text-xs text-slate-500 font-medium">({nairobiToday})</span>
          </div>

          <p className="text-xs text-slate-600">
            {todaySubmission
              ? 'Your attendance has been logged and sent to your teacher for review.'
              : 'Please mark your register for today before class begins.'}
          </p>

          <div className="pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-600 font-semibold">
            <span>Total Sessions: {totalSubmissions}</span>
            <span className="text-emerald-700">Present: {presentCount}</span>
            <span className="text-amber-700">Late: {lateCount}</span>
          </div>
        </div>

        {/* Card 2: Curriculum Progression */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              Curriculum Coverage
            </span>
            <BookOpen className="w-4 h-4 text-blue-600" />
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{progressPercent}%</span>
            <span className="text-xs text-slate-500 font-medium">
              ({uniqueTopicsCovered} of {totalCohortTopics} Topics)
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-600 to-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-600 truncate">
              Subject: {activeCohort?.curriculumSnapshot?.curriculumTitle || 'Assigned Curriculum'}
            </p>
            {activeCohort?.curriculumSnapshot && (
              <button
                type="button"
                onClick={() => setShowRoadmap((prev) => !prev)}
                className="text-[11px] font-bold text-blue-700 hover:underline shrink-0 flex items-center space-x-0.5"
              >
                <span>{showRoadmap ? 'Hide Topics' : 'View Curriculum'}</span>
                {showRoadmap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Understanding Level Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
              My Understanding
            </span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1 text-center">
            <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
              <Smile className="w-4 h-4 text-emerald-600 mx-auto" />
              <span className="block font-black text-emerald-900 text-sm mt-0.5">{excellentCount}</span>
              <span className="text-[10px] text-emerald-700 font-bold block">Excellent</span>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mx-auto" />
              <span className="block font-black text-blue-900 text-sm mt-0.5">{goodCount}</span>
              <span className="text-[10px] text-blue-700 font-bold block">Good</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl">
              <Meh className="w-4 h-4 text-amber-600 mx-auto" />
              <span className="block font-black text-amber-900 text-sm mt-0.5">{fairCount}</span>
              <span className="text-[10px] text-amber-700 font-bold block">Fair</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl">
              <Frown className="w-4 h-4 text-rose-600 mx-auto" />
              <span className="block font-black text-rose-900 text-sm mt-0.5">{needsSupportCount}</span>
              <span className="text-[10px] text-rose-700 font-bold block">Support</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Assigned Curriculum Roadmap */}
      {showRoadmap && activeCohort?.curriculumSnapshot && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <span>{activeCohort.curriculumSnapshot.curriculumTitle} (v{activeCohort.curriculumSnapshot.version})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Complete curriculum roadmap assigned to {activeCohort.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowRoadmap(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          <div className="space-y-4">
            {activeCohort.curriculumSnapshot.learningAreas.map((area, aIdx) => (
              <div key={area.id} className="space-y-2">
                <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                  {aIdx + 1}. {area.title}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {area.modules.map((mod) => (
                    <div key={mod.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                      <p className="text-xs font-bold text-slate-800">{mod.title}</p>
                      <ul className="space-y-1.5">
                        {mod.topics.map((top) => {
                          const isCovered = coveredTopicIds.has(top.id);
                          return (
                            <li key={top.id} className="flex items-start justify-between gap-2 text-xs">
                              <span className={isCovered ? 'text-slate-900 font-semibold' : 'text-slate-600'}>
                                • {top.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  isCovered
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isCovered ? 'Covered' : 'Upcoming'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Timetable & Scheduled Topics */}
      {timetableEntries.length > 0 && (() => {
        const activeWeek =
          timetableEntries.find((w) => w.startDate <= nairobiToday && nairobiToday <= w.endDate) ||
          timetableEntries[0];
        const weeksToDisplay = showAllWeeksTimetable ? timetableEntries : [activeWeek];

        return (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <CalendarDays className="w-4 h-4 text-emerald-700" />
                  <span>
                    Weekly Timetable & Topics ({activeWeek.programmeTerm})
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Different practical topics scheduled per week for {activeCohort?.name}.
                </p>
              </div>
              {timetableEntries.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllWeeksTimetable((prev) => !prev)}
                  className="text-xs font-bold text-emerald-700 hover:underline flex items-center space-x-1 self-start sm:self-auto"
                >
                  <span>
                    {showAllWeeksTimetable
                      ? 'Show Active Week Only'
                      : `View All ${timetableEntries.length} Weeks`}
                  </span>
                  {showAllWeeksTimetable ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {weeksToDisplay.map((week) => {
                const isThisWeek = week.startDate <= nairobiToday && nairobiToday <= week.endDate;
                return (
                  <div
                    key={week.id}
                    className={`rounded-xl border p-4 space-y-3 ${
                      isThisWeek
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase">
                            Week {week.weekNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-600">
                            {week.startDate} to {week.endDate}
                          </span>
                          {isThisWeek && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black uppercase">
                              This Week
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 mt-1">
                          {week.weekLabel}
                        </h4>
                        {week.weeklyTheme && (
                          <p className="text-xs text-slate-600">{week.weeklyTheme}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {(week.topics || []).map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold text-emerald-800 uppercase">
                            <span>{slot.dayOfWeek}</span>
                            <span className="font-mono text-slate-500">{slot.timeSlot}</span>
                          </div>
                          <p className="font-bold text-slate-900 leading-snug">{slot.topicTitle}</p>
                          <p className="text-[11px] text-blue-800 font-semibold">{slot.learningArea}</p>
                          {slot.practicalActivity && (
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {slot.practicalActivity}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Teacher Guidance / Feedback Section */}
      {feedbackList.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-extrabold text-amber-950">
              Teacher Feedback & Guidance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {feedbackList.map((fb) => (
              <div
                key={fb.id}
                className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs text-xs space-y-1"
              >
                <div className="flex justify-between items-center text-slate-500">
                  <span className="font-bold text-slate-800">{fb.teacherName}</span>
                  <span className="text-[10px]">
                    {new Date(fb.createdAt).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })}
                  </span>
                </div>
                <p className="text-slate-700 font-medium">{fb.message}</p>
                {fb.topicTitle && (
                  <p className="text-[10px] text-emerald-700 font-semibold">
                    Topic: {fb.topicTitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Learning Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              My Learning & Attendance Records ({registers.length})
            </h3>
            <p className="text-xs text-slate-500">
              History of attendance, topics covered, and self-understanding ratings.
            </p>
          </div>
          {registers.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllHistory((prev) => !prev)}
              className="text-xs font-bold text-emerald-700 hover:underline shrink-0"
            >
              {showAllHistory ? 'Show Recent 10' : `Show All (${registers.length})`}
            </button>
          )}
        </div>

        {registers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">No registers submitted yet</p>
            <p>Click "MARK TODAY'S REGISTER" to submit your first session entry!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Attendance</th>
                  <th className="py-3 px-4">Area & Topic Learned</th>
                  <th className="py-3 px-4">Understanding</th>
                  <th className="py-3 px-4">Reflection / Notes</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4 text-right">Previous Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {displayedRegisters.map((r) => {
                  const canUpdatePreviousDay =
                    activeCohort?.status === 'active' &&
                    r.date < nairobiToday &&
                    r.status !== 'absent' &&
                    r.status !== 'excused';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">{r.date}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            r.status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'late'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.didStudy === false && (
                          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                            Did Not Study
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {r.didStudy === false ? (
                          <span className="text-amber-800 font-bold">
                            No Study — {r.nonStudyReason || 'Reason logged'}
                          </span>
                        ) : (
                          <div>
                            {r.learningAreaTitle && (
                              <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md mr-1.5">
                                {r.learningAreaTitle}
                              </span>
                            )}
                            <span>{r.topicTitle || '—'}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.didStudy === false ? (
                          <span className="text-[11px] font-semibold text-slate-400">N/A (No Study)</span>
                        ) : (
                          <span className="font-bold text-blue-700 uppercase">
                            {r.understandingLevel ? r.understandingLevel.replace('_', ' ') : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {r.reflectionLearned || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[11px] font-semibold ${
                            r.verificationStatus === 'verified'
                              ? 'text-emerald-700'
                              : r.verificationStatus === 'corrected'
                              ? 'text-blue-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {r.verificationStatus === 'verified'
                            ? 'Verified by Teacher'
                            : r.verificationStatus === 'corrected'
                            ? 'Teacher Corrected'
                            : 'Pending Review'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {canUpdatePreviousDay ? (
                          <button
                            type="button"
                            onClick={() => openRegisterForDate(r.date)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[11px] font-bold transition"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{r.topicTitle ? 'Edit Learning' : 'Log Area Learned'}</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cohort Selector Modal */}
      {showCohortModal && (
        <CohortSelectModal
          onClose={activeCohort ? () => setShowCohortModal(false) : undefined}
          onSelected={(cohort) => {
            setActiveCohort(cohort);
            setShowCohortModal(false);
            if (onCohortSelected) onCohortSelected();
          }}
        />
      )}

      {/* Daily Register Modal */}
      {showRegisterModal && activeCohort && learnerProfile && (
        <DailyRegisterModal
          cohort={activeCohort}
          learner={learnerProfile}
          existingSubmission={todaySubmission}
          allRegisters={registers}
          initialDate={registerModalDate}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={(savedReg) => {
            setRegisters((prev) => {
              const filtered = prev.filter((item) => item.id !== savedReg.id);
              return [savedReg, ...filtered].sort((a, b) =>
                (b.date || '').localeCompare(a.date || '')
              );
            });
            setShowRegisterModal(false);
          }}
        />
      )}

      {/* Voluntary Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-base">Update Private Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordChangeSubmit} className="p-6 space-y-4">
              {pwdError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold">
                  {pwdSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Private Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="At least 6 characters"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="py-2 px-4 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  {savingPwd ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Digital Learner ID Card Modal */}
      {showIdCardModal && learnerProfile && (
        <DigitalIdCardModal
          learner={learnerProfile}
          cohortName={
            activeCohort ? `${activeCohort.name} (${activeCohort.code})` : 'Sangurur Comprehensive School'
          }
          onClose={() => setShowIdCardModal(false)}
        />
      )}
      </div>
    </div>
  );
};
