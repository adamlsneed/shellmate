import { Router } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_PATH, CONFIG_DIR, detectLegacyConfig, migrateLegacyConfig } from '../utils/config.js';

const router = Router();

// GET /api/preflight — check if Shellmate is ready to run
router.get('/preflight', (_req, res) => {
  const hasConfig = fs.existsSync(CONFIG_PATH);
  const hasLegacy = detectLegacyConfig();

  if (hasConfig) {
    return res.json({ ready: true, needsMigration: false, hasLegacy: false });
  }

  if (hasLegacy) {
    return res.json({ ready: false, needsMigration: true, hasLegacy: true });
  }

  // Nothing exists — create empty config dir so the app can proceed
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  return res.json({ ready: true, needsMigration: false, hasLegacy: false });
});

// POST /api/preflight/migrate — migrate legacy ~/.openclaw/ config
router.post('/preflight/migrate', (_req, res) => {
  try {
    migrateLegacyConfig();
    res.json({ ok: true, message: 'Migration complete' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
