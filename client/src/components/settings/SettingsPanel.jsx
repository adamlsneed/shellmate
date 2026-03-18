import { useState } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { useThemeStore } from '../../theme.js';
import { BigButton } from '../common/BigButton.jsx';

export default function SettingsPanel({ onClose, onRunWizard }) {
  const { provider, model, reset: resetAI } = useAIConfig();
  const { mode, toggle: toggleTheme } = useThemeStore();
  const [confirmReset, setConfirmReset] = useState(false);

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

        {/* Connection info */}
        <div className="space-y-2">
          <h3 className="text-h3 text-[var(--text-primary)]">Connection</h3>
          <div className="px-4 py-3 rounded-friendly bg-[var(--bg-primary)] text-body">
            <div className="text-[var(--text-secondary)]">Provider: <span className="text-[var(--text-primary)] font-medium">{provider}</span></div>
            <div className="text-[var(--text-secondary)]">Model: <span className="text-[var(--text-primary)] font-medium">{model}</span></div>
          </div>
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
