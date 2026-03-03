import { Router } from 'express';
import { generateFiles } from '../generators/index.js';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { teamSpec } = req.body;
    if (!teamSpec) return res.status(400).json({ error: 'teamSpec required' });
    const files = generateFiles(teamSpec);
    res.json({ files, errors: [] });
  } catch (err) {
    res.status(500).json({ error: err.message, files: [], errors: [err.message] });
  }
});

export default router;
