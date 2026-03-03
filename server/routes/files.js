import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { expandHome } from '../utils/paths.js';
import { readOpenClawConfig, backupTimestamp } from '../utils/config.js';

const router = Router();

function resolveAgentWorkspace(agentId, cfg) {
  const existing = (cfg.agents?.list || []).find(a => a.id === agentId);
  if (existing?.workspace) return existing.workspace;
  // Agent exists but has no explicit workspace — uses agents.defaults.workspace
  if (existing) return cfg.agents?.defaults?.workspace || '~/.openclaw/workspace';
  // New agent
  return `~/.openclaw/workspace-${agentId}`;
}

router.get('/check-paths', (req, res) => {
  const agents = (req.query.agents || '').split(',').filter(Boolean);
  const cfg = readOpenClawConfig();
  const conflicts = agents.map(agentId => {
    const ws = resolveAgentWorkspace(agentId, cfg);
    const p = expandHome(ws);
    return { agentId, path: p, exists: fs.existsSync(p) };
  });
  res.json({ conflicts });
});

router.post('/write', async (req, res) => {
  const { files, basePath, force = false } = req.body;
  const written = [], skipped = [], errors = [];

  for (const file of files) {
    try {
      let filePath = file.path;
      // Resolve relative to basePath or ~/.openclaw
      if (!path.isAbsolute(filePath)) {
        const base = basePath ? expandHome(basePath) : expandHome('~/.openclaw');
        filePath = path.join(base, filePath);
      } else {
        filePath = expandHome(filePath);
      }

      const dir = path.dirname(filePath);
      fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(filePath) && !force) {
        skipped.push(filePath);
        continue;
      }

      if (fs.existsSync(filePath) && force) {
        const ts = backupTimestamp();
        const bakPath = `${filePath}.bak-${ts}`;
        fs.copyFileSync(filePath, bakPath);
      }

      fs.writeFileSync(filePath, file.content, 'utf8');
      written.push(filePath);
    } catch (err) {
      errors.push({ path: file.path, error: err.message });
    }
  }

  res.json({ written, skipped, errors });
});

export default router;
