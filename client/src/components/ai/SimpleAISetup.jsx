import { useState, useEffect } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { BigButton } from '../common/BigButton.jsx';

export default function SimpleAISetup({ onDone }) {
  const { configure } = useAIConfig();
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  // Check if the person setting this up already put the key on the computer
  useEffect(() => {
    fetch('/api/chat/env-status')
      .then(r => r.json())
      .then(data => {
        if (data.anthropicKey || data.openaiKey) {
          const provider = data.anthropicKey ? 'anthropic' : 'openai';
          const model = data.anthropicKey ? 'claude-sonnet-4-6' : 'gpt-4o';
          configure({ provider, apiKey: '', model, envKey: true });
          onDone();
        }
      })
      .catch(() => {});
  }, []);

  async function handleConnect() {
    if (!accessCode.trim()) return;
    setError('');
    setTesting(true);

    // Auto-detect provider from key format
    const isAnthropic = accessCode.startsWith('sk-ant-');
    const provider = isAnthropic ? 'anthropic' : 'openai';
    const model = isAnthropic ? 'claude-sonnet-4-6' : 'gpt-4o';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          provider, model,
          apiKey: accessCode.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError("That code didn't work. Please double-check it and try again.");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        setTesting(false);
        return;
      }

      configure({ provider, apiKey: accessCode.trim(), model, envKey: false });
      onDone();
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-6xl mb-6">🐢</div>
      <h1 className="text-h1 text-[var(--text-primary)] mb-3">
        Welcome to Shellmate
      </h1>
      <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-md">
        To get started, enter the access code that was set up for you.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="password"
          value={accessCode}
          onChange={e => setAccessCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder="Paste your access code here"
          className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
          autoFocus
        />

        {error && (
          <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3">
            {error}
          </p>
        )}

        <BigButton
          onClick={handleConnect}
          disabled={!accessCode.trim() || testing}
          className="w-full"
        >
          {testing ? 'Connecting...' : 'Connect'}
        </BigButton>
      </div>

      <p className="text-small text-[var(--text-muted)] mt-8 max-w-sm">
        Don't have an access code? Ask the person who set up Shellmate for you, or check the instructions they left.
      </p>
    </div>
  );
}
