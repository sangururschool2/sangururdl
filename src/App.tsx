import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, TeacherTab } from './components/common/Sidebar';
import { LoginView } from './components/auth/LoginView';
import { LearnerDashboard } from './components/learner/LearnerDashboard';
import { FirstLoginModal } from './components/learner/FirstLoginModal';

import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { CohortsView } from './components/teacher/CohortsView';
import { LearnerManagementView } from './components/teacher/LearnerManagementView';
import { CurriculumLibraryView } from './components/teacher/CurriculumLibraryView';
import { AttendanceRegisterView } from './components/teacher/AttendanceRegisterView';
import { LearningProgressView } from './components/teacher/LearningProgressView';
import { UnderstandingAnalyticsView } from './components/teacher/UnderstandingAnalyticsView';
import { ReportsView } from './components/teacher/ReportsView';
import { SettingsView } from './components/teacher/SettingsView';
import { WeeklyTimetableView } from './components/teacher/WeeklyTimetableView';

import {
  getCohorts,
  getLearners,
  getCurricula,
  getDailyRegisters,
  verifyDailyRegister,
  getTeachers,
  purgeLegacyDemoRecordsIfAdmin,
} from './services/dataService';
import { Cohort, Learner, Curriculum, DailyRegister, Teacher } from './types';
import { School, Loader2 } from 'lucide-react';

const MainApplication: React.FC = () => {
  const { role, teacherProfile, learnerProfile, loading } = useAuth();

  // Active teacher tab & mobile drawer
  const [currentTab, setCurrentTab] = useState<TeacherTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Shared application state
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [registers, setRegisters] = useState<DailyRegister[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Curriculum to customize in builder & optional initial grade filter from dashboard
  const [builderCurriculum, setBuilderCurriculum] = useState<Curriculum | null>(null);
  const [learnerGradeFilter, setLearnerGradeFilter] = useState<string>('all');

  // Learner first-time login modal state
  const [showFirstLoginModal, setShowFirstLoginModal] = useState<boolean>(false);
  const [showCohortSelectAfterPassword, setShowCohortSelectAfterPassword] = useState<boolean>(false);

  useEffect(() => {
    if (role === 'learner' && (learnerProfile?.mustChangePassword || learnerProfile?.isFirstLogin)) {
      setShowFirstLoginModal(true);
    } else {
      setShowFirstLoginModal(false);
    }
  }, [role, learnerProfile]);

  // Load all system data for staff/teachers (enforcing cohort isolation for non-admin teachers)
  const loadSystemData = async () => {
    if (!teacherProfile) return;
    setDataLoading(true);
    try {
      await purgeLegacyDemoRecordsIfAdmin();
      const hasSchoolWideAccess =
        teacherProfile.role === 'admin' ||
        teacherProfile.role === 'super_admin' ||
        teacherProfile.uid === 'teacher_default_staff';

      const [scopedCohorts, lrData, currData, teacherList] = await Promise.all([
        getCohorts(teacherProfile.uid, hasSchoolWideAccess),
        getLearners(),
        getCurricula(),
        getTeachers(),
      ]);

      const scopedCohortIds = scopedCohorts.map((c) => c.id);
      const regData = await getDailyRegisters(
        hasSchoolWideAccess ? undefined : { cohortIds: scopedCohortIds }
      );

      const scopedCohortIdSet = new Set(scopedCohortIds);
      const scopedLearners = hasSchoolWideAccess
        ? lrData
        : lrData.filter((l) => (l.assignedCohortIds || []).some((id) => scopedCohortIdSet.has(id)));
      const scopedRegisters = hasSchoolWideAccess
        ? regData
        : regData.filter((r) => scopedCohortIdSet.has(r.cohortId));

      setCohorts(scopedCohorts);
      setLearners(scopedLearners);
      setCurricula(currData);
      setRegisters(scopedRegisters);
      setTeachers(teacherList);
    } catch (err) {
      console.error('Error loading initial SDLR data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (role && role !== 'learner' && teacherProfile) {
      loadSystemData();
    }
  }, [role, teacherProfile]);

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-lg ring-4 ring-emerald-600/20 mb-4 animate-pulse">
          <School className="w-8 h-8" />
        </div>
        <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
          SANGURUR COMPREHENSIVE SCHOOL
        </h2>
        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mt-0.5">
          Think, Code, Change the World
        </p>
        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-4">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span>Loading SDLR System...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login View
  if (!role) {
    return <LoginView />;
  }

  // LEARNER ROLE VIEW
  if (role === 'learner') {
    if (showFirstLoginModal || learnerProfile?.mustChangePassword || learnerProfile?.isFirstLogin) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col justify-between">
          <Header />
          <FirstLoginModal
            onSuccess={() => {
              setShowFirstLoginModal(false);
              setShowCohortSelectAfterPassword(true);
            }}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col">
          <LearnerDashboard
            forceOpenCohortSelect={showCohortSelectAfterPassword}
            onCohortSelected={() => setShowCohortSelectAfterPassword(false)}
          />
        </main>
      </div>
    );
  }

  // TEACHER / ADMIN ROLE VIEW
  const pendingReviewsCount = registers.filter(
    (r) => r.verificationStatus === 'pending_verification'
  ).length;
  const supportAlertCount = registers.filter(
    (r) => r.understandingLevel === 'needs_support'
  ).length;

  const handleVerifyRegister = async (regId: string) => {
    if (!teacherProfile) return;
    await verifyDailyRegister(regId, teacherProfile.uid);
    await loadSystemData();
  };

  const handleSelectGradeFilterFromDashboard = (levelFilter: string) => {
    setLearnerGradeFilter(levelFilter);
    setCurrentTab('learners');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header
        showMenuButton={true}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      <div className="flex-1 flex relative">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            if (tab !== 'curriculum-builder') {
              setBuilderCurriculum(null);
            }
            setCurrentTab(tab);
          }}
          pendingReviewsCount={pendingReviewsCount}
          supportAlertCount={supportAlertCount}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Tab Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full">
          {dataLoading && cohorts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
              <span className="text-xs font-semibold">Loading cohort records...</span>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <TeacherDashboard
                  cohorts={cohorts}
                  learners={learners}
                  registers={registers}
                  onNavigate={(tab) => setCurrentTab(tab)}
                  onVerifyRegister={handleVerifyRegister}
                  onSelectGradeFilter={handleSelectGradeFilterFromDashboard}
                />
              )}

              {currentTab === 'cohorts' && (
                <CohortsView
                  cohorts={cohorts}
                  allLearners={learners}
                  curricula={curricula}
                  teachers={teachers}
                  registers={registers}
                  currentTeacherId={teacherProfile?.uid || 'teacher_staff'}
                  currentTeacherName={teacherProfile?.fullName || 'Staff Teacher'}
                  isAdmin={
                    teacherProfile?.role === 'admin' ||
                    teacherProfile?.role === 'super_admin' ||
                    teacherProfile?.uid === 'teacher_default_staff'
                  }
                  onRefresh={loadSystemData}
                />
              )}

              {currentTab === 'learners' && (
                <LearnerManagementView
                  learners={learners}
                  cohorts={cohorts}
                  onRefresh={loadSystemData}
                  initialGradeFilter={learnerGradeFilter}
                />
              )}

              {(currentTab === 'curriculum-library' || currentTab === 'curriculum-builder') && (
                <CurriculumLibraryView
                  curricula={curricula}
                  currentTeacherName={teacherProfile?.fullName || 'Sangurur Staff'}
                  onSaved={loadSystemData}
                  initialMode={currentTab === 'curriculum-builder' ? 'builder' : 'library'}
                  initialBuilderCurriculum={builderCurriculum}
                />
              )}

              {currentTab === 'timetable' && (
                <WeeklyTimetableView
                  cohorts={cohorts}
                  currentTeacherName={teacherProfile?.fullName || 'Sangurur Staff'}
                  registers={registers}
                />
              )}

              {currentTab === 'attendance' && (
                <AttendanceRegisterView
                  cohorts={cohorts}
                  learners={learners}
                  registers={registers}
                  currentTeacherId={teacherProfile?.uid || 'teacher_staff'}
                  currentTeacherName={teacherProfile?.fullName || 'Staff Teacher'}
                  onRefresh={loadSystemData}
                />
              )}

              {currentTab === 'progress' && (
                <LearningProgressView
                  cohorts={cohorts}
                  learners={learners}
                  registers={registers}
                />
              )}

              {currentTab === 'understanding' && (
                <UnderstandingAnalyticsView
                  cohorts={cohorts}
                  learners={learners}
                  registers={registers}
                  currentTeacherId={teacherProfile?.uid || 'teacher_staff'}
                  currentTeacherName={teacherProfile?.fullName || 'Staff Teacher'}
                  onRefresh={loadSystemData}
                />
              )}

              {currentTab === 'reports' && (
                <ReportsView
                  cohorts={cohorts}
                  learners={learners}
                  registers={registers}
                />
              )}

              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApplication />
    </AuthProvider>
  );
}
