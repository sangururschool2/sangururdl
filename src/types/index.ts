export type UserRole = 'teacher' | 'admin' | 'super_admin' | 'learner';

export interface Teacher {
  uid: string;
  username?: string;
  email: string;
  fullName: string;
  role: 'teacher' | 'admin' | 'super_admin';
  phone?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Learner {
  id: string; // Firestore document ID
  fullName: string;
  digitalId: string; // Unique format e.g. SG-LRN-2026-001
  learnerId: string; // Same as digitalId
  username: string; // Same as digitalId for login
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  age?: number;
  schoolName?: string;
  grade?: string;
  guardianContact?: string;
  assignedCohortIds: string[];
  mustChangePassword: boolean;
  isFirstLogin: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  initialPassword?: string; // transient for printable access slip
}

export interface Cohort {
  id: string;
  name: string;
  code: string; // e.g. GR7-CBC-2026
  programme: string;
  description: string;
  learningLevel: string; // e.g., Grade 7, Form 1, Beginner
  ageBracket?: string; // e.g., 13–15 Years (Junior School: Grade 7–9)
  startDate: string;
  endDate: string;
  teacherId: string;
  teacherName: string;
  curriculumId?: string;
  curriculumSnapshot?: CurriculumSnapshot;
  status: 'active' | 'archived' | 'draft';
  learnerCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CohortMember {
  id: string;
  cohortId: string;
  learnerId: string;
  learnerName: string;
  learnerCode: string;
  joinedAt: string;
  status: 'active' | 'transferred' | 'completed';
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  learningObjectives: string[];
  expectedDuration: string; // e.g. "2 hours" or "1 week"
  resources?: string[];
  practicalActivities?: string;
  order: number;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  topics: Topic[];
  order: number;
}

export interface LearningArea {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  order: number;
}

export interface Curriculum {
  id: string;
  title: string;
  category: string;
  description: string;
  level: string;
  isTemplate: boolean;
  isPublished: boolean;
  version: number;
  createdBy: string;
  learningAreas: LearningArea[];
  createdAt: string;
  updatedAt?: string;
}

export interface CurriculumSnapshot {
  curriculumId: string;
  curriculumTitle: string;
  version: number;
  snapshotDate: string;
  learningAreas: LearningArea[];
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type VerificationStatus = 'pending_verification' | 'verified' | 'corrected';
export type UnderstandingLevel = 'excellent' | 'good' | 'fair' | 'needs_support';

export interface CorrectionRecord {
  correctedBy: string;
  correctedByName: string;
  timestamp: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}

export interface DailyRegister {
  id: string; // Deterministic: reg_{cohortId}_{learnerDocId}_{date}
  cohortId: string;
  cohortCode: string;
  learnerDocId: string;
  learnerId: string;
  learnerName: string;
  date: string; // YYYY-MM-DD local Nairobi
  timestamp: string; // ISO String
  status: AttendanceStatus;
  didStudy?: boolean;
  nonStudyReason?: string | null;
  verificationStatus: VerificationStatus;
  learningAreaId?: string;
  learningAreaTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  topicId?: string;
  topicTitle?: string;
  topicDescription?: string;
  understandingLevel?: UnderstandingLevel | null;
  reflectionLearned?: string;
  reflectionActivity?: string;
  reflectionDifficult?: string;
  reflectionTeacherExplain?: string;
  teacherNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  correctionHistory?: CorrectionRecord[];
}

export interface TeacherFeedback {
  id: string;
  teacherId: string;
  teacherName: string;
  learnerDocId: string;
  cohortId: string;
  topicId?: string;
  topicTitle?: string;
  message: string;
  supportType: 'encouragement' | 'revision' | 'intervention' | 'general';
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details: string;
  timestamp: string;
}

export interface SchoolSetting {
  id: string;
  schoolName: string;
  schoolMotto: string;
  timezone: string;
  allowLearnerReflections: boolean;
  lateCutoffTime: string;
  attendanceCutoffTime: string;
  contactEmail: string;
}

export type TimetableDayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export interface TimetableTopicSlot {
  id: string;
  dayOfWeek: TimetableDayOfWeek;
  timeSlot: string;
  topicTitle: string;
  learningArea: string;
  facilitator?: string;
  practicalActivity?: string;
  curriculumTopicId?: string;
}

export interface WeeklyTimetableEntry {
  id: string;
  cohortId: string;
  cohortCode: string;
  programmeTerm: string;
  weekNumber: number;
  weekLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  weeklyTheme: string;
  topics: TimetableTopicSlot[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type EducationLevelKey =
  | 'playgroup'
  | 'lower_primary'
  | 'upper_primary'
  | 'junior_school'
  | 'senior_school'
  | 'unspecified';

export interface GradeBandMeta {
  key: Exclude<EducationLevelKey, 'unspecified'>;
  label: string;
  shortRange: string;
  grades: string[];
}

export const EDUCATION_LEVEL_BANDS: GradeBandMeta[] = [
  {
    key: 'playgroup',
    label: 'Play Group',
    shortRange: 'Playgroup, PP1 – PP2',
    grades: ['Playgroup', 'PP1', 'PP2'],
  },
  {
    key: 'lower_primary',
    label: 'Lower Primary',
    shortRange: 'Grade 1 – Grade 3',
    grades: ['Grade 1', 'Grade 2', 'Grade 3'],
  },
  {
    key: 'upper_primary',
    label: 'Upper Primary',
    shortRange: 'Grade 4 – Grade 6',
    grades: ['Grade 4', 'Grade 5', 'Grade 6'],
  },
  {
    key: 'junior_school',
    label: 'Junior School',
    shortRange: 'Grade 7 – Grade 9',
    grades: ['Grade 7', 'Grade 8', 'Grade 9'],
  },
  {
    key: 'senior_school',
    label: 'Senior School',
    shortRange: 'Grade 10 – 12 / Form 1 – 4',
    grades: ['Grade 10', 'Grade 11', 'Grade 12', 'Form 1', 'Form 2', 'Form 3', 'Form 4'],
  },
];

export const ALL_GRADE_OPTIONS: string[] = EDUCATION_LEVEL_BANDS.flatMap((b) => b.grades);

export const AGE_BRACKET_OPTIONS: string[] = [
  '3–5 Years (Play Group / PP1–PP2)',
  '6–9 Years (Lower Primary: Grade 1–3)',
  '10–12 Years (Upper Primary: Grade 4–6)',
  '13–15 Years (Junior School: Grade 7–9)',
  '16–18 Years (Senior School: Grade 10–12 / Form 1–4)',
  'Mixed Age Bootcamp (6–18 Years)',
];

export function classifyEducationLevel(
  grade?: string | null,
  fallbackLevel?: string | null
): EducationLevelKey {
  const candidates = [grade, fallbackLevel].filter(Boolean) as string[];
  for (const raw of candidates) {
    const val = raw.trim().toLowerCase();
    if (!val) continue;

    if (
      /\b(play\s*group|baby\s*class|ecde|nursery|kindergarten|kg|pp\s*1|pp\s*2|pre[-\s]*primary)\b/.test(
        val
      )
    ) {
      return 'playgroup';
    }

    if (/\blower\s*primary\b/.test(val)) return 'lower_primary';
    if (/\bupper\s*primary\b/.test(val)) return 'upper_primary';
    if (/\b(junior\s*school|junior\s*secondary|jss)\b/.test(val)) return 'junior_school';
    if (/\b(senior\s*school|senior\s*secondary|high\s*school)\b/.test(val)) return 'senior_school';

    const formMatch = val.match(/\bform\s*(\d{1,2})\b/);
    if (formMatch) {
      const f = Number(formMatch[1]);
      if (f >= 1 && f <= 4) return 'senior_school';
    }

    const gradeMatch = val.match(/\b(?:grade|std|standard|class|gr)\s*(\d{1,2})\b/);
    if (gradeMatch) {
      const g = Number(gradeMatch[1]);
      if (g >= 1 && g <= 3) return 'lower_primary';
      if (g >= 4 && g <= 6) return 'upper_primary';
      if (g >= 7 && g <= 9) return 'junior_school';
      if (g >= 10 && g <= 12) return 'senior_school';
    }
  }
  return 'unspecified';
}

