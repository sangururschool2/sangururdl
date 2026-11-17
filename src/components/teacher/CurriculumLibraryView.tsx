import React, { useState, useEffect } from 'react';
import { Curriculum } from '../../types';
import { CurriculumBuilderView } from './CurriculumBuilderView';
import {
  BookOpen,
  Copy,
  Eye,
  Sparkles,
  X,
  GitBranch,
  Plus,
  ArrowLeft,
} from 'lucide-react';

interface CurriculumLibraryViewProps {
  curricula: Curriculum[];
  currentTeacherName: string;
  onSaved: () => Promise<void>;
  initialMode?: 'library' | 'builder';
  initialBuilderCurriculum?: Curriculum | null;
}

export const CurriculumLibraryView: React.FC<CurriculumLibraryViewProps> = ({
  curricula,
  currentTeacherName,
  onSaved,
  initialMode = 'library',
  initialBuilderCurriculum = null,
}) => {
  const [activeSubView, setActiveSubView] = useState<'library' | 'builder'>(initialMode);
  const [builderTarget, setBuilderTarget] = useState<Curriculum | null>(initialBuilderCurriculum);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [previewCurriculum, setPreviewCurriculum] = useState<Curriculum | null>(null);

  useEffect(() => {
    setActiveSubView(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (initialBuilderCurriculum) {
      setBuilderTarget(initialBuilderCurriculum);
      setActiveSubView('builder');
    }
  }, [initialBuilderCurriculum]);

  const openInBuilder = (curriculum: Curriculum | null) => {
    setBuilderTarget(curriculum);
    setActiveSubView('builder');
  };

  const categories = ['All', ...Array.from(new Set(curricula.map((c) => c.category)))];

  const filtered = curricula.filter(
    (c) => selectedCategory === 'All' || c.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      {/* Top Banner with Embedded Library <-> Builder Switcher */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Curriculum Library & Builder
            </span>
            <span className="text-xs text-slate-500 font-medium">Sangurur Academic Board</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            {activeSubView === 'builder'
              ? 'Curriculum Builder & Designer'
              : 'Curriculum Templates & Learning Blueprints'}
          </h2>
          <p className="text-xs text-slate-500">
            Browse verified curricula or create & customize structured Learning Areas, Modules, and Topics right inside the Curriculum Library.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveSubView('library')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                activeSubView === 'library'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Library ({curricula.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('builder')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                activeSubView === 'builder'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Curriculum Builder</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openInBuilder(null)}
            className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Build New Curriculum</span>
          </button>
        </div>
      </div>

      {activeSubView === 'builder' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setActiveSubView('library')}
              className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Curriculum Templates Library</span>
            </button>
            <span className="text-emerald-700 font-semibold">
              {builderTarget ? `Customizing: ${builderTarget.title}` : 'Creating New Curriculum Blueprint'}
            </span>
          </div>

          <CurriculumBuilderView
            initialCurriculum={builderTarget}
            currentTeacherName={currentTeacherName}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition ${
                    selectedCategory === cat
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs text-emerald-900 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{curricula.length} Curricula Available</span>
            </div>
          </div>

      {/* Curricula Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((curr) => {
          const totalTopics = curr.learningAreas.reduce(
            (acc, la) => acc + la.modules.reduce((mAcc, mod) => mAcc + mod.topics.length, 0),
            0
          );
          const totalAreas = curr.learningAreas.length;

          return (
            <div
              key={curr.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition flex flex-col justify-between p-5 space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-slate-100 text-slate-700">
                    {curr.category}
                  </span>
                  {curr.isTemplate ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Official Template
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Custom Curriculum
                    </span>
                  )}
                </div>

                <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                  {curr.title}
                </h3>
                <p className="text-xs text-slate-600 line-clamp-3">{curr.description}</p>

                <div className="pt-2 text-xs space-y-1 text-slate-500">
                  <div className="flex justify-between">
                    <span>Level:</span>
                    <strong className="text-slate-800">{curr.level}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Structure:</span>
                    <strong className="text-emerald-700">
                      {totalAreas} Learning Areas • {totalTopics} Topics
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Author:</span>
                    <span className="text-slate-600 truncate max-w-[140px]">{curr.createdBy}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setPreviewCurriculum(curr)}
                  className="py-1.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs flex items-center space-x-1 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => openInBuilder(curr)}
                  className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center space-x-1 transition shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Customize in Builder</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {/* CURRICULUM PREVIEW MODAL */}
      {previewCurriculum && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col">
            <div className="bg-emerald-800 p-5 text-white flex justify-between items-center">
              <div>
                <span className="px-2 py-0.5 bg-white/20 text-[10px] font-bold uppercase rounded-md">
                  {previewCurriculum.category}
                </span>
                <h3 className="font-extrabold text-base tracking-tight mt-1">
                  {previewCurriculum.title}
                </h3>
                <p className="text-emerald-100 text-xs">
                  {previewCurriculum.level} • Sangurur Comprehensive School
                </p>
              </div>
              <button
                onClick={() => setPreviewCurriculum(null)}
                className="text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 overflow-y-auto text-xs">
              <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {previewCurriculum.description}
              </p>

              <div className="space-y-4">
                <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-xs">
                  Curriculum Learning Areas & Modules:
                </h4>

                {previewCurriculum.learningAreas.map((area, aIdx) => (
                  <div key={area.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-[10px]">
                        {aIdx + 1}
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm">{area.title}</h5>
                    </div>
                    <p className="text-slate-500 pl-7">{area.description}</p>

                    <div className="pl-7 space-y-3 pt-2">
                      {area.modules.map((mod, mIdx) => (
                        <div key={mod.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                          <h6 className="font-bold text-slate-800">
                            Module {aIdx + 1}.{mIdx + 1}: {mod.title}
                          </h6>
                          <div className="space-y-2 pl-2">
                            {mod.topics.map((top, tIdx) => (
                              <div key={top.id} className="border-l-2 border-emerald-500 pl-2.5 py-1 space-y-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-semibold text-slate-900">
                                    {top.title}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {top.expectedDuration}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[11px]">{top.description}</p>
                                {top.learningObjectives?.length > 0 && (
                                  <div className="text-[11px] text-slate-500">
                                    <strong className="text-slate-700">Objectives: </strong>
                                    {top.learningObjectives.join(' • ')}
                                  </div>
                                )}
                                {top.practicalActivities && (
                                  <p className="text-[11px] text-emerald-800 font-medium">
                                    <strong>Practical: </strong>
                                    {top.practicalActivities}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => setPreviewCurriculum(null)}
                className="py-2 px-4 text-xs text-slate-600 font-semibold"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const item = previewCurriculum;
                  setPreviewCurriculum(null);
                  openInBuilder(item);
                }}
                className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Open in Curriculum Builder</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
