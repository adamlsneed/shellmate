# Plan 4: CLI Discovery + Plugins + TOOLS.md Generator

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-discover installed CLI tools, support user-defined plugin tools from `~/.shellmate/tools/`, add API endpoints for tool listing and rescanning, and update the TOOLS.md generator to include all discovered capabilities.

**Architecture:** `discovery.js` scans for CLIs via `which`, caches results to `~/.shellmate/discovered-tools.json`, and registers lightweight wrapper tools. `plugins.js` loads `.js` files from `~/.shellmate/tools/` when enabled in config. New API endpoints expose tool listing and rescan. The TOOLS.md generator is updated to include Mac tools, discovered CLIs, and plugins in the agent's system prompt.

**Tech Stack:** Node.js ESM, child_process.exec, fs.watch, Express

**Spec:** `docs/superpowers/specs/2026-03-19-mac-native-tools-design.md` (sections 3, 4, 8)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/tools/discovery.js` | Create | CLI auto-discovery — scan, cache, register wrappers with registry |
| `server/tools/plugins.js` | Create | Plugin loader — load `.js` files from `~/.shellmate/tools/`, opt-in gate |
| `server/routes/tools.js` | Modify | Add `GET /api/tools/list`, `POST /api/tools/rescan`, `GET /api/tools/plugins` |
| `server/index.js` | Modify | Call discovery + plugin loading on startup |
| `server/generators/tools.js` | Modify | Generate TOOLS.md with Mac tools, discovered CLIs, plugins |
| `client/src/theme.js` | Modify | Add `cli_*` tool description fallback |

---

## Task 1: CLI Auto-Discovery

**Files:**
- Create: `server/tools/discovery.js`

- [ ] **Step 1: Create discovery.js**

```js
// server/tools/discovery.js
/**
 * CLI auto-discovery for Shellmate.
 * Scans for commonly useful CLI tools via `which`, caches results,
 * and registers lightweight wrapper tools with the registry.
 */

import { exec, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerTool, unregisterTool, addToDenyCategory } from './registry.js';

const CACHE_PATH = path.join(os.homedir(), '.shellmate', 'discovered-tools.json');
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * CLI tools to scan for. Each entry: { cmd, name?, description }
 * name defaults to cmd if not specified.
 */
const CLI_CANDIDATES = [
  { cmd: 'ffmpeg',       description: 'Video/audio processing' },
  { cmd: 'convert',      name: 'imagemagick', description: 'Image processing (ImageMagick)' },
  { cmd: 'pandoc',       description: 'Document format conversion' },
  { cmd: 'yt-dlp',       name: 'yt_dlp', description: 'Video/audio downloader' },
  { cmd: 'jq',           description: 'JSON processor' },
  { cmd: 'sqlite3',      description: 'SQLite database shell' },
  { cmd: 'python3',      description: 'Python 3 interpreter' },
  { cmd: 'node',         description: 'Node.js runtime' },
  { cmd: 'brew',         description: 'Homebrew package manager' },
  { cmd: 'git',          description: 'Version control' },
  { cmd: 'curl',         description: 'HTTP client' },
  { cmd: 'wget',         description: 'File downloader' },
  { cmd: 'rsync',        description: 'File synchronization' },
  { cmd: 'zip',          description: 'Create ZIP archives' },
  { cmd: 'unzip',        description: 'Extract ZIP archives' },
  { cmd: 'say',          description: 'Text-to-speech (macOS)' },
  { cmd: 'pbcopy',       description: 'Copy to clipboard (macOS)' },
  { cmd: 'pbpaste',      description: 'Paste from clipboard (macOS)' },
  { cmd: 'open',         description: 'Open files/URLs with default app (macOS)' },
  { cmd: 'defaults',     description: 'Read/write macOS preferences' },
  { cmd: 'diskutil',     description: 'Disk management (macOS)' },
  { cmd: 'caffeinate',   description: 'Prevent Mac from sleeping' },
  { cmd: 'sips',         description: 'Image processing (macOS built-in)' },
  { cmd: 'mdls',         description: 'Read file metadata (Spotlight)' },
  { cmd: 'mdfind',       description: 'Spotlight search from terminal' },
  { cmd: 'screencapture', description: 'Screen capture (macOS)' },
];

// Track registered CLI tool names for cleanup on rescan
const registeredCLINames = new Set();

/**
 * Parse a command-line string into an args array.
 * Respects single and double quotes.
 */
function parseArgs(str) {
  const args = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === ' ' && !inSingle && !inDouble) {
      if (current) { args.push(current); current = ''; }
      continue;
    }
    current += c;
  }
  if (current) args.push(current);
  return args;
}

/**
 * Check if a command exists using `which`.
 * Returns the path or null.
 */
function whichCmd(cmd) {
  return new Promise(resolve => {
    exec(`which ${cmd}`, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

/**
 * Read the discovery cache. Returns null if stale or missing.
 */
function readCache() {
  try {
    const stat = fs.statSync(CACHE_PATH);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Write the discovery cache.
 */
function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

/**
 * Scan for CLI tools. Returns array of { name, cmd, path, description }.
 */
async function scanCLIs() {
  const found = [];
  const results = await Promise.all(
    CLI_CANDIDATES.map(async (c) => {
      const p = await whichCmd(c.cmd);
      return p ? { name: c.name || c.cmd, cmd: c.cmd, path: p, description: c.description } : null;
    })
  );
  for (const r of results) {
    if (r) found.push(r);
  }
  return found;
}

/**
 * Register a single discovered CLI as a tool.
 */
function registerCLI(cli) {
  const safeName = `cli_${cli.name.replace(/[^a-z0-9]/gi, '_')}`;
  const definition = {
    name: safeName,
    description: `Run ${cli.cmd}. ${cli.description}. Installed at ${cli.path}.`,
    input_schema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: `Command-line arguments for ${cli.cmd}` },
      },
      required: ['args'],
    },
  };

  const executor = (input) => {
    return new Promise(resolve => {
      // Use execFile with args array to prevent command injection.
      // Split args on whitespace (respecting quoted strings).
      const args = parseArgs(input.args || '');
      execFile(cli.path, args, { timeout: 30000, maxBuffer: 5 * 1024 * 1024, cwd: os.homedir() }, (err, stdout, stderr) => {
        const parts = [];
        if (stdout) parts.push(stdout.slice(0, 50000));
        if (stderr) parts.push(`STDERR:\n${stderr.slice(0, 10000)}`);
        if (err && err.killed) parts.push('[Process killed — timeout 30s]');
        else if (err && !stdout && !stderr) parts.push(`Error: ${err.message}`);
        resolve(parts.join('\n') || '(no output)');
      });
    });
  };

  registerTool(definition, executor, { tier: 'action' });
  addToDenyCategory('exec', safeName);
  addToDenyCategory('cli', safeName);
  registeredCLINames.add(safeName);
}

/**
 * Discover and register CLI tools.
 * Uses cache if fresh, otherwise scans and caches.
 */
export async function discoverCLIs({ forceRescan = false } = {}) {
  let clis;

  if (!forceRescan) {
    const cached = readCache();
    if (cached) {
      clis = cached;
    }
  }

  if (!clis) {
    clis = await scanCLIs();
    writeCache(clis);
  }

  // Clean up stale CLI tools from previous registration
  for (const name of registeredCLINames) {
    unregisterTool(name);
  }
  registeredCLINames.clear();

  for (const cli of clis) {
    registerCLI(cli);
  }

  return clis;
}

/**
 * Force rescan — clears cache and re-discovers.
 */
export async function rescanCLIs() {
  return discoverCLIs({ forceRescan: true });
}

/**
 * Get the list of discovered CLIs (from cache, no re-scan).
 */
export function getDiscoveredCLIs() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Verify discovery works**

Run: `node -e "import('./server/tools/discovery.js').then(async m => { const clis = await m.discoverCLIs(); console.log(clis.length + ' CLIs found:', clis.map(c => c.cmd).join(', ')); })"`
Expected: List of found CLIs (varies by machine, but should include git, curl, etc.)

- [ ] **Step 3: Commit**

```bash
git add server/tools/discovery.js
git commit -m "feat: add CLI auto-discovery with caching and registry integration"
```

---

## Task 2: Plugin Loader

**Files:**
- Create: `server/tools/plugins.js`

- [ ] **Step 1: Create plugins.js**

```js
// server/tools/plugins.js
/**
 * Plugin tool loader for Shellmate.
 * Loads user-defined tools from ~/.shellmate/tools/*.js when enabled.
 * Disabled by default — requires plugins.enabled: true in shellmate.json.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerTool, unregisterTool } from './registry.js';
import { readConfig } from '../utils/config.js';

const PLUGINS_DIR = path.join(os.homedir(), '.shellmate', 'tools');
let watcher = null;
const loadedPlugins = new Map(); // name → { path }

/**
 * Check if plugins are enabled in shellmate.json.
 */
function isPluginsEnabled() {
  const cfg = readConfig();
  return cfg.plugins?.enabled === true;
}

/**
 * Load a single plugin file. Returns the plugin name or null on failure.
 */
async function loadPlugin(filePath) {
  try {
    // Dynamic import with cache-busting query param for hot-reload
    const mod = await import(`${filePath}?t=${Date.now()}`);
    const plugin = mod.default;

    if (!plugin?.name || !plugin?.description || !plugin?.input_schema || !plugin?.execute) {
      console.warn(`[plugins] Skipping ${filePath}: missing name, description, input_schema, or execute`);
      return null;
    }

    const definition = {
      name: plugin.name,
      description: plugin.description,
      input_schema: plugin.input_schema,
    };

    registerTool(definition, plugin.execute, { tier: plugin.tier || 'action' });
    loadedPlugins.set(plugin.name, { path: filePath });
    return plugin.name;
  } catch (err) {
    console.warn(`[plugins] Failed to load ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Load all plugins from the plugins directory.
 */
export async function loadPlugins() {
  if (!isPluginsEnabled()) {
    return { loaded: 0, message: 'Plugins disabled (set plugins.enabled: true in shellmate.json)' };
  }

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    return { loaded: 0, message: 'Plugin directory created (empty)' };
  }

  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  let loaded = 0;

  for (const file of files) {
    const name = await loadPlugin(path.join(PLUGINS_DIR, file));
    if (name) loaded++;
  }

  return { loaded, message: `Loaded ${loaded} plugin(s)` };
}

/**
 * Start watching the plugins directory for changes (hot-reload).
 */
export function watchPlugins() {
  if (!isPluginsEnabled() || !fs.existsSync(PLUGINS_DIR)) return;
  if (watcher) return; // already watching

  try {
    watcher = fs.watch(PLUGINS_DIR, async (eventType, filename) => {
      if (!filename?.endsWith('.js')) return;
      const filePath = path.join(PLUGINS_DIR, filename);

      if (fs.existsSync(filePath)) {
        // File added or changed — (re)load it
        const name = await loadPlugin(filePath);
        if (name) console.log(`[plugins] Loaded/reloaded: ${name}`);
      } else {
        // File removed — unregister if we loaded it
        for (const [name, info] of loadedPlugins) {
          if (info.path === filePath) {
            unregisterTool(name);
            loadedPlugins.delete(name);
            console.log(`[plugins] Unloaded: ${name}`);
            break;
          }
        }
      }
    });
  } catch (err) {
    console.warn(`[plugins] Watch failed: ${err.message}`);
  }
}

/**
 * Get the list of loaded plugins.
 */
export function getLoadedPlugins() {
  return Array.from(loadedPlugins.entries()).map(([name, info]) => ({
    name,
    path: info.path,
  }));
}
```

- [ ] **Step 2: Verify module loads (plugins disabled)**

Run: `node -e "import('./server/tools/plugins.js').then(async m => { const r = await m.loadPlugins(); console.log(r); })"`
Expected: `{ loaded: 0, message: 'Plugins disabled (set plugins.enabled: true in shellmate.json)' }`

- [ ] **Step 3: Commit**

```bash
git add server/tools/plugins.js
git commit -m "feat: add plugin loader with opt-in gate and hot-reload watcher"
```

---

## Task 3: Add API Endpoints for Tool Management

**Files:**
- Modify: `server/routes/tools.js`

- [ ] **Step 1: Add list, rescan, and plugins endpoints**

In `server/routes/tools.js`, add new imports at the top (after line 7):

```js
import { getToolsForAgent } from '../tools/registry.js';
import { rescanCLIs, getDiscoveredCLIs } from '../tools/discovery.js';
import { getLoadedPlugins } from '../tools/plugins.js';
```

Then add these routes before the `export default router;` line (before line 30):

```js
/**
 * GET /api/tools/list — List all registered tools (for settings UI).
 */
router.get('/tools/list', (_req, res) => {
  const tools = getToolsForAgent({});
  res.json({
    count: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description })),
  });
});

/**
 * POST /api/tools/rescan — Force re-scan for CLI tools.
 */
router.post('/tools/rescan', async (_req, res) => {
  try {
    const clis = await rescanCLIs();
    res.json({ ok: true, count: clis.length, clis: clis.map(c => ({ name: c.cmd, path: c.path })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tools/plugins — List loaded plugins.
 */
router.get('/tools/plugins', (_req, res) => {
  res.json({ plugins: getLoadedPlugins() });
});
```

- [ ] **Step 2: Verify routes mount**

Run: `node -e "import('./server/index.js').then(m => m.createServer().then(() => console.log('OK')))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/routes/tools.js
git commit -m "feat: add tool list, rescan, and plugins API endpoints"
```

---

## Task 4: Wire Discovery and Plugins Into Server Startup

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add imports and startup calls**

In `server/index.js`, add imports after line 17 (`import { registerMacTools }`):

```js
import { discoverCLIs } from './tools/discovery.js';
import { loadPlugins, watchPlugins } from './tools/plugins.js';
```

Then update the startup section. Replace lines 22-24:
```js
  // Initialize tool registry with built-in tools
  registerBuiltins();
  registerMacTools();
```
with:
```js
  // Initialize tool registry
  registerBuiltins();
  registerMacTools();
  await discoverCLIs();
  await loadPlugins();
  watchPlugins();
```

- [ ] **Step 2: Verify server starts with all tools**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const tools = getToolsForAgent({}); console.log(tools.length + ' total tools'); })"`
Expected: More than 16 tools (16 built-in+Mac + discovered CLIs)

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: wire CLI discovery and plugin loading into server startup"
```

---

## Task 5: Update TOOLS.md Generator

**Files:**
- Modify: `server/generators/tools.js`

- [ ] **Step 1: Rewrite generateTools to include all capabilities**

Replace the entire contents of `server/generators/tools.js`:

```js
/**
 * Generate TOOLS.md for the Shellmate agent.
 * Pure function — receives agent spec, team spec, and optional context.
 * Documents Mac-native tools, discovered CLIs, and environment specifics.
 */

export function generateTools(agent, _teamSpec, { discoveredCLIs = [] } = {}) {
  const macApps = agent.mac_apps && agent.mac_apps.length > 0
    ? agent.mac_apps.map(app => `- ${app}`).join('\n')
    : '- (none specified)';

  const clis = discoveredCLIs;
  const cliSection = clis.length > 0
    ? clis.map(c => `- \`${c.cmd}\` — ${c.description} (${c.path})`).join('\n')
    : '- No additional CLI tools discovered';

  return `# TOOLS.md — Mac Environment & Available Tools

You have built-in tools for running commands, reading/writing files, and searching the web.
You also have direct access to Mac apps and discovered CLI tools listed below.

## Mac Apps You Use

${macApps}

## Available Mac Tools

You have dedicated tools for interacting with these Mac apps (use the mac_* tools instead of shell commands):

- **Calendar** (mac_calendar) — list, create, delete, search events
- **Reminders** (mac_reminders) — list, create, complete, delete reminders
- **Contacts** (mac_contacts) — search contacts, get details, list groups
- **Notes** (mac_notes) — list, create, search, read notes
- **Messages** (mac_messages) — send iMessage, read recent messages
- **Mail** (mac_mail) — list inbox, search, compose drafts, read messages
- **Finder** (mac_finder) — open folders, reveal files, get desktop items
- **System** (mac_system) — battery, Wi-Fi, volume, screenshot, dark mode, disk space
- **Apps** (mac_apps) — open, quit, list running apps
- **Files** (mac_files) — organize folders, find duplicates, categorize files, bulk rename

> Use mac_* tools for Mac app interactions. Use shell_exec for general terminal commands.
> Use mac_files for batch file organization. Use file_read/file_write for individual files.

## Installed CLI Tools

${cliSection}

## Finder Paths

- ~/Desktop — quick drop zone
- ~/Downloads — downloaded files
- ~/Documents — documents and projects

## Tips

- For file organization tasks, prefer mac_files (smart categorization, duplicate detection)
- For Mac app interactions, use the dedicated mac_* tools — they're more reliable than shell_exec + osascript
- Web search uses DuckDuckGo by default — no API key needed
`;
}
```

- [ ] **Step 2: Verify generator produces output**

Run: `node -e "import('./server/generators/tools.js').then(m => { const r = m.generateTools({ mac_apps: ['Safari', 'Notes'] }, {}, { discoveredCLIs: [{ cmd: 'git', description: 'Version control', path: '/usr/bin/git' }] }); console.log(r.substring(0, 400)); })"`
Expected: TOOLS.md content starting with header and listing Mac tools

- [ ] **Step 3: Commit**

```bash
git add server/generators/tools.js
git commit -m "feat: update TOOLS.md generator with Mac tools, discovered CLIs"
```

---

## Task 6: Add CLI Tool Description Fallback in Theme

**Files:**
- Modify: `client/src/theme.js`

- [ ] **Step 1: Add cli_* fallback in describeTool**

In `client/src/theme.js`, find the `default:` case in the `describeTool` function (currently the last case before the closing brace):

```js
    default:              return 'Working on it...';
```

Replace with:

```js
    default: {
      // CLI-discovered tools: cli_ffmpeg, cli_git, etc.
      if (name.startsWith('cli_')) {
        const cmd = name.replace('cli_', '').replace(/_/g, '-');
        return `Running ${cmd}...`;
      }
      return 'Working on it...';
    }
```

Also add `cli_*` entries to `FRIENDLY_TOOL_NAMES` — add after the `mac_files` entry:

```js
  // CLI tools get a generic prefix; specific names resolved at runtime
```

Actually, the `describeTool` function handles CLI tools dynamically, so no static entry is needed in `FRIENDLY_TOOL_NAMES`. Just the `describeTool` change is sufficient.

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add client/src/theme.js
git commit -m "feat: add CLI tool description fallback in chat UI"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Verify total tool count**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const tools = getToolsForAgent({}); const builtins = tools.filter(t => !t.name.startsWith('mac_') && !t.name.startsWith('cli_')); const mac = tools.filter(t => t.name.startsWith('mac_')); const cli = tools.filter(t => t.name.startsWith('cli_')); console.log('Total:', tools.length); console.log('Built-in:', builtins.length); console.log('Mac:', mac.length); console.log('CLI:', cli.length, cli.map(t => t.name).join(', ')); })"`
Expected: 16+ tools (6 built-in + 10 Mac + N CLI)

- [ ] **Step 2: Verify deny map blocks CLI tools under 'exec'**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const all = getToolsForAgent({}); const denied = getToolsForAgent({ tools: { deny: ['exec'] } }); const blocked = all.length - denied.length; console.log('exec deny blocks', blocked, 'tools (shell_exec + all cli_*)'); })"`
Expected: More than 1 tool blocked (shell_exec + cli_* tools)

- [ ] **Step 3: Verify TOOLS.md generator**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { generateTools } = await import('./server/generators/tools.js'); const { getDiscoveredCLIs } = await import('./server/tools/discovery.js'); const r = generateTools({ mac_apps: ['Safari'] }, {}, { discoveredCLIs: getDiscoveredCLIs() }); console.log(r.includes('mac_calendar') && r.includes('CLI Tools') ? 'TOOLS.md OK' : 'MISSING'); })"`
Expected: `TOOLS.md OK`

- [ ] **Step 4: Verify client build**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build

- [ ] **Step 5: Commit any fixes**

---

## What We've Built (All 4 Plans)

After all 4 plans are complete, Shellmate has:

| Category | Count | Examples |
|----------|-------|---------|
| Built-in tools | 6 | shell_exec, file_read, file_write, file_list, web_search, web_fetch |
| Mac-native tools | 10 | mac_calendar, mac_reminders, mac_contacts, mac_notes, mac_messages, mac_mail, mac_finder, mac_system, mac_apps, mac_files |
| CLI tools | N (auto-discovered) | cli_ffmpeg, cli_git, cli_brew, cli_curl, ... |
| Plugin tools | M (user-defined) | Custom tools from ~/.shellmate/tools/ |

Plus:
- Dynamic tool registry with deny map
- DuckDuckGo search (no API key)
- Trust-after-first-use permission system
- Friendly UI descriptions for all tools
- CLI caching with 24h refresh
- Plugin hot-reload with file watcher
