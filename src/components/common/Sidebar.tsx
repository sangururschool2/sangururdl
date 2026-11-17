import React from 'react';
import { SchoolLogo } from './SchoolLogo';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  BookOpen,
  ClipboardCheck,
  TrendingUp,
  BrainCircuit,
  FileSpreadsheet,
  Settings,
  X,
  CalendarDays,
} from 'lucide-react';

export type TeacherTab =
  | 'dashboard'
  | 'cohorts'
  | 'learners'
  | 'curriculum-library'
  | 'curriculum-builder'
  | 'timetable'
  | 'attendance'
  | 'progress'
  | 'understanding'
  | 'reports'
  | 'settings';

interface SidebarProps {
  currentTab: TeacherTab;
  onSelectTab: (tab: TeacherTab) => void;
  pendingReviewsCount?: number;
  supportAlertCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingReviewsCount = 0,
  supportAlertCount = 0,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'dashboard' as TeacherTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Overview & key metrics',
    },
    {
      id: 'cohorts' as TeacherTab,
      label: 'My Cohorts',
      icon: Users,
      description: 'Classes & assignments',
    },
    {
      id: 'learners' as TeacherTab,
      label: 'Learner Management',
      icon: UserPlus,
      description: 'Individual & bulk registration',
    },
    {
      id: 'curriculum-library' as TeacherTab,
      label: 'Curriculum Library & Builder',
      icon: BookOpen,
      description: 'Templates & interactive builder',
    },
    {
      id: 'timetable' as TeacherTab,
      label: 'Weekly Timetable',
      icon: CalendarDays,
      description: 'Nov/Dec holiday & weekly topics',
    },
    {
      id: 'attendance' as TeacherTab,
      label: 'Attendance Register',
      icon: ClipboardCheck,
      description: 'Daily tracking & verification',
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      id: 'progress' as TeacherTab,
      label: 'Learning Progress',
      icon: TrendingUp,
      description: 'Exposure & verified mastery',
    },
    {
      id: 'understanding' as TeacherTab,
      label: 'Understanding Analytics',
      icon: BrainCircuit,
      description: 'Self-ratings & intervention list',
      badge: supportAlertCount > 0 ? supportAlertCount : undefined,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    },
    {
      id: 'reports' as TeacherTab,
      label: 'Reports & Exports',
      icon: FileSpreadsheet,
      description: 'PDF, Excel & CSV dossier',
    },
    {
      id: 'settings' as TeacherTab,
      label: 'Settings',
      icon: Settings,
      description: 'School rules & audit logs',
    },
  ];

  const handleSelect = (tab: TeacherTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-x-0 top-16 bottom-0 z-20 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-16 bottom-0 left-0 z-30 w-64 bg-white border-r border-slate-200 shrink-0 flex flex-col justify-between py-4 overflow-y-auto transform transition-transform duration-200 ease-in-out lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:transform-none ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="px-4 mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Teacher Navigation
            </p>
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <nav className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                currentTab === item.id ||
                (item.id === 'curriculum-library' && currentTab === 'curriculum-builder');

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full border ${
                        isActive ? 'bg-white text-emerald-800' : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Institutional Footer in Sidebar */}
        <div className="px-4 pt-4 border-t border-slate-200 text-xs text-slate-500 flex items-center space-x-2.5">
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
    </>
  );
};
