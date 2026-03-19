# Mac-Native Tools & Dynamic Tool System

**Date:** 2026-03-19
**Status:** Approved design

## Problem

Shellmate's agent has 6 generic tools (shell_exec, file_read, file_write, file_list, web_search, web_fetch) but zero Mac-native capabilities. When users ask the agent to check their calendar, create reminders, send messages, or organize files, it can only suggest the user do it manually. For an "IT buddy" targeting non-technical Mac users, this is a critical gap.

## Goals

1. Add dedicated Mac-native tools that interact with macOS apps via AppleScript/JXA
2. Auto-discover installed CLI tools so the agent knows what's available on this Mac
3. Support user-defined plugin tools that can be added at any time
4. Implement trust-after-first-use permissions so the agent can act safely without being annoying
5. Replace Brave Search with Google search as the default — no API key required

## Non-Goals

- Multi-platform support (macOS only)
- OAuth flows for cloud services (tools use local macOS apps directly)
- Sandboxing tool execution (Electron already runs with user privileges)

## Key Design Decisions

**D1. Permission pause uses Promise/resolver pattern, not polling.**
When a tool requires confirmation, the tool loop creates a Promise and stores its resolver in a pending-grants map keyed by a unique `confirmId`. The loop `await`s this Promise. When the client sends `POST /api/tools/grant { confirmId, granted }`, the route looks up the resolver and calls it. The tool loop resumes. This works because Node.js is single-threaded and the SSE response stream stays open while the Promise is pending.

**D2. Permission grants are per tool+tier, not per tool.**
`sessionGrants` is keyed by `${toolName}:${tier}`. Granting `mac_calendar:action` (for create_event) does NOT auto-grant `mac_calendar:destructive` (for delete_event). Read-tier actions never create a grant entry — they are always auto-allowed. This means a user may see two confirmations for the same tool: once for action-tier operations, once for destructive-tier operations.

**D3. Plugin system is opt-in and disabled by default.**
Plugins (`~/.shellmate/tools/`) are not loaded unless `shellmate.json` contains `"plugins": { "enabled": true }`. This protects the target user (non-technical 80-year-old) from accidental code execution. The agent can suggest enabling plugins, but cannot enable them itself.

**D4. CLI-discovered tools are blocked by the `exec` deny category.**
The deny map explicitly includes all `cli_*` tools under the `exec` key. This is enforced dynamically — when `discovery.js` registers a tool, it tags it with `denyCategory: 'exec'`, and the registry adds it to the exec deny group.

**D5. macOS TCC (privacy permission) dialogs are detected and handled.**
The `osascript.js` helper detects TCC-related errors (error code -1743, "not allowed assistive access", "not authorized") and returns a structured error: `{ tccDenied: true, app: 'Calendar', message: '...' }`. The tool loop recognizes this and sends a special SSE `tcc_error` event. The client shows a friendly guide: "Shellmate needs permission to access Calendar. Open System Settings > Privacy & Security > Calendars and allow Shellmate." The Electron app's `Info.plist` includes usage description strings for all accessed apps.

**D7. Google search replaces Brave as the default search provider.**
The current `web_search` tool requires a Brave API key — a significant friction point for non-technical users. The new default uses Google search via HTML scraping (fetch `https://www.google.com/search?q=...`, parse results from HTML). No API key needed. Brave and Perplexity remain as optional providers for users who prefer them. The `web_search` tool executor becomes provider-aware: Google (default, no key), Brave (requires key), Perplexity (requires key).

**D6. Tool count is managed by contextual filtering.**
To avoid inflating every API call with 30+ tools, the registry supports `getToolsForAgent(agentConfig, { contextHint })`. When `contextHint` is provided (extracted from the user's message by a lightweight classifier), only relevant tool categories are included. All built-in + Mac tools are always included (16 tools). CLI tools are only included when the context suggests command-line work. Plugin tools are always included. Maximum tool count cap: 30.

---

## Architecture

### 1. Dynamic Tool Registry (`server/tools/registry.js`)

Replaces the hardcoded `TOOLS` array in `definitions.js` with a dynamic registry.

**Interface:**

```js
// Register a tool (definition + executor + permission tier)
registerTool({ name, description, input_schema, tier }, executorFn)

// Remove a tool
unregisterTool(name)

// Get all registered tools (respects agent deny list)
getToolsForAgent(agentConfig) → Tool[]

// Execute a tool by name
executeTool(name, input, context) → string

// Get tool metadata (for permission checks)
getToolMeta(name) → { name, tier, category }
```

**Tool sources load in order on startup:**
1. Built-in tools (existing 6) — from `server/tools/builtins.js` (refactored out of current definitions.js/executor.js)
2. Mac-native tools — from `server/tools/mac/index.js`
3. Auto-discovered CLI tools — from `server/tools/discovery.js`
4. Plugin tools — from `~/.shellmate/tools/*.js`

The registry is a singleton module. `toAnthropicTools()` and `toOpenAITools()` converters remain as-is — they operate on the tool array returned by the registry.

### 2. Mac-Native Tools (`server/tools/mac/`)

Each file exports one or more tool definitions + executors. All use `osascript` (AppleScript or JXA) under the hood via a shared `runAppleScript(script)` helper.

**Shared helper** (`server/tools/mac/osascript.js`):
```js
// Runs AppleScript via osascript, returns stdout
export async function runAppleScript(script, { timeout = 10000 } = {})
// Runs JXA (JavaScript for Automation) via osascript -l JavaScript
export async function runJXA(script, { timeout = 10000 } = {})
```

**Error handling:** The helper normalizes osascript errors into structured responses:
- **TCC denied** (error -1743, "not allowed assistive access"): Returns `{ error: 'tcc_denied', app: 'Calendar', message: 'Shellmate needs permission...' }`
- **App not running**: Returns `"Calendar is not open. Would you like me to open it first?"`
- **App not installed**: Returns `"Calendar app not found on this Mac."`
- **Script error**: Returns `"Failed to [action]: [cleaned error message]"` (strips osascript stack traces)
- **Timeout**: Returns `"Calendar took too long to respond (10s). The app may be unresponsive."`

All errors are returned as human-readable strings that the AI can relay to the user without translation.

**Tool modules:**

| File | Tool Name | Actions | Tier |
|------|-----------|---------|------|
| `calendar.js` | `mac_calendar` | list_events, create_event, delete_event, search_events | read: list/search; action: create; destructive: delete |
| `reminders.js` | `mac_reminders` | list_reminders, create_reminder, complete_reminder, delete_reminder | read: list; action: create/complete; destructive: delete |
| `contacts.js` | `mac_contacts` | search_contacts, get_contact, list_groups | read: all |
| `notes.js` | `mac_notes` | list_notes, create_note, search_notes, read_note | read: list/search/read; action: create |
| `messages.js` | `mac_messages` | send_message, read_recent | read: read_recent; destructive: send |
| `mail.js` | `mac_mail` | list_inbox, search_mail, compose_draft, read_message | read: list/search/read; destructive: compose_draft |
| `finder.js` | `mac_finder` | open_folder, reveal_file, get_selection, get_desktop_items | read: get_selection/get_desktop_items; action: open/reveal |
| `system.js` | `mac_system` | battery_status, wifi_status, volume_control, screenshot, notification, dark_mode, disk_space | read: battery/wifi/disk; action: volume/screenshot/notification/dark_mode |
| `apps.js` | `mac_apps` | open_app, quit_app, list_running, frontmost_app | read: list/frontmost; action: open; destructive: quit |
| `files.js` | `mac_files` | organize_folder, find_duplicates, categorize_files, folder_stats, move_files, bulk_rename, find_large_files, empty_trash | read: folder_stats/find_duplicates/find_large_files/categorize; action: organize/move/rename; destructive: empty_trash |

**`mac_files` vs existing file tools:** The existing `file_read`/`file_write`/`file_list` are low-level single-file operations. `mac_files` is a high-level organization tool — "categorize my Downloads folder by file type", "find duplicate photos", "organize Desktop into folders by date". It operates on batches of files with smart logic (file-type detection via `mdls`, size analysis, deduplication via checksums). The system prompt will guide the AI: use `file_*` for reading/writing individual files, use `mac_files` for organizing and analyzing groups of files.

**Each tool uses an `action` dispatch pattern:**
```js
// Example: mac_calendar
export const definition = {
  name: 'mac_calendar',
  description: 'Interact with Apple Calendar. Actions: list_events, create_event, delete_event, search_events.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list_events', 'create_event', 'delete_event', 'search_events'] },
      date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      title: { type: 'string' },
      time: { type: 'string', description: 'Time in HH:MM format' },
      duration: { type: 'number', description: 'Duration in minutes' },
      calendar: { type: 'string', description: 'Calendar name (optional, defaults to default calendar)' },
      query: { type: 'string', description: 'Search query for search_events' },
    },
    required: ['action'],
  },
  tier: { list_events: 'read', search_events: 'read', create_event: 'action', delete_event: 'destructive' },
};
```

**`mac/index.js`** — Imports all Mac tool modules and registers them with the registry.

### 3. CLI Auto-Discovery (`server/tools/discovery.js`)

Scans for installed CLI tools and registers lightweight wrappers.

**Discovery list** (checked via `which`):
```
ffmpeg, convert (imagemagick), pandoc, yt-dlp, jq, sqlite3, python3,
node, brew, git, curl, wget, rsync, zip, unzip, say, pbcopy, pbpaste,
open, defaults, diskutil, caffeinate, screencapture, sips, mdls, mdfind
```

**For each found CLI, registers:**
```js
{
  name: `cli_${safeName}`,       // e.g. cli_ffmpeg
  description: `Run ${name}. Installed at ${path}. Use args parameter.`,
  input_schema: {
    type: 'object',
    properties: {
      args: { type: 'string', description: 'Command-line arguments' },
    },
    required: ['args'],
  },
  tier: 'action',
}
```

**Executor:** Shells out to the CLI with the provided args. Uses the same safety checks as `shell_exec` (timeout, output truncation, blocked paths).

**Cache:** Results stored in `~/.shellmate/discovered-tools.json` with timestamps. Re-scan triggered by:
- App startup (if cache older than 24h)
- Manual API call: `POST /api/tools/rescan`
- Agent request via a `tools_rescan` built-in tool

### 4. Plugin Directory (`~/.shellmate/tools/`)

User-defined tools loaded from `.js` files.

**Plugin format:**
```js
// ~/.shellmate/tools/my-tool.js
export default {
  name: 'my_custom_tool',
  description: 'Does something custom',
  input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  tier: 'action',
  execute: async (input) => {
    // ... do work ...
    return 'result string';
  },
};
```

**Loading:** Only if `shellmate.json` has `"plugins": { "enabled": true }`. When enabled: load on startup + file watcher (`fs.watch`) for hot-reload. New tools appear immediately without restart. Disabled by default — protects non-technical users from accidental code execution.

**Validation:** Plugin must export `name`, `description`, `input_schema`, and `execute`. Invalid plugins are skipped with a warning log. Plugin code runs with full Node.js privileges (no sandbox).

**Enabling plugins:** User must explicitly set `plugins.enabled: true` in shellmate.json (via settings UI or manual edit). The agent cannot enable plugins on its own.

### 5. Trust-After-First-Use Permissions (`server/tools/permissions.js`)

**Permission tiers:**
- `read` — Auto-allowed. No confirmation needed. (list events, search contacts, battery status)
- `action` — Confirm on first use of this tool category per session. (create event, open app, move files)
- `destructive` — Confirm on first use of this tool category per session, with stronger warning language. (send message, delete event, quit app, empty trash)

**How it works:**

1. Tool registry tags every tool+action with a tier (see tool table above)
2. `permissions.js` maintains a `sessionGrants` Map keyed by `${toolName}:${tier}` (reset on app restart)
3. Before executing a tool in `loop.js`, resolve the tier for the specific action, then check: `isGranted(toolName, tier)`
4. If `tier === 'read'` → always allowed, skip confirmation
5. If `tier === 'action'` or `'destructive'` and not yet granted:
   a. Generate a unique `confirmId` (uuid)
   b. Create a Promise and store its resolver in `pendingGrants` Map keyed by `confirmId`
   c. Send SSE event `{ type: 'confirm', confirmId, tool: name, action, tier, description }` to the client
   d. `await` the Promise — the tool loop pauses here (Node event loop continues serving other requests)
6. Client shows inline PermissionCard in the chat
7. User clicks Allow/Deny → client sends `POST /api/tools/grant { confirmId, granted: true|false }`
8. The grant route looks up `pendingGrants.get(confirmId)` and calls `resolver({ granted })` — the Promise resolves
9. If granted: `sessionGrants.set('${toolName}:${tier}', true)`, execute the tool, continue loop
10. If denied: return a tool_result of "Permission denied by user", continue loop (AI can adjust)
11. All subsequent calls to that tool+tier auto-execute for the session

**SSE flow change in `loop.js`:**
```
AI response → tool_call event → resolve tier for action → permission check
  → if read or already granted: execute → tool_result event → continue loop
  → if not granted: confirm event → await Promise → grant route resolves it
    → if granted: execute → tool_result → continue
    → if denied: tool_result("denied") → continue (AI adapts)
```

**TCC error handling:**
```
execute tool → osascript returns TCC error → tcc_error SSE event
  → client shows friendly System Settings guide → tool_result("permission needed") → AI explains
```

**Client confirmation UI** (inline in chat, not a modal):
```
┌─────────────────────────────────────────────┐
│ 📅 Shellmate wants to create a calendar     │
│ event: "Doctor appointment"                 │
│                                             │
│ Allow calendar actions for this session?    │
│                                             │
│  [Allow]  [Deny]                            │
└─────────────────────────────────────────────┘
```

For destructive tier, the card uses a warning color and slightly different language:
```
┌─────────────────────────────────────────────┐
│ ⚠️ Shellmate wants to send an iMessage to   │
│ "John Smith"                                │
│                                             │
│ This will send a message from your Mac.     │
│ Allow messaging for this session?           │
│                                             │
│  [Allow]  [Deny]                            │
└─────────────────────────────────────────────┘
```

### 6. Extended Deny Map

The deny map in `definitions.js` (or now `registry.js`) gains new categories:

```js
const DENY_MAP = {
  // Existing
  exec: ['shell_exec'],  // + all cli_* tools added dynamically (see below)
  write: ['file_write'],
  read: ['file_read', 'file_list'],
  web: ['web_search', 'web_fetch'],
  browser: ['web_fetch'],
  // New — block all mac tools
  mac: ['mac_calendar', 'mac_reminders', 'mac_contacts', 'mac_notes',
        'mac_messages', 'mac_mail', 'mac_finder', 'mac_system', 'mac_apps', 'mac_files'],
  // New — granular
  calendar: ['mac_calendar'],
  reminders: ['mac_reminders'],
  contacts: ['mac_contacts'],
  notes: ['mac_notes'],
  messages: ['mac_messages'],
  mail: ['mac_mail'],
  files: ['mac_files'],
};
```

**CLI tools and the deny map:** When `discovery.js` registers a `cli_*` tool, it calls `registry.addToDenyCategory('exec', toolName)`. This dynamically adds the tool to the `exec` deny group. If a user's agent config has `deny: ['exec']`, all CLI tools are blocked along with `shell_exec`. This is enforced in the registry, not as a static map.

### 7. API Endpoints

New routes in `server/routes/tools.js`:

```
POST /api/tools/grant       — Grant session permission for a tool category
POST /api/tools/rescan      — Re-scan for CLI tools
GET  /api/tools/list        — List all registered tools (for settings UI)
GET  /api/tools/plugins     — List loaded plugins
```

### 8. Google Search as Default Provider

Replace the Brave-only `web_search` executor with a multi-provider system. Google is the default and requires no API key.

**New file: `server/tools/search-providers.js`**

```js
// Provider interface: search(query, count) → [{ title, url, snippet }]
export async function googleSearch(query, count = 5)   // scrapes google.com, no key needed
export async function braveSearch(query, count, apiKey) // existing Brave API logic
export async function perplexitySearch(query, count, apiKey) // Perplexity API
```

**Google search implementation:**
- Fetches `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${count}` with a browser-like User-Agent
- Parses result blocks from HTML (title from `<h3>`, URL from `<a href>`, snippet from nearby text)
- Returns structured results identical to Brave format
- Handles rate limiting gracefully: if Google returns a CAPTCHA page, falls back to a "Search is temporarily limited" message
- No API key, no signup, works immediately on first launch

**Provider selection logic in executor:**
```js
export async function webSearch({ query, count = 5 }, context) {
  const provider = context.searchProvider || 'google';
  switch (provider) {
    case 'google':     return googleSearch(query, count);
    case 'brave':      return braveSearch(query, count, context.braveApiKey);
    case 'perplexity': return perplexitySearch(query, count, context.perplexityApiKey);
    default:           return googleSearch(query, count);
  }
}
```

**Config changes:**
- `shellmate.json` `tools.web.search.provider` defaults to `'google'` (previously defaulted to `'brave'`)
- Brave/Perplexity still work if configured with API keys
- Capabilities UI (`CapabilitiesStep`) shows Google as default, Brave/Perplexity as optional upgrades
- Validation route (`/api/validate`) no longer fails when no Brave key is set — Google needs no key

**Modified files for search:**
- `server/tools/executor.js` → `webSearch()` delegates to provider
- `server/tools/search-providers.js` (new) → Google/Brave/Perplexity implementations
- `server/routes/agentChat.js` → pass `searchProvider` in context
- `server/routes/validate.js` → remove Brave key requirement
- `server/routes/capabilities.js` → default provider is `'google'`, update GET/POST
- `client/src/components/wizard/CapabilitiesStep.jsx` → show Google as default option

### 9. TOOLS.md Generator Update

`server/generators/tools.js` updates to include discovered tools and Mac capabilities:

```markdown
# TOOLS.md — Mac Environment & Available Tools

## Mac Apps
- Calendar, Reminders, Notes, ...

## Available Mac Tools
You have direct access to: Calendar, Reminders, Contacts, Notes, Messages, Mail, Finder, System controls, App management, File organization.

## Installed CLI Tools
- ffmpeg (video/audio processing)
- brew (package manager)
- ...

## Custom Tools
- my_custom_tool: Does something custom
```

---

## Files Changed/Added

### New Files
| File | Purpose |
|------|---------|
| `server/tools/registry.js` | Dynamic tool registry — singleton, register/unregister/execute |
| `server/tools/builtins.js` | Existing 6 tools refactored out of definitions.js/executor.js |
| `server/tools/permissions.js` | Trust-after-first-use session permission manager |
| `server/tools/discovery.js` | CLI auto-discovery via `which` checks |
| `server/tools/mac/osascript.js` | Shared AppleScript/JXA runner helper |
| `server/tools/mac/calendar.js` | Apple Calendar tool |
| `server/tools/mac/reminders.js` | Apple Reminders tool |
| `server/tools/mac/contacts.js` | Apple Contacts tool |
| `server/tools/mac/notes.js` | Apple Notes tool |
| `server/tools/mac/messages.js` | iMessage tool |
| `server/tools/mac/mail.js` | Apple Mail tool |
| `server/tools/mac/finder.js` | Finder interaction tool |
| `server/tools/mac/system.js` | System status/control tool |
| `server/tools/mac/apps.js` | App management tool |
| `server/tools/mac/files.js` | File organization tool |
| `server/tools/mac/index.js` | Registers all Mac tools with registry |
| `server/routes/tools.js` | API routes for grants, rescan, listing |
| `server/tools/search-providers.js` | Google (default), Brave, Perplexity search implementations |
| `client/src/components/chat/PermissionCard.jsx` | Inline confirmation UI component |

### Modified Files
| File | Change |
|------|--------|
| `server/tools/definitions.js` | Delegates to registry; keeps `toAnthropicTools`/`toOpenAITools` |
| `server/tools/executor.js` | Delegates to registry; `webSearch` delegates to search-providers |
| `server/tools/loop.js` | Add permission check + confirm/resume SSE flow |
| `server/routes/agentChat.js` | Pass session ID for permission tracking |
| `server/index.js` | Mount new `/api/tools` routes; initialize registry on startup |
| `client/src/hooks/useSSEChat.js` | Handle `confirm` SSE event type |
| `client/src/components/chat/ChatApp.jsx` | Render PermissionCard on confirm events |
| `client/src/components/chat/ToolCallDisplay.jsx` | Add Mac tool icons and friendly descriptions |
| `client/src/components/common/FriendlyToolStatus.jsx` | Add Mac tool descriptions to `describeTool()` |
| `server/generators/tools.js` | Include discovered tools + Mac capabilities in TOOLS.md |
| `server/routes/validate.js` | Remove Brave key requirement; Google needs no key |
| `server/routes/capabilities.js` | Default search provider → Google; Brave/Perplexity optional |
| `client/src/components/wizard/CapabilitiesStep.jsx` | Google as default search option |

---

## Implementation Order

1. **Registry** — `registry.js` + refactor `builtins.js` + move converters to registry (existing tools work through registry, `definitions.js` becomes thin re-export)
2. **Google Search** — `search-providers.js` (Google default + Brave + Perplexity) + update `executor.js` + update `validate.js` + update `capabilities.js` + update `CapabilitiesStep.jsx`. Quick win — removes API key friction immediately.
3. **Permissions** — `permissions.js` (Promise/resolver pattern) + `loop.js` changes + `PermissionCard.jsx` + `POST /api/tools/grant` route + `useSSEChat.js` confirm handler. Must be complete before Mac tools so we can test confirmation flow.
4. **Mac foundation** — `osascript.js` helper (with TCC error detection) + `mac/index.js` loader + Electron `Info.plist` usage description strings
5. **Mac tools** — Implement all 10 tool modules (start with calendar + reminders for quick validation, then batch the rest)
6. **CLI discovery** — `discovery.js` + dynamic deny-map registration + cache + rescan endpoint + `tools_rescan` built-in tool
7. **Plugin system** — Plugin loader + file watcher + opt-in gate (`plugins.enabled` in shellmate.json)
8. **UI polish** — Mac tool icons + friendly descriptions in `describeTool()` + TOOLS.md generator update
9. **Integration** — Wire everything through agentChat.js, contextual tool filtering, end-to-end testing

## Future Additions (Out of Scope for Now)

- `mac_shortcuts` — Run Apple Shortcuts by name. The TOOLS.md generator already references Shortcuts; this is a natural next tool.
- TOOLS.md auto-refresh — Regenerate workspace files when tool availability changes after wizard setup.
- `mac_messages.read_recent` tier upgrade — Currently `read`, but reading iMessages is privacy-sensitive. Consider upgrading to `action` tier after user feedback.
