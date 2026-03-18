# Senior-Friendly UI Overhaul — "IT Buddy for Mac"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Shellmate from a developer-oriented setup wizard + chat into an effortlessly simple "IT buddy" that an 80-year-old non-technical Mac user can launch, set up, and use with confidence — while retaining full tool execution power underneath.

**Architecture:** The overhaul touches 3 layers: (1) a new Tailwind theme system with large typography, high contrast, and a light mode default; (2) a radically simplified wizard that collapses 5 phases into 2-3 with sensible defaults and zero jargon; (3) a friendlier chat experience that hides technical tool output behind human-readable descriptions. The server/tool engine is untouched — all changes are client-side.

**Tech Stack:** React 18, Zustand, TailwindCSS v3, Vite 5. No new dependencies except possibly `@tailwindcss/forms` for better default form styling.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `client/src/theme.js` | Theme constants (font sizes, spacing, color tokens) + light/dark mode toggle state |
| `client/src/components/common/BigButton.jsx` | Reusable large button component (min 48px height, 18px+ text) |
| `client/src/components/common/FriendlyToolStatus.jsx` | Human-readable tool execution display (replaces raw ToolCallDisplay in simple mode) |
| `client/src/components/common/QuickActions.jsx` | Pre-built action chips for chat ("Check my email", "Open Photos", etc.) |
| `client/src/components/settings/SettingsPanel.jsx` | Settings modal with theme toggle, connection info, and advanced mode access |
| `client/src/components/wizard/SimpleSetup.jsx` | New simplified wizard — replaces the 5-phase flow with 2-3 steps |
| `client/src/components/ai/SimpleAISetup.jsx` | Simplified API key entry — feels like "sign in", not developer config |

### Modified Files
| File | What Changes |
|------|-------------|
| `tailwind.config.js` | Add light theme colors, larger base font size, accessibility spacing scale |
| `client/src/index.css` | Add light theme CSS variables, base font size bump |
| `client/src/App.jsx` | Route to `SimpleSetup` instead of `WizardShell` for new users |
| `client/src/hooks/useWizard.js` | Add simplified phase constants (CHAT → DONE, skip middle steps) |
| `client/src/store/teamSpec.js` | Add `simpleMode` flag, auto-populate sensible defaults |
| `client/src/store/aiConfig.js` | No structural changes, but SimpleAISetup will call same `configure()` |
| `client/src/components/chat/ChatApp.jsx` | Larger text, bigger input, quick-action chips, friendly tool display |
| `client/src/components/common/MessageBubble.jsx` | Larger font, more padding, better contrast in light mode |
| `client/src/components/chat/ToolCallDisplay.jsx` | Add `friendly` prop — shows human description instead of raw JSON |
| `client/src/components/wizard/WizardShell.jsx` | Keep as "advanced mode" path, no changes needed |
| `client/src/components/wizard/ConversationPhase.jsx` | Update system prompt for simpler questions when in simple mode |

### Unchanged (but important context)
| File | Why Unchanged |
|------|--------------|
| `server/tools/*` | Full tool power stays — we're only changing the UI layer |
| `server/routes/agentChat.js` | SSE streaming + tool loop stays exactly as-is |
| `server/generators/*` | Workspace file generation stays — SimpleSetup calls the same APIs |
| `server/utils/config.js` | Config read/write unchanged |

---

## Task 1: Tailwind Theme — Large Typography & Light Mode

**Files:**
- Modify: `tailwind.config.js` (all 29 lines — theme extension)
- Modify: `client/src/index.css` (base styles)
- Create: `client/src/theme.js`

This task establishes the visual foundation. Every subsequent task builds on these tokens.

- [ ] **Step 1: Add light theme colors and spacing to Tailwind config**

```js
// tailwind.config.js — replace the entire file
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#1a1f2e',
          950: '#131825',
        },
        shell: {
          50:  '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Light mode surfaces
        cream: {
          50:  '#fefefe',
          100: '#f8f7f5',
          200: '#f0eeeb',
          300: '#e2dfd9',
        },
      },
      fontSize: {
        // Senior-friendly scale (minimum 18px body)
        'body':    ['18px', { lineHeight: '1.6' }],
        'body-lg': ['20px', { lineHeight: '1.6' }],
        'label':   ['16px', { lineHeight: '1.5' }],
        'h1':      ['32px', { lineHeight: '1.3', fontWeight: '700' }],
        'h2':      ['26px', { lineHeight: '1.3', fontWeight: '600' }],
        'h3':      ['22px', { lineHeight: '1.4', fontWeight: '600' }],
        'small':   ['16px', { lineHeight: '1.5' }],
      },
      spacing: {
        // Larger tap targets
        'btn': '48px',   // min button height
        'input': '52px', // min input height
      },
      borderRadius: {
        'friendly': '16px',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 2: Add light mode CSS variables and base font bump**

```css
/* client/src/index.css — REPLACE the entire file with this.
   The old @layer base with `@apply bg-navy-950 text-gray-100` must be removed
   or it will override our CSS variable-based theming. */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Light mode (default for new users) */
:root {
  --bg-primary: #f8f7f5;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #4a4a4a;
  --text-muted: #7a7a7a;
  --border: #e2dfd9;
  --accent: #0891b2;
  --accent-light: #ecfeff;
  --user-bubble: #0891b2;
  --user-bubble-text: #ffffff;
  --assistant-bubble: #ffffff;
  --assistant-bubble-text: #1a1a1a;
  font-size: 18px;
}

/* Dark mode (existing users, toggle) */
.dark {
  --bg-primary: #131825;
  --bg-secondary: #1a1f2e;
  --bg-card: #1e2436;
  --text-primary: #f0f0f0;
  --text-secondary: #c0c0c0;
  --text-muted: #808080;
  --border: #2a3040;
  --accent: #22d3ee;
  --accent-light: #0e7490;
  --user-bubble: #0e7490;
  --user-bubble-text: #ffffff;
  --assistant-bubble: #1e2436;
  --assistant-bubble-text: #f0f0f0;
}

@layer base {
  body {
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 100vh;
  }
}

@layer utilities {
  .scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: #2a3040 transparent;
  }
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #2a3040;
    border-radius: 3px;
  }
}
```

- [ ] **Step 3: Create theme constants module**

```js
// client/src/theme.js
import { create } from 'zustand';

// Human-readable tool descriptions (used by FriendlyToolStatus)
export const FRIENDLY_TOOL_NAMES = {
  shell_exec:  'Running a command',
  file_read:   'Reading a file',
  file_write:  'Saving a file',
  file_list:   'Looking at your files',
  web_search:  'Searching the web',
  web_fetch:   'Reading a webpage',
};

// Friendly descriptions based on tool input
export function describeTool(name, input) {
  switch (name) {
    case 'shell_exec': {
      const cmd = input?.command || '';
      if (cmd.includes('osascript')) return 'Working with a Mac app...';
      if (cmd.includes('open '))     return 'Opening something for you...';
      if (cmd.includes('defaults'))  return 'Checking a setting...';
      if (cmd.includes('say '))      return 'Reading something aloud...';
      return 'Running a command on your Mac...';
    }
    case 'file_read':  return `Reading "${shortPath(input?.path)}"...`;
    case 'file_write': return `Saving "${shortPath(input?.path)}"...`;
    case 'file_list':  return `Looking through "${shortPath(input?.path)}"...`;
    case 'web_search': return `Searching for "${input?.query}"...`;
    case 'web_fetch':  return 'Reading a webpage...';
    default:           return 'Working on it...';
  }
}

function shortPath(p) {
  if (!p) return 'a file';
  const parts = p.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || 'a file';
}

// Theme mode store (persisted to localStorage)
const THEME_KEY = 'shellmate-theme';

export const useThemeStore = create((set) => ({
  mode: localStorage.getItem(THEME_KEY) || 'light',
  setMode: (mode) => {
    localStorage.setItem(THEME_KEY, mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
    set({ mode });
  },
  toggle: () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ mode: next });
  },
}));

// Initialize theme on import
const saved = localStorage.getItem(THEME_KEY) || 'light';
document.documentElement.classList.toggle('dark', saved === 'dark');
```

- [ ] **Step 4: Verify build still works**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.js client/src/index.css client/src/theme.js
git commit -m "feat: add senior-friendly theme system with light mode and large typography"
```

---

## Task 2: Reusable UI Components — BigButton & FriendlyToolStatus

**Files:**
- Create: `client/src/components/common/BigButton.jsx`
- Create: `client/src/components/common/FriendlyToolStatus.jsx`

These are the building blocks used by everything that follows.

- [ ] **Step 1: Create BigButton component**

```jsx
// client/src/components/common/BigButton.jsx
export function BigButton({ children, onClick, variant = 'primary', disabled, className = '' }) {
  const base = 'min-h-btn px-8 rounded-friendly text-body font-semibold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-shell-300 disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.98]',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] hover:border-[var(--accent)]',
    ghost:     'text-[var(--accent)] hover:bg-[var(--accent-light)] hover:bg-opacity-10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Create FriendlyToolStatus component**

```jsx
// client/src/components/common/FriendlyToolStatus.jsx
import { describeTool } from '../../theme.js';

export function FriendlyToolStatus({ name, input, result, isExecuting }) {
  const description = describeTool(name, input);
  const isDone = !!result;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-friendly bg-[var(--bg-card)] border border-[var(--border)] my-2">
      {isExecuting ? (
        <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      ) : isDone ? (
        <span className="text-green-500 text-xl">✓</span>
      ) : (
        <span className="text-[var(--text-muted)] text-xl">○</span>
      )}
      <span className="text-body text-[var(--text-primary)]">
        {isExecuting ? description : isDone ? description.replace('...', '') + ' — done' : description}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/common/BigButton.jsx client/src/components/common/FriendlyToolStatus.jsx
git commit -m "feat: add BigButton and FriendlyToolStatus reusable components"
```

---

## Task 3: Simplified AI Setup — "Sign In" Experience

**Files:**
- Create: `client/src/components/ai/SimpleAISetup.jsx`
- Read (reference only): `client/src/components/ai/AISetup.jsx` (309 lines — keep as advanced fallback)
- Read (reference only): `client/src/store/aiConfig.js` (52 lines)

The current AISetup has provider picker, mode toggle, auth method picker, step-by-step numbered guides, and developer-oriented language. The new version has one screen with one field.

- [ ] **Step 1: Create SimpleAISetup component**

```jsx
// client/src/components/ai/SimpleAISetup.jsx
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
```

`★ Insight ─────────────────────────────────────`
**Why "access code" instead of "API key"?** The term "API key" is developer jargon. For a non-technical user, "access code" maps to familiar mental models — like a Wi-Fi password or a code from the doctor's office. The key auto-detection (`sk-ant-` prefix) means we don't need to ask which "provider" they want — we just figure it out from the format.
`─────────────────────────────────────────────────`

- [ ] **Step 2: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ai/SimpleAISetup.jsx
git commit -m "feat: add simplified AI setup with access-code framing"
```

---

## Task 4: Simplified Wizard — 2-Step Setup

**Files:**
- Create: `client/src/components/wizard/SimpleSetup.jsx`
- Modify: `client/src/components/wizard/ConversationPhase.jsx` (lines 10-103 — system prompt)
- Modify: `client/src/store/teamSpec.js` (lines 3-23 — defaults)
- Modify: `client/src/App.jsx` (lines 36-45 — routing)

This collapses the 5-phase wizard (Chat → Review → Generate → Capabilities → Done) into 2 steps: (1) a friendly AI conversation, (2) auto-generate + done. The Review, Generate, and Capabilities phases are skipped — sensible defaults are used. The full wizard remains accessible from settings for power users.

- [ ] **Step 1: Add simple-mode defaults to teamSpec store**

In `client/src/store/teamSpec.js`, add a `populateSimpleDefaults` action that fills in sensible values so we can skip Review/Generate/Capabilities:

```js
// Add after the existing `mergeSpec` action (around line 92)
// This goes inside the create() callback, same level as mergeSpec/reset

    // Fills gaps with sensible defaults and returns the updated spec (avoids stale closure)
    populateSimpleDefaults: () => {
      const state = get();
      const agent = state.teamSpec.agent;
      const updated = {
        ...state.teamSpec,
        agent: {
          ...agent,
          // Keep whatever the conversation extracted, fill gaps
          personality: agent.personality || 'Warm, patient, and encouraging. Explains things simply.',
          mission: agent.mission || 'Help with everyday Mac tasks — files, apps, settings, and questions.',
          failure: agent.failure || 'Apologize simply and suggest trying a different approach.',
          escalation: agent.escalation || 'If something seems risky, always ask before doing it.',
          never: agent.never?.length ? agent.never : [
            'Never delete files without asking first',
            'Never change system settings without asking first',
            'Never share personal information',
          ],
        },
        capabilities: {
          ...state.teamSpec.capabilities,
          webSearch: false,
          webFetch: true,
          memory: 'core',
          tools: { deny: [] },  // All tools enabled — full IT buddy power
        },
      };
      set({ teamSpec: updated });
      return updated;  // Return the new spec so callers don't hit stale closure
    },
```

- [ ] **Step 2: Update the system prompt for simple mode conversations**

In `client/src/components/wizard/ConversationPhase.jsx`, add a simpler system prompt. The existing `SYSTEM_PROMPT` (lines 10-103) is thorough but asks too many questions. Add a new constant after it:

```js
// Add after line 103 (after the existing SYSTEM_PROMPT closing backtick)

const SIMPLE_SYSTEM_PROMPT = `You are setting up Shellmate — a friendly Mac helper — for someone who is not very technical.

Your job: have a SHORT, warm conversation (3-4 exchanges max) to learn just enough to personalize their helper.

RULES:
- Use simple, warm language. No jargon. No technical terms.
- Keep your responses SHORT (2-3 sentences max).
- Use their name once you know it.
- NEVER say "agent", "AI", "model", "configuration", "workspace", or "API".
- Call yourself "your helper" or "Shellmate".

ASK THESE (one at a time, naturally):
1. Their first name
2. What they mainly use their Mac for (email, photos, browsing, etc.)
3. Which apps they use most (suggest common ones: Mail, Safari, Photos, Calendar, Messages, Notes, Reminders)
4. One or two things they wish they had help with on their Mac

After 3-4 exchanges, say something warm like "I think I have a good picture of how to help you!" and output the spec.

OUTPUT FORMAT — after gathering enough info, output a single <shellmate-spec> block.
Use the EXACT format below (flat fields, NOT nested under "agent"):

<shellmate-spec complete="true">
{
  "name": "[their name]'s Helper",
  "personality": "Warm, patient, and encouraging. Explains things simply without technical jargon.",
  "mission": "Help [name] with everyday Mac tasks — [their specific interests].",
  "mac_apps": ["[apps they mentioned]"],
  "use_cases": ["[things they want help with]"],
  "failure": "Apologize simply and suggest trying a different approach.",
  "escalation": "If something seems risky, always ask before doing it.",
  "never": ["Never delete files without asking first", "Never change system settings without asking first", "Never share personal information"]
}
</shellmate-spec>

IMPORTANT: The spec block is invisible to the user — they only see your friendly text.
IMPORTANT: Use complete="true" as an XML attribute on the tag, NOT as a JSON field inside the block.
IMPORTANT: Fields are FLAT (name, personality, etc.) — do NOT nest them under an "agent" key.`;
```

Then modify the `sendToAI` function (around line 150) to pick the right prompt. Find the line that references `SYSTEM_PROMPT` in the fetch body and change it:

```js
// In the fetch body for /api/chat (around line 158), change:
//   system: SYSTEM_PROMPT,
// to:
system: simpleMode ? SIMPLE_SYSTEM_PROMPT : SYSTEM_PROMPT,
```

Add `simpleMode` prop to the component signature (line 125):

```js
// Change line ~125 from:
//   export default function ConversationPhase() {
// to:
export default function ConversationPhase({ simpleMode = false }) {
```

- [ ] **Step 3: Create SimpleSetup component**

```jsx
// client/src/components/wizard/SimpleSetup.jsx
import { useState, useEffect, useRef } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import SimpleAISetup from '../ai/SimpleAISetup.jsx';
import ConversationPhase from './ConversationPhase.jsx';
import { BigButton } from '../common/BigButton.jsx';

const STEP = { AUTH: 0, CHAT: 1, FINISHING: 2, READY: 3 };

export default function SimpleSetup({ onComplete }) {
  const { configured } = useAIConfig();
  const { conversationComplete, teamSpec, populateSimpleDefaults } = useTeamSpecStore();
  const [step, setStep] = useState(configured ? STEP.CHAT : STEP.AUTH);
  const [error, setError] = useState('');
  const finishAttempted = useRef(false);

  // When AI conversation is done, auto-finish setup
  useEffect(() => {
    if (conversationComplete && step === STEP.CHAT && !finishAttempted.current) {
      finishAttempted.current = true;
      finishSetup();
    }
  }, [conversationComplete, step]);

  async function finishSetup() {
    setStep(STEP.FINISHING);
    setError('');

    try {
      // Fill in any gaps with sensible defaults — returns the updated spec to avoid stale closure
      const updatedSpec = populateSimpleDefaults();

      // Generate workspace files
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSpec: updatedSpec }),
      });
      if (!genRes.ok) throw new Error('Failed to generate files');
      const { files } = await genRes.json();

      // Rewrite paths: workspace-main/X → ~/.shellmate/workspace/X (server resolves ~)
      const workspaceRoot = '~/.shellmate/workspace';
      const rewritten = files.map(f => {
        const match = f.path.match(/^workspace-main\/(.+)$/);
        return match ? { ...f, path: `${workspaceRoot}/${match[1]}` } : f;
      });

      const writeRes = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: rewritten, force: true }),
      });
      if (!writeRes.ok) throw new Error('Failed to write files');

      // Register agent in config (same pattern as GenerateStep.jsx)
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMainAgent: true }),
      });

      setStep(STEP.READY);
    } catch (err) {
      console.error('Setup error:', err);
      setError("Something went wrong during setup. Let's try again.");
      setStep(STEP.CHAT);
      finishAttempted.current = false;
    }
  }

  // Step 0: Access code / sign in
  if (step === STEP.AUTH) {
    return <SimpleAISetup onDone={() => setStep(STEP.CHAT)} />;
  }

  // Step 2: Finishing (auto-generating)
  if (step === STEP.FINISHING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <span className="inline-block w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-h2 text-[var(--text-primary)] mb-2">Setting things up...</h2>
        <p className="text-body text-[var(--text-secondary)]">This only takes a moment.</p>
      </div>
    );
  }

  // Step 3: Ready!
  if (step === STEP.READY) {
    const name = teamSpec.agent?.name?.replace("'s Helper", '') || 'friend';
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-6">🐢</div>
        <h1 className="text-h1 text-[var(--text-primary)] mb-3">
          All set, {name}!
        </h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-md">
          Shellmate is ready to help. Just type what you need — like talking to a helpful friend who's great with computers.
        </p>
        <BigButton onClick={onComplete} className="px-12">
          Start chatting
        </BigButton>
      </div>
    );
  }

  // Step 1: Friendly conversation
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="text-center pt-6 pb-2 px-6">
        <div className="text-4xl mb-2">🐢</div>
        <h2 className="text-h2 text-[var(--text-primary)]">Let's get to know you</h2>
        <p className="text-body text-[var(--text-secondary)]">Just a few quick questions</p>
      </div>

      {error && (
        <div className="mx-6 mt-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-friendly text-body">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ConversationPhase simpleMode={true} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.jsx to route to SimpleSetup**

In `client/src/App.jsx`, add import and route. The file is only 47 lines, so here are the specific changes:

Add import at top (after existing imports, around line 4):
```js
import SimpleSetup from './components/wizard/SimpleSetup.jsx';
```

Change the routing section (around lines 36-45). Replace:
```jsx
if (state === 'wizard')    return <WizardShell onComplete={() => setState('chat')} />;
```

With:
```jsx
if (state === 'wizard')    return <SimpleSetup onComplete={() => setState('chat')} />;
```

Keep WizardShell import for now — it's the advanced-mode fallback we'll wire up from settings later.

- [ ] **Step 5: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Manual test — run dev server and go through setup**

Run: `cd /Users/adam/dev/shellmate && npm run dev`
Expected: Visit localhost:3847, see the new SimpleAISetup → ConversationPhase → auto-generate → ready screen.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/wizard/SimpleSetup.jsx client/src/components/wizard/ConversationPhase.jsx client/src/store/teamSpec.js client/src/App.jsx
git commit -m "feat: add simplified 2-step wizard for non-technical users"
```

---

## Task 5: Senior-Friendly Chat Interface

**Files:**
- Modify: `client/src/components/chat/ChatApp.jsx` (125 lines)
- Modify: `client/src/components/common/MessageBubble.jsx` (38 lines)
- Modify: `client/src/components/chat/ToolCallDisplay.jsx` (73 lines)
- Create: `client/src/components/common/QuickActions.jsx`

This task overhauls the post-setup chat experience: bigger text, bigger input, friendly tool display, and quick-action chips so the user doesn't face a blank screen.

- [ ] **Step 1: Create QuickActions component**

```jsx
// client/src/components/common/QuickActions.jsx
const ACTIONS = [
  { label: '📧  Check my email',       prompt: 'Can you help me check my email?' },
  { label: '📸  Open my photos',        prompt: 'Can you open my Photos app?' },
  { label: '📅  What\'s on my calendar', prompt: 'What do I have coming up on my calendar?' },
  { label: '🔍  Search the web',        prompt: 'Can you search the web for something for me?' },
  { label: '📁  Find a file',           prompt: 'Can you help me find a file on my Mac?' },
  { label: '⚙️  Fix a problem',         prompt: 'Something on my Mac isn\'t working right. Can you help?' },
];

export function QuickActions({ onSelect }) {
  return (
    <div className="px-4 pb-4">
      <p className="text-body text-[var(--text-muted)] mb-3 text-center">
        Try asking me to...
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => onSelect(action.prompt)}
            className="px-5 py-3 rounded-friendly bg-[var(--bg-card)] border border-[var(--border)] text-body text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update MessageBubble for larger text and light mode**

Replace the entire `client/src/components/common/MessageBubble.jsx` (38 lines):

```jsx
/**
 * @param {{ role: 'user'|'assistant', content: string, showAvatar?: boolean, transformContent?: function }} props
 */
export function MessageBubble({ role, content, showAvatar = false, transformContent }) {
  const display = transformContent ? transformContent(content) : content;
  const lines = display.split('\n');
  const isUser = role === 'user';

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && showAvatar && (
        <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-xl flex-shrink-0">
          🐢
        </div>
      )}
      <div
        className={`max-w-[85%] px-5 py-4 text-body leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[var(--user-bubble)] text-[var(--user-bubble-text)] rounded-2xl rounded-br-md'
            : 'bg-[var(--assistant-bubble)] text-[var(--assistant-bubble-text)] rounded-2xl rounded-bl-md border border-[var(--border)]'
        }`}
      >
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
      {isUser && showAvatar && (
        <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-xl flex-shrink-0">
          👤
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update ToolCallDisplay with friendly mode**

In `client/src/components/chat/ToolCallDisplay.jsx` (73 lines), add a `friendly` prop that switches to the simple display. Replace the entire file:

```jsx
import { useState } from 'react';
import { describeTool } from '../../theme.js';
import { FriendlyToolStatus } from '../common/FriendlyToolStatus.jsx';

const TOOL_ICONS  = { shell_exec: '$ ', file_read: '> ', file_write: '< ', file_list: '# ', web_search: '@ ', web_fetch: '~ ' };
const TOOL_LABELS = { shell_exec: 'Shell', file_read: 'Read', file_write: 'Write', file_list: 'List', web_search: 'Search', web_fetch: 'Fetch' };

export default function ToolCallDisplay({ name, input, result, isExecuting, friendly = true }) {
  const [expanded, setExpanded] = useState(false);

  // Friendly mode — just show a human-readable status line
  if (friendly) {
    return <FriendlyToolStatus name={name} input={input} result={result} isExecuting={isExecuting} />;
  }

  // Advanced mode — original collapsible display
  const icon = TOOL_ICONS[name] || '⚙ ';
  const label = TOOL_LABELS[name] || name;
  const summary = (() => {
    if (!input) return '';
    if (input.command) return input.command.slice(0, 60);
    if (input.path)    return input.path;
    if (input.query)   return input.query;
    if (input.url)     return input.url.slice(0, 60);
    return JSON.stringify(input).slice(0, 60);
  })();

  return (
    <div className="my-1 rounded bg-navy-950 border border-gray-800 text-xs font-mono overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 text-left">
        {isExecuting
          ? <span className="inline-block w-4 h-4 border-2 border-shell-400 border-t-transparent rounded-full animate-spin" />
          : <span className="text-shell-400">{icon}</span>
        }
        <span className="text-gray-300 font-semibold">{label}</span>
        <span className="text-gray-500 truncate flex-1">{summary}</span>
        <span className="text-gray-600">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-800">
          <div className="mt-2">
            <div className="text-gray-500 mb-1">Input</div>
            <pre className="text-gray-300 whitespace-pre-wrap break-all">{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}</pre>
          </div>
          {result && (
            <div className="mt-2">
              <div className="text-gray-500 mb-1">Output</div>
              <pre className="text-green-400 whitespace-pre-wrap break-all max-h-48 overflow-auto">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update ChatApp with larger UI and quick actions**

Replace `client/src/components/chat/ChatApp.jsx` (125 lines):

```jsx
import { useState, useRef, useEffect } from 'react';
import { useSSEChat } from '../../hooks/useSSEChat.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import ToolCallDisplay from './ToolCallDisplay.jsx';
import { QuickActions } from '../common/QuickActions.jsx';
import { useThemeStore } from '../../theme.js';

export default function ChatApp({ onSettings }) {
  const { chatItems, sendMessage, loading, error } = useSSEChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { mode, toggle: toggleTheme } = useThemeStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, loading]);

  function send(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    sendMessage(msg);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = chatItems.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐢</span>
          <span className="text-h3 text-[var(--accent)] font-bold">Shellmate</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="px-3 py-2 rounded-friendly text-body text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>
          {onSettings && (
            <button
              onClick={onSettings}
              className="px-3 py-2 rounded-friendly text-body text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              ⚙️ Settings
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {isEmpty && !loading && (
            <div className="text-center pt-12 pb-6">
              <div className="text-5xl mb-4">🐢</div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-2">How can I help?</h2>
              <p className="text-body text-[var(--text-secondary)]">
                Ask me anything about your Mac, or try one of these:
              </p>
            </div>
          )}

          {isEmpty && !loading && <QuickActions onSelect={send} />}

          {chatItems.map((item, i) => {
            if (item.type === 'tool_call') return <ToolCallDisplay key={i} {...item} friendly={true} />;
            if (item.type === 'user') return <MessageBubble key={i} role="user" content={item.content} showAvatar={true} />;
            if (item.type === 'assistant') return <MessageBubble key={i} role="assistant" content={item.content} showAvatar={true} />;
            return null;
          })}

          {loading && (
            <div className="flex items-center gap-3 px-4">
              <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-body text-[var(--text-muted)]">Thinking...</span>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-friendly bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-body">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={2}
            className="flex-1 min-h-input px-5 py-3 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300 resize-none"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="min-h-input px-6 rounded-friendly bg-[var(--accent)] text-white text-body font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Manual test — full flow**

Run: `cd /Users/adam/dev/shellmate && npm run dev`
Test: Complete setup, reach chat, verify:
- Large text throughout
- Quick action chips appear on empty chat
- Tool calls show friendly descriptions
- Light/dark toggle works
- Send button and Enter key both work

- [ ] **Step 7: Commit**

```bash
git add client/src/components/chat/ChatApp.jsx client/src/components/common/MessageBubble.jsx client/src/components/chat/ToolCallDisplay.jsx client/src/components/common/QuickActions.jsx
git commit -m "feat: senior-friendly chat with large text, quick actions, and friendly tool display"
```

---

## Task 6: Wire Up Light Mode Initialization & Body Styles

**Files:**
- Modify: `client/index.html`

Ensure the light/dark class is applied before React hydrates to avoid a flash of wrong theme.

- [ ] **Step 1: Add theme initialization to index.html**

In `client/index.html`, add a script in `<head>` before any CSS loads:

```html
<script>
  // Apply theme before first paint to avoid flash
  const theme = localStorage.getItem('shellmate-theme') || 'light';
  if (theme === 'dark') document.documentElement.classList.add('dark');
</script>
```

- [ ] **Step 2: Add body background classes to index.html**

On the `<body>` tag:

```html
<body class="bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
```

- [ ] **Step 3: Verify no flash on load**

Run: `cd /Users/adam/dev/shellmate && npm run dev`
Expected: Page loads in light mode by default with no dark flash.

- [ ] **Step 4: Commit**

```bash
git add client/index.html
git commit -m "feat: prevent theme flash with pre-render theme detection"
```

---

## Task 7: Safety Confirmations for Sensitive Actions

**Files:**
- Modify: `server/generators/agents.js` (safety instructions in generated AGENTS.md)

This adds a safety layer via the system prompt: before Shellmate runs certain commands (deleting files, changing settings, installing software), the AI asks for confirmation in natural language through the chat. No client-side confirmation dialog is needed — the AI's conversational confirmation is simpler and more appropriate for a non-technical user.

- [ ] **Step 1: Add sensitive command detection to the system prompt**

In the workspace generator `server/generators/agents.js`, add a safety instruction to the AGENTS.md template. Find the section that generates safety boundaries and add:

```
## Confirmation Required

Before running any of these actions, ALWAYS ask the user first in plain language:
- Deleting or moving files
- Changing system settings (System Preferences / System Settings)
- Installing or uninstalling software
- Modifying login items or startup programs
- Accessing contacts, messages, or other personal data
- Running commands with sudo or admin privileges
- Sending emails or messages on behalf of the user

Frame it simply: "I can [action] for you. Should I go ahead?"
Never proceed with these actions without explicit confirmation.
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add server/generators/agents.js
git commit -m "feat: add safety confirmations for sensitive Mac actions via system prompt"
```

---

## Task 8: Settings Access & Advanced Mode Escape Hatch

**Files:**
- Modify: `client/src/App.jsx`
- Create: `client/src/components/settings/SettingsPanel.jsx`

Power users (or the person who set up Shellmate for grandma) need a way to access the full wizard, change the API key, toggle dark mode, and see advanced tool output.

- [ ] **Step 1: Create SettingsPanel component**

```jsx
// client/src/components/settings/SettingsPanel.jsx
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
```

- [ ] **Step 2: Wire settings into App.jsx**

Add settings state and panel rendering to `client/src/App.jsx`. Add import:
```js
import SettingsPanel from './components/settings/SettingsPanel.jsx';
```

Add state:
```js
const [showSettings, setShowSettings] = useState(false);
```

Pass `onSettings` to ChatApp:
```jsx
if (state === 'chat') return (
  <>
    <ChatApp onSettings={() => setShowSettings(true)} />
    {showSettings && (
      <SettingsPanel
        onClose={() => setShowSettings(false)}
        onRunWizard={() => { setShowSettings(false); setState('wizard'); }}
      />
    )}
  </>
);
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/adam/dev/shellmate && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual test**

Run: `cd /Users/adam/dev/shellmate && npm run dev`
Test: Click Settings in chat header, verify panel shows, theme toggle works, "Run full setup wizard" routes to WizardShell.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/settings/SettingsPanel.jsx client/src/App.jsx
git commit -m "feat: add settings panel with theme toggle and advanced mode access"
```

---

## Summary & Execution Order

| Task | Name | Dependencies | Est. Files Changed |
|------|------|-------------|-------------------|
| 1 | Tailwind Theme | None | 3 (2 modify, 1 create) |
| 2 | BigButton & FriendlyToolStatus | Task 1 | 2 create |
| 3 | Simple AI Setup | Tasks 1-2 | 1 create |
| 4 | Simplified Wizard | Tasks 1-3 | 4 (1 create, 3 modify) |
| 5 | Senior-Friendly Chat | Tasks 1-2 | 4 (1 create, 3 modify) |
| 6 | Light Mode Init | Task 1 | 1 modify |
| 7 | Safety Confirmations | None | 1 modify |
| 8 | Settings Panel | Tasks 1-2, 5 | 2 (1 create, 1 modify) |

**Parallelizable:** Tasks 3+5 can run in parallel (independent components). Tasks 6+7 can run in parallel. Task 8 depends on 5.

**Total new files:** 6
**Total modified files:** 9
**Server changes:** 1 file (generators/agents.js — safety prompt only)
**Tool engine changes:** 0 — all power preserved
