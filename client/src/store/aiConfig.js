import { create } from 'zustand';

const STORAGE_KEY = 'shellmate-ai-config';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      provider: state.provider,
      apiKey: state.apiKey,
      model: state.model,
      configured: state.configured,
      envKey: state.envKey || false,
    }));
  } catch {}
}

const saved = load();

export const useAIConfig = create((set, get) => ({
  provider: saved.provider || 'default',
  apiKey: saved.apiKey || '',
  model: saved.model || 'claude-sonnet-4-6',
  configured: saved.configured || false,
  // true = using server-side env key, no client API key needed
  envKey: saved.envKey || false,

  setProvider: (provider) => { set({ provider }); save(get()); },
  setApiKey: (apiKey) => { set({ apiKey }); save(get()); },
  setModel: (model) => { set({ model }); save(get()); },

  configure: ({ provider, apiKey, model, envKey }) => {
    const next = { provider, apiKey: apiKey || '', model, configured: true, envKey: !!envKey };
    set(next);
    save({ ...get(), ...next });
  },

  reset: () => {
    const next = { provider: 'default', apiKey: '', model: 'claude-sonnet-4-6', configured: false, envKey: false };
    set(next);
    save(next);
  },
}));
