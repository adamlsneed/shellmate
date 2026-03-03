import { useState, useEffect } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';

const PROVIDERS = {
  anthropic: {
    label: 'Anthropic Claude',
    badge: 'Recommended',
    defaultModel: 'claude-sonnet-4-6',
    placeholder: 'sk-ant-api03-... or sk-ant-oat...',
    costNote: 'Free $5 credit on signup',
    authMethods: [
      {
        id: 'apikey',
        label: 'API Key',
        desc: 'Pay-as-you-go',
        steps: [
          {
            text: 'Create a free account',
            url: 'https://console.anthropic.com',
            urlLabel: 'console.anthropic.com',
            note: 'Includes $5 in free credit.',
          },
          { text: <>Click <strong className="text-gray-200">API Keys</strong> in the sidebar.</> },
          { text: <>Click <strong className="text-gray-200">Create Key</strong>, name it, copy it.</> },
          { text: 'Paste it below.' },
        ],
      },
      {
        id: 'oauth',
        label: 'OAuth Token',
        desc: 'Claude Pro / Max',
        steps: [
          {
            text: 'Install Claude Code',
            url: 'https://docs.anthropic.com/en/docs/claude-code/overview',
            urlLabel: 'docs.anthropic.com',
          },
          { text: <>Run <code className="bg-gray-700 px-1 py-0.5 rounded text-shell-300 text-xs">claude setup-token</code> in Terminal.</> },
          { text: 'Log in and copy the token.' },
          { text: 'Paste it below.' },
        ],
      },
    ],
    tokenHint: 'API keys (sk-ant-api03-...) or OAuth tokens (sk-ant-oat...).',
  },
  openai: {
    label: 'OpenAI GPT',
    defaultModel: 'gpt-4o',
    placeholder: 'sk-proj-... or OAuth token',
    costNote: '~$0.05 per session',
    authMethods: [
      {
        id: 'apikey',
        label: 'API Key',
        desc: 'Pay-as-you-go',
        steps: [
          {
            text: 'Create an account',
            url: 'https://platform.openai.com/signup',
            urlLabel: 'platform.openai.com',
            note: 'Add $5 credit to get started.',
          },
          { text: <>Profile icon → <strong className="text-gray-200">API keys</strong>.</> },
          { text: <>Click <strong className="text-gray-200">Create new secret key</strong>, copy it.</> },
          { text: 'Paste it below.' },
        ],
      },
      {
        id: 'oauth',
        label: 'OAuth Token',
        desc: 'ChatGPT Plus / Max',
        steps: [
          {
            text: 'Install Codex CLI',
            url: 'https://github.com/openai/codex',
            urlLabel: 'github.com/openai/codex',
          },
          { text: <>Run <code className="bg-gray-700 px-1 py-0.5 rounded text-shell-300 text-xs">codex</code> in Terminal and log in.</> },
          { text: <>Copy the token from <code className="bg-gray-700 px-1 py-0.5 rounded text-shell-300 text-xs">~/.codex/auth.json</code>.</> },
          { text: 'Paste it below.' },
        ],
      },
    ],
    tokenHint: 'API keys (sk-proj-...) or OAuth tokens.',
  },
};

export default function AISetup({ onDone }) {
  const { configure } = useAIConfig();

  const [envStatus, setEnvStatus]           = useState(null);
  const [provider, setProvider]             = useState('anthropic');
  const [mode, setMode]                     = useState('need');
  const [authMethod, setAuthMethod]         = useState('apikey');
  const [apiKey, setApiKey]                 = useState('');
  const [error, setError]                   = useState('');
  const [testing, setTesting]               = useState(false);

  useEffect(() => {
    fetch('/api/chat/env-status')
      .then(r => r.json())
      .then(data => {
        setEnvStatus(data);
        if (data.available) {
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
      <div className="bg-navy-900 border border-gray-700 rounded-xl p-5 text-center">
        <p className="text-gray-500 text-sm">Checking your setup...</p>
      </div>
    );
  }

  const cfg = PROVIDERS[provider];

  return (
    <div className="bg-navy-900 border border-gray-700 rounded-xl p-5 max-w-md">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <p className="text-sm font-semibold text-white mb-0.5">Connect an AI model</p>
      <p className="text-xs text-gray-500 mb-4">
        You'll need an API key or OAuth token from one of these providers.
      </p>

      {/* ── Provider picker ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4">
        {Object.entries(PROVIDERS).map(([key, p]) => (
          <button
            key={key}
            onClick={() => switchProvider(key)}
            className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${
              provider === key
                ? 'border-shell-500 bg-shell-900/30'
                : 'border-gray-700 bg-gray-800/60 hover:border-gray-600'
            }`}
          >
            <span className={`text-sm font-semibold ${provider === key ? 'text-white' : 'text-gray-300'}`}>
              {p.label}
            </span>
            {p.badge && provider === key && (
              <span className="text-xs bg-shell-800 text-shell-300 px-1.5 py-0.5 rounded-full leading-none">
                {p.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Mode toggle ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-800 rounded-lg mb-4">
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
          <div className="flex gap-2 mb-3">
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

          <ol className="space-y-2 mb-4">
            {(cfg.authMethods.find(m => m.id === authMethod)?.steps || []).map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <div className="w-5 h-5 rounded-full bg-shell-900 border border-shell-700 flex items-center justify-center text-xs font-bold text-shell-400 shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="text-sm text-gray-300 leading-snug min-w-0">
                  {step.url ? (
                    <>
                      <a
                        href={step.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-shell-400 hover:text-shell-300 underline font-medium"
                      >
                        {step.urlLabel}
                      </a>
                      {' — '}{step.text.toLowerCase()}.
                    </>
                  ) : step.text}
                  {step.note && (
                    <span className="text-xs text-gray-500 ml-1">{step.note}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {/* ── Key input ───────────────────────────────────────────────────────── */}
      <div className="mb-1">
        <input
          type="password"
          value={apiKey}
          onChange={e => { setApiKey(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          placeholder={cfg.placeholder}
          autoFocus={mode === 'have'}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 font-mono"
        />
        <p className="text-xs text-gray-600 mt-1">
          {cfg.tokenHint} Never sent to us.
        </p>
      </div>

      {error && <p className="text-red-400 text-xs mt-2 mb-1">{error}</p>}

      <button
        onClick={handleConnect}
        disabled={testing || !apiKey.trim()}
        className="w-full mt-3 px-5 py-2.5 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
      >
        {testing ? '⟳ Testing connection...' : 'Connect →'}
      </button>
    </div>
  );
}
