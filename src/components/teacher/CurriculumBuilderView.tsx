import React, { useState, useEffect } from 'react';
import { Curriculum, LearningArea, Module, Topic } from '../../types';
import { createCurriculum, updateCurriculum } from '../../services/dataService';
import {
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Copy,
  ArrowUp,
  ArrowDown,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface CurriculumBuilderViewProps {
  initialCurriculum?: Curriculum | null;
  currentTeacherName: string;
  onSaved: () => Promise<void>;
}

const DEFAULT_AREAS: LearningArea[] = [
  {
    id: `la_${Date.now()}`,
    title: 'Core Computing Fundamentals',
    description: 'Basic computational knowledge and digital environment usage.',
    order: 1,
    modules: [
      {
        id: `mod_${Date.now()}_1`,
        title: 'System Setup & Laboratory Safety',
        description: 'Laboratory rules, ergonomics, and hardware connections.',
        order: 1,
        topics: [
          {
            id: `top_${Date.now()}_1`,
            title: 'Safe Lab Practices & Posture',
            description: 'Ergonomic seating, cable management, and school electrical safety.',
            learningObjectives: ['Demonstrate good sitting posture', 'Identify school lab rules'],
            expectedDuration: '2 Lessons (80 min)',
            practicalActivities: 'Inspect workstation layout and organize computer cables safely.',
            order: 1,
          },
        ],
      },
    ],
  },
];

export const CurriculumBuilderView: React.FC<CurriculumBuilderViewProps> = ({
  initialCurriculum,
  currentTeacherName,
  onSaved,
}) => {
  const [curriculumId, setCurriculumId] = useState<string | null>(
    initialCurriculum && !initialCurriculum.isTemplate ? initialCurriculum.id : null
  );
  const [isEditingTemplateCopy, setIsEditingTemplateCopy] = useState<boolean>(
    Boolean(initialCurriculum?.isTemplate)
  );
  const [version, setVersion] = useState<number>(initialCurriculum?.version || 1);
  const [title, setTitle] = useState(
    initialCurriculum
      ? initialCurriculum.isTemplate
        ? `${initialCurriculum.title} (Custom Copy)`
        : initialCurriculum.title
      : 'Custom Grade 7 Computer Literacy'
  );
  const [category, setCategory] = useState(initialCurriculum?.category || 'Applied Technology');
  const [description, setDescription] = useState(
    initialCurriculum?.description ||
      'Customized learning roadmap designed for Sangurur Comprehensive School junior secondary learners.'
  );
  const [level, setLevel] = useState(initialCurriculum?.level || 'Grade 7-8');
  const [isPublished, setIsPublished] = useState(initialCurriculum?.isPublished ?? true);

  const [learningAreas, setLearningAreas] = useState<LearningArea[]>(
    initialCurriculum?.learningAreas
      ? JSON.parse(JSON.stringify(initialCurriculum.learningAreas))
      : DEFAULT_AREAS
  );

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state whenever initialCurriculum changes
  useEffect(() => {
    setSuccessMessage(null);
    setErrorMessage(null);
    if (initialCurriculum) {
      const fromTemplate = Boolean(initialCurriculum.isTemplate);
      setIsEditingTemplateCopy(fromTemplate);
      setCurriculumId(fromTemplate ? null : initialCurriculum.id);
      setVersion(initialCurriculum.version || 1);
      setTitle(fromTemplate ? `${initialCurriculum.title} (Custom Copy)` : initialCurriculum.title);
      setCategory(initialCurriculum.category);
      setDescription(initialCurriculum.description);
      setLevel(initialCurriculum.level);
      setIsPublished(initialCurriculum.isPublished ?? true);
      setLearningAreas(JSON.parse(JSON.stringify(initialCurriculum.learningAreas || [])));
    } else {
      setIsEditingTemplateCopy(false);
      setCurriculumId(null);
      setVersion(1);
    }
  }, [initialCurriculum]);

  // Add Learning Area
  const addLearningArea = () => {
    const newArea: LearningArea = {
      id: `la_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title: `Learning Area ${learningAreas.length + 1}: Digital Competency`,
      description: 'Focus area description...',
      order: learningAreas.length + 1,
      modules: [
        {
          id: `mod_${Date.now()}`,
          title: 'Module 1: Introductory Skills',
          description: 'Module concepts...',
          order: 1,
          topics: [
            {
              id: `top_${Date.now()}`,
              title: 'Topic 1: Foundations',
              description: 'Topic coverage description...',
              learningObjectives: ['Define key concepts'],
              expectedDuration: '2 Lessons (80 min)',
              practicalActivities: 'Classroom hands-on exercise',
              order: 1,
            },
          ],
        },
      ],
    };
    setLearningAreas([...learningAreas, newArea]);
  };

  // Move Learning Area Up/Down
  const moveLearningArea = (index: number, direction: 'up' | 'down') => {
    const copy = [...learningAreas];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= copy.length) return;
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setLearningAreas(copy.map((a, i) => ({ ...a, order: i + 1 })));
  };

  // Delete Learning Area
  const removeLearningArea = (areaId: string) => {
    setLearningAreas(learningAreas.filter((a) => a.id !== areaId));
  };

  // Add Module to Area
  const addModule = (areaId: string) => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        const newMod: Module = {
          id: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          title: `Module ${area.modules.length + 1}: Practical Application`,
          description: 'Module description...',
          order: area.modules.length + 1,
          topics: [
            {
              id: `top_${Date.now()}`,
              title: 'New Topic',
              description: 'Topic description...',
              learningObjectives: ['Understand practical application'],
              expectedDuration: '2 Lessons (80 min)',
              practicalActivities: 'Complete lab task',
              order: 1,
            },
          ],
        };
        return { ...area, modules: [...area.modules, newMod] };
      })
    );
  };

  // Move Module Up/Down
  const moveModule = (areaId: string, index: number, direction: 'up' | 'down') => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        const copy = [...area.modules];
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= copy.length) return area;
        const [moved] = copy.splice(index, 1);
        copy.splice(target, 0, moved);
        return { ...area, modules: copy.map((m, i) => ({ ...m, order: i + 1 })) };
      })
    );
  };

  // Delete Module
  const removeModule = (areaId: string, modId: string) => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        return { ...area, modules: area.modules.filter((m) => m.id !== modId) };
      })
    );
  };

  // Add Topic to Module
  const addTopic = (areaId: string, modId: string) => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          modules: area.modules.map((mod) => {
            if (mod.id !== modId) return mod;
            const newTop: Topic = {
              id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              title: `Topic ${mod.topics.length + 1}: Applied Skill`,
              description: 'Details of concepts covered during this lesson...',
              learningObjectives: ['Identify core steps', 'Demonstrate practical exercise'],
              expectedDuration: '2 Lessons (80 min)',
              practicalActivities: 'Student lab exercise in computer room',
              order: mod.topics.length + 1,
            };
            return { ...mod, topics: [...mod.topics, newTop] };
          }),
        };
      })
    );
  };

  // Delete Topic
  const removeTopic = (areaId: string, modId: string, topId: string) => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          modules: area.modules.map((mod) => {
            if (mod.id !== modId) return mod;
            return { ...mod, topics: mod.topics.filter((t) => t.id !== topId) };
          }),
        };
      })
    );
  };

  // Reorder topics within a module
  const moveTopic = (areaId: string, modId: string, index: number, direction: 'up' | 'down') => {
    setLearningAreas(
      learningAreas.map((area) => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          modules: area.modules.map((mod) => {
            if (mod.id !== modId) return mod;
            const topicsCopy = [...mod.topics];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= topicsCopy.length) return mod;
            const [moved] = topicsCopy.splice(index, 1);
            topicsCopy.splice(targetIndex, 0, moved);
            return { ...mod, topics: topicsCopy.map((t, i) => ({ ...t, order: i + 1 })) };
          }),
        };
      })
    );
  };

  // Save Curriculum
  const handleSave = async (asNew: boolean = false) => {
    if (!title.trim()) {
      setErrorMessage('Curriculum title is required.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (curriculumId && !asNew) {
        const nextVersion = await updateCurriculum(curriculumId, {
          title: title.trim(),
          category: category.trim(),
          description: description.trim(),
          level: level.trim(),
          isPublished,
          learningAreas,
        });
        setVersion(nextVersion);
        setSuccessMessage(`Curriculum updated successfully (Version ${nextVersion}). Existing cohort snapshots remain preserved.`);
      } else {
        const created = await createCurriculum({
          title: asNew ? `${title.trim()} (Custom Copy)` : title.trim(),
          category: category.trim(),
          description: description.trim(),
          level: level.trim(),
          isTemplate: false,
          isPublished,
          version: 1,
          createdBy: currentTeacherName || 'Sangurur Teacher',
          learningAreas,
        });
        setCurriculumId(created.id);
        setVersion(1);
        setIsEditingTemplateCopy(false);
        setSuccessMessage('Curriculum created successfully in Sangurur School repository.');
      }

      await onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving curriculum');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Curriculum Builder & Designer (v{version})
            </span>
            {isEditingTemplateCopy && (
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800">
                Cloned from Official Template
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-1">
            Design Learning Areas, Modules & Topics
          </h2>
          <p className="text-xs text-slate-500">
            Hierarchical structure: Curriculum → Learning Areas → Modules → Topics → Practical Activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {curriculumId && (
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition border border-slate-200"
            >
              <Copy className="w-3.5 h-3.5 text-blue-700" />
              <span>Save As New Copy</span>
            </button>
          )}

          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="py-2 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : isPublished ? 'Save & Publish Curriculum' : 'Save Draft'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Curriculum Metadata Form */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Curriculum Overview & Classification
          </h3>
          <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-600"
            />
            <span>Published for Cohort Assignment</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Curriculum Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Curriculum Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Target Level / Grade
            </label>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Curriculum Hierarchy Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>Curriculum Hierarchy (Learning Areas & Modules)</span>
          </h3>

          <button
            type="button"
            onClick={addLearningArea}
            className="py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Learning Area</span>
          </button>
        </div>

        {learningAreas.map((area, aIndex) => (
          <div
            key={area.id}
            className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4 shadow-xs"
          >
            {/* Learning Area Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {aIndex + 1}
                  </span>
                  <input
                    type="text"
                    value={area.title}
                    onChange={(e) => {
                      const updated = [...learningAreas];
                      updated[aIndex].title = e.target.value;
                      setLearningAreas(updated);
                    }}
                    className="font-extrabold text-slate-900 text-sm bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-600 outline-none flex-1 py-0.5"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Learning area description..."
                  value={area.description}
                  onChange={(e) => {
                    const updated = [...learningAreas];
                    updated[aIndex].description = e.target.value;
                    setLearningAreas(updated);
                  }}
                  className="w-full text-xs text-slate-500 bg-transparent border-b border-dashed border-slate-200 outline-none py-0.5"
                />
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  disabled={aIndex === 0}
                  onClick={() => moveLearningArea(aIndex, 'up')}
                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                  title="Move Learning Area Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={aIndex === learningAreas.length - 1}
                  onClick={() => moveLearningArea(aIndex, 'down')}
                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                  title="Move Learning Area Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => addModule(area.id)}
                  className="py-1 px-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Module</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeLearningArea(area.id)}
                  className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg"
                  title="Delete Learning Area"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modules List */}
            <div className="space-y-4 pl-4 border-l-2 border-emerald-100">
              {area.modules.map((mod, mIndex) => (
                <div
                  key={mod.id}
                  className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-blue-800">
                          Module {aIndex + 1}.{mIndex + 1}:
                        </span>
                        <input
                          type="text"
                          value={mod.title}
                          onChange={(e) => {
                            const updated = [...learningAreas];
                            updated[aIndex].modules[mIndex].title = e.target.value;
                            setLearningAreas(updated);
                          }}
                          className="font-bold text-slate-900 text-xs bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none flex-1 py-0.5"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={mIndex === 0}
                        onClick={() => moveModule(area.id, mIndex, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Module Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={mIndex === area.modules.length - 1}
                        onClick={() => moveModule(area.id, mIndex, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                        title="Move Module Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => addTopic(area.id, mod.id)}
                        className="py-1 px-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-md text-[11px] flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Topic</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeModule(area.id, mod.id)}
                        className="p-1 text-slate-400 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Topics List with Reordering */}
                  <div className="space-y-2.5 pt-1">
                    {mod.topics.map((topic, tIndex) => (
                      <div
                        key={topic.id}
                        className="bg-white rounded-lg p-3 border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <input
                              type="text"
                              value={topic.title}
                              placeholder="Topic title..."
                              onChange={(e) => {
                                const updated = [...learningAreas];
                                updated[aIndex].modules[mIndex].topics[tIndex].title = e.target.value;
                                setLearningAreas(updated);
                              }}
                              className="font-bold text-slate-900 text-xs w-full bg-transparent border-b border-slate-200 focus:border-emerald-600 outline-none py-0.5"
                            />
                            <input
                              type="text"
                              value={topic.description}
                              placeholder="Topic description..."
                              onChange={(e) => {
                                const updated = [...learningAreas];
                                updated[aIndex].modules[mIndex].topics[tIndex].description = e.target.value;
                                setLearningAreas(updated);
                              }}
                              className="text-[11px] text-slate-500 w-full bg-transparent outline-none py-0.5"
                            />
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              disabled={tIndex === 0}
                              onClick={() => moveTopic(area.id, mod.id, tIndex, 'up')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                              title="Move Topic Up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={tIndex === mod.topics.length - 1}
                              onClick={() => moveTopic(area.id, mod.id, tIndex, 'down')}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20"
                              title="Move Topic Down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTopic(area.id, mod.id, topic.id)}
                              className="p-1 text-slate-400 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                          <div>
                            <span className="text-slate-400 block font-medium">Duration:</span>
                            <input
                              type="text"
                              value={topic.expectedDuration}
                              onChange={(e) => {
                                const updated = [...learningAreas];
                                updated[aIndex].modules[mIndex].topics[tIndex].expectedDuration = e.target.value;
                                setLearningAreas(updated);
                              }}
                              className="w-full text-slate-700 bg-slate-50 p-1 rounded-md border border-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Practical Activity:</span>
                            <input
                              type="text"
                              value={topic.practicalActivities || ''}
                              placeholder="Hands-on task..."
                              onChange={(e) => {
                                const updated = [...learningAreas];
                                updated[aIndex].modules[mIndex].topics[tIndex].practicalActivities = e.target.value;
                                setLearningAreas(updated);
                              }}
                              className="w-full text-slate-700 bg-slate-50 p-1 rounded-md border border-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Objectives (comma-separated):</span>
                            <input
                              type="text"
                              value={(topic.learningObjectives || []).join(', ')}
                              placeholder="Objective 1, Objective 2..."
                              onChange={(e) => {
                                const updated = [...learningAreas];
                                updated[aIndex].modules[mIndex].topics[tIndex].learningObjectives = e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                                setLearningAreas(updated);
                              }}
                              className="w-full text-slate-700 bg-slate-50 p-1 rounded-md border border-slate-200 outline-none"
                            />
                          </div>
                        </div>
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
  );
};
