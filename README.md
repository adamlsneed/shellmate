<p align="center">
  <img src="electron/icons/icon.png" width="128" height="128" alt="Shellmate icon">
</p>

<h1 align="center">Shellmate</h1>

<p align="center">
  A personal AI helper for your Mac.<br>
  Just a short conversation and your helper is ready — no technical knowledge needed.
</p>

<p align="center">
  <a href="https://github.com/adamlsneed/shellmate/releases/latest"><strong>Download for macOS</strong></a>
</p>

---

## How it works

| Step | What happens |
|:----:|:-------------|
| 🐢 | **Sign in** — Connect with your Claude account or paste an access code. |
| 💬 | **Have a quick chat** — Shellmate asks a few friendly questions about you, your Mac, and what you'd like help with. |
| ✅ | **Start chatting** — Your helper is personalized and ready to go. |

Optionally, you can set up extra features like web search, terminal access, and smart home control.

After the one-time setup, Shellmate opens straight to chat on every launch.

## What your helper can do

- **Answer questions** — ask about anything and get clear, simple answers
- **Search the web** — look things up for you (requires free Brave Search key)
- **Read and write files** — organize, create, and edit documents on your Mac
- **Run Mac commands** — automate tasks, open apps, fix problems (optional, off by default)
- **Control smart home** — manage HomeKit / Home Assistant devices (optional)

All actions respect the permissions you choose. Shellmate always asks before doing anything risky.

## Built for everyone

Shellmate is designed to be usable by anyone — including people who have never used a terminal or configured software before. The setup wizard uses plain language, large text, and sensible defaults. A technically-savvy family member can pre-configure the access code so the user just opens the app and starts talking.

## Security

- **Code signed and notarized** by Apple — no Gatekeeper warnings
- **Auth tokens** protect the local API from cross-site attacks
- **Path restrictions** prevent access to sensitive files (~/.ssh, /etc, etc.)
- **Secret redaction** — API keys are never exposed in responses
- **Confirmation required** before any destructive action (deleting files, changing settings)

## Development

```bash
npm install
npm run dev              # starts at localhost:3847 with Vite hot-reload
npm run build            # builds client into dist/
npm start                # serves production build
npm run electron:dev     # launches the desktop app in dev mode
npm run electron:build   # builds DMG into release/
```

## License

MIT
