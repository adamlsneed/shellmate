# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Shellmate — a self-contained Mac desktop app that is a personal AI helper. Uses a short, Mac-focused conversation to personalize the helper, then generates workspace files and configures everything automatically. After first-time wizard setup, subsequent launches go straight to chat with full tool capabilities (shell exec, file read/write, web search/fetch).

## Commands

```bash
npm run dev              # Dev server at localhost:3847 (Vite hot-reload)
npm run build            # Build client into dist/
npm start                # Serve production build
npm run preview          # Build + start
npm run electron:dev     # Launch desktop app in dev mode
npm run electron:build   # Build DMG into release/
```

No test framework is configured. No linter is configured.

## Architecture

**ESM throughout** — `"type": "module"` in package.json. Use `import`/`export` everywhere. Use `fileURLToPath(import.meta.url)` for `__dirname` equivalents.

### Server (Node.js + Express)

- **Entry:** `server/dev.js` / `server/start.js` → `server/index.js` (creates Express app)
- **Routes:** `server/routes/*.js` — mounted under `/api`
- **Tools:** `server/tools/` — built-in tool execution engine
  - `definitions.js` — tool schemas, deny map, provider format converters
  - `executor.js` — server-side tool functions (shell, file, web)
  - `loop.js` — agentic tool-use loop for Anthropic/OpenAI (max 15 rounds)
- **Generators:** `server/generators/*.js` — pure functions: `generator(agent, teamSpec) → string`. Never invent content not in the spec.
- **Utils:** `server/utils/` — `ai-clients.js` (Anthropic/OpenAI calls), `config.js` (read/write shellmate.json with backups), `paths.js`, `sse.js`
- Dev mode: Vite middleware serves client with HMR. Production: serves static `dist/`.

### Client (React 18 + Vite 5)

- **Entry:** `client/src/main.jsx` → `App.jsx` → checks `/api/setup-status`
  - If setup complete → `ChatApp` (full-screen chat)
  - If not → `PreflightCheck` → `WizardShell`
- **State:** Zustand stores in `client/src/store/` — `teamSpec.js` (wizard state + single-agent spec) and `aiConfig.js` (provider/key/model)
- **Styling:** TailwindCSS v3 with custom `shell` color palette
- **Phase flow** (in `useWizard.js`): CHAT(0) → REVIEW(1) → GENERATE(2) → CAPABILITIES(3) → DONE(4)

### Key Conventions

- **Self-contained:** No external binary dependencies. Tool execution is built-in.
- **Single agent:** Shellmate always configures the main agent at `~/.shellmate/workspace`. No multi-agent support.
- **Spec shape:** `teamSpec.agent` is a singular object (not an array): `{ id: 'main', name, personality, mission, mac_apps, use_cases, failure, escalation, never }`
- **Config:** `~/.shellmate/shellmate.json` — NEVER touch `agents.defaults`, `auth`, `models`, or `channels`. Backup on every write.
- **Tool execution:** Agent chat uses SSE streaming with tool-use loop. Tools: `shell_exec`, `file_read`, `file_write`, `file_list`, `web_search`, `web_fetch`.
- **Per-agent tool deny:** `agents.list[].tools.deny` — values: `exec`, `browser`, `write`, `read`, `web`.
- **AI clients:** `server/utils/ai-clients.js` — `detectProvider()`, `resolveApiKey()` (client key takes precedence over env var), `callAnthropic()`, `callOpenAI()`.
- **SSE pattern:** `server/utils/sse.js` — `initSse(res)` + `sendSse(res, type, data)` for streaming tool execution and events.
- **Legacy migration:** Detects `~/.openclaw/` and migrates to `~/.shellmate/` on first launch.

## Versioning

Stay below `1.0.0` until the product generates revenue. Current: `0.0.16`.

## Release

Bump `package.json` version → commit → `git tag vX.X.X && git push --tags`. CI (`.github/workflows/publish.yml`) builds macOS DMG installer (uploaded to GitHub Releases) on `v*` tags.
