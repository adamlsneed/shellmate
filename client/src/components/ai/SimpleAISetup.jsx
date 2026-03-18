import { useState, useEffect } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { BigButton } from '../common/BigButton.jsx';

const VIEW = { CHOOSE: 0, CODE: 1, SIGNIN: 2 };

export default function SimpleAISetup({ onDone }) {
  const { configure } = useAIConfig();
  const [view, setView] = useState(VIEW.CHOOSE);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  // Check if the person setting this up already put the key on the computer
  useEffect(() => {
    fetch('/api/chat/env-status')
      .then(r => r.json())
      .then(data => {
        if (data.available) {
          const provider = data.provider || 'anthropic';
          const model = data.model || 'claude-sonnet-4-6';
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
    const key = accessCode.trim();
    const isAnthropic = key.startsWith('sk-ant-');
    const provider = isAnthropic ? 'anthropic' : 'openai';
    const model = isAnthropic ? 'claude-sonnet-4-6' : 'gpt-4o';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi' }],
          provider, model,
          apiKey: key,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || '';
        if (res.status === 401) {
          setError("That didn't work. Please double-check it and try again.");
        } else if (msg.includes('OAuth authentication is currently not supported')) {
          setError("Claude sign-in tokens aren't available right now. Try using an access code from console.anthropic.com instead.");
        } else if (msg.includes('credit') || msg.includes('balance') || msg.includes('quota')) {
          setError("Your account doesn't have enough credit. You may need to add a payment method.");
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        setTesting(false);
        return;
      }

      configure({ provider, apiKey: key, model, envKey: false });
      onDone();
    } catch {
      setError("Couldn't connect. Check your internet and try again.");
      setTesting(false);
    }
  }

  // ── Choose path ────────────────────────────────────────────────────────────
  if (view === VIEW.CHOOSE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-6">🐢</div>
        <h1 className="text-h1 text-[var(--text-primary)] mb-3">
          Welcome to Shellmate
        </h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-md">
          To get started, we need to connect Shellmate to an AI service. Pick whichever option fits you best:
        </p>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setView(VIEW.SIGNIN)}
            className="w-full px-6 py-5 rounded-friendly bg-[var(--bg-card)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left"
          >
            <div className="text-body font-semibold text-[var(--text-primary)] mb-1">
              Sign in with Claude
            </div>
            <div className="text-small text-[var(--text-muted)]">
              Use your existing Claude account (Pro or Max plan)
            </div>
          </button>

          <button
            onClick={() => setView(VIEW.CODE)}
            className="w-full px-6 py-5 rounded-friendly bg-[var(--bg-card)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left"
          >
            <div className="text-body font-semibold text-[var(--text-primary)] mb-1">
              I have an access code
            </div>
            <div className="text-small text-[var(--text-muted)]">
              Someone gave me a code to paste in
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Sign in with Claude ────────────────────────────────────────────────────
  if (view === VIEW.SIGNIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-6">🐢</div>
        <h1 className="text-h2 text-[var(--text-primary)] mb-6">
          Sign in with your Claude account
        </h1>

        <div className="w-full max-w-md text-left space-y-5 mb-8">
          <Step number={1}>
            <span>If you don't have one yet, </span>
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline font-medium"
            >
              create a Claude account
            </a>
            <span> (you'll need a Pro or Max plan).</span>
          </Step>

          <Step number={2}>
            <span>Go to </span>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline font-medium"
            >
              your API keys page
            </a>
            <span> and sign in.</span>
          </Step>

          <Step number={3}>
            Click the <strong className="text-[var(--text-primary)]">Create Key</strong> button, give it any name (like "Shellmate"), and click <strong className="text-[var(--text-primary)]">Create Key</strong>.
          </Step>

          <Step number={4}>
            Copy the key that appears and paste it below.
          </Step>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <input
            type="password"
            value={accessCode}
            onChange={e => { setAccessCode(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            placeholder="Paste your key here"
            className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
            autoFocus
          />

          {error && (
            <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 text-left">
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

          <button
            onClick={() => { setView(VIEW.CHOOSE); setError(''); setAccessCode(''); }}
            className="text-small text-[var(--accent)] hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Paste access code ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-6xl mb-6">🐢</div>
      <h1 className="text-h2 text-[var(--text-primary)] mb-3">
        Enter your access code
      </h1>
      <p className="text-body text-[var(--text-secondary)] mb-8 max-w-md">
        Paste the code that was set up for you.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <input
          type="password"
          value={accessCode}
          onChange={e => { setAccessCode(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder="Paste your access code here"
          className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
          autoFocus
        />

        {error && (
          <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 text-left">
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

        <button
          onClick={() => { setView(VIEW.CHOOSE); setError(''); setAccessCode(''); }}
          className="text-small text-[var(--accent)] hover:underline"
        >
          Go back
        </button>
      </div>

      <p className="text-small text-[var(--text-muted)] mt-6 max-w-sm">
        Don't have a code? Go back and choose "Sign in with Claude" instead.
      </p>
    </div>
  );
}

// ── Helper: numbered step ──────────────────────────────────────────────────
function Step({ number, children }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-body font-bold flex-shrink-0">
        {number}
      </div>
      <p className="text-body text-[var(--text-secondary)] pt-1">
        {children}
      </p>
    </div>
  );
}
