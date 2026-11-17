import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';
import {
  Cohort,
  Learner,
  DailyRegister,
  AttendanceStatus,
  UnderstandingLevel,
  Topic,
  LearningArea,
  Module,
  WeeklyTimetableEntry,
} from '../../types';
import {
  Calendar,
  Clock,
  Smile,
  Meh,
  Frown,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Sparkles,
  BookOpen,
  ZapOff,
  History,
} from 'lucide-react';

interface DailyRegisterModalProps {
  cohort: Cohort;
  learner: Learner;
  existingSubmission?: DailyRegister | null;
  allRegisters?: DailyRegister[];
  initialDate?: string;
  onClose: () => void;
  onSuccess: (savedRegister: DailyRegister) => void;
}

const NON_STUDY_REASONS = [
  'Power blackout',
  'Internet / Network outage',
  'Teacher unavailable / Staff meeting',
  'Computer lab maintenance',
  'School assembly / Co-curricular event',
  'Heavy rain / Weather disruption',
  'Illness while at school',
  'Other reason',
];

function getPreviousNairobiDate(baseYmd: string, daysBack = 1): string {
  const [y, m, d] = baseYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - daysBack));
  return dt.toISOString().slice(0, 10);
}

export const DailyRegisterModal: React.FC<DailyRegisterModalProps> = ({
  cohort,
  learner,
  existingSubmission,
  allRegisters = [],
  initialDate,
  onClose,
  onSuccess,
}) => {
  const { learnerToken } = useAuth();
  const [allowReflections, setAllowReflections] = useState<boolean>(true);

  useEffect(() => {
    if (!learnerToken) return;
    fetch('/api/learner/settings', {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.settings) {
          setAllowReflections(json.settings.allowLearnerReflections !== false);
        }
      })
      .catch(() => setAllowReflections(true));
  }, [learnerToken]);

  // Nairobi local date
  const nairobiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const nairobiYesterday = useMemo(() => getPreviousNairobiDate(nairobiToday, 1), [nairobiToday]);

  const [selectedDate, setSelectedDate] = useState<string>(initialDate || nairobiToday);
  const [step, setStep] = useState<number>(1); // 1: Date & Attendance/Study Status, 2: Area & Topic, 3: Understanding, 4: Reflection, 5: Review
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [didStudy, setDidStudy] = useState<boolean>(true);
  const [selectedReasonChip, setSelectedReasonChip] = useState<string>('Power blackout');
  const [customReasonText, setCustomReasonText] = useState<string>('');

  // Extract all topics from cohort curriculum snapshot + weekly timetable for selectedDate
  const [timetableEntries, setTimetableEntries] = useState<WeeklyTimetableEntry[]>([]);
  const [allTopics, setAllTopics] = useState<
    {
      topic: Topic;
      learningArea: LearningArea;
      module: Module;
      source: 'timetable' | 'curriculum';
      scheduleLabel?: string;
    }[]
  >([]);
  const [activeTimetableWeek, setActiveTimetableWeek] = useState<WeeklyTimetableEntry | null>(null);

  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('ALL');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [useCustomTopic, setUseCustomTopic] = useState<boolean>(false);
  const [customAreaTitle, setCustomAreaTitle] = useState<string>('');
  const [customTopicTitle, setCustomTopicTitle] = useState<string>('');

  const [understandingLevel, setUnderstandingLevel] = useState<UnderstandingLevel>('good');

  // Reflections
  const [reflectionLearned, setReflectionLearned] = useState<string>('');
  const [reflectionActivity, setReflectionActivity] = useState<string>('');
  const [reflectionDifficult, setReflectionDifficult] = useState<string>('');
  const [reflectionTeacherExplain, setReflectionTeacherExplain] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isToday = selectedDate === nairobiToday;

  // Lookup existing register for the currently selectedDate
  const existingForSelectedDate = useMemo(() => {
    const match = allRegisters.find((r) => r.date === selectedDate);
    if (match) return match;
    if (selectedDate === nairobiToday && existingSubmission) return existingSubmission;
    return null;
  }, [allRegisters, selectedDate, nairobiToday, existingSubmission]);

  // Load weekly timetable entries once per cohort via authenticated learner API
  useEffect(() => {
    if (!learnerToken) return;
    let cancelled = false;
    fetch(`/api/learner/timetable?cohortId=${encodeURIComponent(cohort.id)}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((json) => {
        if (!cancelled) setTimetableEntries(json.entries || []);
      })
      .catch(() => {
        if (!cancelled) setTimetableEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cohort.id, learnerToken]);

  // Build topic list tailored to selectedDate's timetable week + curriculum snapshot
  useEffect(() => {
    const matchedWeek =
      timetableEntries.find((w) => w.startDate <= selectedDate && selectedDate <= w.endDate) ||
      timetableEntries[0] ||
      null;

    setActiveTimetableWeek(matchedWeek);

    const timetableItems: {
      topic: Topic;
      learningArea: LearningArea;
      module: Module;
      source: 'timetable' | 'curriculum';
      scheduleLabel?: string;
    }[] = [];

    if (matchedWeek && matchedWeek.topics?.length) {
      matchedWeek.topics.forEach((slot, idx) => {
        const syntheticTopic: Topic = {
          id: slot.id,
          title: slot.topicTitle,
          description: slot.practicalActivity || matchedWeek.weeklyTheme || matchedWeek.weekLabel,
          learningObjectives: slot.practicalActivity ? [slot.practicalActivity] : [],
          expectedDuration: slot.timeSlot,
          order: idx + 1,
        };
        const syntheticArea: LearningArea = {
          id: `area_${(slot.learningArea || matchedWeek.programmeTerm).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
          title: slot.learningArea || matchedWeek.programmeTerm,
          description: matchedWeek.weeklyTheme || '',
          modules: [],
          order: 1,
        };
        const syntheticModule: Module = {
          id: matchedWeek.id,
          title: `Week ${matchedWeek.weekNumber}: ${slot.dayOfWeek} (${slot.timeSlot})`,
          description: matchedWeek.weekLabel,
          topics: [syntheticTopic],
          order: 1,
        };
        timetableItems.push({
          topic: syntheticTopic,
          learningArea: syntheticArea,
          module: syntheticModule,
          source: 'timetable',
          scheduleLabel: `${slot.dayOfWeek} • ${slot.timeSlot}`,
        });
      });
    }

    const curriculumItems: {
      topic: Topic;
      learningArea: LearningArea;
      module: Module;
      source: 'timetable' | 'curriculum';
      scheduleLabel?: string;
    }[] = [];

    const areas = cohort.curriculumSnapshot?.learningAreas || [];
    areas.forEach((area) => {
      area.modules.forEach((mod) => {
        mod.topics.forEach((top) => {
          curriculumItems.push({
            topic: top,
            learningArea: area,
            module: mod,
            source: 'curriculum',
          });
        });
      });
    });

    const merged = [...timetableItems, ...curriculumItems];
    setAllTopics(merged);

    // If prefilling from existing previous day submission, preserve it cleanly
    if (existingForSelectedDate && existingForSelectedDate.date < nairobiToday) {
      if (existingForSelectedDate.status === 'present' || existingForSelectedDate.status === 'late') {
        setStatus(existingForSelectedDate.status);
      }
      const prevStudied = existingForSelectedDate.didStudy !== false;
      setDidStudy(prevStudied);
      if (!prevStudied && existingForSelectedDate.nonStudyReason) {
        if (NON_STUDY_REASONS.includes(existingForSelectedDate.nonStudyReason)) {
          setSelectedReasonChip(existingForSelectedDate.nonStudyReason);
          setCustomReasonText('');
        } else {
          setSelectedReasonChip('Other reason');
          setCustomReasonText(existingForSelectedDate.nonStudyReason);
        }
      }
      if (existingForSelectedDate.understandingLevel) {
        setUnderstandingLevel(existingForSelectedDate.understandingLevel);
      }
      setReflectionLearned(existingForSelectedDate.reflectionLearned || '');
      setReflectionActivity(existingForSelectedDate.reflectionActivity || '');
      setReflectionDifficult(existingForSelectedDate.reflectionDifficult || '');
      setReflectionTeacherExplain(existingForSelectedDate.reflectionTeacherExplain || '');

      const matchedExistingTopic = merged.find(
        (m) =>
          m.topic.id === existingForSelectedDate.topicId ||
          (existingForSelectedDate.topicTitle &&
            m.topic.title.toLowerCase() === existingForSelectedDate.topicTitle.toLowerCase())
      );

      if (matchedExistingTopic) {
        setUseCustomTopic(false);
        setSelectedTopicId(matchedExistingTopic.topic.id);
        setSelectedAreaFilter(matchedExistingTopic.learningArea.title);
      } else if (existingForSelectedDate.topicTitle) {
        setUseCustomTopic(true);
        setCustomAreaTitle(existingForSelectedDate.learningAreaTitle || cohort.programme || '');
        setCustomTopicTitle(existingForSelectedDate.topicTitle);
      } else if (merged.length > 0) {
        setUseCustomTopic(false);
        setSelectedTopicId(merged[0].topic.id);
      }
      return;
    }

    // Default selection matching the day of the week of selectedDate
    setUseCustomTopic(false);
    setSelectedAreaFilter('ALL');
    if (timetableItems.length > 0) {
      const [yy, mm, dd] = selectedDate.split('-').map(Number);
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        weekday: 'long',
      }).format(new Date(Date.UTC(yy, mm - 1, dd)));
      const daySlot = timetableItems.find((item) =>
        item.scheduleLabel?.toLowerCase().startsWith(weekday.toLowerCase())
      );
      setSelectedTopicId((daySlot || timetableItems[0]).topic.id);
    } else if (curriculumItems.length > 0) {
      setSelectedTopicId(curriculumItems[0].topic.id);
    }
  }, [cohort, timetableEntries, selectedDate, existingForSelectedDate, nairobiToday]);

  // Available unique learning areas for the learner to pick from
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    allTopics.forEach((t) => {
      if (t.learningArea?.title) set.add(t.learningArea.title);
    });
    return Array.from(set);
  }, [allTopics]);

  const filteredTopics = useMemo(() => {
    if (selectedAreaFilter === 'ALL') return allTopics;
    return allTopics.filter((t) => t.learningArea.title === selectedAreaFilter);
  }, [allTopics, selectedAreaFilter]);

  const activeTopicItem = allTopics.find((t) => t.topic.id === selectedTopicId);

  const effectiveNonStudyReason =
    selectedReasonChip === 'Other reason' ? customReasonText.trim() : selectedReasonChip;

  const resolvedAreaTitle = useCustomTopic
    ? customAreaTitle.trim() || cohort.programme
    : activeTopicItem?.learningArea.title || (selectedAreaFilter !== 'ALL' ? selectedAreaFilter : cohort.programme);

  const resolvedTopicTitle = useCustomTopic
    ? customTopicTitle.trim()
    : activeTopicItem?.topic.title || '';

  // Strict Duplicate Lock ONLY when selectedDate is TODAY and today is already submitted
  if (isToday && existingForSelectedDate) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
            <CheckCircle className="w-9 h-9" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Today’s Register Completed!</h3>
          <p className="text-sm font-semibold text-emerald-800 mt-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
            Your register for today ({nairobiToday}) has already been submitted.
          </p>

          <div className="mt-4 text-left bg-slate-50 p-4 rounded-xl text-xs space-y-1.5 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Date:</span>
              <span className="font-bold text-slate-800">{existingForSelectedDate.date} (EAT)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Attendance:</span>
              <span className="font-bold uppercase text-emerald-700">
                {existingForSelectedDate.status}
                {existingForSelectedDate.didStudy === false ? ' (Did Not Study)' : ''}
              </span>
            </div>
            {existingForSelectedDate.didStudy === false ? (
              <div className="flex justify-between">
                <span className="text-slate-500">Reason:</span>
                <span className="font-bold text-amber-800">
                  {existingForSelectedDate.nonStudyReason || 'Did not study'}
                </span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Area Learned:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">
                    {existingForSelectedDate.learningAreaTitle || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Topic Covered:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">
                    {existingForSelectedDate.topicTitle || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Understanding:</span>
                  <span className="font-bold uppercase text-blue-700">
                    {existingForSelectedDate.understandingLevel?.replace('_', ' ') || 'GOOD'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(nairobiYesterday);
                setStep(1);
                setErrorMessage(null);
              }}
              className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition"
            >
              <History className="w-4 h-4 text-blue-700" />
              <span>Mark or Update a Previous Day</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-slate-800 text-white font-bold rounded-xl text-sm hover:bg-slate-900 transition"
            >
              Close & Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleNextStep = () => {
    setErrorMessage(null);

    if (step === 1) {
      if (!selectedDate || selectedDate > nairobiToday) {
        setErrorMessage(`Please select a valid date on or before ${nairobiToday}.`);
        return;
      }
      if (
        existingForSelectedDate &&
        ['absent', 'excused'].includes(existingForSelectedDate.status)
      ) {
        setErrorMessage(
          `A teacher marked you ${existingForSelectedDate.status.toUpperCase()} on ${selectedDate}. Contact your teacher to change attendance.`
        );
        return;
      }
      if (!didStudy) {
        if (!effectiveNonStudyReason) {
          setErrorMessage('Please choose or specify why you did not study (e.g., Power blackout).');
          return;
        }
        // Skip Topic & Understanding steps when learner was present and did not study
        setStep(allowReflections ? 4 : 5);
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (useCustomTopic && !customTopicTitle.trim()) {
        setErrorMessage('Please enter the topic covered or switch back to select a listed topic.');
        return;
      }
      if (!useCustomTopic && !activeTopicItem && allTopics.length > 0) {
        setErrorMessage('Please select the area & topic learned on this date.');
        return;
      }
      setStep(3);
      return;
    }

    if (step < 5) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    if (!didStudy && (step === 4 || step === 5)) {
      setStep(step === 5 && allowReflections ? 4 : 1);
      return;
    }
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      cohortId: cohort.id,
      cohortCode: cohort.code,
      learnerDocId: learner.id,
      learnerId: learner.learnerId,
      learnerName: learner.fullName,
      date: selectedDate,
      status,
      didStudy,
      nonStudyReason: didStudy ? null : effectiveNonStudyReason,
      topicId: didStudy ? (useCustomTopic ? `custom_${Date.now()}` : activeTopicItem?.topic.id) : null,
      topicTitle: didStudy ? resolvedTopicTitle : null,
      topicDescription: didStudy
        ? useCustomTopic
          ? `Area: ${resolvedAreaTitle}`
          : activeTopicItem?.topic.description
        : null,
      learningAreaId: didStudy
        ? useCustomTopic
          ? 'custom_area'
          : activeTopicItem?.learningArea.id
        : null,
      learningAreaTitle: didStudy ? resolvedAreaTitle : null,
      moduleId: didStudy ? (useCustomTopic ? null : activeTopicItem?.module.id) : null,
      moduleTitle: didStudy ? (useCustomTopic ? 'Self-Logged Session' : activeTopicItem?.module.title) : null,
      understandingLevel: didStudy ? understandingLevel : null,
      reflectionLearned: allowReflections ? reflectionLearned : '',
      reflectionActivity: allowReflections ? reflectionActivity : '',
      reflectionDifficult: allowReflections ? reflectionDifficult : '',
      reflectionTeacherExplain: allowReflections ? reflectionTeacherExplain : '',
    };

    try {
      const res = await fetch('/api/attendance/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(learnerToken ? { Authorization: `Bearer ${learnerToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit daily register');
      }

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Confetti is optional visual polish
      }

      onSuccess(data.register);
    } catch (err: any) {
      setErrorMessage(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-blue-800 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
              <FileCheck className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                {isToday ? 'Daily Digital Register' : `Previous Day Register (${selectedDate})`}
              </h3>
              <p className="text-emerald-100 text-xs">
                Sangurur Comprehensive School • {cohort.name} ({cohort.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Step Progress Tracker */}
        <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4, 5].map((s) => {
              const skipped = !didStudy && (s === 2 || s === 3);
              return (
                <span
                  key={s}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                    skipped
                      ? 'bg-slate-200 text-slate-400 line-through'
                      : step === s
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : step > s
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {s}
                </span>
              );
            })}
          </div>
          <span className="text-emerald-800 font-bold uppercase tracking-wider text-[11px]">
            {step === 1 && 'Section A: Date, Attendance & Study Status'}
            {step === 2 && 'Section B: Area & Topic Learned'}
            {step === 3 && 'Section C: Understanding Level'}
            {step === 4 && 'Section D: Daily Reflection'}
            {step === 5 && 'Section E: Review & Confirm'}
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SECTION A: DATE, ATTENDANCE & STUDY STATUS */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Learner Metadata */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold">Learner</span>
                  <span className="font-bold text-slate-900">{learner.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Digital ID</span>
                  <span className="font-bold font-mono text-slate-900">{learner.learnerId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">Cohort</span>
                  <span className="font-bold text-slate-900">{cohort.name}</span>
                </div>
              </div>

              {/* Register Date Picker (Today or Previous Day) */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-blue-950 uppercase tracking-wider flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-700" />
                    <span>Select Register Date (Today or Previous Day)</span>
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(nairobiToday);
                        setErrorMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        selectedDate === nairobiToday
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      Today ({nairobiToday})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(nairobiYesterday);
                        setErrorMessage(null);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        selectedDate === nairobiYesterday
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      Yesterday ({nairobiYesterday})
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="date"
                    max={nairobiToday}
                    min="2024-01-01"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setErrorMessage(null);
                      }
                    }}
                    className="px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-[11px] text-blue-900 font-medium">
                    {isToday
                      ? 'Submitting today’s attendance register (Africa/Nairobi).'
                      : existingForSelectedDate
                      ? `Updating previous day record (${selectedDate}) — you can log or update what area you learned and your understanding level.`
                      : `Marking missed previous day register (${selectedDate}).`}
                  </span>
                </div>
              </div>

              {/* Attendance & Study Choice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Attendance & Session Study Status *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. PRESENT & STUDIED */}
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('present');
                      setDidStudy(true);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      status === 'present' && didStudy
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm">PRESENT — STUDIED</span>
                      <CheckCircle
                        className={`w-5 h-5 ${
                          status === 'present' && didStudy ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      I attended on time and learned a topic in class.
                    </p>
                  </button>

                  {/* 2. PRESENT & DID NOT STUDY */}
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('present');
                      setDidStudy(false);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      status === 'present' && !didStudy
                        ? 'border-amber-600 bg-amber-50 text-amber-950 ring-2 ring-amber-400'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-amber-900">
                        PRESENT — DID NOT STUDY
                      </span>
                      <ZapOff
                        className={`w-5 h-5 ${
                          status === 'present' && !didStudy ? 'text-amber-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      I was present, but we could not study (e.g., power blackout).
                    </p>
                  </button>

                  {/* 3. LATE & STUDIED */}
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('late');
                      setDidStudy(true);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      status === 'late' && didStudy
                        ? 'border-blue-600 bg-blue-50 text-blue-950 ring-2 ring-blue-400'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-blue-900">LATE — STUDIED</span>
                      <Clock
                        className={`w-5 h-5 ${
                          status === 'late' && didStudy ? 'text-blue-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      I arrived after class started and joined the study session.
                    </p>
                  </button>

                  {/* 4. LATE & DID NOT STUDY */}
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('late');
                      setDidStudy(false);
                    }}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                      status === 'late' && !didStudy
                        ? 'border-orange-600 bg-orange-50 text-orange-950 ring-2 ring-orange-400'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-sm text-orange-900">
                        LATE — DID NOT STUDY
                      </span>
                      <ZapOff
                        className={`w-5 h-5 ${
                          status === 'late' && !didStudy ? 'text-orange-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      I arrived late and no study lesson took place.
                    </p>
                  </button>
                </div>

                {/* NON-STUDY REASONS PANEL */}
                {!didStudy && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div>
                      <span className="block text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                        Reason Why You Did Not Study on {selectedDate} *
                      </span>
                      <p className="text-[11px] text-amber-800">
                        Select the cause so your teacher records why no topic was covered.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {NON_STUDY_REASONS.map((reason) => {
                        const active = selectedReasonChip === reason;
                        return (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => setSelectedReasonChip(reason)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                              active
                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>

                    {selectedReasonChip === 'Other reason' && (
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">
                          Specify Reason *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Projector fault / Lab locked for exams..."
                          value={customReasonText}
                          onChange={(e) => setCustomReasonText(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-600"
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-500 mt-2 italic">
                  * Note: Absent and Excused statuses are officially recorded by your class teacher.
                </p>
              </div>
            </div>
          )}

          {/* SECTION B: AREA LEARNED & CURRICULUM TOPIC */}
          {step === 2 && didStudy && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold">Logging Learning For: </span>
                  <span className="font-extrabold">{selectedDate}</span> •{' '}
                  <span className="font-semibold">
                    {cohort.curriculumSnapshot?.curriculumTitle || cohort.programme}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUseCustomTopic((prev) => !prev)}
                  className="text-[11px] font-bold text-blue-800 hover:underline"
                >
                  {useCustomTopic ? 'Choose from Curriculum / Timetable' : '+ Enter Other Area / Topic'}
                </button>
              </div>

              {useCustomTopic ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Area Learned on {selectedDate} *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Web Technology, Scratch Programming, Computer Fundamentals"
                      value={customAreaTitle}
                      onChange={(e) => setCustomAreaTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Specific Topic Learned on {selectedDate} *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Flexbox Layout Cards / Keyboard Typing Practice"
                      value={customTopicTitle}
                      onChange={(e) => setCustomTopicTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Area Filter / Selector */}
                  {availableAreas.length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        1. Choose Area Learned on {selectedDate}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedAreaFilter('ALL')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            selectedAreaFilter === 'ALL'
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          All Areas ({allTopics.length})
                        </button>
                        {availableAreas.map((area) => (
                          <button
                            key={area}
                            type="button"
                            onClick={() => {
                              setSelectedAreaFilter(area);
                              const firstInArea = allTopics.find(
                                (t) => t.learningArea.title === area
                              );
                              if (firstInArea) setSelectedTopicId(firstInArea.topic.id);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                              selectedAreaFilter === area
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {area}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Topic Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      2. Select Topic Covered on {selectedDate}
                    </label>

                    {filteredTopics.length === 0 ? (
                      <p className="text-xs text-slate-500 p-4 bg-slate-50 rounded-xl">
                        No topics found for this filter. Click "+ Enter Other Area / Topic" above to type what you studied.
                      </p>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                        {activeTimetableWeek &&
                          filteredTopics.some((t) => t.source === 'timetable') && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
                                Scheduled Timetable ({activeTimetableWeek.weekLabel})
                              </div>
                              {filteredTopics
                                .filter((t) => t.source === 'timetable')
                                .map((item) => {
                                  const isSelected = selectedTopicId === item.topic.id;
                                  return (
                                    <div
                                      key={item.topic.id}
                                      onClick={() => setSelectedTopicId(item.topic.id)}
                                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                                          : 'border-slate-200 hover:border-slate-300 bg-white'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-md">
                                            {item.scheduleLabel} • {item.learningArea.title}
                                          </span>
                                          <h4 className="font-bold text-slate-900 text-sm mt-1">
                                            {item.topic.title}
                                          </h4>
                                          <p className="text-xs text-slate-600 mt-1">
                                            {item.topic.description}
                                          </p>
                                        </div>
                                        <div className="shrink-0 ml-3 mt-1">
                                          {isSelected ? (
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                          ) : (
                                            <div className="w-5 h-5 rounded-full border border-slate-300" />
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}

                        {filteredTopics.some((t) => t.source === 'curriculum') && (
                          <div className="space-y-2">
                            {activeTimetableWeek && (
                              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                                Assigned Curriculum Topics
                              </div>
                            )}
                            {filteredTopics
                              .filter((t) => t.source === 'curriculum')
                              .map((item) => {
                                const isSelected = selectedTopicId === item.topic.id;
                                return (
                                  <div
                                    key={item.topic.id}
                                    onClick={() => setSelectedTopicId(item.topic.id)}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                                      isSelected
                                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                          {item.learningArea.title} • {item.module.title}
                                        </span>
                                        <h4 className="font-bold text-slate-900 text-sm mt-1">
                                          {item.topic.title}
                                        </h4>
                                        <p className="text-xs text-slate-600 mt-1">
                                          {item.topic.description}
                                        </p>
                                      </div>
                                      <div className="shrink-0 ml-3 mt-1">
                                        {isSelected ? (
                                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                          <div className="w-5 h-5 rounded-full border border-slate-300" />
                                        )}
                                      </div>
                                    </div>

                                    {isSelected && item.topic.learningObjectives?.length > 0 && (
                                      <div className="mt-2.5 pt-2 border-t border-emerald-200/60 text-xs">
                                        <span className="font-bold text-slate-700">Objectives: </span>
                                        <span className="text-slate-600">
                                          {item.topic.learningObjectives.join(' • ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SECTION C: UNDERSTANDING ASSESSMENT */}
          {step === 3 && didStudy && (
            <div className="space-y-4">
              <div className="text-center">
                <h4 className="text-sm font-extrabold text-slate-900">
                  How well did you understand the lesson on {selectedDate}?
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Area: <strong className="text-emerald-800">{resolvedAreaTitle}</strong> • Topic:{' '}
                  <strong className="text-slate-800">{resolvedTopicTitle || 'Selected lesson'}</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => setUnderstandingLevel('excellent')}
                  className={`p-4 rounded-2xl border-3 text-left transition-all ${
                    understandingLevel === 'excellent'
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500 shadow-sm'
                      : 'border-slate-200 hover:border-emerald-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <Smile className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-black text-emerald-900 text-base block">EXCELLENT</span>
                      <span className="text-[11px] font-bold text-emerald-700">Level 1</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    I understand very well and can teach someone else or do the practical work easily.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUnderstandingLevel('good')}
                  className={`p-4 rounded-2xl border-3 text-left transition-all ${
                    understandingLevel === 'good'
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500 shadow-sm'
                      : 'border-slate-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-black text-blue-900 text-base block">GOOD</span>
                      <span className="text-[11px] font-bold text-blue-700">Level 2</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    I understand the main ideas and can follow the class exercises.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUnderstandingLevel('fair')}
                  className={`p-4 rounded-2xl border-3 text-left transition-all ${
                    understandingLevel === 'fair'
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400 shadow-sm'
                      : 'border-slate-200 hover:border-amber-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                      <Meh className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-black text-amber-900 text-base block">FAIR</span>
                      <span className="text-[11px] font-bold text-amber-700">Level 3</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    I need more practice. Some concepts were a bit confusing for me.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setUnderstandingLevel('needs_support')}
                  className={`p-4 rounded-2xl border-3 text-left transition-all ${
                    understandingLevel === 'needs_support'
                      ? 'border-rose-600 bg-rose-50 ring-2 ring-rose-500 shadow-sm'
                      : 'border-slate-200 hover:border-rose-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                      <Frown className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-black text-rose-900 text-base block">NEEDS SUPPORT</span>
                      <span className="text-[11px] font-bold text-rose-700">
                        Level 4 (Teacher Alert)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 font-medium">
                    I need the teacher’s help and 1-on-1 explanation to understand this topic.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* SECTION D: DAILY REFLECTION */}
          {step === 4 && (
            <div className="space-y-4">
              {!allowReflections ? (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900">
                  <p className="font-bold">Daily Reflections Disabled by School Policy</p>
                  <p className="mt-1 text-amber-800">
                    Your school administrator has disabled learner reflection prompts. Click Continue to review and submit your register.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-700">
                    <span className="font-bold text-slate-900">
                      {didStudy ? 'Personal Reflection: ' : 'Session Note (Optional): '}
                    </span>
                    {didStudy
                      ? 'Share your thoughts to help your teacher support your learning journey.'
                      : `Optionally add any note regarding "${effectiveNonStudyReason}" on ${selectedDate}.`}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {didStudy
                        ? '1. What did you learn?'
                        : '1. Any details on what happened while at school?'}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        didStudy
                          ? 'e.g., I learned how Flexbox aligns navigation bars...'
                          : 'e.g., Power went out at 08:40 AM so we revised notebooks instead...'
                      }
                      value={reflectionLearned}
                      onChange={(e) => setReflectionLearned(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                    />
                  </div>

                  {didStudy && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          2. What activity did you complete?
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g., Created my responsive holiday portfolio page..."
                          value={reflectionActivity}
                          onChange={(e) => setReflectionActivity(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          3. What was difficult?
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g., Positioning cards cleanly on small screens..."
                          value={reflectionDifficult}
                          onChange={(e) => setReflectionDifficult(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          4. What would you like the teacher to explain again?
                        </label>
                        <textarea
                          rows={2}
                          placeholder="e.g., Please demonstrate media queries once more..."
                          value={reflectionTeacherExplain}
                          onChange={(e) => setReflectionTeacherExplain(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* SECTION E: REVIEW & CONFIRM */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                <Sparkles className="w-8 h-8 text-emerald-600 mx-auto mb-1" />
                <h4 className="font-extrabold text-slate-900 text-sm">
                  {existingForSelectedDate && !isToday
                    ? `Confirm Previous Day Update (${selectedDate})`
                    : `Review Your Register (${selectedDate})`}
                </h4>
                <p className="text-xs text-emerald-800">
                  {isToday
                    ? 'Please verify before final submission. Only one entry is allowed per day.'
                    : 'This record will be saved under the selected previous date with full audit logging.'}
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Register Date:</span>
                  <span className="font-bold text-slate-900">{selectedDate} (EAT)</span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Learner:</span>
                  <span className="font-bold text-slate-900">
                    {learner.fullName} ({learner.learnerId})
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Class / Cohort:</span>
                  <span className="font-bold text-slate-900">
                    {cohort.name} ({cohort.code})
                  </span>
                </div>
                <div className="p-3 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Attendance & Study:</span>
                  <span
                    className={`font-black uppercase px-2 py-0.5 rounded-full ${
                      !didStudy
                        ? 'bg-amber-100 text-amber-900'
                        : status === 'present'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {status} {!didStudy ? '— DID NOT STUDY' : '— STUDIED'}
                  </span>
                </div>

                {!didStudy ? (
                  <div className="p-3 flex justify-between items-center bg-amber-50/50">
                    <span className="text-slate-500 font-medium">Reason Did Not Study:</span>
                    <span className="font-bold text-amber-900">{effectiveNonStudyReason}</span>
                  </div>
                ) : (
                  <>
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-slate-500 font-medium flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Area Learned:</span>
                      </span>
                      <span className="font-bold text-emerald-900">{resolvedAreaTitle}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Topic Covered:</span>
                      <span className="font-bold text-slate-900">{resolvedTopicTitle || 'N/A'}</span>
                    </div>
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Understanding Level:</span>
                      <span className="font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                        {understandingLevel.replace('_', ' ')}
                      </span>
                    </div>
                  </>
                )}

                {reflectionLearned && (
                  <div className="p-3">
                    <span className="text-slate-500 font-medium block">Notes / What you learned:</span>
                    <span className="text-slate-800 italic mt-0.5 block">{reflectionLearned}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="py-2 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 text-slate-500 hover:text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
            >
              <span>{step === 1 && !didStudy ? 'Continue to Review' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="py-2.5 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-md"
            >
              <span>
                {submitting
                  ? 'Saving Register...'
                  : existingForSelectedDate && !isToday
                  ? `Update Previous Day (${selectedDate})`
                  : isToday
                  ? 'Submit Today’s Register'
                  : `Submit Register (${selectedDate})`}
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-200" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
