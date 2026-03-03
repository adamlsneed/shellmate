import { Router } from 'express';
import { spawn } from 'child_process';
import { getOpenclawBinary } from '../utils/openclaw-binary.js';

const router = Router();

router.post('/validate', (_req, res) => {
  const bin = getOpenclawBinary();
  const proc = spawn(bin, ['doctor'], { shell: true });
  let output = '';

  proc.stdout.on('data', d => { output += d.toString(); });
  proc.stderr.on('data', d => { output += d.toString(); });

  proc.on('error', err => {
    res.json({ exitCode: 1, output: err.message, passed: false });
  });

  proc.on('close', code => {
    res.json({ exitCode: code, output, passed: code === 0 });
  });
});

export default router;
