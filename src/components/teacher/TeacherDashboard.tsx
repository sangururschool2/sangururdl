import React from 'react';
import {
  Cohort,
  Learner,
  DailyRegister,
  EDUCATION_LEVEL_BANDS,
  classifyEducationLevel,
} from '../../types';
import { TeacherTab } from '../common/Sidebar';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  ShieldAlert,
  ClipboardList,
  ArrowUpRight,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  School,
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
} from 'recharts';

interface TeacherDashboardProps {
  cohorts: Cohort[];
  learners: Learner[];
  registers: DailyRegister[];
  onNavigate: (tab: TeacherTab) => void;
  onVerifyRegister: (regId: string) => void;
  onSelectGradeFilter?: (levelFilter: string) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  cohorts,
  learners,
  registers,
  onNavigate,
  onVerifyRegister,
  onSelectGradeFilter,
}) => {
  // Nairobi local date
  const nairobiToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const todayRegisters = registers.filter((r) => r.date === nairobiToday);

  // Key stats
  const totalCohorts = cohorts.length;
  const activeCohorts = cohorts.filter((c) => c.status === 'active').length;
  const totalLearners = learners.length;

  const presentCount = todayRegisters.filter((r) => r.status === 'present').length;
  const lateCount = todayRegisters.filter((r) => r.status === 'late').length;
  const absentCount = todayRegisters.filter((r) => r.status === 'absent').length;
  const excusedCount = todayRegisters.filter((r) => r.status === 'excused').length;

  const uniquePresentOrLateLearners = new Set(
    todayRegisters
      .filter((r) => r.status === 'present' || r.status === 'late')
      .map((r) => r.learnerDocId)
  ).size;

  const pendingReviews = registers.filter((r) => r.verificationStatus === 'pending_verification');
  const learnersRequiringSupport = registers.filter(
    (r) => r.understandingLevel === 'needs_support'
  );

  // Chart data: Attendance Today
  const attendanceChartData = [
    { name: 'Present', count: presentCount, color: '#10b981' },
    { name: 'Late', count: lateCount, color: '#f59e0b' },
    { name: 'Absent', count: absentCount, color: '#ef4444' },
    { name: 'Excused', count: excusedCount, color: '#6366f1' },
  ];

  // Chart data: Understanding Levels across all recent registers
  const understandingCounts = {
    excellent: registers.filter((r) => r.understandingLevel === 'excellent').length,
    good: registers.filter((r) => r.understandingLevel === 'good').length,
    fair: registers.filter((r) => r.understandingLevel === 'fair').length,
    needs_support: registers.filter((r) => r.understandingLevel === 'needs_support').length,
  };

  const understandingChartData = [
    { name: 'Excellent', count: understandingCounts.excellent, color: '#0f766e' },
    { name: 'Good', count: understandingCounts.good, color: '#2563eb' },
    { name: 'Fair', count: understandingCounts.fair, color: '#f59e0b' },
    { name: 'Needs Support', count: understandingCounts.needs_support, color: '#e11d48' },
  ];

  // Learner counts by Grade Tier (Play Group, Lower Primary, Upper Primary, Junior School, Senior School)
  const levelCounts: Record<string, number> = {
    playgroup: 0,
    lower_primary: 0,
    upper_primary: 0,
    junior_school: 0,
    senior_school: 0,
    unspecified: 0,
  };

  learners.forEach((lr) => {
    const primaryCohort = cohorts.find((c) => (lr.assignedCohortIds || []).includes(c.id));
    const tier = classifyEducationLevel(lr.grade, primaryCohort?.learningLevel);
    levelCounts[tier] = (levelCounts[tier] || 0) + 1;
  });

  const bandColors: Record<string, { badge: string; bar: string; border: string; bg: string }> = {
    playgroup: {
      badge: 'bg-pink-100 text-pink-800',
      bar: '#db2777',
      border: 'border-pink-200 hover:border-pink-400',
      bg: 'bg-pink-50/50',
    },
    lower_primary: {
      badge: 'bg-amber-100 text-amber-900',
      bar: '#d97706',
      border: 'border-amber-200 hover:border-amber-400',
      bg: 'bg-amber-50/50',
    },
    upper_primary: {
      badge: 'bg-emerald-100 text-emerald-900',
      bar: '#059669',
      border: 'border-emerald-200 hover:border-emerald-400',
      bg: 'bg-emerald-50/50',
    },
    junior_school: {
      badge: 'bg-blue-100 text-blue-900',
      bar: '#2563eb',
      border: 'border-blue-200 hover:border-blue-400',
      bg: 'bg-blue-50/50',
    },
    senior_school: {
      badge: 'bg-indigo-100 text-indigo-900',
      bar: '#4f46e5',
      border: 'border-indigo-200 hover:border-indigo-400',
      bg: 'bg-indigo-50/50',
    },
  };

  const levelChartData = EDUCATION_LEVEL_BANDS.map((band) => ({
    key: band.key,
    name: band.label,
    shortRange: band.shortRange,
    count: levelCounts[band.key] || 0,
    color: bandColors[band.key].bar,
  }));

  const distinctSchoolsCount = new Set(
    learners.map((l) => (l.schoolName || 'Sangurur Comprehensive School').trim()).filter(Boolean)
  ).size;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Teacher & Administrator Overview
            </span>
            <span className="text-xs text-slate-500 font-medium">Sangurur Comprehensive School</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Academic & Register Operations
          </h1>
          <p className="text-xs text-slate-500">
            Current Local Date: <strong className="text-slate-800">{nairobiToday}</strong> (Africa/Nairobi EAT)
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('cohorts')}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Cohort</span>
          </button>

          <button
            onClick={() => onNavigate('learners')}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Register Learners</span>
          </button>

          <button
            onClick={() => onNavigate('attendance')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Attendance Register</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Reports Dossier</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div
          onClick={() => onNavigate('cohorts')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cohorts</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalCohorts}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">{activeCohorts} Active Classes</p>
        </div>

        <div
          onClick={() => onNavigate('learners')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Learners</span>
            <GraduationCap className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalLearners}</p>
          <p className="text-[11px] text-blue-700 font-medium mt-1">Enrolled Students</p>
        </div>

        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Attendance</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <p className="text-2xl font-black text-emerald-700">{uniquePresentOrLateLearners}</p>
            <span className="text-xs text-slate-400">/ {totalLearners}</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            Unique learners checked in
          </p>
        </div>

        <div
          onClick={() => onNavigate('understanding')}
          className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs hover:border-rose-400 transition cursor-pointer ring-1 ring-rose-100"
        >
          <div className="flex items-center justify-between text-rose-500 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Require Support</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700">{learnersRequiringSupport.length}</p>
          <p className="text-[11px] text-rose-600 font-semibold mt-1">Intervention Alert</p>
        </div>

        <div
          onClick={() => onNavigate('attendance')}
          className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs hover:border-amber-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Reviews</span>
            <ClipboardList className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700">{pendingReviews.length}</p>
          <p className="text-[11px] text-amber-800 font-semibold mt-1">Requires Verification</p>
        </div>
      </div>

      {/* Explicit Daily Attendance Status Strip: Present / Late / Absent / Excused */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-emerald-800 block">Present Today</span>
            <span className="text-xl font-black text-emerald-950">{presentCount}</span>
          </div>
          <UserCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-amber-800 block">Late Today</span>
            <span className="text-xl font-black text-amber-950">{lateCount}</span>
          </div>
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-rose-800 block">Absent Today</span>
            <span className="text-xl font-black text-rose-950">{absentCount}</span>
          </div>
          <UserX className="w-5 h-5 text-rose-600" />
        </div>
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase text-indigo-800 block">Excused Today</span>
            <span className="text-xl font-black text-indigo-950">{excusedCount}</span>
          </div>
          <ShieldAlert className="w-5 h-5 text-indigo-600" />
        </div>
      </div>

      {/* Learners by Grade Level: Play Group, Lower Primary, Upper Primary, Junior School, Senior School */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4 text-emerald-700" />
              <h3 className="font-extrabold text-sm text-slate-900">
                Learners by Grade & Education Level
              </h3>
              {distinctSchoolsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold inline-flex items-center space-x-1">
                  <School className="w-3 h-3 text-emerald-700" />
                  <span>
                    {distinctSchoolsCount} {distinctSchoolsCount === 1 ? 'School' : 'Schools'} Represented
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution across Play Group, Lower Primary, Upper Primary, Junior School, and Senior School — click any level to filter learners.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onSelectGradeFilter) onSelectGradeFilter('all');
              else onNavigate('learners');
            }}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1 self-start sm:self-auto"
          >
            <span>Filter by School & Grade</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {levelChartData.map((tier) => {
            const style = bandColors[tier.key];
            const pct = totalLearners > 0 ? Math.round((tier.count / totalLearners) * 100) : 0;
            return (
              <button
                key={tier.key}
                type="button"
                onClick={() => {
                  if (onSelectGradeFilter) onSelectGradeFilter(`level:${tier.key}`);
                  else onNavigate('learners');
                }}
                className={`text-left p-3.5 rounded-xl border ${style.border} ${style.bg} transition cursor-pointer flex flex-col justify-between space-y-2`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${style.badge}`}>
                    {tier.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{pct}%</span>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900">{tier.count}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{tier.shortRange}</p>
                </div>
              </button>
            );
          })}
        </div>

        {levelCounts.unspecified > 0 && (
          <p className="text-[11px] text-slate-500">
            * {levelCounts.unspecified} learner{levelCounts.unspecified === 1 ? '' : 's'} currently have no specific grade recorded.
          </p>
        )}
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Today's Attendance Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Today's Attendance Status Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Live attendance across cohorts for {nairobiToday}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">Total: {todayRegisters.length}</span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Learners`, 'Count']}
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {attendanceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Cumulative Understanding Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Learner Understanding Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Self-reported ratings on covered curriculum topics
              </p>
            </div>
            <button
              onClick={() => onNavigate('understanding')}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center space-x-1"
            >
              <span>Full Analytics</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={understandingChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Responses`, 'Total']}
                  contentStyle={{ borderRadius: '0.75rem', fontSize: '12px' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {understandingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pending Reviews & Interventions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Verification Submissions */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ClipboardList className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-extrabold text-slate-900">
                Pending Verification ({pendingReviews.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Open Register
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {pendingReviews.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                All learner self-submitted registers have been verified!
              </div>
            ) : (
              pendingReviews.slice(0, 5).map((r) => (
                <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-900">{r.learnerName}</p>
                    <p className="text-[11px] text-slate-500">
                      ID: {r.learnerId} • Cohort: {r.cohortCode} • Date: {r.date}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Topic: {r.topicTitle || 'General Lesson'}
                    </p>
                  </div>
                  <button
                    onClick={() => onVerifyRegister(r.id)}
                    className="py-1 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-lg text-xs transition"
                  >
                    Verify
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Learners Requiring Support Intervention */}
        <div className="bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-rose-200 bg-rose-50/50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-extrabold text-rose-950">
                Support Alert Watchlist ({learnersRequiringSupport.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('understanding')}
              className="text-xs font-bold text-rose-700 hover:underline"
            >
              Intervention Details
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {learnersRequiringSupport.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                No learners currently flagged for urgent support.
              </div>
            ) : (
              learnersRequiringSupport.slice(0, 5).map((r) => (
                <div key={r.id} className="p-3.5 hover:bg-rose-50/30 space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-slate-900">{r.learnerName}</span>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                      Needs Support
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Topic: <strong>{r.topicTitle || 'N/A'}</strong> ({r.date})
                  </p>
                  {r.reflectionDifficult && (
                    <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded-md">
                      "{r.reflectionDifficult}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
