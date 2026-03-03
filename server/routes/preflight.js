import { Router } from 'express';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { getOpenclawBinary } from '../utils/openclaw-binary.js';

const router = Router();

// Check if the openclaw binary is available
router.get('/preflight', (_req, res) => {
  const bin = getOpenclawBinary();

  // Try running --version with the resolved binary
  try {
    const version = execSync(`"${bin}" --version`, { timeout: 5000, shell: true })
      .toString()
      .trim();
    return res.json({ installed: true, version });
  } catch {}

  // Fallback: if ~/.openclaw/openclaw.json exists, assume it's usable
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  if (existsSync(configPath)) {
    return res.json({ installed: true, version: '(version unknown)' });
  }

  res.json({ installed: false, version: null });
});

export default router;
