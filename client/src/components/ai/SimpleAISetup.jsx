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
  const [signinTab, setSigninTab] = useState('subscription');
  const [oauthStep, setOauthStep] = useState(null); // null | 'checking' | 'browser' | 'paste' | 'exchanging'
  const [oauthCode, setOauthCode] = useState('');

  // Check if the person setting this up already put the key on the computer
  useEffect(() => {
    fetch('/api/chat/env-status')
      .then(r => r.json())
      .then(data => {
        if (data.available) {
          configure({ provider: data.provider || 'anthropic', apiKey: '', model: data.model || 'claude-sonnet-4-6', envKey: true });
          onDone();
        }
      })
      .catch(() => {});
  }, []);

  // When switching to subscription tab, check for existing OAuth credentials
  useEffect(() => {
    if (view === VIEW.SIGNIN && signinTab === 'subscription') {
      checkExistingOAuth();
    }
  }, [view, signinTab]);

  async function checkExistingOAuth() {
    setOauthStep('checking');
    try {
      const res = await fetch('/api/oauth/status');
      const data = await res.json();
      if (data.available) {
        // Already have valid credentials — get a fresh token and connect
        const tokenRes = await fetch('/api/oauth/token');
        const tokenData = await tokenRes.json();
        if (tokenData.token) {
          configure({ provider: 'anthropic', apiKey: tokenData.token, model: 'claude-sonnet-4-6', envKey: false });
          onDone();
          return;
        }
      }
    } catch {}
    setOauthStep(null);
  }

  async function startOAuth() {
    setError('');
    setOauthStep('browser');
    try {
      const res = await fetch('/api/oauth/start', { method: 'POST' });
      const data = await res.json();
      if (data.authUrl) {
        // Open the browser to the auth URL
        window.open(data.authUrl, '_blank');
        setOauthStep('paste');
      } else {
        setError('Could not start sign-in. Please try again.');
        setOauthStep(null);
      }
    } catch {
      setError('Could not connect. Check your internet and try again.');
      setOauthStep(null);
    }
  }

  async function exchangeOAuthCode() {
    if (!oauthCode.trim()) return;
    setError('');
    setOauthStep('exchanging');
    try {
      const res = await fetch('/api/oauth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: oauthCode.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        configure({ provider: 'anthropic', apiKey: data.token, model: 'claude-sonnet-4-6', envKey: false });
        onDone();
      } else {
        setError(data.error || 'Code exchange failed. Please try again.');
        setOauthStep('paste');
      }
    } catch {
      setError('Could not connect. Check your internet and try again.');
      setOauthStep('paste');
    }
  }

  async function handleConnect() {
    if (!accessCode.trim()) return;
    setError('');
    setTesting(true);

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
          provider, model, apiKey: key,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || '';
        if (res.status === 401) {
          setError("That didn't work. Please double-check it and try again.");
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
        <h1 className="text-h1 text-[var(--text-primary)] mb-3">Welcome to Shellmate</h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-md">
          To get started, we need to connect Shellmate to an AI service. Pick whichever option fits you best:
        </p>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setView(VIEW.SIGNIN)}
            className="w-full px-6 py-5 rounded-friendly bg-[var(--bg-card)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left"
          >
            <div className="text-body font-semibold text-[var(--text-primary)] mb-1">Sign in with Claude</div>
            <div className="text-small text-[var(--text-muted)]">Use your existing Claude account (Pro, Max, or Team plan)</div>
          </button>
          <button
            onClick={() => setView(VIEW.CODE)}
            className="w-full px-6 py-5 rounded-friendly bg-[var(--bg-card)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left"
          >
            <div className="text-body font-semibold text-[var(--text-primary)] mb-1">I have an access code</div>
            <div className="text-small text-[var(--text-muted)]">Someone gave me a code to paste in</div>
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
        <h1 className="text-h2 text-[var(--text-primary)] mb-6">Connect your Claude account</h1>

        {/* Tab toggle */}
        <div className="flex rounded-friendly overflow-hidden border border-[var(--border)] mb-6 w-full max-w-sm">
          <button
            onClick={() => setSigninTab('subscription')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              signinTab === 'subscription'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Pro / Max / Team
          </button>
          <button
            onClick={() => setSigninTab('apikey')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              signinTab === 'apikey'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            API Key
          </button>
        </div>

        {signinTab === 'subscription' ? (
          <div className="w-full max-w-md space-y-5 mb-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-friendly p-4">
              <p className="text-sm text-[var(--text-secondary)]">
                If you have a <strong className="text-[var(--text-primary)]">Claude Pro</strong>, <strong className="text-[var(--text-primary)]">Max</strong>, or <strong className="text-[var(--text-primary)]">Team</strong> subscription, you can use it with Shellmate — no separate API billing needed.
              </p>
            </div>

            {/* Checking for existing credentials */}
            {oauthStep === 'checking' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-body text-[var(--text-muted)]">Checking for existing sign-in...</span>
              </div>
            )}

            {/* Step 1: Click to sign in */}
            {!oauthStep && (
              <div className="space-y-4">
                <BigButton onClick={startOAuth} className="w-full">
                  Sign in with Claude
                </BigButton>
                <p className="text-sm text-[var(--text-muted)]">
                  This will open your browser. Sign in with your Claude account.
                </p>
              </div>
            )}

            {/* Step 2: Browser opened, waiting for user */}
            {oauthStep === 'browser' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-body text-[var(--text-muted)]">Opening your browser...</span>
              </div>
            )}

            {/* Step 3: Paste the authorization code */}
            {oauthStep === 'paste' && (
              <div className="space-y-4 text-left">
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-friendly p-4">
                  <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Almost there!</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    After signing in, you'll see an authorization code on the page. Copy it and paste it below.
                  </p>
                </div>
                <input
                  type="text"
                  value={oauthCode}
                  onChange={e => { setOauthCode(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && exchangeOAuthCode()}
                  placeholder="Paste the code here"
                  className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
                  autoFocus
                />
                <BigButton
                  onClick={exchangeOAuthCode}
                  disabled={!oauthCode.trim()}
                  className="w-full"
                >
                  Connect
                </BigButton>
              </div>
            )}

            {/* Step 4: Exchanging code */}
            {oauthStep === 'exchanging' && (
              <div className="flex items-center justify-center gap-3 py-6">
                <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span className="text-body text-[var(--text-muted)]">Connecting your account...</span>
              </div>
            )}

            {error && (
              <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 text-left">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md text-left space-y-5 mb-8">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-friendly p-4 mb-2">
              <p className="text-sm text-[var(--text-secondary)]">
                API keys use <strong className="text-[var(--text-primary)]">pay-as-you-go</strong> billing (separate from your Claude subscription). Great if you want usage-based pricing.
              </p>
            </div>
            <Step number={1}>
              <span>Go to </span>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline font-medium">console.anthropic.com/settings/keys</a>
              <span> and sign in.</span>
            </Step>
            <Step number={2}>
              Click <strong className="text-[var(--text-primary)]">Create Key</strong>, name it "Shellmate", and copy it.
            </Step>
            <Step number={3}>Paste the key below.</Step>
            <div className="space-y-4">
              <input
                type="password"
                value={accessCode}
                onChange={e => { setAccessCode(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                placeholder="Paste your API key here (sk-ant-api...)"
                className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
                autoFocus
              />
              {error && (
                <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 text-left">{error}</p>
              )}
              <BigButton onClick={handleConnect} disabled={!accessCode.trim() || testing} className="w-full">
                {testing ? 'Connecting...' : 'Connect'}
              </BigButton>
            </div>
          </div>
        )}

        <button
          onClick={() => { setView(VIEW.CHOOSE); setError(''); setAccessCode(''); setOauthStep(null); setOauthCode(''); }}
          className="text-small text-[var(--accent)] hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  // ── Paste access code ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-6xl mb-6">🐢</div>
      <h1 className="text-h2 text-[var(--text-primary)] mb-3">Enter your access code</h1>
      <p className="text-body text-[var(--text-secondary)] mb-8 max-w-md">Paste the code that was set up for you.</p>
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
          <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 text-left">{error}</p>
        )}
        <BigButton onClick={handleConnect} disabled={!accessCode.trim() || testing} className="w-full">
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

function Step({ number, children }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-body font-bold flex-shrink-0">{number}</div>
      <p className="text-body text-[var(--text-secondary)] pt-1">{children}</p>
    </div>
  );
}
