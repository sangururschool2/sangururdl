import React, { useState } from 'react';
import { Cohort, Learner, DailyRegister } from '../../types';
import { sendTeacherFeedback } from '../../services/dataService';
import { generateSupportNeededPDF, generateLearnerUnderstandingPDF } from '../../services/pdfReportGenerator';
import {
  BrainCircuit,
  Smile,
  Meh,
  Frown,
  CheckCircle,
  AlertTriangle,
  Send,
  Printer,
  Sparkles,
  Search,
  MessageSquare,
  X,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface UnderstandingAnalyticsViewProps {
  cohorts: Cohort[];
  learners: Learner[];
  registers: DailyRegister[];
  currentTeacherId: string;
  currentTeacherName: string;
  onRefresh: () => Promise<void>;
}

export const UnderstandingAnalyticsView: React.FC<UnderstandingAnalyticsViewProps> = ({
  cohorts,
  learners,
  registers,
  currentTeacherId,
  currentTeacherName,
  onRefresh,
}) => {
  const [selectedCohortId, setSelectedCohortId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Send Feedback Modal
  const [feedbackModalTarget, setFeedbackModalTarget] = useState<DailyRegister | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<
    'intervention' | 'encouragement' | 'revision' | 'general'
  >('intervention');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  // Filter registers by cohort
  const cohortFiltered = registers.filter(
    (r) => selectedCohortId === 'all' || r.cohortId === selectedCohortId
  );

  // 4 understanding level counters
  const totalRated = cohortFiltered.filter((r) => r.understandingLevel).length;
  const excellentCount = cohortFiltered.filter((r) => r.understandingLevel === 'excellent').length;
  const goodCount = cohortFiltered.filter((r) => r.understandingLevel === 'good').length;
  const fairCount = cohortFiltered.filter((r) => r.understandingLevel === 'fair').length;
  const needsSupportCount = cohortFiltered.filter(
    (r) => r.understandingLevel === 'needs_support'
  ).length;

  // Chart data
  const chartData = [
    { name: 'Excellent', count: excellentCount, color: '#0f766e' },
    { name: 'Good', count: goodCount, color: '#2563eb' },
    { name: 'Fair', count: fairCount, color: '#f59e0b' },
    { name: 'Needs Support', count: needsSupportCount, color: '#e11d48' },
  ];

  // Group by topics to detect bottleneck problem topics
  const topicStatsMap = new Map<
    string,
    {
      title: string;
      total: number;
      needsSupport: number;
      fair: number;
      excellent: number;
    }
  >();

  cohortFiltered.forEach((r) => {
    if (!r.topicTitle) return;
    const existing = topicStatsMap.get(r.topicTitle) || {
      title: r.topicTitle,
      total: 0,
      needsSupport: 0,
      fair: 0,
      excellent: 0,
    };
    existing.total += 1;
    if (r.understandingLevel === 'needs_support') existing.needsSupport += 1;
    if (r.understandingLevel === 'fair') existing.fair += 1;
    if (r.understandingLevel === 'excellent') existing.excellent += 1;
    topicStatsMap.set(r.topicTitle, existing);
  });

  const topicBottlenecks = Array.from(topicStatsMap.values())
    .filter((t) => t.needsSupport > 0 || t.fair > 0)
    .sort((a, b) => b.needsSupport - a.needsSupport);

  // Intervention list: individual learners needing support
  const interventionList = cohortFiltered.filter(
    (r) =>
      r.understandingLevel === 'needs_support' &&
      (r.learnerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.topicTitle && r.topicTitle.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Send Feedback
  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackModalTarget || !feedbackMessage.trim()) return;

    setFeedbackError(null);
    setSendingFeedback(true);
    try {
      await sendTeacherFeedback({
        teacherId: currentTeacherId,
        teacherName: currentTeacherName,
        learnerDocId: feedbackModalTarget.learnerDocId,
        cohortId: feedbackModalTarget.cohortId,
        topicId: feedbackModalTarget.topicId,
        topicTitle: feedbackModalTarget.topicTitle,
        message: feedbackMessage.trim(),
        supportType: feedbackType,
      });

      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setFeedbackModalTarget(null);
        setFeedbackMessage('');
      }, 1500);
    } catch (err: any) {
      setFeedbackError(err.message || 'Error sending feedback');
    } finally {
      setSendingFeedback(false);
    }
  };

  const handleExportSupportPDF = () => {
    const targetCohort = cohorts.find((c) => c.id === selectedCohortId) || {
      name: 'All Cohorts',
      code: 'SCS-ALL',
    } as Cohort;
    generateSupportNeededPDF(cohortFiltered, targetCohort);
  };

  const handleExportUnderstandingPDF = () => {
    const targetCohort = cohorts.find((c) => c.id === selectedCohortId) || {
      name: 'All Cohorts',
      code: 'SCS-ALL',
    } as Cohort;
    generateLearnerUnderstandingPDF(cohortFiltered, targetCohort);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Understanding Analytics & Interventions
            </span>
            <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            Comprehension Analytics & Problem Topic Radar
          </h2>
          <p className="text-xs text-slate-500">
            Identify curriculum bottlenecks where learners struggle and dispatch 1-on-1 pedagogical interventions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportSupportPDF}
            className="py-2 px-3.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-rose-200" />
            <span>Support Watchlist (PDF)</span>
          </button>

          <button
            onClick={handleExportUnderstandingPDF}
            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Understanding Dossier (PDF)</span>
          </button>
        </div>
      </div>

      {/* Cohort Filter Selector */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3 w-full sm:w-80">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
          Filter Cohort:
        </span>
        <select
          value={selectedCohortId}
          onChange={(e) => setSelectedCohortId(e.target.value)}
          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
        >
          <option value="all">All School Cohorts</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {/* 4 COUNTER CARDS (Section 13 requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Excellent */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-black uppercase tracking-wider">1. Excellent</span>
            <Smile className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-900">{excellentCount}</p>
          <p className="text-[11px] text-emerald-700">
            {totalRated > 0 ? Math.round((excellentCount / totalRated) * 100) : 0}% of responses
          </p>
        </div>

        {/* Good */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-black uppercase tracking-wider">2. Good</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-blue-900">{goodCount}</p>
          <p className="text-[11px] text-blue-700">
            {totalRated > 0 ? Math.round((goodCount / totalRated) * 100) : 0}% of responses
          </p>
        </div>

        {/* Fair */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-black uppercase tracking-wider">3. Fair</span>
            <Meh className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-900">{fairCount}</p>
          <p className="text-[11px] text-amber-700">Needs more practical practice</p>
        </div>

        {/* Needs Support Alert */}
        <div className="bg-white p-4 rounded-2xl border-2 border-rose-300 shadow-xs space-y-1 ring-2 ring-rose-100">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-black uppercase tracking-wider">4. Needs Support</span>
            <Frown className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-900">{needsSupportCount}</p>
          <p className="text-[11px] text-rose-700 font-bold">Direct Teacher Help Required</p>
        </div>
      </div>

      {/* Chart and Problem Topics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recharts Understanding Overview */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900">
            Distribution of Self-Rated Understanding
          </h3>
          <p className="text-xs text-slate-500">
            Aggregated across {totalRated} student ratings for selected cohort
          </p>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: any) => [`${v} Ratings`, 'Total']}
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Problem Topics / Bottleneck Identification */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <h3 className="font-extrabold text-sm text-slate-900">
              Curriculum Bottlenecks (Topics Needing Review)
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Lessons where the highest number of students indicated confusion or requested explanation.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {topicBottlenecks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                No topic bottlenecks identified. All learners report good understanding!
              </div>
            ) : (
              topicBottlenecks.map((top, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                >
                  <div className="flex justify-between items-start">
                    <strong className="text-slate-900">{top.title}</strong>
                    <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[10px]">
                      {top.needsSupport} Need Help
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                    <span>Total Submissions: {top.total}</span>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">{top.fair} Fair</span>
                    <span>•</span>
                    <span className="text-emerald-700">{top.excellent} Excellent</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* TEACHER INTERVENTION LIST (Section 13 requirement) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Teacher Intervention Watchlist ({interventionList.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Learners who submitted "NEEDS SUPPORT" ratings and need 1-on-1 assistance or follow-up feedback.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search learner or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
        </div>

        {interventionList.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-bold text-slate-700">No active intervention alerts</p>
            <p>All learners have reported satisfactory comprehension.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-4">Learner</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Topic Stumbled On</th>
                  <th className="py-3 px-4">Reported Difficulty</th>
                  <th className="py-3 px-4">What To Explain</th>
                  <th className="py-3 px-4 text-right">Intervention</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {interventionList.map((r) => (
                  <tr key={r.id} className="hover:bg-rose-50/20">
                    <td className="py-3 px-4">
                      <strong className="text-slate-900 block">{r.learnerName}</strong>
                      <span className="text-[11px] text-slate-500 font-mono">{r.learnerId}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.cohortCode}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{r.date}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{r.topicTitle || '—'}</td>
                    <td className="py-3 px-4 max-w-xs text-rose-700 font-medium">
                      {r.reflectionDifficult || 'Flagged topic as confusing'}
                    </td>
                    <td className="py-3 px-4 max-w-xs text-slate-600">
                      {r.reflectionTeacherExplain || 'Requested teacher clarification'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          setFeedbackModalTarget(r);
                          setFeedbackError(null);
                          setFeedbackMessage(
                            `Hi ${r.learnerName}, I reviewed your reflection on "${r.topicTitle}". Let us do a quick 10-minute recap during the practical session.`
                          );
                          setFeedbackType('intervention');
                        }}
                        className="py-1 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition inline-flex items-center space-x-1 shadow-xs"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send Feedback</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SEND FEEDBACK MODAL */}
      {feedbackModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-700 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-base tracking-tight">
                  Send Teacher Feedback & Guidance
                </h3>
                <p className="text-rose-100 text-xs">
                  Direct message to learner's portal
                </p>
              </div>
              <button
                onClick={() => setFeedbackModalTarget(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendFeedback} className="p-6 space-y-4">
              {feedbackSuccess ? (
                <div className="p-6 text-center text-xs text-emerald-800 space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <p className="font-extrabold text-sm">Feedback Sent to Learner Portal!</p>
                </div>
              ) : (
                <>
                  {feedbackError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                      {feedbackError}
                    </div>
                  )}

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                    <p>
                      <strong>To:</strong> {feedbackModalTarget.learnerName} (
                      {feedbackModalTarget.learnerId})
                    </p>
                    <p>
                      <strong>Topic:</strong> {feedbackModalTarget.topicTitle || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Guidance Type
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value as any)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-600 outline-none"
                    >
                      <option value="intervention">Pedagogical Intervention</option>
                      <option value="revision">Revision Guidance</option>
                      <option value="encouragement">Encouragement</option>
                      <option value="general">General Comment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Teacher Message *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-600 outline-none"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFeedbackModalTarget(null)}
                      className="py-2 px-4 text-xs text-slate-600 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sendingFeedback}
                      className="py-2.5 px-5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingFeedback ? 'Sending...' : 'Send Guidance'}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
