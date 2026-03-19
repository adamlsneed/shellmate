import { Router } from 'express';
import { readConfig, writeConfig, backupConfig } from '../utils/config.js';

const router = Router();

// GET /api/capabilities — return current capabilities state from shellmate.json
router.get('/capabilities', (_req, res) => {
  const cfg = readConfig();

  const memoryPlugin = cfg.plugins?.slots?.memory || null;
  const lancedb = cfg.plugins?.entries?.['memory-lancedb'] || {};
  const memoryCore = cfg.plugins?.entries?.['memory-core'] || {};

  const webSearch = cfg.tools?.web?.search || {};
  const webFetch = cfg.tools?.web?.fetch || {};
  const browser = cfg.browser || {};
  const haSkill = cfg.skills?.entries?.homeassistant || {};
  const goPlaces = cfg.skills?.entries?.goplaces || {};

  res.json({
    memory: {
      mode: memoryPlugin === 'memory-lancedb' ? 'lancedb'
           : memoryPlugin === 'memory-core'   ? 'core'
           : 'none',
      lancedb: {
        autoRecall:  lancedb.config?.autoRecall  ?? true,
        autoCapture: lancedb.config?.autoCapture ?? false,
        embeddingApiKey: lancedb.config?.embedding?.apiKey ? '***' : '',
        embeddingModel:  lancedb.config?.embedding?.model  || 'text-embedding-3-small',
      },
    },
    webSearch: {
      enabled:  true,  // Always enabled — DuckDuckGo needs no key
      provider: webSearch.provider || 'duckduckgo',
      braveApiKey:      webSearch.apiKey ? '***' : '',
      perplexityApiKey: webSearch.perplexity?.apiKey ? '***' : '',
    },
    webFetch: {
      enabled: webFetch.enabled !== false && !!cfg.browser?.enabled,
    },
    homeAssistant: {
      enabled: !!haSkill.env?.HA_TOKEN,
      token: haSkill.env?.HA_TOKEN ? '***' : '',
      url:   haSkill.env?.HA_URL   || 'http://homeassistant.local:8123',
    },
    googlePlaces: {
      enabled: !!goPlaces.apiKey,
      apiKey: goPlaces.apiKey ? '***' : '',
    },
  });
});

// POST /api/capabilities — write capabilities to shellmate.json
router.post('/capabilities', (req, res) => {
  try {
    const { memory, webSearch, webFetch, homeAssistant, googlePlaces } = req.body;
    const cfg = readConfig();

    // Backup
    backupConfig();

    // ── Memory ──────────────────────────────────────────────────────────────
    if (memory) {
      if (!cfg.plugins) cfg.plugins = {};
      if (!cfg.plugins.entries) cfg.plugins.entries = {};

      if (memory.mode === 'lancedb') {
        cfg.plugins.slots = { ...(cfg.plugins.slots || {}), memory: 'memory-lancedb' };
        cfg.plugins.entries['memory-lancedb'] = {
          enabled: true,
          config: {
            autoRecall:  memory.lancedb?.autoRecall  ?? true,
            autoCapture: memory.lancedb?.autoCapture ?? false,
            embedding: {
              apiKey: memory.lancedb?.embeddingApiKey || '',
              model:  memory.lancedb?.embeddingModel  || 'text-embedding-3-small',
            },
          },
        };
        if (cfg.plugins.entries['memory-core']) {
          cfg.plugins.entries['memory-core'].enabled = false;
        }
      } else if (memory.mode === 'core') {
        cfg.plugins.slots = { ...(cfg.plugins.slots || {}), memory: 'memory-core' };
        cfg.plugins.entries['memory-core'] = { enabled: true };
        if (cfg.plugins.entries['memory-lancedb']) {
          cfg.plugins.entries['memory-lancedb'].enabled = false;
        }
      } else {
        // none — disable all memory plugins
        delete cfg.plugins?.slots?.memory;
        if (cfg.plugins.entries['memory-lancedb']) cfg.plugins.entries['memory-lancedb'].enabled = false;
        if (cfg.plugins.entries['memory-core'])    cfg.plugins.entries['memory-core'].enabled    = false;
      }
    }

    // ── Web Search ──────────────────────────────────────────────────────────
    if (!cfg.tools) cfg.tools = {};
    if (!cfg.tools.web) cfg.tools.web = {};

    if (webSearch) {
      if (webSearch.provider === 'duckduckgo' || webSearch.provider === 'google' || !webSearch.provider) {
        cfg.tools.web.search = {
          ...(cfg.tools.web.search || {}),
          provider: 'duckduckgo',
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

    // ── Web Fetch / Browser ─────────────────────────────────────────────────
    if (webFetch !== undefined) {
      cfg.tools.web.fetch = { enabled: !!webFetch?.enabled };
      cfg.browser = { enabled: !!webFetch?.enabled, headless: true };
    }

    // ── Home Assistant ──────────────────────────────────────────────────────
    if (homeAssistant) {
      if (!cfg.skills) cfg.skills = {};
      if (!cfg.skills.entries) cfg.skills.entries = {};
      if (!homeAssistant.enabled) {
        delete cfg.skills.entries.homeassistant;
      } else {
        cfg.skills.entries.homeassistant = {
          env: {
            HA_TOKEN: homeAssistant.token || '',
            HA_URL:   homeAssistant.url   || 'http://homeassistant.local:8123',
          },
        };
      }
    }

    // ── Google Places ───────────────────────────────────────────────────────
    if (googlePlaces) {
      if (!cfg.skills) cfg.skills = {};
      if (!cfg.skills.entries) cfg.skills.entries = {};
      if (!googlePlaces.enabled) {
        delete cfg.skills.entries.goplaces;
      } else {
        cfg.skills.entries.goplaces = { apiKey: googlePlaces.apiKey || '' };
      }
    }

    // ── Per-agent tool deny ─────────────────────────────────────────────────
    const { agentToolDeny } = req.body;
    if (agentToolDeny && typeof agentToolDeny === 'object') {
      if (!cfg.agents) cfg.agents = {};
      if (!cfg.agents.list) cfg.agents.list = [];
      for (const [agentId, denied] of Object.entries(agentToolDeny)) {
        if (!Array.isArray(denied) || denied.length === 0) continue;
        const idx = cfg.agents.list.findIndex(a => a.id === agentId);
        if (idx >= 0) {
          cfg.agents.list[idx].tools = {
            ...(cfg.agents.list[idx].tools || {}),
            deny: denied,
          };
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
