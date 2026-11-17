import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SchoolLogo } from './SchoolLogo';
import { LogOut, Clock, ShieldCheck, UserCheck, Menu } from 'lucide-react';

interface HeaderProps {
  showMenuButton?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ showMenuButton = false, onToggleMobileMenu }) => {
  const { role, teacherProfile, learnerProfile, logout } = useAuth();
  const [nairobiTime, setNairobiTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-KE', {
        timeZone: 'Africa/Nairobi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('en-KE', {
        timeZone: 'Africa/Nairobi',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      setNairobiTime(`${dateStr} • ${timeStr} EAT`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-800 border-b border-emerald-700/80 text-white sticky top-0 z-40 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & School Identity */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            {showMenuButton && onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/15 border border-white/25 shrink-0 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="bg-white p-0.5 rounded-xl border border-white/40 shadow-xs shrink-0">
              <SchoolLogo className="w-10 h-10 sm:w-11 sm:h-11" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-sm sm:text-lg tracking-tight truncate">
                  SANGURUR COMPREHENSIVE SCHOOL
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-bold rounded-full bg-white/15 text-white border border-white/30 shrink-0">
                  SDLR
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-semibold text-emerald-100 uppercase tracking-wider truncate">
                  Motto: Think, Code, Change the World
                </span>
                <span className="text-emerald-200/60 hidden md:inline">•</span>
                <span className="text-emerald-100/90 hidden md:inline">Digital Learner Register</span>
              </div>
            </div>
          </div>

          {/* Time & User Profile / Logout */}
          <div className="flex items-center space-x-4">
            {/* Nairobi local timezone badge */}
            <div className="hidden lg:flex items-center space-x-1.5 text-xs font-medium text-emerald-50 bg-black/20 px-3 py-1.5 rounded-lg border border-white/20">
              <Clock className="w-3.5 h-3.5 text-emerald-200" />
              <span>{nairobiTime || 'Nairobi Time (EAT)'}</span>
            </div>

            {/* User Info */}
            <div className="flex items-center space-x-3 pl-3 border-l border-white/20">
              {role === 'learner' && learnerProfile ? (
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-sm ring-1 ring-white/35">
                    <UserCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-white leading-tight">
                      {learnerProfile.fullName}
                    </p>
                    <p className="text-xs text-emerald-100">
                      ID: {learnerProfile.learnerId} • <span className="font-semibold text-white">Learner</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-sm ring-1 ring-white/35">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-white leading-tight">
                      {teacherProfile?.fullName || 'Staff Teacher'}
                    </p>
                    <p className="text-xs text-emerald-100">
                      {teacherProfile?.role === 'admin' || teacherProfile?.role === 'super_admin' ? (
                        <span className="font-semibold text-amber-200">School Administrator</span>
                      ) : (
                        <span className="font-semibold text-white">Teacher</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Sign out of SDLR"
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-rose-600 hover:border-rose-500 rounded-lg transition-colors border border-white/25"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
