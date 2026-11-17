import React, { useState } from 'react';
import {
  Cohort,
  Learner,
  Curriculum,
  Teacher,
  DailyRegister,
  AGE_BRACKET_OPTIONS,
} from '../../types';
import {
  createCohort,
  updateCohort,
  assignLearnerToCohort,
  removeLearnerFromCohort,
  seedNovDecHolidayTimetable,
} from '../../services/dataService';
import { generateBootcampCertificatePDF } from '../../services/pdfReportGenerator';
import { WeeklyTimetableView } from './WeeklyTimetableView';
import {
  Users,
  Plus,
  BookOpen,
  Archive,
  Edit2,
  X,
  Search,
  UserPlus,
  Trash2,
  ChevronRight,
  AlertCircle,
  ClipboardCheck,
  Award,
  CalendarDays,
} from 'lucide-react';

interface CohortsViewProps {
  cohorts: Cohort[];
  allLearners: Learner[];
  curricula: Curriculum[];
  teachers?: Teacher[];
  registers?: DailyRegister[];
  currentTeacherId: string;
  currentTeacherName: string;
  isAdmin?: boolean;
  onRefresh: () => Promise<void>;
}

export const CohortsView: React.FC<CohortsViewProps> = ({
  cohorts,
  allLearners,
  curricula,
  teachers = [],
  registers = [],
  currentTeacherId,
  currentTeacherName,
  isAdmin = false,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [drawerTab, setDrawerTab] = useState<'learners' | 'timetable' | 'curriculum' | 'analytics'>('learners');
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Confirm remove learner modal
  const [confirmRemoveLearner, setConfirmRemoveLearner] = useState<Learner | null>(null);
  const [removingLearner, setRemovingLearner] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [programme, setProgramme] = useState('Junior School CBC Computing');
  const [description, setDescription] = useState('');
  const [learningLevel, setLearningLevel] = useState('Grade 7');
  const [ageBracket, setAgeBracket] = useState(AGE_BRACKET_OPTIONS[3]);
  const [startDate, setStartDate] = useState('2026-01-12');
  const [endDate, setEndDate] = useState('2026-11-20');
  const [assignedTeacherId, setAssignedTeacherId] = useState(currentTeacherId);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Add Learner to selected cohort modal
  const [showAddLearnerModal, setShowAddLearnerModal] = useState(false);
  const [selectedLearnerToAdd, setSelectedLearnerToAdd] = useState('');

  const filteredCohorts = cohorts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.programme.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setName('');
    setCode(`GR7-${Math.random().toString(36).substring(2, 5).toUpperCase()}-2026`);
    setProgramme('Junior Secondary CBC Computing');
    setDescription('Standard digital skills and learner register cohort.');
    setLearningLevel('Grade 7');
    setAgeBracket(AGE_BRACKET_OPTIONS[3]);
    setStartDate('2026-01-12');
    setEndDate('2026-11-20');
    setAssignedTeacherId(currentTeacherId);
    setSelectedCurriculumId(curricula[0]?.id || '');
    setEditingCohort(null);
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (c: Cohort) => {
    setEditingCohort(c);
    setName(c.name);
    setCode(c.code);
    setProgramme(c.programme);
    setDescription(c.description);
    setLearningLevel(c.learningLevel);
    setAgeBracket(c.ageBracket || AGE_BRACKET_OPTIONS[3]);
    setStartDate(c.startDate);
    setEndDate(c.endDate);
    setAssignedTeacherId(c.teacherId || currentTeacherId);
    setSelectedCurriculumId(c.curriculumId || '');
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleSaveCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError(null);

    try {
      const normalizedCode = code.trim().toUpperCase();
      const duplicateCode = cohorts.find(
        (c) => c.code.toUpperCase() === normalizedCode && c.id !== editingCohort?.id
      );
      if (duplicateCode) {
        throw new Error(`Cohort code "${normalizedCode}" already exists. Please use a unique cohort code.`);
      }

      const chosenCurr = curricula.find((c) => c.id === selectedCurriculumId);
      const curriculumChanged = !editingCohort || editingCohort.curriculumId !== selectedCurriculumId;

      const curriculumSnapshot =
        chosenCurr && curriculumChanged
          ? {
              curriculumId: chosenCurr.id,
              curriculumTitle: chosenCurr.title,
              version: chosenCurr.version || 1,
              snapshotDate: new Date().toISOString(),
              learningAreas: chosenCurr.learningAreas,
            }
          : editingCohort?.curriculumSnapshot;

      const selectedTeacher = teachers.find((t) => t.uid === assignedTeacherId);
      const teacherIdToSave = selectedTeacher?.uid || assignedTeacherId || currentTeacherId;
      const teacherNameToSave =
        selectedTeacher?.fullName ||
        (teacherIdToSave === currentTeacherId ? currentTeacherName : editingCohort?.teacherName || currentTeacherName);

      if (editingCohort) {
        await updateCohort(editingCohort.id, {
          name,
          code: normalizedCode,
          programme,
          description,
          learningLevel,
          ageBracket: ageBracket.trim() || undefined,
          startDate,
          endDate,
          teacherId: teacherIdToSave,
          teacherName: teacherNameToSave,
          curriculumId: selectedCurriculumId,
          ...(curriculumSnapshot && { curriculumSnapshot }),
        });
        await onRefresh();
        setShowCreateModal(false);
      } else {
        const createdCohort = await createCohort({
          name,
          code: normalizedCode,
          programme,
          description,
          learningLevel,
          ageBracket: ageBracket.trim() || undefined,
          startDate,
          endDate,
          teacherId: teacherIdToSave,
          teacherName: teacherNameToSave,
          curriculumId: selectedCurriculumId,
          curriculumSnapshot,
          status: 'active',
        });

        // Automatically initialize weekly timetable inside the newly created cohort
        try {
          await seedNovDecHolidayTimetable(createdCohort, teacherNameToSave, 'Nov/Dec Holiday 2026');
        } catch (ttErr) {
          console.warn('Auto-seeding cohort weekly timetable warning:', ttErr);
        }

        await onRefresh();
        setShowCreateModal(false);
        setSelectedCohort(createdCohort);
        setDrawerTab('timetable');
      }
    } catch (err: any) {
      setModalError(err.message || 'Error saving cohort');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (c: Cohort) => {
    setBannerError(null);
    try {
      const nextStatus = c.status === 'archived' ? 'active' : 'archived';
      await updateCohort(c.id, { status: nextStatus });
      await onRefresh();
      if (selectedCohort?.id === c.id) {
        setSelectedCohort({ ...selectedCohort, status: nextStatus });
      }
    } catch (err: any) {
      setBannerError(err.message || 'Error updating cohort status');
    }
  };

  const handleAddLearner = async () => {
    if (!selectedCohort || !selectedLearnerToAdd) return;
    const learner = allLearners.find((l) => l.id === selectedLearnerToAdd);
    if (!learner) return;

    setBannerError(null);
    try {
      await assignLearnerToCohort(selectedCohort.id, learner);
      await onRefresh();
      setShowAddLearnerModal(false);
      setSelectedLearnerToAdd('');
    } catch (err: any) {
      setBannerError(err.message || 'Error assigning learner');
    }
  };

  const handleConfirmRemoveLearner = async () => {
    if (!selectedCohort || !confirmRemoveLearner) return;
    setRemovingLearner(true);
    setBannerError(null);
    try {
      await removeLearnerFromCohort(selectedCohort.id, confirmRemoveLearner.id);
      await onRefresh();
      setConfirmRemoveLearner(null);
    } catch (err: any) {
      setBannerError(err.message || 'Error removing learner from cohort');
    } finally {
      setRemovingLearner(false);
    }
  };

  // Find enrolled learners in currently selected cohort
  const enrolledLearners = selectedCohort
    ? allLearners.filter((l) => (l.assignedCohortIds || []).includes(selectedCohort.id))
    : [];

  const unenrolledLearners = selectedCohort
    ? allLearners.filter((l) => !(l.assignedCohortIds || []).includes(selectedCohort.id))
    : [];

  const cohortRegisters = selectedCohort
    ? registers.filter((r) => r.cohortId === selectedCohort.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Cohort Management
          </h2>
          <p className="text-xs text-slate-500">
            Organise independent learner classes, assign immutable curriculum snapshots, and track progress.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Cohort</span>
        </button>
      </div>

      {bannerError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button onClick={() => setBannerError(null)} className="text-rose-500 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search cohort by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {(['active', 'archived', 'all'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Cohorts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCohorts.length === 0 ? (
          <div className="col-span-full bg-white p-10 text-center rounded-2xl border border-slate-200 space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="font-extrabold text-slate-700 text-sm">No cohorts found</h3>
            <p className="text-xs text-slate-500">
              Create your first cohort to begin registering learners and assigning curricula.
            </p>
            <button
              onClick={handleOpenCreate}
              className="py-2 px-4 bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Cohort Now</span>
            </button>
          </div>
        ) : (
          filteredCohorts.map((cohort) => {
            const count = allLearners.filter((l) =>
              (l.assignedCohortIds || []).includes(cohort.id)
            ).length;

            return (
              <div
                key={cohort.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between p-5 space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-100 text-emerald-800">
                        {cohort.code}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base mt-1.5 leading-snug">
                        {cohort.name}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        cohort.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cohort.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{cohort.description}</p>

                  <div className="pt-2 text-xs space-y-1.5 text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Programme:</span>
                      <strong className="text-slate-800">{cohort.programme}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Age Bracket:</span>
                      <strong className="text-slate-800 truncate max-w-[170px]">
                        {cohort.ageBracket || cohort.learningLevel || 'Standard'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Teacher:</span>
                      <strong className="text-slate-800 truncate max-w-[150px]">{cohort.teacherName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Assigned Curriculum:</span>
                      <strong className="text-emerald-700 truncate max-w-[150px]">
                        {cohort.curriculumSnapshot?.curriculumTitle || 'Standard Curriculum'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Learners Enrolled:</span>
                      <strong className="text-blue-700">{count} Learners</strong>
                    </div>
                  </div>
                </div>

                {/* Cohort Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedCohort(cohort);
                        setDrawerTab('learners');
                      }}
                      className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1"
                    >
                      <span>View & Manage</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCohort(cohort);
                        setDrawerTab('timetable');
                      }}
                      className="py-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                      title="Open cohort weekly timetable and topics taught"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Timetable</span>
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(cohort)}
                      title="Edit Cohort"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleArchiveToggle(cohort)}
                      title={cohort.status === 'archived' ? 'Unarchive' : 'Archive Cohort'}
                      className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cohort Detail Drawer with Learners, Curriculum & Analytics tabs */}
      {selectedCohort && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 text-xs font-black rounded-md bg-emerald-100 text-emerald-800">
                  {selectedCohort.code}
                </span>
                <h3 className="text-lg font-black text-slate-900">{selectedCohort.name}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Programme: <strong>{selectedCohort.programme}</strong>
                {selectedCohort.ageBracket ? (
                  <>
                    {' '}• Age Bracket: <strong>{selectedCohort.ageBracket}</strong>
                  </>
                ) : null}
                {' '}• Teacher: <strong>{selectedCohort.teacherName}</strong> • {enrolledLearners.length} Enrolled Learners
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddLearnerModal(true)}
                className="py-2 px-3.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Learner</span>
              </button>
              <button
                onClick={() => setSelectedCohort(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
            <button
              onClick={() => setDrawerTab('learners')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                drawerTab === 'learners' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Enrolled Learners ({enrolledLearners.length})</span>
            </button>
            <button
              onClick={() => setDrawerTab('timetable')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                drawerTab === 'timetable' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Weekly Timetable & Topics Taught</span>
            </button>
            <button
              onClick={() => setDrawerTab('curriculum')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                drawerTab === 'curriculum' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Curriculum Snapshot</span>
            </button>
            <button
              onClick={() => setDrawerTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                drawerTab === 'analytics' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Attendance & Summary ({cohortRegisters.length})</span>
            </button>
          </div>

          {/* TAB 1: LEARNERS */}
          {drawerTab === 'learners' && (
            <div className="space-y-3">
              {enrolledLearners.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  No learners enrolled in this cohort yet. Click "Enroll Learner" or import learners via Learner Management.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="py-2.5 px-4">#</th>
                        <th className="py-2.5 px-4">Learner Name</th>
                        <th className="py-2.5 px-4">Digital ID</th>
                        <th className="py-2.5 px-4">Gender</th>
                        <th className="py-2.5 px-4">Guardian Contact</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {enrolledLearners.map((lr, idx) => (
                        <tr key={lr.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-4 text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-900">{lr.fullName}</td>
                          <td className="py-2.5 px-4 text-blue-700 font-mono">{lr.digitalId || lr.learnerId}</td>
                          <td className="py-2.5 px-4 capitalize">{lr.gender || '—'}</td>
                          <td className="py-2.5 px-4 text-slate-500">{lr.guardianContact || '—'}</td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1">
                            <button
                              onClick={() => generateBootcampCertificatePDF(lr, selectedCohort)}
                              className="py-1 px-2 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition inline-flex items-center space-x-1 text-[11px] font-semibold"
                              title="Download Bootcamp Completion Certificate (PDF)"
                            >
                              <Award className="w-3 h-3 text-emerald-700" />
                              <span>Certificate</span>
                            </button>
                            <button
                              onClick={() => setConfirmRemoveLearner(lr)}
                              className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition inline-flex align-middle"
                              title="Remove from cohort"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EMBEDDED WEEKLY TIMETABLE & TOPICS TAUGHT */}
          {drawerTab === 'timetable' && (
            <WeeklyTimetableView
              cohorts={cohorts}
              fixedCohortId={selectedCohort.id}
              currentTeacherName={currentTeacherName}
              registers={registers}
              embedded
            />
          )}

          {/* TAB 3: CURRICULUM SNAPSHOT */}
          {drawerTab === 'curriculum' && (
            <div className="space-y-3">
              {!selectedCohort.curriculumSnapshot ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                  No curriculum snapshot bound to this cohort. Edit the cohort to assign a curriculum.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-emerald-950">
                      {selectedCohort.curriculumSnapshot.curriculumTitle} (Version {selectedCohort.curriculumSnapshot.version})
                    </span>
                    <span className="text-emerald-800">
                      Snapshot Frozen: {new Date(selectedCohort.curriculumSnapshot.snapshotDate).toLocaleDateString('en-KE')}
                    </span>
                  </div>
                  {selectedCohort.curriculumSnapshot.learningAreas.map((area, i) => (
                    <div key={area.id} className="border border-slate-200 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {i + 1}. {area.title}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {area.modules.map((mod) => (
                          <div key={mod.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                            <p className="font-bold text-slate-800">{mod.title}</p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              {mod.topics.length} Topics: {mod.topics.map((t) => t.title).join(', ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ANALYTICS */}
          {drawerTab === 'analytics' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 block font-semibold">Total Submissions</span>
                <span className="text-xl font-black text-slate-900">{cohortRegisters.length}</span>
              </div>
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 block font-semibold">Present / Late</span>
                <span className="text-xl font-black text-emerald-900">
                  {cohortRegisters.filter((r) => r.status === 'present' || r.status === 'late').length}
                </span>
              </div>
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200">
                <span className="text-blue-800 block font-semibold">Verified Entries</span>
                <span className="text-xl font-black text-blue-900">
                  {cohortRegisters.filter((r) => r.verificationStatus === 'verified').length}
                </span>
              </div>
              <div className="bg-rose-50 p-3.5 rounded-xl border border-rose-200">
                <span className="text-rose-800 block font-semibold">Needs Support</span>
                <span className="text-xl font-black text-rose-900">
                  {cohortRegisters.filter((r) => r.understandingLevel === 'needs_support').length}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT COHORT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  {editingCohort ? 'Edit Cohort' : 'Create New Cohort'}
                </h3>
                <p className="text-emerald-100 text-xs">
                  Sangurur Comprehensive School Academic Cohorts
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCohort} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                  {modalError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cohort Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nov/Dec Computing Boot Camp"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unique Cohort Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COHORT-2026-A"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono uppercase focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Programme / Department
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Junior Secondary CBC, STEM Club"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>

              {isAdmin && teachers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Teacher
                  </label>
                  <select
                    value={assignedTeacherId}
                    onChange={(e) => setAssignedTeacherId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  >
                    {teachers.map((t) => (
                      <option key={t.uid} value={t.uid}>
                        {t.fullName} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description of this learning class..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Learning Level
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grade 7"
                    value={learningLevel}
                    onChange={(e) => setLearningLevel(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Age Bracket *
                  </label>
                  <input
                    type="text"
                    required
                    list="cohort-age-brackets"
                    placeholder="e.g. 13–15 Years (Junior School)"
                    value={ageBracket}
                    onChange={(e) => setAgeBracket(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                  <datalist id="cohort-age-brackets">
                    {AGE_BRACKET_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assign Curriculum (Versioned Snapshot)
                </label>
                <select
                  value={selectedCurriculumId}
                  onChange={(e) => setSelectedCurriculumId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                >
                  <option value="">Select a curriculum template...</option>
                  {curricula.map((curr) => (
                    <option key={curr.id} value={curr.id}>
                      {curr.title} ({curr.category} • {curr.level})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  * An immutable versioned snapshot is bound to this cohort so later edits won't alter past records.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2 px-4 text-slate-600 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition"
                >
                  {submitting ? 'Saving...' : editingCohort ? 'Update Cohort' : 'Create Cohort'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENROLL LEARNER MODAL */}
      {showAddLearnerModal && selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-800 p-4 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm">
                Enroll Learner into {selectedCohort.name}
              </h3>
              <button
                onClick={() => setShowAddLearnerModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-xs font-bold text-slate-700">
                Select Registered Learner:
              </label>

              {unenrolledLearners.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                  All registered learners are already enrolled in this cohort.
                </p>
              ) : (
                <select
                  value={selectedLearnerToAdd}
                  onChange={(e) => setSelectedLearnerToAdd(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 outline-none"
                >
                  <option value="">Choose a learner...</option>
                  {unenrolledLearners.map((lr) => (
                    <option key={lr.id} value={lr.id}>
                      {lr.fullName} ({lr.learnerId} - {lr.username})
                    </option>
                  ))}
                </select>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLearnerModal(false)}
                  className="py-1.5 px-3 text-xs text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedLearnerToAdd}
                  onClick={handleAddLearner}
                  className="py-2 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs"
                >
                  Confirm Enrollment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM REMOVE LEARNER MODAL */}
      {confirmRemoveLearner && selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Remove Learner from Cohort?
            </h3>
            <p className="text-xs text-slate-600">
              Remove <strong>{confirmRemoveLearner.fullName}</strong> ({confirmRemoveLearner.learnerId}) from{' '}
              <strong>{selectedCohort.name}</strong>? Historical attendance logs remain preserved.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRemoveLearner(null)}
                className="py-2 px-4 text-xs text-slate-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingLearner}
                onClick={handleConfirmRemoveLearner}
                className="py-2 px-4 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs"
              >
                {removingLearner ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
