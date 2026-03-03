import { useTeamSpecStore } from '../store/teamSpec.js';

export const PHASE = {
  CHAT: 0,
  REVIEW: 1,
  GENERATE: 2,
  CAPABILITIES: 3,
  DONE: 4,
};

export const PHASE_LABELS = ['Conversation', 'Review', 'Generate', 'Capabilities', 'Done'];

export function useWizard() {
  const { phase, setPhase } = useTeamSpecStore();

  function advance() { setPhase(Math.min(phase + 1, PHASE.DONE)); }
  function goBack()  { setPhase(Math.max(phase - 1, PHASE.CHAT)); }

  return { phase, advance, goBack };
}
