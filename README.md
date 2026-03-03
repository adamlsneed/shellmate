<p align="center">
  <img src="electron/icons/icon.png" width="128" height="128" alt="Shellmate icon">
</p>

<h1 align="center">Shellmate</h1>

<p align="center">
  Set up a personal AI helper for your Mac.<br>
  No terminal, no config files — just a short conversation and your helper is ready.
</p>

<p align="center">
  <a href="https://github.com/adamlsneed/shellmate/releases/latest"><strong>Download for macOS</strong></a>
</p>

---

> **Note:** The app is not yet code-signed.
>
> After dragging the app to Applications, open Terminal and run:
> ```bash
> xattr -cr "/Applications/Shellmate.app"
> ```
> Then open it normally. Without this, macOS will say the app is "damaged" because it has no code signature.

## How it works

| Step | What happens |
|:----:|:-------------|
| 🐢 | **Connect an AI** — Use your Anthropic or OpenAI API key (or OAuth token). Step-by-step instructions walk you through getting one. |
| 💬 | **Have a conversation** — The AI asks plain-English questions about what your helper should do, which Mac apps you use, and what you'd like to automate. |
| 📋 | **Review** — See exactly what was captured before anything is written. |
| ⚙️ | **Generate** — Creates workspace files that define your helper's personality, rules, and capabilities. |
| 🔒 | **Set permissions** — Choose what your helper can do on its own vs. what it should always ask first. |
| ✅ | **Done** — Your helper is validated and ready. Chat with it to test, then start the gateway to go live. |

## What gets generated

In `~/.openclaw/workspace/`:

| File | Purpose |
|------|---------|
| `SOUL.md` | Identity, mission, and hard rules |
| `AGENTS.md` | Session startup checklist and operating rules |
| `IDENTITY.md` | Name, role, personality |
| `USER.md` | Profile of the human and their Mac setup |
| `TOOLS.md` | Mac environment notes |
| `BOOTSTRAP.md` | First-run startup ritual |
| `MEMORY.md` | Long-term memory template |
| `memory/README.md` | Memory directory conventions |
| `skills/README.md` | Recommended skills with install commands |

## Development

```bash
npm install
npm run dev              # starts at localhost:3847 with Vite hot-reload
npm run build            # builds client into dist/
npm start                # serves production build
npm run electron:dev     # launches the desktop app in dev mode
npm run electron:build   # builds DMG into release/
```
