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
      openclawEnv: state.openclawEnv || false,
    }));
  } catch {}
}

const saved = load();

export const useAIConfig = create((set, get) => ({
  provider: saved.provider || 'openclaw',
  apiKey: saved.apiKey || '',
  model: saved.model || 'claude-sonnet-4-6',
  configured: saved.configured || false,
  // true = using server-side env key, no client API key needed
  openclawEnv: saved.openclawEnv || false,

  // The Shellmate default status, loaded async from the server
  openclawDefault: null,

  setProvider: (provider) => { set({ provider }); save(get()); },
  setApiKey: (apiKey) => { set({ apiKey }); save(get()); },
  setModel: (model) => { set({ model }); save(get()); },

  configure: ({ provider, apiKey, model, openclawEnv }) => {
    const next = { provider, apiKey: apiKey || '', model, configured: true, openclawEnv: !!openclawEnv };
    set(next);
    save({ ...get(), ...next });
  },

  reset: () => {
    const next = { provider: 'openclaw', apiKey: '', model: 'claude-sonnet-4-6', configured: false, openclawEnv: false };
    set(next);
    save(next);
  },

  setOpenclawDefault: (info) => set({ openclawDefault: info }),
}));
