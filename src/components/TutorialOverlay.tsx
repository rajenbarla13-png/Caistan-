import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  X,
  Compass,
} from 'lucide-react';
import type { DashboardSection, TutorialStepDef } from '../types/clipverse';
import { TUTORIAL_STEPS } from '../data/studioCatalog';

interface TutorialOverlayProps {
  active: boolean;
  minimized: boolean;
  currentStepIndex: number;
  completedStepIds: string[];
  onSetMinimized: (min: boolean) => void;
  onSelectStep: (idx: number, targetSection: DashboardSection) => void;
  onComplete: () => void;
  onDismiss: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  active,
  minimized,
  currentStepIndex,
  completedStepIds,
  onSetMinimized,
  onSelectStep,
  onComplete,
  onDismiss,
}) => {
  if (!active) return null;

  const step: TutorialStepDef = TUTORIAL_STEPS[currentStepIndex] || TUTORIAL_STEPS[0];
  const isLast = currentStepIndex === TUTORIAL_STEPS.length - 1;
  const isStepDone = completedStepIds.includes(step.id);
  const progressPct = Math.round(((currentStepIndex + 1) / TUTORIAL_STEPS.length) * 100);

  return (
    <AnimatePresence>
      {minimized ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-20 lg:bottom-5 right-4 z-40"
        >
          <button
            type="button"
            onClick={() => onSetMinimized(false)}
            className="flex items-center gap-3 rounded-2xl bg-white border border-blue-200 shadow-lg shadow-blue-600/15 px-4 py-2.5 text-left hover:border-blue-400 transition-colors cursor-pointer"
          >
            <img
              src="/src/assets/images/anime_tutorial_guide_1794746977506.jpg"
              alt="Sora AI Guide"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-blue-200"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <span>Studio Guide · Step {step.stepNumber}/{TUTORIAL_STEPS.length}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{step.title}</div>
            </div>
            <Maximize2 className="w-4 h-4 text-blue-600 ml-1" />
          </button>
        </motion.div>
      ) : (
        <motion.aside
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-20 lg:bottom-6 right-4 z-40 w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-white border border-blue-200 shadow-2xl shadow-blue-900/10 overflow-hidden"
          aria-label="Interactive Tutorial Coach"
        >
          {/* Progress stripe */}
          <div className="h-1 bg-slate-100 w-full">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="p-4 sm:p-5 space-y-3.5">
            {/* Header with Anime Mascot */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src="/src/assets/images/anime_tutorial_guide_1794746977506.jpg"
                  alt="Sora Interactive Guide"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-xl object-cover border border-blue-200 shrink-0 bg-blue-50"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-blue-600 tabular-nums">
                    Interactive Tutorial · Step {step.stepNumber} of {TUTORIAL_STEPS.length}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">{step.title}</h3>
                  <p className="text-xs text-slate-500 truncate">{step.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onSetMinimized(true)}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Minimize guide"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Close tutorial"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Instruction Body */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
              <p className="text-xs leading-relaxed text-slate-700">{step.instruction}</p>
              <p className="text-xs font-medium text-blue-700">{step.actionHint}</p>
              <div className="flex items-center gap-2 pt-1 text-xs">
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${isStepDone ? 'text-emerald-600' : 'text-slate-300'}`}
                />
                <span className={isStepDone ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                  {step.checkLabel} {isStepDone ? '— Completed' : ''}
                </span>
              </div>
            </div>

            {/* Step Dot Selector */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                {TUTORIAL_STEPS.map((s, idx) => {
                  const done = completedStepIds.includes(s.id);
                  const current = idx === currentStepIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectStep(idx, s.targetSection)}
                      title={s.title}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        current
                          ? 'w-6 bg-blue-600'
                          : done
                          ? 'w-2.5 bg-emerald-500'
                          : 'w-2 bg-slate-200 hover:bg-slate-300'
                      }`}
                      aria-label={`Go to step ${s.stepNumber}: ${s.title}`}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={() => {
                    const prev = Math.max(0, currentStepIndex - 1);
                    onSelectStep(prev, TUTORIAL_STEPS[prev].targetSection);
                  }}
                  className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                {isLast ? (
                  <button
                    type="button"
                    onClick={onComplete}
                    className="min-h-[36px] px-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-semibold hover:from-blue-700 hover:to-sky-600 flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <span>Finish Guide</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(TUTORIAL_STEPS.length - 1, currentStepIndex + 1);
                      onSelectStep(next, TUTORIAL_STEPS[next].targetSection);
                    }}
                    className="min-h-[36px] px-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-sky-500 text-white text-xs font-semibold hover:from-blue-700 hover:to-sky-600 flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <span>Next Step</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
