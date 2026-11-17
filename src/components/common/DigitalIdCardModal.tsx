import React from 'react';
import { Learner } from '../../types';
import { SchoolLogo } from './SchoolLogo';
import { generateDigitalIdCardPDF } from '../../services/pdfReportGenerator';
import { X, Printer, ShieldCheck, CheckCircle } from 'lucide-react';

interface DigitalIdCardModalProps {
  learner: Learner;
  cohortName: string;
  onClose: () => void;
}

export const DigitalIdCardModal: React.FC<DigitalIdCardModalProps> = ({
  learner,
  cohortName,
  onClose,
}) => {
  const digitalId = learner.digitalId || learner.learnerId || learner.username;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Top Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Official Digital Learner ID Card</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Digital ID Card"
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable ID Card Visual Preview */}
        <div className="p-6 bg-slate-100/70">
          <div className="bg-white rounded-2xl border-2 border-emerald-800 shadow-md overflow-hidden">
            {/* Top School Band with Unmodified Logo on Clean White Panel */}
            <div className="bg-white border-b-2 border-emerald-700 px-4 py-3 flex items-center space-x-3">
              <SchoolLogo className="w-14 h-14 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-900 tracking-tight leading-tight">
                  SANGURUR COMPREHENSIVE SCHOOL
                </h3>
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  Motto: Think, Code, Change the World
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Sangurur Digital Learner Register (SDLR)
                </p>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Learner Full Name
                  </span>
                  <p className="text-base font-black text-slate-900 leading-snug">
                    {learner.fullName}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] inline-flex items-center space-x-1 shrink-0">
                  <CheckCircle className="w-3 h-3" />
                  <span>{learner.status || 'ACTIVE'}</span>
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider block">
                    Official Digital ID (Username)
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900">
                    {digitalId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Role
                  </span>
                  <span className="text-xs font-bold text-emerald-800">LEARNER</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Assigned Cohort
                  </span>
                  <span className="font-bold text-slate-800">{cohortName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Gender / Age
                  </span>
                  <span className="font-semibold text-slate-700 capitalize">
                    {learner.gender || '—'} {learner.age ? `• ${learner.age} yrs` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Accent Strip */}
            <div className="bg-emerald-800 text-white px-4 py-1.5 flex items-center justify-between text-[10px] font-semibold">
              <span>OFFICIAL STUDENT CREDENTIAL</span>
              <span>EAT (Africa/Nairobi)</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => generateDigitalIdCardPDF(learner, cohortName)}
            className="py-2 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm transition"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Download ID Card (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
