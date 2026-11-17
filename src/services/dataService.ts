import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import {
  Cohort,
  Learner,
  Curriculum,
  DailyRegister,
  TeacherFeedback,
  AuditLog,
  SchoolSetting,
  AttendanceStatus,
  CorrectionRecord,
  Teacher,
  WeeklyTimetableEntry,
  TimetableTopicSlot,
} from '../types';
import { PREDEFINED_CURRICULA } from './curriculumTemplates';

// ----------------- TEACHERS -----------------
export async function getTeachers(): Promise<Teacher[]> {
  try {
    const snap = await getDocs(collection(db, 'teachers'));
    return snap.docs.map((d) => ({ ...d.data(), uid: d.id } as Teacher));
  } catch (error) {
    console.warn('Could not load teachers list:', error);
    return [];
  }
}

// Exact legacy starter/demo document IDs previously seeded on initial setup
const LEGACY_DEMO_COHORT_IDS = new Set([
  'coh_1794493904667_72u8',
  'coh_1794493904967_p7ke',
]);
const LEGACY_DEMO_LEARNER_IDS = new Set([
  'learner_1794493810016_x4aq8',
]);
const LEGACY_DEMO_REGISTER_IDS = new Set([
  'reg_GR7-COMP-2026_learner_1794493810016_x4aq8_2026-11-12',
]);

export async function purgeLegacyDemoRecordsIfAdmin(): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  try {
    await Promise.allSettled([
      ...Array.from(LEGACY_DEMO_COHORT_IDS).map((id) => deleteDoc(doc(db, 'cohorts', id))),
      ...Array.from(LEGACY_DEMO_LEARNER_IDS).map((id) => deleteDoc(doc(db, 'learners', id))),
      ...Array.from(LEGACY_DEMO_REGISTER_IDS).map((id) => deleteDoc(doc(db, 'dailyRegisters', id))),
    ]);
  } catch {
    // Non-admin staff accounts silently skip deletion; read filters still exclude them.
  }
}

// ----------------- COHORTS -----------------
export async function getCohorts(
  teacherUid?: string,
  hasSchoolWideAccess: boolean = true
): Promise<Cohort[]> {
  try {
    const q =
      !hasSchoolWideAccess && teacherUid
        ? query(collection(db, 'cohorts'), where('teacherId', '==', teacherUid))
        : query(collection(db, 'cohorts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs
      .filter((d) => !LEGACY_DEMO_COHORT_IDS.has(d.id))
      .map((d) => ({ ...d.data(), id: d.id } as Cohort))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'cohorts');
    return [];
  }
}

export async function createCohort(cohortData: Omit<Cohort, 'id' | 'createdAt'>): Promise<Cohort> {
  const docId = `coh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newCohort: Cohort = {
    ...cohortData,
    id: docId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'cohorts', docId), newCohort);
    return newCohort;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `cohorts/${docId}`);
    throw error;
  }
}

export async function updateCohort(cohortId: string, updates: Partial<Cohort>): Promise<void> {
  try {
    const ref = doc(db, 'cohorts', cohortId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `cohorts/${cohortId}`);
    throw error;
  }
}

export async function getCohortById(cohortId: string): Promise<Cohort | null> {
  try {
    const ref = doc(db, 'cohorts', cohortId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Cohort;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `cohorts/${cohortId}`);
    return null;
  }
}

// ----------------- LEARNERS & MEMBERSHIPS -----------------
export async function getLearners(): Promise<Learner[]> {
  try {
    const snap = await getDocs(collection(db, 'learners'));
    return snap.docs
      .filter((d) => !LEGACY_DEMO_LEARNER_IDS.has(d.id))
      .map((d) => ({ ...d.data(), id: d.id } as Learner));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'learners');
    return [];
  }
}

export async function getLearnersByCohort(cohortId: string): Promise<Learner[]> {
  try {
    const memQuery = query(collection(db, 'cohortMembers'), where('cohortId', '==', cohortId));
    const memSnap = await getDocs(memQuery);
    const learnerIds = memSnap.docs.map((d) => d.data().learnerId);

    if (learnerIds.length === 0) return [];

    const learners: Learner[] = [];
    for (const lid of learnerIds) {
      const snap = await getDoc(doc(db, 'learners', lid));
      if (snap.exists()) {
        learners.push({ ...snap.data(), id: snap.id } as Learner);
      }
    }
    return learners;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'cohortMembers');
    return [];
  }
}

export async function assignLearnerToCohort(cohortId: string, learner: Learner): Promise<void> {
  try {
    const memberId = `mem_${cohortId}_${learner.id}`;
    await setDoc(doc(db, 'cohortMembers', memberId), {
      id: memberId,
      cohortId,
      learnerId: learner.id,
      learnerName: learner.fullName,
      learnerCode: learner.learnerId,
      joinedAt: new Date().toISOString(),
      status: 'active',
    });

    const currentCohorts = learner.assignedCohortIds || [];
    if (!currentCohorts.includes(cohortId)) {
      await updateDoc(doc(db, 'learners', learner.id), {
        assignedCohortIds: [...currentCohorts, cohortId],
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'cohortMembers');
    throw error;
  }
}

export async function removeLearnerFromCohort(cohortId: string, learnerId: string): Promise<void> {
  try {
    const memberId = `mem_${cohortId}_${learnerId}`;
    await deleteDoc(doc(db, 'cohortMembers', memberId));

    const learnerSnap = await getDoc(doc(db, 'learners', learnerId));
    if (learnerSnap.exists()) {
      const data = learnerSnap.data();
      const current = (data.assignedCohortIds || []) as string[];
      await updateDoc(doc(db, 'learners', learnerId), {
        assignedCohortIds: current.filter((c) => c !== cohortId),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `cohortMembers/mem_${cohortId}_${learnerId}`);
    throw error;
  }
}

// ----------------- CURRICULA -----------------
export async function getCurricula(): Promise<Curriculum[]> {
  try {
    const snap = await getDocs(collection(db, 'curricula'));
    if (snap.empty) {
      await seedCurriculaIfEmpty();
      return PREDEFINED_CURRICULA;
    }
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Curriculum));
  } catch (error) {
    console.warn('Could not read from Firestore curricula collection, falling back to predefined templates:', error);
    return PREDEFINED_CURRICULA;
  }
}

export async function seedCurriculaIfEmpty(): Promise<void> {
  try {
    for (const curr of PREDEFINED_CURRICULA) {
      await setDoc(doc(db, 'curricula', curr.id), curr);
    }
  } catch (err) {
    console.warn('Seeding notice:', err);
  }
}

export async function createCurriculum(curr: Omit<Curriculum, 'id' | 'createdAt'>): Promise<Curriculum> {
  const docId = `curr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newCurr: Curriculum = {
    ...curr,
    id: docId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'curricula', docId), newCurr);
    return newCurr;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `curricula/${docId}`);
    throw error;
  }
}

export async function updateCurriculum(id: string, updates: Partial<Curriculum>): Promise<number> {
  try {
    const ref = doc(db, 'curricula', id);
    const snap = await getDoc(ref);
    const currentVersion = snap.exists() ? Number(snap.data().version || 1) : 1;
    const nextVersion = currentVersion + 1;

    await updateDoc(ref, {
      ...updates,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    });
    return nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `curricula/${id}`);
    throw error;
  }
}

// ----------------- DAILY REGISTERS & ATTENDANCE -----------------
export async function getDailyRegisters(filters?: {
  cohortId?: string;
  cohortIds?: string[];
  date?: string;
  learnerDocId?: string;
}): Promise<DailyRegister[]> {
  try {
    if (filters?.cohortIds && !filters.cohortId) {
      if (filters.cohortIds.length === 0) {
        return [];
      }
      const perCohort = await Promise.all(
        filters.cohortIds.map(async (cid) => {
          let q = query(collection(db, 'dailyRegisters'), where('cohortId', '==', cid));
          if (filters.date) {
            q = query(q, where('date', '==', filters.date));
          }
          if (filters.learnerDocId) {
            q = query(q, where('learnerDocId', '==', filters.learnerDocId));
          }
          const snap = await getDocs(q);
          return snap.docs
            .filter(
              (d) =>
                !LEGACY_DEMO_REGISTER_IDS.has(d.id) &&
                !LEGACY_DEMO_LEARNER_IDS.has(d.data().learnerDocId)
            )
            .map((d) => ({ ...d.data(), id: d.id } as DailyRegister));
        })
      );
      const deduped = new Map<string, DailyRegister>();
      perCohort.flat().forEach((r) => deduped.set(r.id, r));
      return Array.from(deduped.values()).sort((a, b) =>
        (b.timestamp || '').localeCompare(a.timestamp || '')
      );
    }

    let q = query(collection(db, 'dailyRegisters'));

    if (filters?.cohortId) {
      q = query(q, where('cohortId', '==', filters.cohortId));
    }
    if (filters?.date) {
      q = query(q, where('date', '==', filters.date));
    }
    if (filters?.learnerDocId) {
      q = query(q, where('learnerDocId', '==', filters.learnerDocId));
    }

    const snap = await getDocs(q);
    const results = snap.docs
      .filter(
        (d) =>
          !LEGACY_DEMO_REGISTER_IDS.has(d.id) &&
          !LEGACY_DEMO_LEARNER_IDS.has(d.data().learnerDocId)
      )
      .map((d) => ({ ...d.data(), id: d.id } as DailyRegister));

    return results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'dailyRegisters');
    return [];
  }
}

export async function verifyDailyRegister(registerId: string, teacherId: string): Promise<void> {
  try {
    const ref = doc(db, 'dailyRegisters', registerId);
    await updateDoc(ref, {
      verificationStatus: 'verified',
      reviewedBy: teacherId,
      reviewedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyRegisters/${registerId}`);
    throw error;
  }
}

export async function correctAttendance(
  register: DailyRegister,
  newStatus: AttendanceStatus,
  reason: string,
  teacherId: string,
  teacherName: string
): Promise<void> {
  try {
    const ref = doc(db, 'dailyRegisters', register.id);
    const correction: CorrectionRecord = {
      correctedBy: teacherId,
      correctedByName: teacherName,
      timestamp: new Date().toISOString(),
      previousStatus: register.status,
      newStatus,
      reason,
    };

    const currentHistory = register.correctionHistory || [];

    await updateDoc(ref, {
      status: newStatus,
      verificationStatus: 'corrected',
      teacherNote: reason,
      reviewedBy: teacherId,
      reviewedAt: new Date().toISOString(),
      correctionHistory: [...currentHistory, correction],
    });

    await logAuditEvent({
      actorId: teacherId,
      actorName: teacherName,
      actorRole: 'teacher',
      action: 'CORRECT_ATTENDANCE',
      targetEntity: 'dailyRegister',
      targetId: register.id,
      details: `Corrected status for ${register.learnerName} on ${register.date} from ${register.status} to ${newStatus}. Reason: ${reason}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `dailyRegisters/${register.id}`);
    throw error;
  }
}

export async function logTeacherAttendanceEntry(entry: {
  cohortId: string;
  cohortCode: string;
  learnerDocId: string;
  learnerId: string;
  learnerName: string;
  date: string;
  status: 'absent' | 'excused';
  teacherId: string;
  teacherName: string;
  reason?: string;
}): Promise<DailyRegister> {
  const docId = `reg_${entry.cohortId}_${entry.learnerDocId}_${entry.date}`;
  const docRef = doc(db, 'dailyRegisters', docId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      throw new Error(
        `An attendance entry for ${entry.learnerName} on ${entry.date} already exists (${existingSnap.data().status}). Use "Correct" to modify it with an audit trail.`
      );
    }

    const register: DailyRegister = {
      id: docId,
      cohortId: entry.cohortId,
      cohortCode: entry.cohortCode,
      learnerDocId: entry.learnerDocId,
      learnerId: entry.learnerId,
      learnerName: entry.learnerName,
      date: entry.date,
      timestamp: new Date().toISOString(),
      status: entry.status,
      verificationStatus: 'verified',
      teacherNote: entry.reason || `Marked ${entry.status} by teacher`,
      reviewedBy: entry.teacherId,
      reviewedAt: new Date().toISOString(),
      correctionHistory: [],
    };

    await setDoc(docRef, register);

    await logAuditEvent({
      actorId: entry.teacherId,
      actorName: entry.teacherName,
      actorRole: 'teacher',
      action: 'TEACHER_MARK_ATTENDANCE',
      targetEntity: 'dailyRegister',
      targetId: docId,
      details: `Teacher marked ${entry.learnerName} (${entry.learnerId}) as ${entry.status} for ${entry.date}. Note: ${register.teacherNote}`,
    });

    return register;
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, `dailyRegisters/${docId}`);
    throw error;
  }
}

// ----------------- MASTERY CERTIFICATIONS -----------------
export interface MasteryCertification {
  id: string;
  cohortId: string;
  learnerId: string;
  certified: boolean;
  certifiedBy?: string;
  certifiedByName?: string;
  updatedAt: string;
}

export async function getMasteryCertifications(
  cohortId?: string,
  cohortIds?: string[]
): Promise<MasteryCertification[]> {
  try {
    const colRef = collection(db, 'masteryCertifications');
    if (cohortIds && !cohortId) {
      if (cohortIds.length === 0) return [];
      const perCohort = await Promise.all(
        cohortIds.map(async (cid) => {
          const snap = await getDocs(query(colRef, where('cohortId', '==', cid)));
          return snap.docs.map((d) => ({ ...d.data(), id: d.id } as MasteryCertification));
        })
      );
      return perCohort.flat();
    }
    const q = cohortId ? query(colRef, where('cohortId', '==', cohortId)) : colRef;
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as MasteryCertification));
  } catch (error) {
    console.warn('Could not load mastery certifications:', error);
    return [];
  }
}

export async function setMasteryCertification(params: {
  cohortId: string;
  learnerId: string;
  learnerName: string;
  certified: boolean;
  teacherId: string;
  teacherName: string;
}): Promise<MasteryCertification> {
  const certId = `cert_${params.cohortId}_${params.learnerId}`;
  const record: MasteryCertification = {
    id: certId,
    cohortId: params.cohortId,
    learnerId: params.learnerId,
    certified: params.certified,
    certifiedBy: params.teacherId,
    certifiedByName: params.teacherName,
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'masteryCertifications', certId), record);
    await logAuditEvent({
      actorId: params.teacherId,
      actorName: params.teacherName,
      actorRole: 'teacher',
      action: params.certified ? 'CERTIFY_MASTERY' : 'REVOKE_MASTERY',
      targetEntity: 'learner',
      targetId: params.learnerId,
      details: `${params.certified ? 'Certified' : 'Revoked'} topic mastery for ${params.learnerName} in cohort ${params.cohortId}.`,
    });
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `masteryCertifications/${certId}`);
    throw error;
  }
}

// ----------------- TEACHER FEEDBACK -----------------
export async function sendTeacherFeedback(
  feedback: Omit<TeacherFeedback, 'id' | 'createdAt' | 'isRead'>
): Promise<void> {
  const docId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item: TeacherFeedback = {
    ...feedback,
    id: docId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'teacherFeedback', docId), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `teacherFeedback/${docId}`);
    throw error;
  }
}

export async function getFeedbackForLearner(learnerDocId: string): Promise<TeacherFeedback[]> {
  try {
    const q = query(collection(db, 'teacherFeedback'), where('learnerDocId', '==', learnerDocId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as TeacherFeedback));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'teacherFeedback');
    return [];
  }
}

// ----------------- AUDIT LOGS -----------------
export async function logAuditEvent(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const docId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const item: AuditLog = {
    ...log,
    id: docId,
    timestamp: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'auditLogs', docId), item);
  } catch (error) {
    console.warn('Audit log write error:', error);
  }
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'auditLogs'));
    const logs = snap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLog));
    return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'auditLogs');
    return [];
  }
}

// ----------------- SCHOOL SETTINGS -----------------
export async function getSchoolSettings(): Promise<SchoolSetting> {
  const defaultSettings: SchoolSetting = {
    id: 'school_config',
    schoolName: 'Sangurur Comprehensive School',
    schoolMotto: 'THINK, CODE, CHANGE THE WORLD',
    timezone: 'Africa/Nairobi',
    allowLearnerReflections: true,
    lateCutoffTime: '08:30',
    attendanceCutoffTime: '16:30',
    contactEmail: 'sangururschool10@gmail.com',
  };

  try {
    const configRef = doc(db, 'schoolSettings', 'school_config');
    const snap = await getDoc(configRef);
    if (!snap.exists()) {
      await setDoc(configRef, defaultSettings);
      return defaultSettings;
    }
    const existing = snap.data() as SchoolSetting;
    if ((existing.schoolMotto || '').trim().toUpperCase() === 'STRIVE TO RISE') {
      await updateDoc(configRef, { schoolMotto: 'THINK, CODE, CHANGE THE WORLD' });
      return { ...existing, schoolMotto: 'THINK, CODE, CHANGE THE WORLD' };
    }
    return existing;
  } catch (e) {
    return defaultSettings;
  }
}

export async function updateSchoolSettings(
  updates: Partial<SchoolSetting>,
  actor?: { uid: string; fullName: string; role: string }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'schoolSettings', 'school_config'), updates);
    await logAuditEvent({
      actorId: actor?.uid || 'teacher_staff',
      actorName: actor?.fullName || 'School Administrator',
      actorRole: actor?.role || 'admin',
      action: 'UPDATE_SCHOOL_SETTINGS',
      targetEntity: 'schoolSettings',
      targetId: 'school_config',
      details: `Updated institution settings (Late Cutoff: ${updates.lateCutoffTime || '—'}, Closing Cutoff: ${updates.attendanceCutoffTime || '—'}, Reflections: ${updates.allowLearnerReflections ? 'Enabled' : 'Disabled'}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'schoolSettings/school_config');
    throw error;
  }
}

// ----------------- WEEKLY TIMETABLES (NOV/DEC HOLIDAY & TERMS) -----------------
export function getNairobiTodayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function getWeeklyTimetable(cohortId?: string): Promise<WeeklyTimetableEntry[]> {
  try {
    const colRef = collection(db, 'weeklyTimetables');
    const q = cohortId ? query(colRef, where('cohortId', '==', cohortId)) : colRef;
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ ...d.data(), id: d.id } as WeeklyTimetableEntry));
    return items.sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return (a.weekNumber || 0) - (b.weekNumber || 0);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'weeklyTimetables');
    return [];
  }
}

export async function createWeeklyTimetableEntry(
  entry: Omit<WeeklyTimetableEntry, 'id' | 'createdAt'>
): Promise<WeeklyTimetableEntry> {
  const safeTerm = (entry.programmeTerm || 'term')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);
  const docId = `tt_${entry.cohortId}_${safeTerm}_w${entry.weekNumber}_${Date.now().toString(36)}`;
  const newEntry: WeeklyTimetableEntry = {
    ...entry,
    id: docId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'weeklyTimetables', docId), newEntry);
    return newEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `weeklyTimetables/${docId}`);
    throw error;
  }
}

export async function updateWeeklyTimetableEntry(
  entryId: string,
  updates: Partial<WeeklyTimetableEntry>
): Promise<void> {
  try {
    const ref = doc(db, 'weeklyTimetables', entryId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `weeklyTimetables/${entryId}`);
    throw error;
  }
}

export async function deleteWeeklyTimetableEntry(entryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'weeklyTimetables', entryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `weeklyTimetables/${entryId}`);
    throw error;
  }
}

function buildNovDecHolidayWeekTemplates(facilitatorName: string): Array<{
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  weeklyTheme: string;
  topics: TimetableTopicSlot[];
}> {
  return [
    {
      weekNumber: 1,
      weekLabel: 'Week 1: Digital Foundations & Computer Systems',
      startDate: '2026-11-02',
      endDate: '2026-11-06',
      weeklyTheme: 'Hardware architecture, OS file management, typing fluency, and spreadsheet logic',
      topics: [
        {
          id: 'tt_slot_w1_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Input, Processing & Output (IPO) Architecture',
          learningArea: 'Computer Fundamentals',
          facilitator: facilitatorName,
          practicalActivity: 'Inspect desktop lab ports and trace data flow from keyboard to monitor',
        },
        {
          id: 'tt_slot_w1_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Primary & Secondary Storage (RAM, ROM, SSD)',
          learningArea: 'Computer Fundamentals',
          facilitator: facilitatorName,
          practicalActivity: 'Classify classroom storage devices and calculate MB/GB capacities',
        },
        {
          id: 'tt_slot_w1_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Operating Systems & Folder Hierarchy',
          learningArea: 'Digital Productivity',
          facilitator: facilitatorName,
          practicalActivity: 'Create a structured Nov/Dec Holiday portfolio workspace',
        },
        {
          id: 'tt_slot_w1_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Spreadsheet Formulas (SUM, AVERAGE, MIN, MAX)',
          learningArea: 'Computer Applications',
          facilitator: facilitatorName,
          practicalActivity: 'Build an interactive marks calculator with column bar charts',
        },
        {
          id: 'tt_slot_w1_fri',
          dayOfWeek: 'Friday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Week 1 Lab Checkpoint & Typing Challenge',
          learningArea: 'Practical Assessment',
          facilitator: facilitatorName,
          practicalActivity: 'Peer-reviewed folder organization and spreadsheet mini-test',
        },
      ],
    },
    {
      weekNumber: 2,
      weekLabel: 'Week 2: Creative Coding & Visual Logic in Scratch',
      startDate: '2026-11-09',
      endDate: '2026-11-13',
      weeklyTheme: 'Block-based sequencing, Cartesian coordinates, loops, and conditional game events',
      topics: [
        {
          id: 'tt_slot_w2_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Sprites, Costumes & Stage Coordinates (X, Y)',
          learningArea: 'Scratch Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Animate a dancing sprite across the 480x360 coordinate grid',
        },
        {
          id: 'tt_slot_w2_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Event Triggers & Broadcast Messaging',
          learningArea: 'Scratch Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Script two characters conversing with timed broadcast signals',
        },
        {
          id: 'tt_slot_w2_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Loops, Repeats & Conditional Decisions (If-Then)',
          learningArea: 'Scratch Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Build collision detection and wall-bounce logic for a maze runner',
        },
        {
          id: 'tt_slot_w2_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Score Variables, Timers & Sound Effects',
          learningArea: 'Game Design',
          facilitator: facilitatorName,
          practicalActivity: 'Add a live score counter and countdown timer to the maze game',
        },
        {
          id: 'tt_slot_w2_fri',
          dayOfWeek: 'Friday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Week 2 Interactive Story & Quiz Playtest',
          learningArea: 'Practical Assessment',
          facilitator: facilitatorName,
          practicalActivity: 'Demonstrate playable Scratch games and swap feedback',
        },
      ],
    },
    {
      weekNumber: 3,
      weekLabel: 'Week 3: Web Design Mastery — HTML5 & CSS Styling',
      startDate: '2026-11-16',
      endDate: '2026-11-20',
      weeklyTheme: 'Semantic web structure, accessible links/media, CSS box model, and Flexbox responsive pages',
      topics: [
        {
          id: 'tt_slot_w3_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'HTML5 Document Structure, Headings & Paragraphs',
          learningArea: 'Web Technology',
          facilitator: facilitatorName,
          practicalActivity: 'Code a personal learner profile HTML page using semantic tags',
        },
        {
          id: 'tt_slot_w3_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Images, Hyperlinks & Multi-Page Navigation Bars',
          learningArea: 'Web Technology',
          facilitator: facilitatorName,
          practicalActivity: 'Connect Home, Clubs, and Timetable pages with working nav links',
        },
        {
          id: 'tt_slot_w3_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'CSS Selectors, Colors, Typography & Box Model',
          learningArea: 'Web Technology',
          facilitator: facilitatorName,
          practicalActivity: 'Style Sangurur school cards with padding, borders, and brand colors',
        },
        {
          id: 'tt_slot_w3_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Mobile-First Responsive Layouts with Flexbox & Grid',
          learningArea: 'Web Technology',
          facilitator: facilitatorName,
          practicalActivity: 'Make club gallery cards adapt smoothly from phone to desktop',
        },
        {
          id: 'tt_slot_w3_fri',
          dayOfWeek: 'Friday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Week 3 Sangurur School Club Website Mini-Exhibition',
          learningArea: 'Practical Assessment',
          facilitator: facilitatorName,
          practicalActivity: 'Present styled multi-page club websites to peers',
        },
      ],
    },
    {
      weekNumber: 4,
      weekLabel: 'Week 4: Python Coding & Problem Solving',
      startDate: '2026-11-23',
      endDate: '2026-11-27',
      weeklyTheme: 'Core Python syntax, user inputs, conditional branching, loops, and structured problem solving',
      topics: [
        {
          id: 'tt_slot_w4_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Print, Variables & Primitive Data Types (str, int, float)',
          learningArea: 'Python Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Write an interactive greeting & learner ID badge formatter script',
        },
        {
          id: 'tt_slot_w4_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Arithmetic Expressions & Type Casting',
          learningArea: 'Python Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Develop a school tuck-shop & fee balance calculator script',
        },
        {
          id: 'tt_slot_w4_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Conditional Branching: if, elif, else',
          learningArea: 'Python Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Code an automatic CBC rubric & grade categorizer tool',
        },
        {
          id: 'tt_slot_w4_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'For/While Loops & Python Lists',
          learningArea: 'Python Programming',
          facilitator: facilitatorName,
          practicalActivity: 'Build a class attendance tallying loop over student lists',
        },
        {
          id: 'tt_slot_w4_fri',
          dayOfWeek: 'Friday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Week 4 Python Debugging & Quiz Assistant Lab',
          learningArea: 'Practical Assessment',
          facilitator: facilitatorName,
          practicalActivity: 'Test and debug a 5-question console trivia game',
        },
      ],
    },
    {
      weekNumber: 5,
      weekLabel: 'Week 5: Artificial Intelligence & Cyber Safety',
      startDate: '2026-11-30',
      endDate: '2026-12-04',
      weeklyTheme: 'Machine learning concepts, clean training datasets, algorithmic fairness, and online safety',
      topics: [
        {
          id: 'tt_slot_w5_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Rule-Based Programs vs. Machine Learning',
          learningArea: 'Artificial Intelligence',
          facilitator: facilitatorName,
          practicalActivity: 'Compare explicit if-else rules against pattern classifiers',
        },
        {
          id: 'tt_slot_w5_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Training Data, Features & Bias Prevention',
          learningArea: 'Artificial Intelligence',
          facilitator: facilitatorName,
          practicalActivity: 'Curate balanced leaf/crop sample labels and inspect errors',
        },
        {
          id: 'tt_slot_w5_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Password Hygiene & Phishing Defense',
          learningArea: 'Digital Literacy',
          facilitator: facilitatorName,
          practicalActivity: 'Audit sample login prompts and design strong passphrase strategies',
        },
        {
          id: 'tt_slot_w5_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:00',
          topicTitle: 'Real-World AI Applications in Kenyan Agriculture & Health',
          learningArea: 'Artificial Intelligence',
          facilitator: facilitatorName,
          practicalActivity: 'Design a community problem-statement poster for an AI helper',
        },
        {
          id: 'tt_slot_w5_fri',
          dayOfWeek: 'Friday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Week 5 Ethical Tech Debate & Vision Demo',
          learningArea: 'Practical Assessment',
          facilitator: facilitatorName,
          practicalActivity: 'Team debate on responsible student AI usage',
        },
      ],
    },
    {
      weekNumber: 6,
      weekLabel: 'Week 6: Holiday Capstone Project & Demo Day',
      startDate: '2026-12-07',
      endDate: '2026-12-11',
      weeklyTheme: 'Team capstone creation, testing, portfolio polish, and Sangurur Holiday Bootcamp Showcase',
      topics: [
        {
          id: 'tt_slot_w6_mon',
          dayOfWeek: 'Monday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Capstone Blueprint & Track Selection (Scratch, Web, or Python)',
          learningArea: 'Capstone Studio',
          facilitator: facilitatorName,
          practicalActivity: 'Draft team project storyboard and milestone checklist',
        },
        {
          id: 'tt_slot_w6_tue',
          dayOfWeek: 'Tuesday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Core Build Sprint & Peer Pair-Programming',
          learningArea: 'Capstone Studio',
          facilitator: facilitatorName,
          practicalActivity: 'Implement core project features with teacher check-ins',
        },
        {
          id: 'tt_slot_w6_wed',
          dayOfWeek: 'Wednesday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Usability Testing, Bug Fixing & Documentation',
          learningArea: 'Capstone Studio',
          facilitator: facilitatorName,
          practicalActivity: 'Cross-test classmate projects and log defect fixes',
        },
        {
          id: 'tt_slot_w6_thu',
          dayOfWeek: 'Thursday',
          timeSlot: '08:30 - 10:30',
          topicTitle: 'Presentation Deck & Live Demo Rehearsal',
          learningArea: 'Capstone Studio',
          facilitator: facilitatorName,
          practicalActivity: 'Rehearse 3-minute student showcase pitches',
        },
        {
          id: 'tt_slot_w6_fri',
          dayOfWeek: 'Friday',
          timeSlot: '09:00 - 12:00',
          topicTitle: 'Nov/Dec Holiday Demo Day & Certificate Awards',
          learningArea: 'Showcase & Certification',
          facilitator: facilitatorName,
          practicalActivity: 'Live project demonstrations & Bootcamp Mastery Certificates',
        },
      ],
    },
  ];
}

export async function seedNovDecHolidayTimetable(
  cohort: Cohort,
  createdBy: string,
  programmeTerm: string = 'Nov/Dec Holiday 2026'
): Promise<WeeklyTimetableEntry[]> {
  const existing = await getWeeklyTimetable(cohort.id);
  const existingWeeks = new Set(
    existing
      .filter((e) => e.programmeTerm === programmeTerm)
      .map((e) => e.weekNumber)
  );

  const templates = buildNovDecHolidayWeekTemplates(cohort.teacherName || createdBy || 'Sangurur Staff');
  const created: WeeklyTimetableEntry[] = [];

  for (const tmpl of templates) {
    if (existingWeeks.has(tmpl.weekNumber)) continue;
    const entry = await createWeeklyTimetableEntry({
      cohortId: cohort.id,
      cohortCode: cohort.code,
      programmeTerm,
      weekNumber: tmpl.weekNumber,
      weekLabel: tmpl.weekLabel,
      startDate: tmpl.startDate,
      endDate: tmpl.endDate,
      weeklyTheme: tmpl.weeklyTheme,
      topics: tmpl.topics,
      createdBy: createdBy || 'Sangurur Staff',
    });
    created.push(entry);
  }

  return [...existing, ...created].sort((a, b) => {
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    return (a.weekNumber || 0) - (b.weekNumber || 0);
  });
}
