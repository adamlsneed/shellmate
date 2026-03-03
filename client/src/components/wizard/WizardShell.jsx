import { useState, useRef, useEffect, useCallback } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useAIConfig } from '../../store/aiConfig.js';
import { PHASE_LABELS } from '../../hooks/useWizard.js';
import ProgressBar from '../common/ProgressBar.jsx';
import ConversationPhase from './ConversationPhase.jsx';
import ReviewStep from './ReviewStep.jsx';
import GenerateStep from './GenerateStep.jsx';
import CapabilitiesStep from './CapabilitiesStep.jsx';
import DoneStep from './DoneStep.jsx';

const PHASES = [ConversationPhase, ReviewStep, GenerateStep, CapabilitiesStep, DoneStep];

export default function WizardShell({ onComplete }) {
  const phase = useTeamSpecStore(s => s.phase);
  const reset = useTeamSpecStore(s => s.reset);
  const resetCount = useTeamSpecStore(s => s.resetCount);
  const { configured, reset: resetAI } = useAIConfig();

  const ActivePhase = PHASES[phase] || ConversationPhase;

  // Scroll overflow detection — show fade when content is clipped
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 8;
    setCanScroll(hasMore);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll, phase]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-shell-400">🐢 Shellmate</span>
        </div>
        <div className="flex items-center gap-4">
          {configured && (
            <button
              onClick={resetAI}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Change AI
            </button>
          )}
          <button
            onClick={() => { if (phase === 0 || confirm('Start over? Your conversation will be lost.')) reset(); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Start over
          </button>
        </div>
      </header>

      {/* Progress — only show after conversation starts */}
      {phase > 0 && (
        <div className="px-6 py-3 border-b border-gray-800 shrink-0">
          <ProgressBar currentPhase={phase} />
        </div>
      )}

      {/* Active phase */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-y-auto flex flex-col px-6 py-4">
          <ActivePhase key={resetCount} onComplete={onComplete} />
        </div>
        {/* Fade hint when more content below */}
        {canScroll && (
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-navy-950 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}
