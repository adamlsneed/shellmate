import { create } from 'zustand';

const STORAGE_KEY = 'shellmate-ai-config';

// Load from localStorage (fast, synchronous — used as initial state)
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocal(state) {
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

// Save to server (persistent across sessions — survives port changes)
async function saveToServer(state) {
  try {
    await fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: state.provider,
        apiKey: state.apiKey,
        model: state.model,
        envKey: state.envKey || false,
      }),
    });
  } catch {}
}

const saved = loadLocal();

export const useAIConfig = create((set, get) => ({
  provider: saved.provider || 'default',
  apiKey: saved.apiKey || '',
  model: saved.model || 'claude-sonnet-4-6',
  configured: saved.configured || false,
  envKey: saved.envKey || false,

  setProvider: (provider) => { set({ provider }); const s = get(); saveLocal(s); saveToServer(s); },
  setApiKey: (apiKey) => { set({ apiKey }); const s = get(); saveLocal(s); saveToServer(s); },
  setModel: (model) => { set({ model }); const s = get(); saveLocal(s); saveToServer(s); },

  configure: ({ provider, apiKey, model, envKey }) => {
    const next = { provider, apiKey: apiKey || '', model, configured: true, envKey: !!envKey };
    set(next);
    const s = { ...get(), ...next };
    saveLocal(s);
    saveToServer(s);
  },

  reset: () => {
    const next = { provider: 'default', apiKey: '', model: 'claude-sonnet-4-6', configured: false, envKey: false };
    set(next);
    saveLocal(next);
    saveToServer(next);
  },

  // Load from server — call this on app startup to recover config across sessions
  loadFromServer: async () => {
    try {
      const res = await fetch('/api/ai-config');
      if (!res.ok) return;
      const data = await res.json();
      if (data.configured) {
        const next = {
          provider: data.provider || 'default',
          apiKey: data.apiKey || '',
          model: data.model || 'claude-sonnet-4-6',
          configured: true,
          envKey: !!data.envKey,
        };
        set(next);
        saveLocal(next);
      }
    } catch {}
  },
}));
