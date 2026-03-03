import { PHASE_LABELS } from '../../hooks/useWizard.js';

export default function ProgressBar({ currentPhase }) {
  return (
    <div className="flex items-center gap-1">
      {PHASE_LABELS.map((label, idx) => {
        const isDone = idx < currentPhase;
        const isActive = idx === currentPhase;

        return (
          <div key={idx} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isDone  ? 'border-shell-500 bg-shell-600 text-white' :
                isActive ? 'border-shell-400 bg-shell-500/20 text-shell-300 ring-2 ring-shell-500/30' :
                           'border-gray-600 bg-gray-800 text-gray-500'
              }`}>
                {isDone ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] leading-tight mt-1 text-center w-16 ${
                isActive ? 'text-shell-300 font-medium' : isDone ? 'text-shell-500' : 'text-gray-600'
              }`}>{label}</span>
            </div>
            {idx < PHASE_LABELS.length - 1 && (
              <div className={`h-0.5 w-6 mx-1 mb-5 rounded ${isDone ? 'bg-shell-600' : 'bg-gray-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
