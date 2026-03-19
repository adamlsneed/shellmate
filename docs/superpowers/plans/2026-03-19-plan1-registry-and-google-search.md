# Plan 1: Dynamic Tool Registry + Google Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded tool array with a dynamic registry, and swap Brave Search (requires API key) for Google Search (works out of the box) as the default search provider.

**Architecture:** The tool registry is a singleton ES module that stores tool definitions + executors in a Map. Existing code (`definitions.js`, `executor.js`) becomes thin delegates to the registry. Google search scrapes google.com HTML — no API key, no signup. Brave and Perplexity remain as optional providers.

**Tech Stack:** Node.js ESM, Express, React 18, Zustand, TailwindCSS

**Spec:** `docs/superpowers/specs/2026-03-19-mac-native-tools-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/tools/registry.js` | Create | Dynamic tool registry — registerTool, unregisterTool, getToolsForAgent, executeTool, getToolMeta, toAnthropicTools, toOpenAITools, addToDenyCategory |
| `server/tools/builtins.js` | Create | Registers the existing 6 tools (shell_exec, file_read, file_write, file_list, web_search, web_fetch) with the registry. Executors extracted from executor.js. |
| `server/tools/search-providers.js` | Create | Google (default), Brave, Perplexity search implementations |
| `server/tools/definitions.js` | Modify | Thin re-export from registry (backward compat) |
| `server/tools/executor.js` | Modify | Thin delegate to registry; webSearch uses search-providers |
| `server/tools/loop.js` | Modify | Import executeTool from registry instead of executor |
| `server/routes/agentChat.js` | Modify | Pass searchProvider in context; get tools from registry |
| `server/routes/validate.js` | Modify | Remove Brave key requirement; Google needs no key |
| `server/routes/capabilities.js` | Modify | Default provider → google; support google/brave/perplexity |
| `client/src/components/wizard/CapabilitiesStep.jsx` | Modify | Google as default, Brave/Perplexity as optional |
| `server/index.js` | Modify | Initialize registry on startup (import builtins) |

---

## Task 1: Create the Tool Registry

**Files:**
- Create: `server/tools/registry.js`

- [ ] **Step 1: Create registry.js with core data structures**

```js
// server/tools/registry.js
/**
 * Dynamic tool registry for Shellmate.
 * Singleton module — all tool sources register here on startup.
 */

const tools = new Map();       // name → { definition, executor, tier, category }
const denyMap = new Map();     // denyCategory → Set<toolName>

// Initialize static deny categories
const STATIC_DENY = {
  exec: ['shell_exec'],
  write: ['file_write'],
  read: ['file_read', 'file_list'],
  web: ['web_search', 'web_fetch'],
  browser: ['web_fetch'],
};
for (const [cat, names] of Object.entries(STATIC_DENY)) {
  denyMap.set(cat, new Set(names));
}

/**
 * Register a tool with the registry.
 * @param {object} definition - { name, description, input_schema }
 * @param {function} executor - async (input, context) => string
 * @param {object} opts - { tier, category } (tier: 'read'|'action'|'destructive' or per-action map)
 */
export function registerTool(definition, executor, opts = {}) {
  const { tier = 'action', category = null } = opts;
  tools.set(definition.name, { definition, executor, tier, category });
}

/**
 * Remove a tool from the registry.
 */
export function unregisterTool(name) {
  tools.delete(name);
  // Remove from all deny categories
  for (const set of denyMap.values()) {
    set.delete(name);
  }
}

/**
 * Add a tool to a deny category (used by CLI discovery).
 */
export function addToDenyCategory(category, toolName) {
  if (!denyMap.has(category)) denyMap.set(category, new Set());
  denyMap.get(category).add(toolName);
}

/**
 * Get tools available for an agent, filtering by its deny list.
 */
export function getToolsForAgent(agentConfig) {
  const deny = agentConfig?.tools?.deny || [];
  if (deny.length === 0) {
    return Array.from(tools.values()).map(t => t.definition);
  }

  const blocked = new Set();
  for (const d of deny) {
    const names = denyMap.get(d);
    if (names) {
      for (const name of names) blocked.add(name);
    }
  }

  return Array.from(tools.values())
    .filter(t => !blocked.has(t.definition.name))
    .map(t => t.definition);
}

/**
 * Execute a tool by name.
 */
export async function executeTool(name, input, context = {}) {
  const entry = tools.get(name);
  if (!entry) return `Unknown tool: ${name}`;
  return entry.executor(input, context);
}

/**
 * Get tool metadata for permission checks.
 */
export function getToolMeta(name) {
  const entry = tools.get(name);
  if (!entry) return null;
  return { name, tier: entry.tier, category: entry.category };
}

/**
 * Convert tools to Anthropic API format.
 */
export function toAnthropicTools(toolDefs) {
  return toolDefs.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Convert tools to OpenAI function calling format.
 */
export function toOpenAITools(toolDefs) {
  return toolDefs.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}
```

- [ ] **Step 2: Verify module loads without errors**

Run: `node -e "import('./server/tools/registry.js').then(() => console.log('OK'))"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add server/tools/registry.js
git commit -m "feat: add dynamic tool registry"
```

---

## Task 2: Extract Built-in Tools to builtins.js

**Files:**
- Create: `server/tools/builtins.js`
- Modify: `server/tools/executor.js`

- [ ] **Step 1: Create builtins.js that registers existing tools with the registry**

```js
// server/tools/builtins.js
/**
 * Registers the 6 built-in tools with the dynamic registry.
 * Executors are imported from executor.js (which keeps the actual implementation).
 */

import { registerTool } from './registry.js';
import {
  shellExec, fileRead, fileWrite, fileList, webSearch, webFetch,
} from './executor.js';

const BUILTIN_TOOLS = [
  {
    definition: {
      name: 'shell_exec',
      description: 'Run a terminal command and return stdout/stderr. Use for system commands, scripts, and automation.',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          cwd: { type: 'string', description: 'Working directory (optional, defaults to home)' },
          timeout: { type: 'number', description: 'Timeout in milliseconds (optional, default 30000)' },
        },
        required: ['command'],
      },
    },
    executor: (input) => shellExec(input),
    tier: 'action',
  },
  {
    definition: {
      name: 'file_read',
      description: 'Read the contents of a file. Returns the text content.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to the file to read' },
        },
        required: ['path'],
      },
    },
    executor: (input) => fileRead(input),
    tier: 'read',
  },
  {
    definition: {
      name: 'file_write',
      description: 'Create or overwrite a file with the given content. Creates parent directories if needed.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path to write to' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
    },
    executor: (input) => fileWrite(input),
    tier: 'action',
  },
  {
    definition: {
      name: 'file_list',
      description: 'List files and directories at a given path.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
          recursive: { type: 'boolean', description: 'List recursively (max depth 3, default false)' },
        },
        required: ['path'],
      },
    },
    executor: (input) => fileList(input),
    tier: 'read',
  },
  {
    definition: {
      name: 'web_search',
      description: 'Search the web using Google. Returns top results with titles, URLs, and snippets.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          count: { type: 'number', description: 'Number of results (default 5, max 20)' },
        },
        required: ['query'],
      },
    },
    executor: (input, context) => webSearch(input, context),
    tier: 'read',
  },
  {
    definition: {
      name: 'web_fetch',
      description: 'Fetch a URL and return its content as plain text (HTML stripped).',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
        },
        required: ['url'],
      },
    },
    executor: (input) => webFetch(input),
    tier: 'read',
  },
];

export function registerBuiltins() {
  for (const tool of BUILTIN_TOOLS) {
    registerTool(tool.definition, tool.executor, { tier: tool.tier });
  }
}
```

- [ ] **Step 2: Update executor.js — change webSearch to use search-providers (prep)**

The `webSearch` function in `executor.js` currently takes `braveApiKey` as a second param. Change it to accept a `context` object so it can route to different providers later (Task 4). For now, keep the Brave implementation as-is but accept context:

In `server/tools/executor.js`, change the `webSearch` export signature from:
```js
export async function webSearch({ query, count = 5 }, braveApiKey) {
```
to:
```js
export async function webSearch({ query, count = 5 }, context = {}) {
  const braveApiKey = context.braveApiKey;
```

And update the `executeTool` switch case (line 218) from:
```js
case 'web_search':  return webSearch(input, context.braveApiKey);
```
to:
```js
case 'web_search':  return webSearch(input, context);
```
This ensures the full context object is passed through.

- [ ] **Step 3: Verify builtins load correctly**

Run: `node -e "import('./server/tools/builtins.js').then(m => { m.registerBuiltins(); console.log('OK'); })"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add server/tools/builtins.js server/tools/executor.js
git commit -m "feat: extract built-in tools to builtins.js with registry registration"
```

---

## Task 3: Wire Registry Into Existing Code

**Files:**
- Modify: `server/tools/definitions.js`
- Modify: `server/tools/loop.js`
- Modify: `server/routes/agentChat.js`
- Modify: `server/index.js`

- [ ] **Step 1: Update definitions.js to re-export from registry**

Replace the entire contents of `server/tools/definitions.js` with thin re-exports:

```js
// server/tools/definitions.js
/**
 * Backward-compatible re-exports from the dynamic registry.
 * Existing code that imports from here continues to work.
 */

export {
  getToolsForAgent,
  toAnthropicTools,
  toOpenAITools,
} from './registry.js';
```

- [ ] **Step 2: Update loop.js to import from registry**

In `server/tools/loop.js`, change line 7:
```js
import { executeTool } from './executor.js';
```
to:
```js
import { executeTool } from './registry.js';
```

And change line 8:
```js
import { toAnthropicTools, toOpenAITools } from './definitions.js';
```
to:
```js
import { toAnthropicTools, toOpenAITools } from './registry.js';
```

- [ ] **Step 3: Update agentChat.js to use registry**

In `server/routes/agentChat.js`, change line 8:
```js
import { getToolsForAgent } from '../tools/definitions.js';
```
to:
```js
import { getToolsForAgent } from '../tools/registry.js';
```

- [ ] **Step 4: Initialize registry on server startup**

In `server/index.js`, add after the existing imports (after line 14):
```js
import { registerBuiltins } from './tools/builtins.js';
```

And at the top of `createServer()`, before `const app = express();` (line 19), add:
```js
  // Initialize tool registry with built-in tools
  registerBuiltins();
```

- [ ] **Step 5: Verify the app starts and chat works**

Run: `npm run dev`
Expected: Server starts at localhost:3847 without errors. If you have a configured agent, sending a chat message should work as before.

- [ ] **Step 6: Commit**

```bash
git add server/tools/definitions.js server/tools/loop.js server/routes/agentChat.js server/index.js
git commit -m "refactor: wire dynamic tool registry into existing code paths"
```

---

## Task 4: Create Google Search Provider

**Files:**
- Create: `server/tools/search-providers.js`

- [ ] **Step 1: Create search-providers.js with Google, Brave, and Perplexity**

```js
// server/tools/search-providers.js
/**
 * Web search provider implementations.
 * Google is the default — no API key needed.
 * Brave and Perplexity are optional (require API keys).
 */

const MAX_RESULTS = 20;

/**
 * Google search via HTML scraping. No API key required.
 */
export async function googleSearch(query, count = 5) {
  try {
    count = Math.min(count, MAX_RESULTS);
    const params = new URLSearchParams({ q: query, num: count, hl: 'en' });
    const res = await fetch(`https://www.google.com/search?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      return `Google search error: ${res.status} ${res.statusText}`;
    }

    const html = await res.text();

    // Check for CAPTCHA / unusual traffic page
    if (html.includes('detected unusual traffic') || html.includes('/sorry/')) {
      return 'Google search is temporarily limited. Try again in a moment, or configure Brave Search as an alternative provider.';
    }

    return parseGoogleResults(html, count);
  } catch (err) {
    return `Google search error: ${err.message}`;
  }
}

/**
 * Parse Google search results from HTML.
 * Extracts title, URL, and snippet from result blocks.
 */
function parseGoogleResults(html, maxResults) {
  const results = [];

  // Match result blocks: <a href="/url?q=REAL_URL..."><h3>TITLE</h3></a> ... snippet
  // Google wraps results in <div class="g"> blocks
  const blockRegex = /<div class="[^"]*\bg\b[^"]*">[\s\S]*?<\/div>\s*<\/div>/g;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    if (results.length >= maxResults) break;

    // Extract URL from /url?q= redirect links
    const urlMatch = block.match(/href="\/url\?q=([^&"]+)/);
    if (!urlMatch) continue;
    const url = decodeURIComponent(urlMatch[1]);

    // Skip Google's own URLs
    if (url.includes('google.com/') && !url.includes('support.google.com')) continue;

    // Extract title from <h3>
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').trim()
      : url;

    // Extract snippet — text after the link block
    const snippetMatch = block.match(/<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const snippet = snippetMatch
      ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim()
      : '';

    if (title || snippet) {
      results.push({ title, url, snippet });
    }
  }

  // Fallback: try simpler regex if the block approach found nothing
  if (results.length === 0) {
    const simpleRegex = /href="\/url\?q=(https?:\/\/[^&"]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g;
    let match;
    while ((match = simpleRegex.exec(html)) !== null && results.length < maxResults) {
      const url = decodeURIComponent(match[1]);
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      if (url.includes('google.com/')) continue;
      results.push({ title, url, snippet: '' });
    }
  }

  if (results.length === 0) {
    return 'No results found.';
  }

  return results.map((r, i) =>
    `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
  ).join('\n\n');
}

/**
 * Brave Search API. Requires API key.
 */
export async function braveSearch(query, count = 5, apiKey) {
  if (!apiKey) return 'Brave Search not configured — no API key found.';
  try {
    const params = new URLSearchParams({ q: query, count: Math.min(count, MAX_RESULTS) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) return `Brave Search error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, count);
    if (results.length === 0) return 'No results found.';
    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ''}`
    ).join('\n\n');
  } catch (err) {
    return `Brave Search error: ${err.message}`;
  }
}

/**
 * Perplexity Search API. Requires API key.
 */
export async function perplexitySearch(query, count = 5, apiKey) {
  if (!apiKey) return 'Perplexity Search not configured — no API key found.';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar-pro',
        messages: [{ role: 'user', content: query }],
        max_tokens: 1000,
      }),
    });
    if (!res.ok) return `Perplexity error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No results found.';
  } catch (err) {
    return `Perplexity error: ${err.message}`;
  }
}

/**
 * Route search to the configured provider.
 */
export async function routeSearch({ query, count = 5 }, context = {}) {
  const provider = context.searchProvider || 'google';
  switch (provider) {
    case 'brave':      return braveSearch(query, count, context.braveApiKey);
    case 'perplexity': return perplexitySearch(query, count, context.perplexityApiKey);
    case 'google':
    default:           return googleSearch(query, count);
  }
}
```

- [ ] **Step 2: Verify Google search works**

Run: `node -e "import('./server/tools/search-providers.js').then(async m => { const r = await m.googleSearch('weather today', 3); console.log(r); })"`
Expected: 3 search results with titles and URLs

- [ ] **Step 3: Commit**

```bash
git add server/tools/search-providers.js
git commit -m "feat: add Google, Brave, Perplexity search providers (Google default, no API key)"
```

---

## Task 5: Wire Google Search Into Executor and Builtins

**Files:**
- Modify: `server/tools/executor.js`
- Modify: `server/tools/builtins.js`
- Modify: `server/routes/agentChat.js`

- [ ] **Step 1: Update executor.js webSearch to use routeSearch**

In `server/tools/executor.js`, add import at top:
```js
import { routeSearch } from './search-providers.js';
```

Replace the entire `webSearch` function with:
```js
export async function webSearch({ query, count = 5 }, context = {}) {
  return routeSearch({ query, count }, context);
}
```

This replaces the old Brave-only implementation. The Brave code now lives in `search-providers.js`.

Also remove the now-dead `executeTool` switch statement function from `executor.js` (it was at the bottom of the file). After Task 3, nothing imports `executeTool` from `executor.js` anymore — everything goes through the registry. Keep the individual executor functions (`shellExec`, `fileRead`, etc.) since `builtins.js` imports them.

- [ ] **Step 2: Update agentChat.js context to include searchProvider**

In `server/routes/agentChat.js`, update the `getBraveApiKey` function and context building. Replace:
```js
function getBraveApiKey() {
  const cfg = readConfig();
  return cfg.tools?.web?.search?.apiKey || '';
}
```
with:
```js
function getSearchContext() {
  const cfg = readConfig();
  const searchCfg = cfg.tools?.web?.search || {};
  return {
    searchProvider: searchCfg.provider || 'google',
    braveApiKey: searchCfg.apiKey || '',
    perplexityApiKey: searchCfg.perplexity?.apiKey || '',
  };
}
```

And update the context line from:
```js
  const context = { braveApiKey: getBraveApiKey() };
```
to:
```js
  const context = getSearchContext();
```

- [ ] **Step 3: Verify dev server starts and search works**

Run: `npm run dev`
Expected: Server starts. Web search tool calls in chat now use Google by default.

- [ ] **Step 4: Commit**

```bash
git add server/tools/executor.js server/routes/agentChat.js
git commit -m "feat: wire Google search as default provider in executor and agent chat"
```

---

## Task 6: Update Validation Route

**Files:**
- Modify: `server/routes/validate.js`

- [ ] **Step 1: Update validate.js to not require Brave API key**

In `server/routes/validate.js`, replace the web search check block (lines 51-60):
```js
  // 4. Web search key (if search is enabled)
  const searchCfg = cfg.tools?.web?.search;
  if (searchCfg?.provider === 'brave') {
    if (searchCfg.apiKey) {
      checks.push({ name: 'Web search', passed: true, detail: 'Brave Search API key configured' });
    } else {
      checks.push({ name: 'Web search', passed: false, detail: 'Brave Search enabled but no API key set' });
      allPassed = false;
    }
  }
```
with:
```js
  // 4. Web search
  const searchCfg = cfg.tools?.web?.search;
  const searchProvider = searchCfg?.provider || 'google';
  if (searchProvider === 'google') {
    checks.push({ name: 'Web search', passed: true, detail: 'Google Search (no API key needed)' });
  } else if (searchProvider === 'brave') {
    if (searchCfg.apiKey) {
      checks.push({ name: 'Web search', passed: true, detail: 'Brave Search API key configured' });
    } else {
      checks.push({ name: 'Web search', passed: false, detail: 'Brave Search enabled but no API key set' });
      allPassed = false;
    }
  } else if (searchProvider === 'perplexity') {
    if (searchCfg.perplexity?.apiKey) {
      checks.push({ name: 'Web search', passed: true, detail: 'Perplexity Search configured' });
    } else {
      checks.push({ name: 'Web search', passed: false, detail: 'Perplexity enabled but no API key set' });
      allPassed = false;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/validate.js
git commit -m "fix: validation no longer requires Brave API key — Google search is default"
```

---

## Task 7: Update Capabilities Route (Server)

**Files:**
- Modify: `server/routes/capabilities.js`

- [ ] **Step 1: Update GET /api/capabilities to return search provider info**

In `server/routes/capabilities.js`, replace the `webSearch` section in the GET response (lines 32-37):
```js
    webSearch: {
      enabled:  !!webSearch.provider,
      provider: webSearch.provider || 'brave',
      braveApiKey:      webSearch.apiKey ? '***' : '',
      perplexityApiKey: webSearch.perplexity?.apiKey ? '***' : '',
    },
```
with:
```js
    webSearch: {
      enabled:  true,  // Always enabled — Google needs no key. Intentional: no "disable search" option.
      provider: webSearch.provider || 'google',
      braveApiKey:      webSearch.apiKey ? '***' : '',
      perplexityApiKey: webSearch.perplexity?.apiKey ? '***' : '',
    },
```

- [ ] **Step 2: Update POST /api/capabilities to handle google provider**

In the web search section of the POST handler (lines 101-121), replace:
```js
    if (webSearch) {
      if (!webSearch.enabled) {
        delete cfg.tools.web.search;
      } else if (webSearch.provider === 'brave') {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'brave',
          apiKey: webSearch.braveApiKey || '',
        };
      } else if (webSearch.provider === 'perplexity') {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'perplexity',
          perplexity: {
            apiKey:   webSearch.perplexityApiKey || '',
            baseUrl:  'https://openrouter.ai/api/v1',
            model:    'perplexity/sonar-pro',
          },
        };
      }
    }
```
with:
```js
    if (webSearch) {
      if (webSearch.provider === 'google' || !webSearch.provider) {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'google',
        };
      } else if (webSearch.provider === 'brave') {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'brave',
          apiKey: webSearch.braveApiKey || '',
        };
      } else if (webSearch.provider === 'perplexity') {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'perplexity',
          perplexity: {
            apiKey:   webSearch.perplexityApiKey || '',
            baseUrl:  'https://openrouter.ai/api/v1',
            model:    'perplexity/sonar-pro',
          },
        };
      }
    }
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/capabilities.js
git commit -m "feat: capabilities API defaults to Google search, Brave/Perplexity optional"
```

---

## Task 8: Update Capabilities UI (CapabilitiesStep)

**Files:**
- Modify: `client/src/components/wizard/CapabilitiesStep.jsx`

- [ ] **Step 1: Replace web search state and UI**

In `CapabilitiesStep.jsx`, replace the search-related state (lines 133-135):
```js
  // Web search (Brave only)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [braveKey, setBraveKey] = useState('');
```
with:
```js
  // Web search (Google default, Brave/Perplexity optional)
  const [searchProvider, setSearchProvider] = useState('google');
  const [braveKey, setBraveKey] = useState('');
  const [perplexityKey, setPerplexityKey] = useState('');
```

- [ ] **Step 2: Update the useEffect data loader**

Replace lines 164-167:
```js
        const currentSearch = d.webSearch?.enabled || false;
        setWebSearchEnabled(currentSearch || teamSpec.capabilities?.webSearch || false);
        setBraveKey(d.webSearch?.braveApiKey || '');
```
with:
```js
        setSearchProvider(d.webSearch?.provider || 'google');
        setBraveKey(d.webSearch?.braveApiKey || '');
        setPerplexityKey(d.webSearch?.perplexityApiKey || '');
```

- [ ] **Step 3: Update the handleSave payload**

Replace the webSearch portion of the save body (lines 218-222):
```js
          webSearch: {
            enabled: webSearchEnabled,
            provider: 'brave',
            braveApiKey: braveKey,
          },
```
with:
```js
          webSearch: {
            provider: searchProvider,
            braveApiKey: braveKey,
            perplexityApiKey: perplexityKey,
          },
```

- [ ] **Step 4: Replace the web search UI card**

Replace the Web Search CapabilityCard (lines 376-391):
```jsx
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
```
with:
```jsx
        {/* Web Search — provider picker */}
        <div className="border border-gray-800 bg-gray-800/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#x1F50D;</span>
            <span className="font-semibold text-sm text-white">Web Search</span>
          </div>
          <p className="text-xs text-gray-500 mb-4 ml-7">
            Search the web for real-time information. Google works out of the box — no setup needed.
          </p>

          <div className="ml-7 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'google',     label: 'Google',     desc: 'No API key needed', badge: 'default' },
                { id: 'brave',      label: 'Brave',      desc: 'Privacy-focused (needs API key)' },
                { id: 'perplexity', label: 'Perplexity', desc: 'AI-powered answers (needs API key)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSearchProvider(opt.id)}
                  className={`text-left p-3 rounded-lg border text-xs transition-colors ${
                    searchProvider === opt.id
                      ? 'border-shell-500 bg-shell-900/30 text-white'
                      : 'border-gray-700 bg-navy-900/30 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                    {opt.label}
                    {opt.badge && (
                      <span className="text-[10px] px-1 py-0.5 rounded leading-none bg-shell-900/50 text-shell-400 border border-shell-700">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-gray-500">{opt.desc}</div>
                </button>
              ))}
            </div>

            {searchProvider === 'brave' && (
              <div className="pt-2 border-t border-gray-700">
                <Field
                  label="Brave Search API Key"
                  value={braveKey}
                  onChange={setBraveKey}
                  placeholder="BSA..."
                  type="password"
                  hint={<><a href="https://api.search.brave.com" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Sign up at api.search.brave.com</a> &rarr; Create an app &rarr; copy the API key. Free tier: 2,000 queries/month.</>}
                />
              </div>
            )}

            {searchProvider === 'perplexity' && (
              <div className="pt-2 border-t border-gray-700">
                <Field
                  label="Perplexity API Key (via OpenRouter)"
                  value={perplexityKey}
                  onChange={setPerplexityKey}
                  placeholder="sk-or-..."
                  type="password"
                  hint={<><a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-shell-400 hover:text-shell-300 underline">Get an OpenRouter key</a> &rarr; API Keys &rarr; Create key. Perplexity/sonar-pro costs ~$3/1000 queries.</>}
                />
              </div>
            )}
          </div>
        </div>
```

- [ ] **Step 5: Verify the UI renders correctly**

Run: `npm run dev`
Navigate to the capabilities step. Verify:
- Google is selected by default
- Selecting Brave shows the API key field
- Selecting Perplexity shows its API key field

- [ ] **Step 6: Commit**

```bash
git add client/src/components/wizard/CapabilitiesStep.jsx
git commit -m "feat: capabilities UI — Google search default, Brave/Perplexity as optional providers"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Start dev server and verify everything works end-to-end**

Run: `npm run dev`

Verify:
1. Server starts without errors
2. `GET /api/capabilities` returns `provider: 'google'`
3. `POST /api/validate` passes without Brave API key
4. Chat works — agent can use `web_search` tool (routes to Google)
5. All existing tools (shell_exec, file_read, etc.) still work
6. Capabilities UI shows Google as default

- [ ] **Step 2: Commit any final fixes if needed**

---

## Next Plans

After this plan is complete, proceed with:
- **Plan 2:** Permissions system (trust-after-first-use)
- **Plan 3:** Mac-native tools (all 10 modules)
- **Plan 4:** CLI discovery + plugins + UI polish
