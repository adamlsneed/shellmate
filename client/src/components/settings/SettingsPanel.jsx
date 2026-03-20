import { useState } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { useThemeStore } from '../../theme.js';
import { BigButton } from '../common/BigButton.jsx';
import SimpleAISetup from '../ai/SimpleAISetup.jsx';

const MODELS = {
  anthropic: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fastest)' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (balanced)' },
    { id: 'claude-opus-4-6', label: 'Opus 4.6 (smartest)' },
  ],
  anthropic_oauth: [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (fastest)' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (balanced)' },
    { id: 'gpt-4.1', label: 'GPT-4.1 (smartest)' },
  ],
};

function isOAuthToken(apiKey) {
  return apiKey?.startsWith('sk-ant-oat');
}

export default function SettingsPanel({ onClose, onRunWizard }) {
  const { provider, model, apiKey, envKey, reset: resetAI, configure } = useAIConfig();
  const { mode, toggle: toggleTheme } = useThemeStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const [showReconnect, setShowReconnect] = useState(false);

  const isOAuth = isOAuthToken(apiKey);
  const normalizedProvider = provider === 'default' ? 'anthropic' : provider;
  const modelKey = isOAuth ? 'anthropic_oauth' : normalizedProvider;
  const availableModels = MODELS[modelKey] || MODELS.anthropic;

  function handleProviderChange(newProvider) {
    const defaultModel = MODELS[newProvider]?.[0]?.id || 'claude-haiku-4-5-20251001';
    configure({ provider: newProvider, apiKey: '', model: defaultModel, envKey: false });
    setShowReconnect(true);
  }

  function handleModelChange(newModel) {
    configure({ provider: normalizedProvider, apiKey, model: newModel, envKey });
  }

  // Show the full connection setup flow
  if (showReconnect) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
        <div className="bg-[var(--bg-card)] rounded-friendly border border-[var(--border)] max-w-md w-full p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h2 text-[var(--text-primary)]">Change Connection</h2>
            <button onClick={() => setShowReconnect(false)} className="text-2xl text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
          </div>
          <SimpleAISetup onDone={() => setShowReconnect(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-[var(--bg-card)] rounded-friendly border border-[var(--border)] max-w-md w-full p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 text-[var(--text-primary)]">Settings</h2>
          <button onClick={onClose} className="text-2xl text-[var(--text-muted)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        {/* Theme */}
        <div className="space-y-2">
          <h3 className="text-h3 text-[var(--text-primary)]">Appearance</h3>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-3 rounded-friendly border border-[var(--border)] text-body text-[var(--text-primary)] hover:border-[var(--accent)]"
          >
            <span>{mode === 'dark' ? '🌙 Dark mode' : '☀️ Light mode'}</span>
            <span className="text-[var(--text-muted)]">Tap to switch</span>
          </button>
        </div>

        {/* Connection */}
        <div className="space-y-3">
          <h3 className="text-h3 text-[var(--text-primary)]">Connection</h3>

          {/* Provider */}
          <div className="space-y-1">
            <label className="text-small text-[var(--text-muted)]">Provider</label>
            {isOAuth ? (
              <div className="px-4 py-3 rounded-friendly bg-[var(--bg-primary)] border border-[var(--border)] text-body text-[var(--text-primary)]">
                Anthropic (Claude subscription)
              </div>
            ) : (
              <select
                value={normalizedProvider}
                onChange={e => handleProviderChange(e.target.value)}
                className="w-full px-4 py-3 rounded-friendly bg-[var(--bg-primary)] border border-[var(--border)] text-body text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openai">OpenAI (GPT)</option>
              </select>
            )}
          </div>

          {/* Model */}
          <div className="space-y-1">
            <label className="text-small text-[var(--text-muted)]">Model</label>
            {availableModels.length === 1 ? (
              <div className="px-4 py-3 rounded-friendly bg-[var(--bg-primary)] border border-[var(--border)] text-body text-[var(--text-primary)]">
                {availableModels[0].label}
                {isOAuth && <span className="text-[var(--text-muted)] text-small ml-2">(subscription limit)</span>}
              </div>
            ) : (
              <select
                value={model}
                onChange={e => handleModelChange(e.target.value)}
                className="w-full px-4 py-3 rounded-friendly bg-[var(--bg-primary)] border border-[var(--border)] text-body text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Reconnect button */}
          <button
            onClick={() => setShowReconnect(true)}
            className="text-small text-[var(--accent)] hover:underline"
          >
            {isOAuth ? 'Switch to API key' : 'Change API key or sign in with Claude'}
          </button>
        </div>

        {/* Advanced */}
        <div className="space-y-2">
          <h3 className="text-h3 text-[var(--text-primary)]">Advanced</h3>
          <BigButton variant="secondary" onClick={onRunWizard} className="w-full text-left">
            Run full setup wizard
          </BigButton>
          {!confirmReset ? (
            <BigButton variant="ghost" onClick={() => setConfirmReset(true)} className="w-full text-left text-red-500">
              Reset Shellmate
            </BigButton>
          ) : (
            <div className="px-4 py-3 rounded-friendly border border-red-300 bg-red-50 dark:bg-red-900/20 space-y-3">
              <p className="text-body text-red-600 dark:text-red-400">This will erase your setup. Are you sure?</p>
              <div className="flex gap-2">
                <BigButton variant="primary" onClick={() => { resetAI(); window.location.reload(); }} className="bg-red-500 hover:bg-red-600">
                  Yes, reset
                </BigButton>
                <BigButton variant="secondary" onClick={() => setConfirmReset(false)}>
                  Cancel
                </BigButton>
              </div>
            </div>
          )}
        </div>

        <BigButton variant="secondary" onClick={onClose} className="w-full">
          Done
        </BigButton>
      </div>
    </div>
  );
}
