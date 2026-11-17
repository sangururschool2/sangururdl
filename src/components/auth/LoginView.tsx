import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { SchoolLogo } from '../common/SchoolLogo';
import {
  Lock,
  User,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LoginViewProps {
  onLearnerLoginSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLearnerLoginSuccess }) => {
  const { loginWithGoogle, loginAsTeacher, loginAsLearner, loading } = useAuth();
  const [activePortal, setActivePortal] = useState<'learner' | 'teacher'>('learner');

  // Learner form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Teacher form fields
  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [teacherSubmitting, setTeacherSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleLearnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your Digital ID and password.');
      return;
    }

    setSubmitting(true);
    try {
      await loginAsLearner(username.trim(), password.trim());
      if (onLearnerLoginSuccess) onLearnerLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials or ask your teacher.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teacherSubmitting) return;
    setError(null);
    if (!teacherUsername.trim() || !teacherPassword) {
      setError('Please enter both your teacher username and password.');
      return;
    }

    setTeacherSubmitting(true);
    try {
      await loginAsTeacher(teacherUsername.trim(), teacherPassword);
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Teacher sign-in failed. Please verify your username and password.';
      setError(message);
    } finally {
      setTeacherSubmitting(false);
    }
  };

  const handleGoogleTeacherLogin = async () => {
    if (googleSubmitting) return;
    setError(null);
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Google Sign-In was cancelled or blocked by the browser popup blocker. Please allow popups for this site and try again.';
      setError(message);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="relative h-dvh overflow-hidden bg-slate-950 flex flex-col justify-between">
      {/* Full-bleed Home / Login Page Background Image */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none">
        <img
          src="/assets/aistudio/Bright_Classroom_Coding_Lab_963c31c2.png"
          alt="Sangurur Comprehensive School coding classroom with learners at computers"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" />
      </div>

      {/* Top Banner */}
      <div className="relative z-10 shrink-0 w-full bg-gradient-to-r from-emerald-900/95 via-emerald-800/95 to-teal-800/95 backdrop-blur-md border-b border-emerald-700/70 py-2 px-4 sm:px-6 lg:px-8 shadow-md">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-0.5 rounded-xl border border-white/40 shadow-xs shrink-0">
              <SchoolLogo className="w-9 h-9 sm:w-10 sm:h-10" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-tight">
                SANGURUR COMPREHENSIVE SCHOOL
              </h1>
              <p className="text-[11px] font-semibold text-emerald-100 tracking-wider uppercase">
                Motto: Think, Code, Change the World
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-semibold text-emerald-100">
              Sangurur Digital Learner Register (SDLR)
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3">
        <div className="relative w-full max-w-lg max-h-full flex flex-col rounded-2xl shadow-2xl border border-white/60 overflow-hidden bg-slate-900">
          {/* Login Card Background Image */}
          <div className="absolute inset-0 z-0 pointer-events-none select-none">
            <img
              src="/assets/aistudio/Bright_Classroom_Coding_Lab_963c31c2.png"
              alt="Sangurur Comprehensive School coding lab background"
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* Header Strip */}
          <div className="relative z-10 shrink-0 bg-gradient-to-r from-emerald-900/85 via-emerald-800/85 to-teal-800/80 backdrop-blur-[2px] px-5 pt-3.5 pb-3 text-white text-center border-b border-white/20">
            <div className="inline-flex bg-white p-1.5 rounded-2xl shadow-sm mb-2">
              <SchoolLogo className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight leading-tight">
              SANGURUR DIGITAL LEARNER REGISTER
            </h2>
            <p className="text-emerald-100 text-[11px] sm:text-xs mt-0.5 font-medium">
              Daily Attendance, Curriculum Progress & Understanding Register
            </p>

            {/* Portal Switch Tabs */}
            <div className="mt-3 grid grid-cols-2 p-1 bg-black/20 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActivePortal('learner');
                  setError(null);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  activePortal === 'learner'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Learner Portal</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePortal('teacher');
                  setError(null);
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                  activePortal === 'teacher'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Teacher & Staff</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5 bg-white/80 backdrop-blur-[3px]">
            {error && (
              <div className="mb-3 p-2.5 bg-rose-50/95 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* LEARNER LOGIN FORM */}
            {activePortal === 'learner' && (
              <form onSubmit={handleLearnerSubmit} className="space-y-3">
                <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900">
                  <p className="font-bold flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Welcome to your Daily Register!</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-700">
                    Enter your official Digital ID and password from your printed school access slip.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Digital ID (Username)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SG-LRN-2026-001"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white/95 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white/95 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-700 font-medium mt-1">
                    On first login, you will be prompted to set a private password.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
                >
                  <span>{submitting ? 'Verifying...' : 'Sign In as Learner'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* TEACHER & STAFF PORTAL */}
            {activePortal === 'teacher' && (
              <div className="space-y-2.5">
                <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-900">
                  <p className="font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Sangurur Staff & Administrator Access</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-700">
                    Sign in with your assigned staff credentials to manage cohorts, register learners, verify attendance, and export reports.
                  </p>
                </div>

                <form onSubmit={handleTeacherSubmit} className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        required
                        autoComplete="username"
                        placeholder="e.g. Teacher"
                        value={teacherUsername}
                        onChange={(e) => setTeacherUsername(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white/95 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type={showTeacherPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={teacherPassword}
                        onChange={(e) => setTeacherPassword(e.target.value)}
                        className="w-full pl-9 pr-10 py-2 bg-white/95 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTeacherPassword((prev) => !prev)}
                        aria-label={showTeacherPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={teacherSubmitting || googleSubmitting}
                    className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
                  >
                    <span>{teacherSubmitting ? 'Signing In...' : 'Sign In as Teacher'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="relative flex items-center py-0.5">
                  <div className="flex-grow border-t border-slate-300/80" />
                  <span className="shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Or
                  </span>
                  <div className="flex-grow border-t border-slate-300/80" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleTeacherLogin}
                  disabled={loading || googleSubmitting || teacherSubmitting}
                  className="w-full py-2 px-4 bg-white/95 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed border border-slate-300 text-slate-800 font-semibold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 text-xs"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{googleSubmitting ? 'Completing Google Sign-In...' : 'Sign In with Google Staff Account'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="relative z-10 shrink-0 bg-white/85 backdrop-blur-xs px-5 py-2 border-t border-slate-200/80 text-center text-[11px] text-slate-700">
            <span>Sangurur Comprehensive School • Kenya • </span>
            <span className="font-bold text-emerald-800">Think, Code, Change the World</span>
          </div>
        </div>
      </div>

      {/* Page Footer */}
      <footer className="relative z-10 shrink-0 text-center py-2 text-[11px] text-slate-200 border-t border-white/15 bg-slate-950/65 backdrop-blur-md">
        © 2026 Sangurur Comprehensive School • SDLR System v2.6.4 • Secure Education Records
      </footer>
    </div>
  );
};
