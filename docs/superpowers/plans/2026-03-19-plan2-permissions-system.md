# Plan 2: Trust-After-First-Use Permission System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permission system where non-read tool calls require one-time user confirmation per session, using a Promise/resolver pattern that pauses the tool loop mid-execution until the user responds.

**Architecture:** `permissions.js` manages session grants (keyed by `toolName:tier`) and pending confirmations (keyed by `confirmId`). When a tool needs confirmation, the tool loop creates a Promise, stores its resolver, sends a `confirm` SSE event, and `await`s the Promise. A new `POST /api/tools/grant` route resolves the Promise when the user clicks Allow/Deny. The client renders an inline `PermissionCard` component in the chat stream.

**Tech Stack:** Node.js ESM, Express, React 18, crypto.randomUUID

**Spec:** `docs/superpowers/specs/2026-03-19-mac-native-tools-design.md` (sections D1, D2, 5)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/tools/permissions.js` | Create | Session grant tracking, pending confirmation management, permission check logic |
| `server/routes/tools.js` | Create | `POST /api/tools/grant` route to resolve pending confirmations |
| `server/tools/loop.js` | Modify | Add permission check before tool execution; handle confirm/deny flow |
| `server/routes/agentChat.js` | Modify | Pass `permissions` module to loop context |
| `server/index.js` | Modify | Mount new `/api/tools` routes |
| `client/src/components/chat/PermissionCard.jsx` | Create | Inline confirmation UI — Allow/Deny buttons with tool description |
| `client/src/hooks/useSSEChat.js` | Modify | Handle `confirm` SSE event type; expose `grantPermission` function |
| `client/src/components/chat/ChatApp.jsx` | Modify | Render PermissionCard for confirm items |

---

## Task 1: Create the Permissions Module

**Files:**
- Create: `server/tools/permissions.js`

- [ ] **Step 1: Create permissions.js**

```js
// server/tools/permissions.js
/**
 * Trust-after-first-use permission system.
 * Manages session grants and pending confirmation Promises.
 *
 * Tiers:
 *   'read'        — always allowed, no confirmation
 *   'action'      — confirm on first use per session
 *   'destructive' — confirm on first use per session (stronger warning)
 *
 * Grants are keyed by `${toolName}:${tier}` so granting 'action' tier
 * does NOT auto-grant 'destructive' tier for the same tool.
 */

import crypto from 'crypto';

// Session grants: Map<'toolName:tier', true>
// Resets on server restart (no persistence).
const sessionGrants = new Map();

// Pending confirmations: Map<confirmId, { resolve }>
const pendingConfirms = new Map();

/**
 * Resolve the tier for a specific tool+action.
 * If the tool's tier is an object (per-action map), look up the action.
 * If it's a string, use it directly. Default: 'action'.
 */
export function resolveTier(toolMeta, actionName) {
  if (!toolMeta) return 'action';
  const tier = toolMeta.tier;
  if (typeof tier === 'object' && tier !== null && actionName) {
    return tier[actionName] || 'action';
  }
  return typeof tier === 'string' ? tier : 'action';
}

/**
 * Check if a tool+tier is already granted for this session.
 */
export function isGranted(toolName, tier) {
  if (tier === 'read') return true;
  return sessionGrants.has(`${toolName}:${tier}`);
}

/**
 * Grant a tool+tier for the rest of this session.
 */
export function grant(toolName, tier) {
  sessionGrants.set(`${toolName}:${tier}`, true);
}

/**
 * Create a pending confirmation. Returns { confirmId, promise }.
 * The promise resolves with { granted: boolean } when the client responds.
 * Auto-denies after timeoutMs (default 2 minutes) to prevent memory leaks
 * if the client disconnects or user never responds.
 */
export function createConfirmation({ timeoutMs = 120000 } = {}) {
  const confirmId = crypto.randomUUID();
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
    setTimeout(() => {
      if (pendingConfirms.has(confirmId)) {
        pendingConfirms.delete(confirmId);
        r({ granted: false });
      }
    }, timeoutMs);
  });
  pendingConfirms.set(confirmId, { resolve });
  return { confirmId, promise };
}

/**
 * Resolve a pending confirmation (called by the grant API route).
 * Returns true if the confirmId was found, false if expired/invalid.
 */
export function resolveConfirmation(confirmId, granted) {
  const pending = pendingConfirms.get(confirmId);
  if (!pending) return false;
  pending.resolve({ granted });
  pendingConfirms.delete(confirmId);
  return true;
}

/**
 * Reset all session grants (e.g., on restart). Exposed for testing.
 */
export function resetGrants() {
  sessionGrants.clear();
  pendingConfirms.clear();
}
```

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./server/tools/permissions.js').then(() => console.log('OK'))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/tools/permissions.js
git commit -m "feat: add trust-after-first-use permission module"
```

---

## Task 2: Create the Grant API Route

**Files:**
- Create: `server/routes/tools.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create server/routes/tools.js**

```js
// server/routes/tools.js
/**
 * API routes for tool management — permission grants, tool listing.
 */

import { Router } from 'express';
import { resolveConfirmation } from '../tools/permissions.js';

const router = Router();

/**
 * POST /api/tools/grant — Resolve a pending permission confirmation.
 * Body: { confirmId: string, granted: boolean }
 */
router.post('/tools/grant', (req, res) => {
  const { confirmId, granted } = req.body;

  if (!confirmId || typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'Missing confirmId or granted boolean' });
  }

  const found = resolveConfirmation(confirmId, granted);
  if (!found) {
    return res.status(404).json({ error: 'Confirmation not found or already resolved' });
  }

  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Mount the route in server/index.js**

In `server/index.js`, add after the existing route imports (after line 14 `import agentChatRoute`):
```js
import toolsRoute from './routes/tools.js';
```

And add after the existing `app.use('/api', agentChatRoute);` line (after line 59):
```js
  app.use('/api', toolsRoute);
```

- [ ] **Step 3: Verify the route mounts**

Run: `node -e "import('./server/index.js').then(m => m.createServer().then(() => console.log('OK')))"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add server/routes/tools.js server/index.js
git commit -m "feat: add POST /api/tools/grant route for permission confirmations"
```

---

## Task 3: Add Permission Check to Tool Loop

This is the most complex task — modifying `loop.js` to check permissions before executing tools and pause for confirmation when needed.

**Files:**
- Modify: `server/tools/loop.js`

- [ ] **Step 1: Add permission imports and helper**

At the top of `server/tools/loop.js`, add after the existing imports (after line 8):

```js
import { getToolMeta } from './registry.js';
import { resolveTier, isGranted, grant, createConfirmation } from './permissions.js';
```

Then add this helper function before the `runAnthropicLoop` export (after line 69, before line 71):

```js
/**
 * Check permission for a tool call. If confirmation is needed, sends a
 * 'confirm' SSE event and awaits the user's response via Promise.
 * Returns the tool result string — either from execution or 'Permission denied'.
 */
async function executeWithPermission(toolName, input, context, onEvent) {
  const meta = getToolMeta(toolName);
  const action = input?.action || null;
  const tier = resolveTier(meta, action);

  // Read tier: always allowed
  if (tier === 'read' || isGranted(toolName, tier)) {
    return executeTool(toolName, input, context);
  }

  // Need confirmation — create a pending Promise
  const { confirmId, promise } = createConfirmation();

  // Build a human-readable description of what the tool wants to do
  const description = describeToolAction(toolName, input);

  // Send confirm event to client
  onEvent({
    type: 'confirm',
    confirmId,
    tool: toolName,
    action: action || toolName,
    tier,
    description,
  });

  // Await user response (Promise resolves when POST /api/tools/grant is called)
  const { granted: userGranted } = await promise;

  if (userGranted) {
    grant(toolName, tier);
    return executeTool(toolName, input, context);
  } else {
    return 'Permission denied by user.';
  }
}

/**
 * Generate a short, human-readable description of a tool action.
 */
function describeToolAction(toolName, input) {
  // Mac tools use action dispatch
  if (input?.action) {
    const action = input.action.replace(/_/g, ' ');
    const target = input.title || input.name || input.path || input.query || '';
    return target ? `${action}: "${target}"` : action;
  }
  // Built-in tools
  switch (toolName) {
    case 'shell_exec': return `Run command: ${(input?.command || '').slice(0, 60)}`;
    case 'file_write': return `Write file: ${input?.path || 'unknown'}`;
    default: return toolName.replace(/_/g, ' ');
  }
}
```

- [ ] **Step 2: Replace executeTool calls with executeWithPermission in Anthropic loop**

In the `runAnthropicLoop` function, find the tool execution block (lines 103-112):

```js
    // Execute all tool calls and build tool_result blocks
    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input, context);
      onEvent({ type: 'tool_result', id: tu.id, name: tu.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result,
      });
    }
```

Replace with:

```js
    // Execute all tool calls (with permission checks) and build tool_result blocks
    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeWithPermission(tu.name, tu.input, context, onEvent);
      onEvent({ type: 'tool_result', id: tu.id, name: tu.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result,
      });
    }
```

- [ ] **Step 3: Replace executeTool calls with executeWithPermission in OpenAI loop**

In the `runOpenAILoop` function, find the tool execution block (lines 155-157):

```js
      const result = await executeTool(fn.name, input, context);
      onEvent({ type: 'tool_result', id: tc.id, name: fn.name, result });
```

Replace with:

```js
      const result = await executeWithPermission(fn.name, input, context, onEvent);
      onEvent({ type: 'tool_result', id: tc.id, name: fn.name, result });
```

- [ ] **Step 4: Verify module loads**

Run: `node -e "import('./server/tools/loop.js').then(() => console.log('OK'))"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add server/tools/loop.js
git commit -m "feat: add permission checks to tool loop with Promise/resolver pause"
```

---

## Task 4: Create the PermissionCard Component

**Files:**
- Create: `client/src/components/chat/PermissionCard.jsx`

- [ ] **Step 1: Create PermissionCard.jsx**

```jsx
// client/src/components/chat/PermissionCard.jsx
import { useState } from 'react';

/**
 * Inline permission confirmation card shown in the chat stream.
 * Displays what the tool wants to do and Allow/Deny buttons.
 * Once resolved, shows the result (allowed or denied).
 */
export default function PermissionCard({ confirmId, tool, action, tier, description, onGrant }) {
  const [resolved, setResolved] = useState(null); // null | 'allowed' | 'denied'
  const [loading, setLoading] = useState(false);

  async function handleGrant(granted) {
    setLoading(true);
    await onGrant(confirmId, granted);
    setResolved(granted ? 'allowed' : 'denied');
    setLoading(false);
  }

  const isDestructive = tier === 'destructive';
  const toolLabel = tool.replace(/^mac_/, '').replace(/_/g, ' ');

  // Already resolved
  if (resolved) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-friendly my-2 border ${
        resolved === 'allowed'
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
      }`}>
        <span className="text-xl">{resolved === 'allowed' ? '✓' : '✕'}</span>
        <span className="text-body text-[var(--text-primary)]">
          {resolved === 'allowed'
            ? `Allowed ${toolLabel} for this session`
            : `Denied ${toolLabel}`
          }
        </span>
      </div>
    );
  }

  // Pending confirmation
  return (
    <div className={`px-4 py-4 rounded-friendly my-2 border ${
      isDestructive
        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl mt-0.5">{isDestructive ? '⚠️' : '🔐'}</span>
        <div>
          <p className="text-body font-semibold text-[var(--text-primary)]">
            Shellmate wants to {description}
          </p>
          {isDestructive && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              This action may modify or send data on your behalf.
            </p>
          )}
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Allow {toolLabel} actions for this session?
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-8">
        <button
          onClick={() => handleGrant(true)}
          disabled={loading}
          className="px-4 py-2 rounded-friendly text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
        >
          Allow
        </button>
        <button
          onClick={() => handleGrant(false)}
          disabled={loading}
          className="px-4 py-2 rounded-friendly text-sm font-semibold bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 transition-all"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chat/PermissionCard.jsx
git commit -m "feat: add PermissionCard component for inline tool confirmations"
```

---

## Task 5: Handle Confirm Events in useSSEChat

**Files:**
- Modify: `client/src/hooks/useSSEChat.js`

- [ ] **Step 1: Add confirm event handler and grantPermission function**

In `client/src/hooks/useSSEChat.js`, add the `confirm` event handler inside the `parseSseStream` function, after the `tool_result` handler (after line 64, before the `if (type === 'error')` block):

```js
          if (type === 'confirm') {
            setChatItems(prev => [
              ...prev,
              {
                type: 'confirm',
                confirmId: data.confirmId,
                tool: data.tool,
                action: data.action,
                tier: data.tier,
                description: data.description,
              },
            ]);
          }
```

- [ ] **Step 2: Add grantPermission callback**

After the `sendMessage` function (after line 112, before the `return` statement), add:

```js
  async function grantPermission(confirmId, granted) {
    try {
      await fetch('/api/tools/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmId, granted }),
      });
    } catch (err) {
      setError(`Permission grant failed: ${err.message}`);
    }
  }
```

- [ ] **Step 3: Add grantPermission to the return value**

Change the return statement from:
```js
  return { chatItems, loading, error, sendMessage };
```
to:
```js
  return { chatItems, loading, error, sendMessage, grantPermission };
```

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useSSEChat.js
git commit -m "feat: handle confirm SSE events and add grantPermission to useSSEChat"
```

---

## Task 6: Render PermissionCard in ChatApp

**Files:**
- Modify: `client/src/components/chat/ChatApp.jsx`

- [ ] **Step 1: Import PermissionCard and destructure grantPermission**

At the top of `client/src/components/chat/ChatApp.jsx`, add import after the existing imports (after line 5):
```js
import PermissionCard from './PermissionCard.jsx';
```

Then update the useSSEChat destructure on line 9 from:
```js
  const { chatItems, sendMessage, loading, error } = useSSEChat();
```
to:
```js
  const { chatItems, sendMessage, grantPermission, loading, error } = useSSEChat();
```

- [ ] **Step 2: Add confirm item rendering in the chat items map**

In the `chatItems.map` callback (around line 77-82), add a case for `confirm` items. Change:
```js
          {chatItems.map((item, i) => {
            if (item.type === 'tool_call') return <ToolCallDisplay key={i} {...item} friendly={true} />;
            if (item.type === 'user') return <MessageBubble key={i} role="user" content={item.content} showAvatar={true} />;
            if (item.type === 'assistant') return <MessageBubble key={i} role="assistant" content={item.content} showAvatar={true} />;
            return null;
          })}
```
to:
```js
          {chatItems.map((item, i) => {
            if (item.type === 'tool_call') return <ToolCallDisplay key={i} {...item} friendly={true} />;
            if (item.type === 'confirm') return <PermissionCard key={i} {...item} onGrant={grantPermission} />;
            if (item.type === 'user') return <MessageBubble key={i} role="user" content={item.content} showAvatar={true} />;
            if (item.type === 'assistant') return <MessageBubble key={i} role="assistant" content={item.content} showAvatar={true} />;
            return null;
          })}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build, no errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chat/ChatApp.jsx
git commit -m "feat: render PermissionCard in chat for tool confirmations"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Verify server starts**

Run: `node -e "import('./server/index.js').then(m => m.createServer().then(() => console.log('OK')))"`
Expected: `OK`

- [ ] **Step 2: Verify permission flow works end-to-end**

Run: `node -e "
import { registerBuiltins } from './server/tools/builtins.js';
import { getToolMeta } from './server/tools/registry.js';
import { resolveTier, isGranted, grant, createConfirmation, resolveConfirmation } from './server/tools/permissions.js';

registerBuiltins();

// Test 1: Read tier is always granted
const meta = getToolMeta('file_read');
console.log('file_read tier:', resolveTier(meta, null));
console.log('file_read granted (read):', isGranted('file_read', 'read'));

// Test 2: Action tier needs confirmation
const meta2 = getToolMeta('shell_exec');
console.log('shell_exec tier:', resolveTier(meta2, null));
console.log('shell_exec granted before:', isGranted('shell_exec', 'action'));

// Test 3: Grant flow
grant('shell_exec', 'action');
console.log('shell_exec granted after:', isGranted('shell_exec', 'action'));

// Test 4: Confirm flow
const { confirmId, promise } = createConfirmation();
console.log('confirmId created:', !!confirmId);
resolveConfirmation(confirmId, true);
promise.then(r => {
  console.log('Promise resolved with granted:', r.granted);
  console.log('All tests passed!');
});
"`
Expected:
```
file_read tier: read
file_read granted (read): true
shell_exec tier: action
shell_exec granted before: false
shell_exec granted after: true
confirmId created: true
Promise resolved with granted: true
All tests passed!
```

- [ ] **Step 3: Verify client build**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build, no errors

- [ ] **Step 4: Commit any fixes if needed**

---

## How It All Works Together

```
User asks: "Create a calendar event for tomorrow at 10am"

1. AI responds with tool_call: mac_calendar({ action: 'create_event', ... })
2. loop.js calls executeWithPermission('mac_calendar', input, ...)
3. permissions.js checks: isGranted('mac_calendar', 'action')? → NO
4. Creates Promise + confirmId, sends SSE: { type: 'confirm', ... }
5. Tool loop PAUSES (await promise)
6. Client receives 'confirm' event → renders PermissionCard
7. User clicks "Allow"
8. Client calls POST /api/tools/grant { confirmId, granted: true }
9. Route calls resolveConfirmation(confirmId, true) → Promise resolves
10. Tool loop RESUMES → grants session permission → executes tool
11. Next mac_calendar action-tier call: isGranted? → YES → executes immediately
```

## Next Plans

- **Plan 3:** Mac-native tools (all 10 AppleScript modules)
- **Plan 4:** CLI discovery + plugins + UI polish
