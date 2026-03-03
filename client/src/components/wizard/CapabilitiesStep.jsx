import { useState, useEffect } from 'react';
import { useWizard } from '../../hooks/useWizard.js';
import { useTeamSpecStore } from '../../store/teamSpec.js';

/* ── Shared primitives ──────────────────────────────────────────────────────── */

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-shell-600' : 'bg-gray-700'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', hint }) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-400 mb-1">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-navy-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-shell-500"
      />
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

/* ── Section heading ────────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

/* ── Capability card (with optional toggle) ─────────────────────────────────── */

function CapabilityCard({ title, icon, description, enabled, onToggle, children }) {
  const hasToggle = typeof onToggle === 'function';
  return (
    <div className={`border rounded-xl p-4 transition-colors ${
      hasToggle && enabled ? 'border-shell-700 bg-gray-800/60' : 'border-gray-800 bg-gray-800/20'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-sm text-white">{title}</span>
        </div>
        {hasToggle && <Toggle enabled={enabled} onChange={onToggle} />}
      </div>
      <p className="text-xs text-gray-500 mb-3 ml-7">{description}</p>
      {hasToggle && enabled && children && (
        <div className="ml-7 space-y-3 pt-2 border-t border-gray-700">
          {children}
        </div>
      )}
      {!hasToggle && children && (
        <div className="ml-7 space-y-3 pt-2 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Informational card (no toggle, just descriptive text) ──────────────────── */

function InfoCard({ title, icon, description, note }) {
  return (
    <div className="border border-gray-800 bg-gray-800/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-sm text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-500 ml-7">{description}</p>
      {note && (
        <p className="text-xs text-gray-600 ml-7 mt-2 italic">{note}</p>
      )}
    </div>
  );
}

/* ── Safety toggle row ──────────────────────────────────────────────────────── */

function SafetyRow({ label, description, allowed, onToggle }) {
  return (
    <div className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors ${
      allowed ? 'border-gray-800 bg-gray-800/20' : 'border-red-900/50 bg-red-900/10'
    }`}>
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Toggle enabled={allowed} onChange={onToggle} />
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */

export default function CapabilitiesStep() {
  const { advance: wizAdvance } = useWizard();
  const { teamSpec } = useTeamSpecStore();
  const recommendedSkills = teamSpec.capabilities?.recommendedSkills || [];

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // Memory
  const [memoryMode, setMemoryMode] = useState('core');
  const [lancedbAutoRecall, setLancedbAutoRecall]   = useState(true);
  const [lancedbAutoCapture, setLancedbAutoCapture] = useState(false);
  const [lancedbKey, setLancedbKey]   = useState('');
  const [lancedbModel, setLancedbModel] = useState('text-embedding-3-small');

  // Web search (Brave only)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [braveKey, setBraveKey] = useState('');

  // Web browsing
  const [webFetchEnabled, setWebFetchEnabled] = useState(false);

  // Home Assistant
  const [haEnabled, setHaEnabled] = useState(false);
  const [haToken, setHaToken] = useState('');
  const [haUrl, setHaUrl] = useState('http://homeassistant.local:8123');

  // Safety — tools.deny
  const [allowExec, setAllowExec]       = useState(true);
  const [allowWrite, setAllowWrite]     = useState(true);
  const [allowBrowser, setAllowBrowser] = useState(true);

  /* ── Load current config ────────────────────────────────────────────────── */

  useEffect(() => {
    fetch('/api/capabilities')
      .then(r => r.json())
      .then(d => {
        const currentMemory = d.memory?.mode || 'none';
        const aiMemory = teamSpec.capabilities?.memory;
        setMemoryMode(currentMemory !== 'none' ? currentMemory : (aiMemory || 'core'));

        setLancedbAutoRecall(d.memory?.lancedb?.autoRecall ?? true);
        setLancedbAutoCapture(d.memory?.lancedb?.autoCapture ?? false);
        setLancedbKey(d.memory?.lancedb?.embeddingApiKey || '');
        setLancedbModel(d.memory?.lancedb?.embeddingModel || 'text-embedding-3-small');

        const currentSearch = d.webSearch?.enabled || false;
        setWebSearchEnabled(currentSearch || teamSpec.capabilities?.webSearch || false);
        setBraveKey(d.webSearch?.braveApiKey || '');

        setWebFetchEnabled(d.webFetch?.enabled || teamSpec.capabilities?.webFetch || false);

        setHaEnabled(d.homeAssistant?.enabled || false);
        setHaToken(d.homeAssistant?.token || '');
        setHaUrl(d.homeAssistant?.url || 'http://homeassistant.local:8123');

        // Safety — derive from store's tools.deny
        const deny = teamSpec.capabilities?.tools?.deny || [];
        setAllowExec(!deny.includes('exec'));
        setAllowWrite(!deny.includes('write'));
        setAllowBrowser(!deny.includes('browser'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Build deny array from safety toggles ───────────────────────────────── */

  function buildDenyArray() {
    const deny = [];
    if (!allowExec)    deny.push('exec');
    if (!allowWrite)   deny.push('write');
    if (!allowBrowser) deny.push('browser');
    return deny;
  }

  /* ── Save ────────────────────────────────────────────────────────────────── */

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const deny = buildDenyArray();
      const agentId = teamSpec.agent?.id || 'main';

      const res = await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentToolDeny: deny.length > 0 ? { [agentId]: deny } : {},
          memory: {
            mode: memoryMode,
            lancedb: {
              autoRecall: lancedbAutoRecall,
              autoCapture: lancedbAutoCapture,
              embeddingApiKey: lancedbKey,
              embeddingModel: lancedbModel,
            },
          },
          webSearch: {
            enabled: webSearchEnabled,
            provider: 'brave',
            braveApiKey: braveKey,
          },
          webFetch: { enabled: webFetchEnabled },
          homeAssistant: { enabled: haEnabled, token: haToken, url: haUrl },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ── Loading state ──────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <span className="animate-spin">&#x27F3;</span> Loading current config...
      </div>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── 1. AI-recommended skills ──────────────────────────────────────── */}
      {recommendedSkills.length > 0 && (
        <div className="border border-shell-700/50 bg-shell-900/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">&#x2728;</span>
            <span className="text-sm font-semibold text-shell-300">Recommended for your agent</span>
          </div>
          <div className="space-y-3">
            {recommendedSkills.map(skill => (
              <div key={skill.id} className="flex items-start gap-3 bg-navy-900/40 rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{skill.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      skill.source === 'installed'
                        ? 'text-green-400 border-green-800 bg-green-900/20'
                        : 'text-blue-400 border-blue-800 bg-blue-900/20'
                    }`}>
                      {skill.source === 'installed' ? 'already installed' : 'clawhub'}
                    </span>
                    {skill.requiresApiKey && (
                      <span className="text-xs text-yellow-500 border border-yellow-800 rounded px-1.5 py-0.5">
                        needs API key
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{skill.reason}</p>
                  {skill.source === 'clawhub' && skill.install && (
                    <code className="text-xs text-gray-600 mt-1 block">{skill.install}</code>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Skills marked "clawhub" can be installed via the terminal command shown above.
          </p>
        </div>
      )}

      {/* ── 2. Basics ─────────────────────────────────────────────────────── */}
      <Section title="Basics">

        {/* Memory */}
        <div className="border border-gray-800 bg-gray-800/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#x1F9E0;</span>
            <span className="font-semibold text-sm text-white">Memory</span>
          </div>
          <p className="text-xs text-gray-500 mb-4 ml-7">
            How your agent remembers things between conversations.
          </p>

          <div className="ml-7 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'none',    label: 'None',    desc: 'Manual markdown files only' },
                { id: 'core',    label: 'Core',    desc: 'Recommended — lightweight structured memory',      badge: 'default' },
                { id: 'lancedb', label: 'LanceDB', desc: 'Advanced — semantic vector search (needs OpenAI key)', badge: 'power user' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setMemoryMode(opt.id)}
                  className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                    memoryMode === opt.id
                      ? 'border-shell-500 bg-shell-900/30 text-white'
                      : 'border-gray-700 bg-navy-900/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    {opt.label}
                    {opt.badge && (
                      <span className={`text-[10px] px-1 py-0.5 rounded leading-none ${
                        opt.badge === 'default'
                          ? 'bg-shell-900/50 text-shell-400 border border-shell-700'
                          : 'bg-gray-800 text-gray-500 border border-gray-700'
                      }`}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            {memoryMode === 'lancedb' && (
              <div className="space-y-3 pt-2 border-t border-gray-700">
                <Field
                  label="OpenAI Embedding API Key"
                  value={lancedbKey}
                  onChange={setLancedbKey}
                  placeholder="sk-..."
                  type="password"
                  hint={<>Used only for memory embeddings, not chat. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Get a key at platform.openai.com</a> &rarr; API keys &rarr; Create new secret key. The <span className="text-gray-400">text-embedding-3-small</span> model costs fractions of a cent per call.</>}
                />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lancedbAutoRecall}
                      onChange={e => setLancedbAutoRecall(e.target.checked)}
                      className="rounded"
                    />
                    Auto-recall
                    <span className="text-gray-600">(search memory on every message)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lancedbAutoCapture}
                      onChange={e => setLancedbAutoCapture(e.target.checked)}
                      className="rounded"
                    />
                    Auto-capture
                    <span className="text-gray-600">(auto-save after each session)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Web Search -- Brave only */}
        <CapabilityCard
          title="Web Search"
          icon="&#x1F50D;"
          description="Search the web for real-time information using Brave Search."
          enabled={webSearchEnabled}
          onToggle={setWebSearchEnabled}
        >
          <Field
            label="Brave Search API Key"
            value={braveKey}
            onChange={setBraveKey}
            placeholder="BSA..."
            type="password"
            hint={<><a href="https://api.search.brave.com" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Sign up at api.search.brave.com</a> &rarr; Create an app &rarr; copy the API key. Free tier: 2,000 queries/month.</>}
          />
        </CapabilityCard>

        {/* Web Browsing */}
        <CapabilityCard
          title="Web Browsing"
          icon="&#x1F310;"
          description="Open URLs and read web pages. Uses a headless browser — no API key needed."
          enabled={webFetchEnabled}
          onToggle={setWebFetchEnabled}
        />
      </Section>

      {/* ── 3. Mac Integration ────────────────────────────────────────────── */}
      <Section title="Mac Integration">
        <CapabilityCard
          title="Calendar"
          icon="&#x1F4C5;"
          description="Read and create calendar events via Google Calendar."
        >
          <p className="text-xs text-gray-400">
            Install the Google Calendar skill from ClawHub:
          </p>
          <code className="text-xs text-gray-500 bg-navy-900/60 rounded px-2 py-1 block">
            clawhub install google-calendar
          </code>
          <p className="text-xs text-gray-600">
            Once installed, follow the skill's setup instructions to connect your Google account.
          </p>
        </CapabilityCard>

        <InfoCard
          title="Shortcuts"
          icon="&#x26A1;"
          description="Run macOS Shortcuts automations from the terminal."
          note="Your agent can trigger any Shortcut via the shortcuts command. No additional setup needed — just make sure the Shortcuts you want are saved in the Shortcuts app."
        />

        <InfoCard
          title="Finder"
          icon="&#x1F4C2;"
          description="Organize files, clean downloads, manage your desktop."
          note="Your agent can already read and organize files using built-in tools. For file cleanup automations, describe what you want in the conversation phase and it will be included in your agent's instructions."
        />
      </Section>

      {/* ── 4. Smart Home ─────────────────────────────────────────────────── */}
      <Section title="Smart Home">
        <CapabilityCard
          title="HomeKit / Home Assistant"
          icon="&#x1F3E0;"
          description="Control smart home devices — lights, locks, thermostats, automations."
          enabled={haEnabled}
          onToggle={setHaEnabled}
        >
          <Field
            label="Long-Lived Access Token"
            value={haToken}
            onChange={setHaToken}
            placeholder="eyJ..."
            type="password"
            hint={<>In Home Assistant: click your profile (bottom-left) &rarr; Security &rarr; <a href="https://www.home-assistant.io/docs/authentication/#your-account-profile" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Long-Lived Access Tokens</a> &rarr; Create token.</>}
          />
          <Field
            label="Home Assistant URL"
            value={haUrl}
            onChange={setHaUrl}
            placeholder="http://homeassistant.local:8123"
            hint={<>Your HA instance URL. Works on local network or via <a href="https://www.nabucasa.com" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Nabu Casa</a> remote access.</>}
          />
        </CapabilityCard>
      </Section>

      {/* ── 5. Permissions ────────────────────────────────────────────────── */}
      <Section title="Permissions — what it can do without asking">
        <p className="text-xs text-gray-400 -mt-2 mb-3">
          Toggle off anything your helper should not do on its own. You can always change these later.
        </p>
        <div className="space-y-2">
          <SafetyRow
            label="Run terminal commands"
            description="Execute shell commands, run scripts, install packages, trigger Shortcuts"
            allowed={allowExec}
            onToggle={setAllowExec}
          />
          <SafetyRow
            label="Create and modify files"
            description="Create, edit, move, or delete files and folders on your Mac"
            allowed={allowWrite}
            onToggle={setAllowWrite}
          />
          <SafetyRow
            label="Browse the web"
            description="Open and interact with web pages using a headless browser"
            allowed={allowBrowser}
            onToggle={setAllowBrowser}
          />
        </div>
        {(!allowExec || !allowWrite || !allowBrowser) && (
          <p className="text-xs text-yellow-500/80 mt-2">
            Restricted actions will require explicit permission each time.
          </p>
        )}
      </Section>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        {!saved ? (
          <>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-shell-600 hover:bg-shell-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? '\u27F3 Saving...' : 'Save capabilities \u2192'}
            </button>
            <button
              onClick={wizAdvance}
              className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Skip for now
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>&#x2713;</span>
              <span>Capabilities saved to shellmate.json</span>
            </div>
            <button
              onClick={wizAdvance}
              className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Finish setup &rarr;
            </button>
          </>
        )}
      </div>
    </div>
  );
}
