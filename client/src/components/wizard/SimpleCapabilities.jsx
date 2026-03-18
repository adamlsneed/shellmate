import { useState } from 'react';
import { BigButton } from '../common/BigButton.jsx';

/**
 * Friendly capabilities setup for non-technical users.
 * Each capability has a plain-language explanation and step-by-step
 * instructions for getting any required keys.
 */

function Step({ number, children }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-label font-bold flex-shrink-0">
        {number}
      </div>
      <p className="text-body text-[var(--text-secondary)] pt-0.5">
        {children}
      </p>
    </div>
  );
}

function CapabilitySection({ title, description, icon, expanded, onToggle, children }) {
  return (
    <div className="border-2 border-[var(--border)] rounded-friendly overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--bg-card)] transition-colors"
      >
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <div className="text-body font-semibold text-[var(--text-primary)]">{title}</div>
          <div className="text-small text-[var(--text-muted)]">{description}</div>
        </div>
        <span className="text-[var(--text-muted)] text-xl">{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-[var(--border)] space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SimpleCapabilities({ onDone, onSkip }) {
  const [expanded, setExpanded] = useState(null);
  const [braveKey, setBraveKey] = useState('');
  const [shellEnabled, setShellEnabled] = useState(false);
  const [haToken, setHaToken] = useState('');
  const [haUrl, setHaUrl] = useState('http://homeassistant.local:8123');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(id) {
    setExpanded(expanded === id ? null : id);
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      const body = {
        webSearch: braveKey.trim()
          ? { enabled: true, provider: 'brave', braveApiKey: braveKey.trim() }
          : { enabled: false },
        webFetch: { enabled: true },
        homeAssistant: haToken.trim()
          ? { enabled: true, token: haToken.trim(), url: haUrl.trim() || 'http://homeassistant.local:8123' }
          : { enabled: false },
      };

      // Save capabilities
      const res = await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');

      // If user enabled shell access, update the agent's deny list
      if (shellEnabled) {
        const cfgRes = await fetch('/api/config');
        const cfg = await cfgRes.json();
        const list = cfg.agents?.list || [];
        const mainAgent = list.find(a => a.id === 'main');
        if (mainAgent) {
          const currentDeny = mainAgent.tools?.deny || ['exec'];
          const newDeny = currentDeny.filter(d => d !== 'exec');
          await fetch('/api/capabilities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentToolDeny: { main: newDeny },
            }),
          });
        }
      }

      onDone();
    } catch (err) {
      console.error('Capabilities save error:', err);
      setError("Couldn't save. You can set these up later in Settings.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-6 py-8">
      <div className="text-4xl mb-4">🐢</div>
      <h1 className="text-h2 text-[var(--text-primary)] mb-2 text-center">
        Extra features
      </h1>
      <p className="text-body text-[var(--text-secondary)] mb-8 text-center max-w-md">
        These are optional — you can set them up now or skip and come back later.
      </p>

      <div className="w-full max-w-lg space-y-3 mb-8">

        {/* ── Web Search ────────────────────────────────────────────── */}
        <CapabilitySection
          icon="🔍"
          title="Web search"
          description="Let Shellmate search the internet to answer your questions"
          expanded={expanded === 'search'}
          onToggle={() => toggle('search')}
        >
          <p className="text-body text-[var(--text-secondary)]">
            This lets Shellmate look things up online for you — like checking the weather, finding how-to guides, or researching anything you ask about.
          </p>
          <p className="text-body text-[var(--text-secondary)] font-medium">
            To enable this, you'll need a free Brave Search key:
          </p>
          <div className="space-y-3">
            <Step number={1}>
              <span>Go to </span>
              <a href="https://brave.com/search/api/" target="_blank" rel="noopener noreferrer"
                className="text-[var(--accent)] underline font-medium">
                brave.com/search/api
              </a>
              <span> and create a free account.</span>
            </Step>
            <Step number={2}>
              Click <strong className="text-[var(--text-primary)]">Get Started</strong> and choose the free plan (2,000 searches/month).
            </Step>
            <Step number={3}>
              Copy your API key and paste it below.
            </Step>
          </div>
          <input
            type="password"
            value={braveKey}
            onChange={e => setBraveKey(e.target.value)}
            placeholder="Paste your Brave Search key here"
            className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
          />
          {braveKey.trim() && (
            <div className="flex items-center gap-2 text-green-500 text-body">
              <span>✓</span> Key entered — web search will be enabled
            </div>
          )}
        </CapabilitySection>

        {/* ── Shell Access ──────────────────────────────────────────── */}
        <CapabilitySection
          icon="💻"
          title="Run commands on your Mac"
          description="Let Shellmate run Terminal commands to fix problems and automate tasks"
          expanded={expanded === 'shell'}
          onToggle={() => toggle('shell')}
        >
          <p className="text-body text-[var(--text-secondary)]">
            This gives Shellmate the ability to run commands on your Mac — like opening apps, organizing files, checking settings, or fixing problems. It's what makes Shellmate a real IT helper instead of just a chatbot.
          </p>
          <div className="px-4 py-3 rounded-friendly bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700">
            <p className="text-body text-yellow-700 dark:text-yellow-300">
              <strong>Good to know:</strong> Shellmate will always ask before doing anything risky, like deleting files or changing settings. But if you're not sure, you can leave this off and Shellmate will still be able to answer questions and help with web searches.
            </p>
          </div>
          <button
            onClick={() => setShellEnabled(!shellEnabled)}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-friendly border-2 transition-colors ${
              shellEnabled
                ? 'border-[var(--accent)] bg-[var(--accent-light)]'
                : 'border-[var(--border)] bg-[var(--bg-primary)]'
            }`}
          >
            <span className="text-body text-[var(--text-primary)] font-medium">
              {shellEnabled ? 'Commands enabled' : 'Commands disabled'}
            </span>
            <div className={`w-12 h-7 rounded-full transition-colors flex items-center ${
              shellEnabled ? 'bg-[var(--accent)] justify-end' : 'bg-[var(--border)] justify-start'
            }`}>
              <div className="w-5 h-5 rounded-full bg-white mx-1 shadow" />
            </div>
          </button>
        </CapabilitySection>

        {/* ── Smart Home ────────────────────────────────────────────── */}
        <CapabilitySection
          icon="🏠"
          title="Smart home control"
          description="Control your smart home devices through Shellmate"
          expanded={expanded === 'home'}
          onToggle={() => toggle('home')}
        >
          <p className="text-body text-[var(--text-secondary)]">
            If you use Home Assistant to control your lights, thermostat, or other smart devices, you can connect it here. Shellmate can then turn things on/off, check statuses, or run automations for you.
          </p>
          <p className="text-body text-[var(--text-secondary)] font-medium">
            You'll need your Home Assistant access token:
          </p>
          <div className="space-y-3">
            <Step number={1}>
              Open your Home Assistant dashboard in a web browser.
            </Step>
            <Step number={2}>
              Click your profile picture (bottom-left), scroll to <strong className="text-[var(--text-primary)]">Long-Lived Access Tokens</strong>.
            </Step>
            <Step number={3}>
              Click <strong className="text-[var(--text-primary)]">Create Token</strong>, name it "Shellmate", and copy it.
            </Step>
          </div>
          <input
            type="password"
            value={haToken}
            onChange={e => setHaToken(e.target.value)}
            placeholder="Paste your Home Assistant token here"
            className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
          />
          {haToken.trim() && (
            <>
              <div className="flex items-center gap-2 text-green-500 text-body">
                <span>✓</span> Token entered
              </div>
              <div>
                <label className="block text-small text-[var(--text-muted)] mb-1">Home Assistant URL (usually fine as-is)</label>
                <input
                  type="text"
                  value={haUrl}
                  onChange={e => setHaUrl(e.target.value)}
                  className="w-full min-h-input px-5 rounded-friendly text-body bg-[var(--bg-primary)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300"
                />
              </div>
            </>
          )}
        </CapabilitySection>
      </div>

      {error && (
        <p className="text-body text-red-500 bg-red-50 dark:bg-red-900/20 rounded-friendly px-4 py-3 mb-4 max-w-lg w-full">
          {error}
        </p>
      )}

      <div className="w-full max-w-lg flex flex-col gap-3">
        {(braveKey.trim() || shellEnabled || haToken.trim()) ? (
          <BigButton onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save and start chatting'}
          </BigButton>
        ) : (
          <BigButton onClick={onSkip} className="w-full">
            Start chatting
          </BigButton>
        )}
        {(braveKey.trim() || shellEnabled || haToken.trim()) && (
          <button
            onClick={onSkip}
            className="text-body text-[var(--accent)] hover:underline"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
