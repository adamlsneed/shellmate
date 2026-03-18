import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { expandHome } from '../utils/paths.js';
import { backupTimestamp } from '../utils/config.js';
import { resolveAgentWorkspace } from '../utils/workspace.js';

const router = Router();

router.get('/check-paths', (req, res) => {
  const agents = (req.query.agents || '').split(',').filter(Boolean);
  const conflicts = agents.map(agentId => {
    const p = resolveAgentWorkspace(agentId);
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
      // Resolve relative to basePath or ~/.shellmate
      if (!path.isAbsolute(filePath)) {
        const base = basePath ? expandHome(basePath) : expandHome('~/.shellmate');
        filePath = path.join(base, filePath);
      } else {
        filePath = expandHome(filePath);
      }

      // Security: ensure path resolves within ~/.shellmate/
      const resolved = path.resolve(filePath);
      const shellmateDir = path.join(os.homedir(), '.shellmate');
      if (!resolved.startsWith(shellmateDir + path.sep) && resolved !== shellmateDir) {
        errors.push({ path: file.path, error: 'Path must be within ~/.shellmate/' });
        continue;
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
