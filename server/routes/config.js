import { Router } from 'express';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { expandHome } from '../utils/paths.js';
import { CONFIG_PATH, readConfig, writeConfig, backupConfig } from '../utils/config.js';

const router = Router();

router.get('/config', (_req, res) => {
  const cfg = readConfig();
  // Redact sensitive fields before sending to client
  const safe = JSON.parse(JSON.stringify(cfg));
  if (safe.tools?.web?.search?.apiKey) safe.tools.web.search.apiKey = '***';
  if (safe.tools?.web?.search?.perplexity?.apiKey) safe.tools.web.search.perplexity.apiKey = '***';
  if (safe.plugins?.entries?.['memory-lancedb']?.config?.embedding?.apiKey)
    safe.plugins.entries['memory-lancedb'].config.embedding.apiKey = '***';
  if (safe.skills?.entries?.homeassistant?.env?.HA_TOKEN)
    safe.skills.entries.homeassistant.env.HA_TOKEN = '***';
  if (safe.skills?.entries?.goplaces?.apiKey)
    safe.skills.entries.goplaces.apiKey = '***';
  res.json(safe);
});

// GET /api/install-context — detect whether this is a fresh install
router.get('/install-context', (_req, res) => {
  const cfg = readConfig();
  const defaultWsRaw = cfg.agents?.defaults?.workspace || '~/.shellmate/workspace';
  const defaultWs = expandHome(defaultWsRaw);
  const soulExists = fs.existsSync(path.join(defaultWs, 'SOUL.md'));
  res.json({
    isFreshInstall: !soulExists,
    defaultWorkspace: defaultWsRaw,
  });
});

// GET /api/setup-status — check if wizard has been completed
router.get('/setup-status', (_req, res) => {
  const cfg = readConfig();
  const defaultWsRaw = cfg.agents?.defaults?.workspace || '~/.shellmate/workspace';
  const defaultWs = expandHome(defaultWsRaw);
  const soulExists = fs.existsSync(path.join(defaultWs, 'SOUL.md'));
  const agentCount = (cfg.agents?.list || []).length + (soulExists ? 1 : 0);
  res.json({
    setupComplete: soulExists,
    agentCount,
  });
});

// ── OAuth automation ─────────────────────────────────────────────────────────

/**
 * GET /api/oauth/status — Check if Claude Code OAuth credentials exist in macOS Keychain.
 * Returns { available, needsLogin, needsInstall }
 */
router.get('/oauth/status', async (_req, res) => {
  try {
    // Try to read Claude Code credentials from macOS Keychain
    const token = await getKeychainOAuthToken();
    if (token) {
      return res.json({ available: true, needsLogin: false, needsInstall: false });
    }

    // No token — check if claude CLI is installed
    const claudePath = await whichCommand('claude');
    if (claudePath) {
      return res.json({ available: false, needsLogin: true, needsInstall: false });
    }

    // No token, no CLI — check if npx is available (comes with Node.js)
    const npxPath = await whichCommand('npx');
    if (npxPath) {
      return res.json({ available: false, needsLogin: true, needsInstall: true, hasNpx: true });
    }

    // No npx either — user needs to install Node.js first
    return res.json({ available: false, needsLogin: true, needsInstall: true, hasNpx: false, needsNode: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/oauth/connect — Get OAuth token from Keychain, or initiate login flow.
 * If credentials exist in Keychain, returns the token immediately.
 * If not, starts `claude auth login` (opens browser) and polls for completion.
 */
router.post('/oauth/connect', async (_req, res) => {
  try {
    // First, try to get existing token from Keychain
    let token = await getKeychainOAuthToken();
    if (token) {
      return res.json({ ok: true, token });
    }

    // No existing token — we need to run claude auth login
    const claudePath = await whichCommand('claude') || await whichCommand('npx');
    if (!claudePath) {
      return res.status(400).json({ error: 'Claude Code CLI not found. Please install it first: npm install -g @anthropic-ai/claude-code' });
    }

    // Start the login flow (opens browser)
    const loginCmd = claudePath.endsWith('npx')
      ? 'npx --yes @anthropic-ai/claude-code auth login --claudeai'
      : 'claude auth login --claudeai';

    exec(loginCmd, { timeout: 120000 }, () => {});

    // Poll Keychain for token (user is signing in via browser)
    const maxWait = 120000; // 2 minutes
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      token = await getKeychainOAuthToken();
      if (token) {
        return res.json({ ok: true, token });
      }
    }

    return res.status(408).json({ error: 'Sign-in timed out. Please try again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Read OAuth access token from macOS Keychain (Claude Code credential store).
 * Returns the token string or null if not found.
 */
function getKeychainOAuthToken() {
  return new Promise((resolve) => {
    exec('security find-generic-password -s "Claude Code-credentials" -w', { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(null);
      try {
        const creds = JSON.parse(stdout.trim());
        const token = creds?.claudeAiOauth?.accessToken;
        resolve(token && token.startsWith('sk-ant-') ? token : null);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Check if a command exists on the system.
 */
function whichCommand(cmd) {
  return new Promise((resolve) => {
    exec(`which ${cmd}`, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

// GET /api/ai-config — return saved AI configuration (provider, key, model)
router.get('/ai-config', (_req, res) => {
  const cfg = readConfig();
  const ai = cfg.ai || {};
  res.json({
    provider: ai.provider || 'default',
    apiKey: ai.apiKey || '',
    model: ai.model || '',
    configured: !!ai.configured,
    envKey: !!ai.envKey,
  });
});

// POST /api/ai-config — persist AI configuration to shellmate.json
router.post('/ai-config', (req, res) => {
  try {
    const { provider, apiKey, model, envKey } = req.body;
    const cfg = readConfig();
    backupConfig();
    cfg.ai = {
      provider: provider || 'default',
      apiKey: apiKey || '',
      model: model || '',
      configured: true,
      envKey: !!envKey,
    };
    writeConfig(cfg);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Shellmate always uses the main agent (agents.defaults.workspace).
// This simplified PATCH just handles bindings.
router.patch('/config', (req, res) => {
  try {
    const { bindings: newBindings } = req.body;
    const cfg = readConfig();

    backupConfig();

    // Merge bindings (top-level) — prepend new, deduplicate
    if (!cfg.bindings) cfg.bindings = [];
    if (newBindings) {
      for (const nb of newBindings) {
        const key = nb.agentId + JSON.stringify(nb.match);
        const exists = cfg.bindings.some(b => b.agentId + JSON.stringify(b.match) === key);
        if (!exists) {
          cfg.bindings.unshift(nb);
        }
      }
    }

    writeConfig(cfg);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
