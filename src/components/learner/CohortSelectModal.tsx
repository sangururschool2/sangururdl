import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Cohort } from '../../types';
import { Users, BookOpen, CheckCircle, ArrowRight, AlertCircle, Loader2, X, LogOut } from 'lucide-react';

interface CohortSelectModalProps {
  onSelected: (cohort: Cohort) => void;
  onClose?: () => void;
}

export const CohortSelectModal: React.FC<CohortSelectModalProps> = ({ onSelected, onClose }) => {
  const { learnerProfile, learnerToken, logout } = useAuth();
  const [assignedCohorts, setAssignedCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);

  useEffect(() => {
    async function loadAssigned() {
      if (!learnerProfile || !learnerToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/learner/cohorts', {
          headers: { Authorization: `Bearer ${learnerToken}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Could not load your assigned cohorts.');
        }

        const list: Cohort[] = data.cohorts || [];
        setAssignedCohorts(list);
        if (list.length > 0) {
          const activeFirst = list.find((c) => c.status === 'active') || list[0];
          setSelectedCohort(activeFirst);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading assigned cohorts');
      } finally {
        setLoading(false);
      }
    }
    loadAssigned();
  }, [learnerProfile, learnerToken]);

  const handleConfirm = () => {
    if (selectedCohort) {
      onSelected(selectedCohort);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-800 to-blue-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight">
                Select Your Assigned Cohort
              </h3>
              <p className="text-emerald-100 text-xs">
                Sangurur Digital Learner Register (SDLR)
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Close cohort selector"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div className="text-xs text-slate-600">
            Welcome back, <strong className="text-slate-900">{learnerProfile?.fullName}</strong>. Please confirm the class or cohort you are registering for today:
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Finding your assigned class records...</span>
            </div>
          ) : assignedCohorts.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-xs text-amber-800">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">No assigned cohorts found</p>
                <p className="mt-1">
                  Your account is active, but your teacher has not yet enrolled you into a cohort. Please contact your class teacher so they can assign your class.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {assignedCohorts.map((cohort) => {
                const isSelected = selectedCohort?.id === cohort.id;
                return (
                  <div
                    key={cohort.id}
                    onClick={() => setSelectedCohort(cohort)}
                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {cohort.name}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {cohort.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{cohort.programme} • {cohort.learningLevel}</p>
                      <p className="text-[11px] text-emerald-800 font-medium flex items-center space-x-1">
                        <BookOpen className="w-3 h-3 inline mr-1 text-emerald-600" />
                        <span>Curriculum: {cohort.curriculumSnapshot?.curriculumTitle || 'Standard Curriculum'}</span>
                      </p>
                    </div>

                    <div className="shrink-0 mt-1">
                      {isSelected ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={logout}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="button"
              disabled={!selectedCohort || loading}
              onClick={handleConfirm}
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-sm"
            >
              <span>Confirm & Enter Register</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
