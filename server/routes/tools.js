// server/routes/tools.js
/**
 * API routes for tool management — permission grants, tool listing.
 */

import { Router } from 'express';
import { resolveConfirmation } from '../tools/permissions.js';

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

export default router;
