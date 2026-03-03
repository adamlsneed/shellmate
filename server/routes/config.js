import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { expandHome } from '../utils/paths.js';
import { CONFIG_PATH, readConfig, writeConfig, backupConfig } from '../utils/config.js';

const router = Router();

router.get('/config', (_req, res) => {
  res.json(readConfig());
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
