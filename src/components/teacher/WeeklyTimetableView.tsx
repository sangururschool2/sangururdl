import React, { useState, useEffect, useMemo } from 'react';
import {
  Cohort,
  DailyRegister,
  WeeklyTimetableEntry,
  TimetableTopicSlot,
  TimetableDayOfWeek,
} from '../../types';
import {
  getWeeklyTimetable,
  createWeeklyTimetableEntry,
  updateWeeklyTimetableEntry,
  deleteWeeklyTimetableEntry,
  seedNovDecHolidayTimetable,
  getNairobiTodayYmd,
} from '../../services/dataService';
import { generateWeeklyTimetablePDF } from '../../services/pdfReportGenerator';
import { exportWeeklyTimetableToExcel } from '../../services/excelService';
import {
  CalendarDays,
  Plus,
  Sparkles,
  FileDown,
  FileSpreadsheet,
  Edit3,
  Trash2,
  Clock,
  BookOpen,
  User,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
  Layers,
  Calendar,
} from 'lucide-react';

interface WeeklyTimetableViewProps {
  cohorts: Cohort[];
  currentTeacherName: string;
  fixedCohortId?: string;
  embedded?: boolean;
  registers?: DailyRegister[];
}

const DAYS_OF_WEEK: TimetableDayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const PROGRAMME_TERMS = [
  'Nov/Dec Holiday 2026',
  'April Holiday 2026',
  'August Holiday 2026',
  'Term 1 2026',
  'Term 2 2026',
  'Term 3 2026',
];

export const WeeklyTimetableView: React.FC<WeeklyTimetableViewProps> = ({
  cohorts,
  currentTeacherName,
  fixedCohortId,
  embedded = false,
  registers = [],
}) => {
  const [selectedCohortId, setSelectedCohortId] = useState<string>(
    fixedCohortId || cohorts[0]?.id || ''
  );
  const [termFilter, setTermFilter] = useState<string>('ALL');
  const [entries, setEntries] = useState<WeeklyTimetableEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [seeding, setSeeding] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add / Edit Week Modal State
  const [showWeekModal, setShowWeekModal] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<WeeklyTimetableEntry | null>(null);
  const [formTerm, setFormTerm] = useState<string>('Nov/Dec Holiday 2026');
  const [formCustomTerm, setFormCustomTerm] = useState<string>('');
  const [formWeekNumber, setFormWeekNumber] = useState<number>(1);
  const [formWeekLabel, setFormWeekLabel] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('2026-11-16');
  const [formEndDate, setFormEndDate] = useState<string>('2026-11-20');
  const [formTheme, setFormTheme] = useState<string>('');
  const [formTopics, setFormTopics] = useState<TimetableTopicSlot[]>([]);
  const [savingWeek, setSavingWeek] = useState<boolean>(false);

  // Curriculum Quick-Pick Drawer State inside modal
  const [quickPickDay, setQuickPickDay] = useState<TimetableDayOfWeek>('Monday');
  const [quickPickTime, setQuickPickTime] = useState<string>('08:30 - 10:00');

  // Delete confirmation modal
  const [entryToDelete, setEntryToDelete] = useState<WeeklyTimetableEntry | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const nairobiToday = getNairobiTodayYmd();

  useEffect(() => {
    if (fixedCohortId) {
      setSelectedCohortId(fixedCohortId);
    } else if (cohorts.length > 0 && !cohorts.some((c) => c.id === selectedCohortId)) {
      setSelectedCohortId(cohorts[0].id);
    }
  }, [fixedCohortId, cohorts, selectedCohortId]);

  const selectedCohort = useMemo(
    () => cohorts.find((c) => c.id === selectedCohortId) || cohorts[0],
    [cohorts, selectedCohortId]
  );

  // Flatten cohort curriculum topics for quick insertion
  const cohortCurriculumTopics = useMemo(() => {
    const list: Array<{ id: string; title: string; learningArea: string; activity: string }> = [];
    const areas = selectedCohort?.curriculumSnapshot?.learningAreas || [];
    areas.forEach((la) => {
      la.modules.forEach((mod) => {
        mod.topics.forEach((top) => {
          list.push({
            id: top.id,
            title: top.title,
            learningArea: la.title,
            activity: top.practicalActivities || '',
          });
        });
      });
    });
    return list;
  }, [selectedCohort]);

  const loadTimetable = async (cohort: Cohort | undefined, autoSeedIfEmpty = true) => {
    if (!cohort) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let data = await getWeeklyTimetable(cohort.id);
      if (data.length === 0 && autoSeedIfEmpty) {
        data = await seedNovDecHolidayTimetable(cohort, currentTeacherName, 'Nov/Dec Holiday 2026');
        setStatusBanner(
          `Loaded the 6-week Nov/Dec Holiday 2026 timetable template for ${cohort.name}. You can edit any week or add custom terms below.`
        );
      }
      setEntries(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load weekly timetable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCohort) {
      loadTimetable(selectedCohort, true);
    }
  }, [selectedCohort?.id]);

  const availableTerms = useMemo(() => {
    const terms = new Set<string>(entries.map((e) => e.programmeTerm).filter(Boolean));
    return Array.from(terms);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (termFilter === 'ALL') return entries;
    return entries.filter((e) => e.programmeTerm === termFilter);
  }, [entries, termFilter]);

  const activeWeekEntry = useMemo(() => {
    return entries.find((e) => e.startDate <= nairobiToday && nairobiToday <= e.endDate) || null;
  }, [entries, nairobiToday]);

  // Compute distinct topics actually logged/taught during each week's date range for this cohort
  const taughtByWeekMap = useMemo(() => {
    const map: Record<
      string,
      Array<{ topicTitle: string; learningArea: string; learnersCount: number; lastDate: string }>
    > = {};
    if (!selectedCohort) return map;
    const cohortRegs = registers.filter(
      (r) => r.cohortId === selectedCohort.id && r.didStudy !== false && Boolean(r.topicTitle?.trim())
    );
    entries.forEach((entry) => {
      const grouped = new Map<
        string,
        { topicTitle: string; learningArea: string; learnerIds: Set<string>; lastDate: string }
      >();
      cohortRegs.forEach((r) => {
        if (r.date >= entry.startDate && r.date <= entry.endDate) {
          const title = (r.topicTitle || '').trim();
          const area = (r.learningAreaTitle || '').trim() || 'Class Session';
          const key = `${area}::${title}`.toLowerCase();
          const cur = grouped.get(key) || {
            topicTitle: title,
            learningArea: area,
            learnerIds: new Set<string>(),
            lastDate: r.date,
          };
          cur.learnerIds.add(r.learnerDocId);
          if (r.date > cur.lastDate) cur.lastDate = r.date;
          grouped.set(key, cur);
        }
      });
      map[entry.id] = Array.from(grouped.values()).map((g) => ({
        topicTitle: g.topicTitle,
        learningArea: g.learningArea,
        learnersCount: g.learnerIds.size,
        lastDate: g.lastDate,
      }));
    });
    return map;
  }, [entries, registers, selectedCohort]);

  const handleLoadNovDecTemplate = async () => {
    if (!selectedCohort) return;
    setSeeding(true);
    setErrorMsg(null);
    try {
      const updated = await seedNovDecHolidayTimetable(
        selectedCohort,
        currentTeacherName,
        'Nov/Dec Holiday 2026'
      );
      setEntries(updated);
      setTermFilter('Nov/Dec Holiday 2026');
      setStatusBanner(
        `Nov/Dec Holiday 2026 weekly schedule synchronized for ${selectedCohort.name} (Weeks 1–6).`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to seed Nov/Dec Holiday timetable.');
    } finally {
      setSeeding(false);
    }
  };

  const openAddWeekModal = () => {
    const nextWeekNum =
      entries.length > 0 ? Math.max(...entries.map((e) => e.weekNumber || 0)) + 1 : 1;
    setEditingEntry(null);
    setFormTerm(termFilter !== 'ALL' ? termFilter : 'Nov/Dec Holiday 2026');
    setFormCustomTerm('');
    setFormWeekNumber(nextWeekNum);
    setFormWeekLabel(`Week ${nextWeekNum}: `);
    setFormStartDate(nairobiToday);
    setFormEndDate(nairobiToday);
    setFormTheme('');
    setFormTopics([
      {
        id: `slot_${Date.now()}_1`,
        dayOfWeek: 'Monday',
        timeSlot: '08:30 - 10:00',
        topicTitle: '',
        learningArea: selectedCohort?.programme || 'Computing',
        facilitator: currentTeacherName,
        practicalActivity: '',
      },
    ]);
    setShowWeekModal(true);
  };

  const openEditWeekModal = (entry: WeeklyTimetableEntry) => {
    setEditingEntry(entry);
    if (PROGRAMME_TERMS.includes(entry.programmeTerm)) {
      setFormTerm(entry.programmeTerm);
      setFormCustomTerm('');
    } else {
      setFormTerm('CUSTOM');
      setFormCustomTerm(entry.programmeTerm);
    }
    setFormWeekNumber(entry.weekNumber);
    setFormWeekLabel(entry.weekLabel);
    setFormStartDate(entry.startDate);
    setFormEndDate(entry.endDate);
    setFormTheme(entry.weeklyTheme || '');
    setFormTopics(entry.topics && entry.topics.length > 0 ? entry.topics.map((t) => ({ ...t })) : []);
    setShowWeekModal(true);
  };

  const addEmptyTopicSlot = () => {
    const nextDay = DAYS_OF_WEEK[formTopics.length % 5];
    setFormTopics((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dayOfWeek: nextDay,
        timeSlot: '08:30 - 10:00',
        topicTitle: '',
        learningArea: selectedCohort?.programme || 'Computing',
        facilitator: currentTeacherName,
        practicalActivity: '',
      },
    ]);
  };

  const addCurriculumTopicSlot = (topic: {
    id: string;
    title: string;
    learningArea: string;
    activity: string;
  }) => {
    setFormTopics((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dayOfWeek: quickPickDay,
        timeSlot: quickPickTime,
        topicTitle: topic.title,
        learningArea: topic.learningArea,
        facilitator: currentTeacherName,
        practicalActivity: topic.activity,
        curriculumTopicId: topic.id,
      },
    ]);
  };

  const updateTopicField = (
    idx: number,
    field: keyof TimetableTopicSlot,
    value: string
  ) => {
    setFormTopics((prev) =>
      prev.map((slot, i) => (i === idx ? { ...slot, [field]: value } : slot))
    );
  };

  const removeTopicSlot = (idx: number) => {
    setFormTopics((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveWeek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCohort) return;
    const effectiveTerm = formTerm === 'CUSTOM' ? formCustomTerm.trim() : formTerm;
    if (!effectiveTerm) {
      setErrorMsg('Please specify a programme / term name.');
      return;
    }
    const cleanTopics = formTopics.filter((t) => t.topicTitle.trim().length > 0);
    if (cleanTopics.length === 0) {
      setErrorMsg('Please add at least one topic slot for this week.');
      return;
    }

    setSavingWeek(true);
    setErrorMsg(null);
    try {
      const payload = {
        cohortId: selectedCohort.id,
        cohortCode: selectedCohort.code,
        programmeTerm: effectiveTerm.slice(0, 128),
        weekNumber: Number(formWeekNumber) || 1,
        weekLabel: formWeekLabel.trim().slice(0, 128) || `Week ${formWeekNumber}`,
        startDate: formStartDate,
        endDate: formEndDate,
        weeklyTheme: formTheme.trim().slice(0, 256),
        topics: cleanTopics,
        createdBy: currentTeacherName,
      };

      if (editingEntry) {
        await updateWeeklyTimetableEntry(editingEntry.id, payload);
        setStatusBanner(`Updated ${payload.weekLabel} (${payload.programmeTerm}).`);
      } else {
        await createWeeklyTimetableEntry(payload);
        setStatusBanner(`Added ${payload.weekLabel} to ${payload.programmeTerm}.`);
      }
      setShowWeekModal(false);
      await loadTimetable(selectedCohort, false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save weekly timetable.');
    } finally {
      setSavingWeek(false);
    }
  };

  const confirmDeleteWeek = async () => {
    if (!entryToDelete || !selectedCohort) return;
    setDeleting(true);
    try {
      await deleteWeeklyTimetableEntry(entryToDelete.id);
      setStatusBanner(`Deleted ${entryToDelete.weekLabel}.`);
      setEntryToDelete(null);
      await loadTimetable(selectedCohort, false);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete week entry.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedCohort) return;
    const label = termFilter === 'ALL' ? 'All Scheduled Terms' : termFilter;
    await generateWeeklyTimetablePDF(filteredEntries, selectedCohort, label);
  };

  const handleExportExcel = async () => {
    if (!selectedCohort) return;
    const label = termFilter === 'ALL' ? 'All Scheduled Terms' : termFilter;
    await exportWeeklyTimetableToExcel(filteredEntries, selectedCohort, label);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Primary Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h2 className={`${embedded ? 'text-base' : 'text-xl'} font-extrabold text-slate-900 tracking-tight flex items-center space-x-2`}>
            <CalendarDays className={`${embedded ? 'w-5 h-5' : 'w-6 h-6'} text-emerald-700`} />
            <span>
              {embedded && selectedCohort
                ? `Weekly Timetable & What Is Taught — ${selectedCohort.name}`
                : 'Weekly Programme Timetable'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize weekly schedules such as the Nov/Dec Holiday Bootcamp with distinct topics every week and view what has been taught during each week.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadNovDecTemplate}
            disabled={seeding || !selectedCohort}
            className="py-2 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>{seeding ? 'Syncing...' : 'Load Nov/Dec Holiday Weekly Template'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredEntries.length === 0 || !selectedCohort}
            className="py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredEntries.length === 0 || !selectedCohort}
            className="py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={openAddWeekModal}
            disabled={!selectedCohort}
            className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Week</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 ${embedded ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 items-end`}>
        {!embedded && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Select Cohort / Class
            </label>
            <select
              value={selectedCohort?.id || ''}
              onChange={(e) => setSelectedCohortId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Programme / Term Filter
          </label>
          <select
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">All Programmes & Terms ({entries.length} Weeks)</option>
            {availableTerms.map((term) => (
              <option key={term} value={term}>
                {term}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Today (EAT)</span>
            <span className="font-extrabold text-slate-900">{nairobiToday}</span>
          </div>
          <div className="h-7 w-px bg-slate-200" />
          <div>
            <span className="text-slate-500 block text-[10px] font-bold uppercase">Active Week</span>
            <span className="font-extrabold text-emerald-700">
              {activeWeekEntry ? `Week ${activeWeekEntry.weekNumber}` : 'None matching today'}
            </span>
          </div>
        </div>
      </div>

      {/* Banners */}
      {statusBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-700 hover:text-emerald-950"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Current Week Highlight */}
      {activeWeekEntry && (
        <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-blue-800 rounded-2xl p-5 text-white shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                <Clock className="w-3 h-3" />
                <span>ACTIVE THIS WEEK • {activeWeekEntry.programmeTerm}</span>
              </span>
              <h3 className="text-lg font-black mt-1.5">{activeWeekEntry.weekLabel}</h3>
              <p className="text-xs text-emerald-100">
                {activeWeekEntry.startDate} to {activeWeekEntry.endDate} — {activeWeekEntry.weeklyTheme}
              </p>
            </div>
            <div className="text-xs bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 shrink-0">
              <span className="block text-[10px] text-emerald-200 font-bold uppercase">Topics Scheduled</span>
              <span className="text-base font-black">{activeWeekEntry.topics?.length || 0} Sessions</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {(activeWeekEntry.topics || []).map((slot) => (
              <div
                key={slot.id}
                className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-amber-300 uppercase">
                  <span>{slot.dayOfWeek}</span>
                  <span>{slot.timeSlot}</span>
                </div>
                <p className="font-bold text-white leading-snug">{slot.topicTitle}</p>
                <p className="text-[11px] text-emerald-100">{slot.learningArea}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Weekly Breakdown Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-700" />
          <span className="text-xs font-semibold">Loading weekly timetable schedules...</span>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-slate-800">No Weekly Timetable Entries Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Load the 6-week Nov/Dec Holiday Bootcamp schedule or click "Add Week" to organize different topics week by week.
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleLoadNovDecTemplate}
              className="py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs"
            >
              Load Nov/Dec Holiday Template
            </button>
            <button
              type="button"
              onClick={openAddWeekModal}
              className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs"
            >
              Create Custom Week
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredEntries.map((entry) => {
            const isCurrentWeek = entry.startDate <= nairobiToday && nairobiToday <= entry.endDate;
            return (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition ${
                  isCurrentWeek ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
                }`}
              >
                {/* Week Header */}
                <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-black uppercase">
                        Week {entry.weekNumber}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                        {entry.programmeTerm}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-semibold">
                        {entry.startDate} to {entry.endDate}
                      </span>
                      {isCurrentWeek && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                          Current Active Week
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">{entry.weekLabel}</h3>
                    {entry.weeklyTheme && (
                      <p className="text-xs text-slate-600">{entry.weeklyTheme}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditWeekModal(entry)}
                      className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center space-x-1 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit Week</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryToDelete(entry)}
                      className="py-1.5 px-3 bg-white hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center space-x-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Week Topics Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-4 w-28">Day</th>
                        <th className="py-2.5 px-4 w-32">Time Slot</th>
                        <th className="py-2.5 px-4">Scheduled Topic</th>
                        <th className="py-2.5 px-4 w-44">Learning Area</th>
                        <th className="py-2.5 px-4">Practical Activity</th>
                        <th className="py-2.5 px-4 w-40">Facilitator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(entry.topics || []).map((slot) => (
                        <tr key={slot.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-extrabold text-slate-900 whitespace-nowrap">
                            {slot.dayOfWeek}
                          </td>
                          <td className="py-3 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                            {slot.timeSlot}
                          </td>
                          <td className="py-3 px-4 font-bold text-emerald-900">
                            {slot.topicTitle}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                              {slot.learningArea || 'Computing'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {slot.practicalActivity || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                            <span className="inline-flex items-center space-x-1">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>{slot.facilitator || currentTeacherName}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* What Is Taught During This Week (Daily Register Summary) */}
                <div className="px-4 py-3 bg-emerald-50/50 border-t border-slate-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                      <span>
                        What Was Taught During Week {entry.weekNumber} ({entry.startDate} to {entry.endDate})
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {entry.topics?.length || 0} Planned • {(taughtByWeekMap[entry.id] || []).length} Logged in Registers
                    </span>
                  </div>
                  {(taughtByWeekMap[entry.id] || []).length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No learner daily register topic logs recorded for this week's date window yet — the {(entry.topics || []).length} scheduled topic(s) above define this week's teaching plan.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(taughtByWeekMap[entry.id] || []).map((t, tIdx) => (
                        <span
                          key={`${entry.id}_taught_${tIdx}`}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] text-slate-800 shadow-2xs"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <strong className="text-emerald-900">{t.topicTitle}</strong>
                          <span className="text-slate-400">({t.learningArea})</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            {t.learnersCount} learner{t.learnersCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Week Modal */}
      {showWeekModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-emerald-800 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-extrabold text-base">
                    {editingEntry ? `Edit ${editingEntry.weekLabel}` : 'Add Weekly Timetable Schedule'}
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Cohort: {selectedCohort?.name} ({selectedCohort?.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWeekModal(false)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWeek} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Programme / Holiday Term *
                  </label>
                  <select
                    value={formTerm}
                    onChange={(e) => setFormTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {PROGRAMME_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="CUSTOM">Custom Term Name...</option>
                  </select>
                  {formTerm === 'CUSTOM' && (
                    <input
                      type="text"
                      required
                      placeholder="e.g., Dec Coding Bootcamp"
                      value={formCustomTerm}
                      onChange={(e) => setFormCustomTerm(e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Week Number *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    required
                    value={formWeekNumber}
                    onChange={(e) => setFormWeekNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Week Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Week End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Week Title / Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Week 3: Web Design Mastery — HTML5 & CSS"
                    value={formWeekLabel}
                    onChange={(e) => setFormWeekLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Weekly Focus / Learning Theme
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Building responsive multi-page school club sites"
                    value={formTheme}
                    onChange={(e) => setFormTheme(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Curriculum Topic Quick-Insert */}
              {cohortCurriculumTopics.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-950 flex items-center space-x-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-700" />
                      <span>Quick-Insert from Assigned Curriculum ({selectedCohort?.curriculumSnapshot?.curriculumTitle}):</span>
                    </span>
                    <div className="flex items-center space-x-2 text-xs">
                      <select
                        value={quickPickDay}
                        onChange={(e) => setQuickPickDay(e.target.value as TimetableDayOfWeek)}
                        className="px-2 py-1 border border-blue-200 rounded-lg bg-white text-xs font-semibold"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={quickPickTime}
                        onChange={(e) => setQuickPickTime(e.target.value)}
                        className="w-28 px-2 py-1 border border-blue-200 rounded-lg bg-white text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {cohortCurriculumTopics.map((ct) => (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => addCurriculumTopicSlot(ct)}
                        className="text-[11px] bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3 text-blue-600" />
                        <span>{ct.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Topic Slots List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Daily Topics for Week {formWeekNumber} ({formTopics.length})</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addEmptyTopicSlot}
                    className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Topic Slot</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formTopics.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Day</label>
                          <select
                            value={slot.dayOfWeek}
                            onChange={(e) => updateTopicField(idx, 'dayOfWeek', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                          >
                            {DAYS_OF_WEEK.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Time</label>
                          <input
                            type="text"
                            value={slot.timeSlot}
                            onChange={(e) => updateTopicField(idx, 'timeSlot', e.target.value)}
                            placeholder="08:30 - 10:00"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-mono"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Topic Title *</label>
                          <input
                            type="text"
                            required
                            value={slot.topicTitle}
                            onChange={(e) => updateTopicField(idx, 'topicTitle', e.target.value)}
                            placeholder="e.g., Conditional Branching: if, elif, else"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Learning Area</label>
                          <input
                            type="text"
                            value={slot.learningArea}
                            onChange={(e) => updateTopicField(idx, 'learningArea', e.target.value)}
                            placeholder="e.g., Python"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end pt-4">
                          <button
                            type="button"
                            onClick={() => removeTopicSlot(idx)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg"
                            title="Remove topic slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                            Practical Activity / Lab Exercise
                          </label>
                          <input
                            type="text"
                            value={slot.practicalActivity || ''}
                            onChange={(e) => updateTopicField(idx, 'practicalActivity', e.target.value)}
                            placeholder="e.g., Build a grade calculator program"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                            Facilitator
                          </label>
                          <input
                            type="text"
                            value={slot.facilitator || ''}
                            onChange={(e) => updateTopicField(idx, 'facilitator', e.target.value)}
                            placeholder={currentTeacherName}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowWeekModal(false)}
                  className="py-2 px-4 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingWeek}
                  className="py-2.5 px-6 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-sm"
                >
                  {savingWeek ? 'Saving Week...' : editingEntry ? 'Update Week Schedule' : 'Save Week Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-700">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Delete Week Entry?</h3>
                <p className="text-xs text-slate-500">
                  Remove {entryToDelete.weekLabel} ({entryToDelete.programmeTerm}) from the timetable?
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                className="py-2 px-4 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteWeek}
                className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
              >
                {deleting ? 'Deleting...' : 'Delete Week'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
