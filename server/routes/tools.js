// server/routes/tools.js
/**
 * API routes for tool management — permission grants, tool listing.
 */

import { Router } from 'express';
import { resolveConfirmation } from '../tools/permissions.js';
import { getToolsForAgent } from '../tools/registry.js';
import { rescanCLIs, getDiscoveredCLIs } from '../tools/discovery.js';
import { getLoadedPlugins } from '../tools/plugins.js';

const router = Router();

/**
 * POST /api/tools/grant — Resolve a pending permission confirmation.
 * Body: { confirmId: string, granted: boolean }
 */
router.post('/tools/grant', (req, res) => {
  const { confirmId, granted } = req.body;

  if (!confirmId || typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'Missing confirmId or granted boolean' });
  }

  const found = resolveConfirmation(confirmId, granted);
  if (!found) {
    return res.status(404).json({ error: 'Confirmation not found or already resolved' });
  }

  res.json({ ok: true });
});

/**
 * GET /api/tools/list — List all registered tools (for settings UI).
 */
router.get('/tools/list', (_req, res) => {
  const tools = getToolsForAgent({});
  res.json({
    count: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description })),
  });
});

/**
 * POST /api/tools/rescan — Force re-scan for CLI tools.
 */
router.post('/tools/rescan', async (_req, res) => {
  try {
    const clis = await rescanCLIs();
    res.json({ ok: true, count: clis.length, clis: clis.map(c => ({ name: c.cmd, path: c.path })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/tools/plugins — List loaded plugins.
 */
router.get('/tools/plugins', (_req, res) => {
  res.json({ plugins: getLoadedPlugins() });
});

export default router;
