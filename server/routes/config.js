import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { expandHome } from '../utils/paths.js';
import { CONFIG_PATH, readOpenClawConfig, writeOpenClawConfig, backupConfig } from '../utils/config.js';

const router = Router();

router.get('/openclaw-config', (_req, res) => {
  res.json(readOpenClawConfig());
});

// GET /api/install-context — detect whether this is a fresh install
router.get('/install-context', (_req, res) => {
  const cfg = readOpenClawConfig();
  const defaultWsRaw = cfg.agents?.defaults?.workspace || '~/.openclaw/workspace';
  const defaultWs = expandHome(defaultWsRaw);
  const soulExists = fs.existsSync(path.join(defaultWs, 'SOUL.md'));
  res.json({
    isFreshInstall: !soulExists,
    defaultWorkspace: defaultWsRaw,
  });
});

// Shellmate always uses the main agent (agents.defaults.workspace).
// This simplified PATCH just handles bindings.
router.patch('/openclaw-config', (req, res) => {
  try {
    const { bindings: newBindings } = req.body;
    const cfg = readOpenClawConfig();

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

    writeOpenClawConfig(cfg);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
