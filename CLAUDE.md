# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Shellmate — a Mac desktop app that sets up a personal AI helper. Bundles OpenClaw inside the DMG so the user never sees OpenClaw branding. Uses a short, Mac-focused conversation to personalize the helper, then generates workspace files and configures everything automatically.

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
- **Generators:** `server/generators/*.js` — pure functions: `generator(agent, teamSpec) → string`. Never invent content not in the spec.
- **Utils:** `server/utils/` — `ai-clients.js` (Anthropic/OpenAI calls), `config.js` (read/write openclaw.json with backups), `openclaw-binary.js` (resolve embedded binary), `paths.js`, `sse.js`
- Dev mode: Vite middleware serves client with HMR. Production: serves static `dist/`.

### Client (React 18 + Vite 5)

- **Entry:** `client/src/main.jsx` → `App.jsx` → `PreflightCheck` → `WizardShell`
- **State:** Zustand stores in `client/src/store/` — `teamSpec.js` (wizard state + single-agent spec) and `aiConfig.js` (provider/key/model)
- **Styling:** TailwindCSS v3 with custom `shell` color palette
- **Phase flow** (in `useWizard.js`): CHAT(0) → REVIEW(1) → GENERATE(2) → CAPABILITIES(3) → DONE(4)

### Key Conventions

- **Single agent:** Shellmate always configures the main agent at `~/.openclaw/workspace`. No multi-agent support.
- **Spec shape:** `teamSpec.agent` is a singular object (not an array): `{ id: 'main', name, personality, mission, mac_apps, use_cases, failure, escalation, never }`
- **Config merging:** NEVER touch `agents.defaults`, `auth`, `models`, or `channels` in openclaw.json. Backup on every write.
- **OpenClaw binary:** Resolved via `server/utils/openclaw-binary.js` — checks packaged extraResources first, then dev resources/, then system PATH.
- **AI clients:** `server/utils/ai-clients.js` — `detectProvider()`, `resolveApiKey()` (client key takes precedence over env var), `callAnthropic()`, `callOpenAI()`.
- **SSE pattern:** `server/utils/sse.js` — `initSse(res)` + `sendSse(res, type, data)` for streaming long operations.

## Versioning

Stay below `1.0.0` until the product generates revenue. Current: `0.0.1`.

## Release

Bump `package.json` version → commit → `git tag vX.X.X && git push --tags`. CI (`.github/workflows/publish.yml`) builds macOS DMG installer (uploaded to GitHub Releases) on `v*` tags.
