import { Router } from 'express';
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
  const configFlag = !!cfg.setupComplete;
  const agentCount = (cfg.agents?.list || []).length + (soulExists ? 1 : 0);
  res.json({
    setupComplete: soulExists || configFlag,
    agentCount,
  });
});

// ── OAuth (PKCE flow — no CLI or Node.js dependency) ────────────────────────

import {
  startOAuthFlow,
  exchangeCodeForTokens,
  getValidAccessToken,
  loadOAuthCredentials,
} from '../utils/anthropic-oauth.js';

/**
 * GET /api/oauth/status — Check if saved OAuth credentials exist.
 */
router.get('/oauth/status', async (_req, res) => {
  try {
    const token = await getValidAccessToken();
    res.json({ available: !!token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/oauth/start — Begin the OAuth PKCE flow.
 * Returns an authorization URL that should be opened in the user's browser.
 */
router.post('/oauth/start', async (_req, res) => {
  try {
    const { authUrl } = await startOAuthFlow();
    res.json({ authUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/oauth/exchange — Exchange the authorization code for tokens.
 * Body: { code: "authcode#state" }
 */
router.post('/oauth/exchange', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const credentials = await exchangeCodeForTokens(code);
    res.json({
      ok: true,
      token: credentials.accessToken,
      expiresAt: credentials.expiresAt,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/oauth/token — Get a valid access token (auto-refreshes if expired).
 */
router.get('/oauth/token', async (_req, res) => {
  try {
    const token = await getValidAccessToken();
    if (!token) return res.status(404).json({ error: 'No OAuth credentials. Please sign in first.' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const { bindings: newBindings, setupComplete } = req.body;
    const cfg = readConfig();

    backupConfig();

    // Mark setup as complete
    if (setupComplete) {
      cfg.setupComplete = true;
    }

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
