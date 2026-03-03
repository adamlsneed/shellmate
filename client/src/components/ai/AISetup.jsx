import { useState, useEffect } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    badge: 'Recommended',
    defaultModel: 'claude-sonnet-4-6',
    placeholder: 'sk-ant-api03-... or sk-ant-oat...',
    costNote: 'Free $5 credit on signup · ~100 sessions',
    authMethods: [
      {
        id: 'apikey',
        label: 'API Key',
        desc: 'Pay-as-you-go from the Anthropic console',
        steps: [
          {
            text: 'Create a free account',
            url: 'https://console.anthropic.com',
            urlLabel: 'console.anthropic.com',
            note: 'Includes $5 in free credit — enough for ~100 sessions.',
          },
          { text: <>In the left sidebar, click <strong className="text-gray-200">API Keys</strong>.</> },
          { text: <>Click <strong className="text-gray-200">Create Key</strong>, give it any name, and copy it.</> },
          { text: 'Paste it in the field below.' },
        ],
      },
      {
        id: 'oauth',
        label: 'OAuth Token',
        desc: 'Use your Claude Pro / Max subscription',
        steps: [
          {
            text: 'Install Claude Code if you haven\'t',
            url: 'https://docs.anthropic.com/en/docs/claude-code/overview',
            urlLabel: 'docs.anthropic.com',
            note: 'Claude Code is a free CLI tool from Anthropic.',
          },
          { text: <>Open a terminal and run: <code className="bg-gray-700 px-1.5 py-0.5 rounded text-shell-300 text-xs">claude setup-token</code></> },
          { text: 'Log in when prompted and copy the token it generates.' },
          { text: 'Paste the token in the field below.' },
        ],
      },
    ],
    tokenHint: 'Accepts API keys (sk-ant-api03-...) and OAuth tokens (sk-ant-oat...).',
  },
  openai: {
    label: 'OpenAI GPT',
    defaultModel: 'gpt-4o',
    placeholder: 'sk-proj-... or OAuth token',
    costNote: 'Pay as you go · ~$0.05 per session',
    authMethods: [
      {
        id: 'apikey',
        label: 'API Key',
        desc: 'Pay-as-you-go from the OpenAI platform',
        steps: [
          {
            text: 'Create an account',
            url: 'https://platform.openai.com/signup',
            urlLabel: 'platform.openai.com',
            note: "You'll need to add a small credit balance — $5 is plenty to get started.",
          },
          { text: <>Click your profile icon (top-right) → <strong className="text-gray-200">API keys</strong>.</> },
          { text: <>Click <strong className="text-gray-200">Create new secret key</strong> and copy it.</> },
          { text: 'Paste it in the field below.' },
        ],
      },
      {
        id: 'oauth',
        label: 'OAuth Token',
        desc: 'Use your ChatGPT Plus / Max subscription',
        steps: [
          {
            text: 'Install Codex CLI if you haven\'t',
            url: 'https://github.com/openai/codex',
            urlLabel: 'github.com/openai/codex',
            note: 'Codex is OpenAI\'s CLI tool — free to install.',
          },
          { text: <>Run <code className="bg-gray-700 px-1.5 py-0.5 rounded text-shell-300 text-xs">codex</code> in your terminal — it will prompt you to log in on first run.</> },
          { text: <>After logging in, find your token at <code className="bg-gray-700 px-1.5 py-0.5 rounded text-shell-300 text-xs">~/.codex/auth.json</code> and copy the <code className="text-shell-300">token</code> value.</> },
          { text: 'Paste the token in the field below.' },
        ],
      },
    ],
    tokenHint: 'Accepts API keys (sk-proj-...) and OAuth tokens.',
  },
};

export default function AISetup({ onDone }) {
  const { configure } = useAIConfig();

  const [envStatus, setEnvStatus]           = useState(null); // null = loading
  const [provider, setProvider]             = useState('anthropic');
  const [mode, setMode]                     = useState('need'); // 'need' | 'have'
  const [authMethod, setAuthMethod]         = useState('apikey'); // 'apikey' | 'oauth'
  const [apiKey, setApiKey]                 = useState('');
  const [error, setError]                   = useState('');
  const [testing, setTesting]               = useState(false);

  useEffect(() => {
    fetch('/api/chat/env-status')
      .then(r => r.json())
      .then(data => {
        setEnvStatus(data);
        if (data.available) {
          // Env key found — configure silently and advance
          configure({
            provider: 'default',
            apiKey: '',
            model: data.normalized || data.model || 'claude-sonnet-4-6',
            envKey: true,
          });
          onDone?.();
        }
      })
      .catch(() => setEnvStatus({ available: false }));
  }, []);

  function switchProvider(p) {
    setProvider(p);
    setAuthMethod('apikey');
    setApiKey('');
    setError('');
  }

  function switchMode(m) {
    setMode(m);
    setError('');
  }

  async function handleConnect() {
    if (!apiKey.trim()) { setError('Paste your API key or token to continue.'); return; }
    setError('');
    setTesting(true);
    const model = PROVIDERS[provider].defaultModel;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
          apiKey: apiKey.trim(),
          model,
          provider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connection failed');
      configure({ provider, apiKey: apiKey.trim(), model });
      onDone?.();
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('OAuth authentication is currently not supported')) {
        setError('Anthropic has temporarily disabled OAuth tokens for third-party apps. Try using an API key from console.anthropic.com instead.');
      } else if (msg.includes('401') || msg.includes('invalid') || msg.includes('auth') || msg.includes('key')) {
        setError("That key or token didn't work — make sure you copied it in full.");
      } else if (msg.includes('credit') || msg.includes('balance') || msg.includes('quota')) {
        setError('Your account has no remaining credit. Add a balance and try again.');
      } else {
        setError(`Connection failed: ${msg}`);
      }
    } finally {
      setTesting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (envStatus === null) {
    return (
      <div className="bg-navy-900 border border-gray-700 rounded-xl p-6 text-center">
        <p className="text-gray-500 text-sm">Checking your setup...</p>
      </div>
    );
  }

  const cfg = PROVIDERS[provider];

  return (
    <div className="bg-navy-900 border border-gray-700 rounded-xl p-6 max-w-md">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <p className="text-sm font-semibold text-white mb-1">Connect an AI model</p>
      <p className="text-xs text-gray-400 mb-5">
        Shellmate uses AI to have a conversation with you and set up your helper. You'll need an API key or OAuth token.
      </p>

      {/* ── Provider picker ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5">
        {Object.entries(PROVIDERS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => switchProvider(key)}
            className={`flex-1 flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-colors ${
              provider === key
                ? 'border-shell-500 bg-shell-900/30'
                : 'border-gray-700 bg-gray-800/60 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-sm font-semibold ${provider === key ? 'text-white' : 'text-gray-300'}`}>
                {p.label}
              </span>
              {p.badge && (
                <span className="text-xs bg-shell-800 text-shell-300 px-1.5 py-0.5 rounded-full leading-none">
                  {p.badge}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">{p.costNote}</span>
          </button>
        ))}
      </div>

      {/* ── Mode toggle ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded-lg mb-5">
        {[
          { id: 'need', label: "I need to get one" },
          { id: 'have', label: "I already have one" },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => switchMode(opt.id)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === opt.id
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Auth method picker + step-by-step guide ──────────────────────────── */}
      {mode === 'need' && (
        <>
          <div className="flex gap-2 mb-4">
            {cfg.authMethods.map(method => (
              <button
                key={method.id}
                onClick={() => { setAuthMethod(method.id); setError(''); }}
                className={`flex-1 px-3 py-2 rounded-lg border text-left transition-colors ${
                  authMethod === method.id
                    ? 'border-shell-500 bg-shell-900/20'
                    : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                }`}
              >
                <span className={`block text-xs font-semibold ${authMethod === method.id ? 'text-white' : 'text-gray-400'}`}>
                  {method.label}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">{method.desc}</span>
              </button>
            ))}
          </div>

          <ol className="space-y-3 mb-5">
            {(cfg.authMethods.find(m => m.id === authMethod)?.steps || []).map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-shell-900 border border-shell-700 flex items-center justify-center text-xs font-bold text-shell-400 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="text-sm text-gray-300 leading-relaxed min-w-0">
                  {step.url ? (
                    <>
                      Go to{' '}
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-shell-400 hover:text-shell-300 underline font-medium"
                      >
                        {step.urlLabel}
                      </a>
                      {' '}and {step.text.toLowerCase()}.
                    </>
                  ) : step.text}
                  {step.note && (
                    <span className="block text-xs text-gray-500 mt-0.5">{step.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* ── Key input ───────────────────────────────────────────────────────── */}
      <div className="mb-1">
        {mode === 'need' && (
          <label className="block text-xs text-gray-400 mb-1.5">Paste your key or token here:</label>
        )}
        <input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder={cfg.placeholder}
          autoFocus={mode === 'have'}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 font-mono"
        />
        <p className="text-xs text-gray-600 mt-1.5">
          {cfg.tokenHint} Stored in your browser session only — never sent to us.
        </p>
      </div>

      {error && <p className="text-red-400 text-xs mt-3 mb-1">{error}</p>}

      <button
        onClick={handleConnect}
        disabled={testing || !apiKey.trim()}
        className="w-full mt-4 px-5 py-3 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
      >
        {testing ? '⟳ Testing connection...' : 'Connect →'}
      </button>
    </div>
  );
}
