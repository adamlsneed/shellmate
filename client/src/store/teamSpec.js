import { create } from 'zustand';

const defaultShellmateSpec = () => ({
  version: '1.0',
  agent: {
    id: 'main',
    name: '',
    personality: '',
    mission: '',
    mac_apps: [],
    use_cases: [],
    failure: '',
    escalation: '',
    never: [],
  },
  capabilities: {
    webSearch: false,
    webFetch: false,
    memory: 'core',
    recommendedSkills: [],
    tools: { deny: [] },
  },
});

export const useTeamSpecStore = create((set, get) => ({
  // Navigation state
  phase: 0,
  subStep: 0,

  // Conversation state
  conversationMessages: [],
  conversationComplete: false,

  // The spec being built
  teamSpec: defaultShellmateSpec(),

  // Results from generation
  generatedFiles: [],
  writeResult: null,
  validationOutput: '',
  isGenerating: false,
  isWriting: false,
  isValidating: false,

  // Reset counter — used as React key to force remount on "Start over"
  resetCount: 0,

  // Actions
  setPhase: (phase) => set({ phase, subStep: 0 }),
  setSubStep: (subStep) => set({ subStep }),

  setConversationMessages: (msgs) => set({ conversationMessages: msgs }),
  setConversationComplete: (v) => set({ conversationComplete: v }),

  // Update the single agent
  updateAgent: (updates) =>
    set(s => ({
      teamSpec: {
        ...s.teamSpec,
        agent: { ...s.teamSpec.agent, ...updates },
      },
    })),

  // Deep-merge a partial spec from the AI into the current one
  mergeSpec: (partial) => set(s => {
    const cur = s.teamSpec;
    const merged = { ...cur };

    if (partial.version) merged.version = partial.version;

    // Merge agent fields
    if (partial.name !== undefined) merged.agent = { ...cur.agent, name: partial.name };
    if (partial.personality !== undefined) merged.agent = { ...merged.agent, personality: partial.personality };
    if (partial.mission !== undefined) merged.agent = { ...merged.agent, mission: partial.mission };
    if (partial.mac_apps !== undefined) merged.agent = { ...merged.agent, mac_apps: partial.mac_apps };
    if (partial.use_cases !== undefined) merged.agent = { ...merged.agent, use_cases: partial.use_cases };
    if (partial.failure !== undefined) merged.agent = { ...merged.agent, failure: partial.failure };
    if (partial.escalation !== undefined) merged.agent = { ...merged.agent, escalation: partial.escalation };
    if (partial.never !== undefined) merged.agent = { ...merged.agent, never: partial.never };

    // Merge capabilities
    if (partial.capabilities) {
      merged.capabilities = {
        ...cur.capabilities,
        ...partial.capabilities,
        recommendedSkills: partial.capabilities.recommendedSkills ?? cur.capabilities?.recommendedSkills ?? [],
        tools: { ...(cur.capabilities?.tools || {}), ...(partial.capabilities.tools || {}) },
      };
    }

    return { teamSpec: merged };
  }),

    // Fills gaps with sensible defaults and returns the updated spec (avoids stale closure)
    populateSimpleDefaults: () => {
      const state = get();
      const agent = state.teamSpec.agent;
      const updated = {
        ...state.teamSpec,
        agent: {
          ...agent,
          personality: agent.personality || 'Warm, patient, and encouraging. Explains things simply.',
          mission: agent.mission || 'Help with everyday Mac tasks — files, apps, settings, and questions.',
          failure: agent.failure || 'Apologize simply and suggest trying a different approach.',
          escalation: agent.escalation || 'If something seems risky, always ask before doing it.',
          never: agent.never?.length ? agent.never : [
            'Never delete files without asking first',
            'Never change system settings without asking first',
            'Never share personal information',
          ],
        },
        capabilities: {
          ...state.teamSpec.capabilities,
          webSearch: false,
          webFetch: true,
          memory: 'core',
          tools: { deny: ['exec'] },  // Restrict shell exec by default for non-technical users
        },
      };
      set({ teamSpec: updated });
      return updated;
    },

  setGeneratedFiles: (files) => set({ generatedFiles: files }),
  setWriteResult: (result) => set({ writeResult: result }),
  setValidationOutput: (output) => set({ validationOutput: output }),
  setIsGenerating: (v) => set({ isGenerating: v }),
  setIsWriting: (v) => set({ isWriting: v }),
  setIsValidating: (v) => set({ isValidating: v }),

  reset: () => set(s => ({
    phase: 0,
    subStep: 0,
    teamSpec: defaultShellmateSpec(),
    generatedFiles: [],
    writeResult: null,
    validationOutput: '',
    isGenerating: false,
    isWriting: false,
    isValidating: false,
    conversationMessages: [],
    conversationComplete: false,
    resetCount: s.resetCount + 1,
  })),
}));
