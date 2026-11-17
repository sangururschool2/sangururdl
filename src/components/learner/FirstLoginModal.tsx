import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, ShieldAlert, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FirstLoginModalProps {
  onSuccess: () => void;
}

export const FirstLoginModal: React.FC<FirstLoginModalProps> = ({ onSuccess }) => {
  const { learnerProfile, changeLearnerPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword === '123456789') {
      setError('You cannot use the default initial password (123456789). Please choose a private password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Your new password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please retype carefully.');
      return;
    }

    setSaving(true);
    try {
      await changeLearnerPassword(newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const digitalId = learnerProfile?.digitalId || learnerProfile?.learnerId || learnerProfile?.username;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-emerald-600/30 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-blue-800 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/10 mx-auto flex items-center justify-center mb-2 ring-1 ring-white/20">
            <KeyRound className="w-6 h-6 text-amber-300" />
          </div>
          <h3 className="font-black text-lg tracking-tight">
            Mandatory Security Setup
          </h3>
          <p className="text-emerald-100 text-xs mt-0.5">
            Sangurur Comprehensive School • SDLR
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-1">
            <div className="flex justify-between items-center font-bold">
              <span>Learner: {learnerProfile?.fullName}</span>
              <span className="font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                {digitalId}
              </span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              School policy requires all learners to replace the default password (<code className="font-bold">123456789</code>) with a private password before accessing the digital register.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Create New Private Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="password"
                required
                autoFocus
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Confirm New Private Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="password"
                required
                placeholder="Retype your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 text-sm"
            >
              <span>{saving ? 'Saving Security Credentials...' : 'Save Password & Select Cohort'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-400">
            * The default password (123456789) will become permanently invalid.
          </p>
        </form>
      </div>
    </div>
  );
};
