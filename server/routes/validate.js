import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { CONFIG_PATH, readConfig } from '../utils/config.js';
import { expandHome } from '../utils/paths.js';
import { resolveApiKey } from '../utils/ai-clients.js';

const router = Router();

router.post('/validate', (_req, res) => {
  const checks = [];
  let allPassed = true;

  // 1. Config file exists and is valid JSON
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      checks.push({ name: 'Config file', passed: true, detail: 'shellmate.json exists and is valid JSON' });
    } else {
      checks.push({ name: 'Config file', passed: false, detail: 'shellmate.json not found' });
      allPassed = false;
    }
  } catch {
    checks.push({ name: 'Config file', passed: false, detail: 'shellmate.json contains invalid JSON' });
    allPassed = false;
  }

  // 2. Workspace directory exists with SOUL.md
  const cfg = readConfig();
  const wsRaw = cfg.agents?.defaults?.workspace || '~/.shellmate/workspace';
  const ws = expandHome(wsRaw);
  const soulPath = path.join(ws, 'SOUL.md');
  if (fs.existsSync(soulPath)) {
    checks.push({ name: 'Workspace', passed: true, detail: `SOUL.md found in ${wsRaw}` });
  } else {
    checks.push({ name: 'Workspace', passed: false, detail: `SOUL.md not found in ${wsRaw}` });
    allPassed = false;
  }

  // 3. API key available
  const anthropicKey = resolveApiKey('anthropic', null);
  const openaiKey = resolveApiKey('openai', null);
  if (anthropicKey || openaiKey) {
    const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
    checks.push({ name: 'API key', passed: true, detail: `${provider} API key available` });
  } else {
    checks.push({ name: 'API key', passed: false, detail: 'No API key found (set ANTHROPIC_API_KEY or OPENAI_API_KEY)' });
    allPassed = false;
  }

  // 4. Web search
  const searchCfg = cfg.tools?.web?.search;
  const searchProvider = searchCfg?.provider || 'duckduckgo';
  if (searchProvider === 'duckduckgo' || searchProvider === 'google') {
    checks.push({ name: 'Web search', passed: true, detail: 'Web search enabled (no API key needed)' });
  } else if (searchProvider === 'brave') {
    if (searchCfg.apiKey) {
      checks.push({ name: 'Web search', passed: true, detail: 'Brave Search API key configured' });
    } else {
      checks.push({ name: 'Web search', passed: false, detail: 'Brave Search enabled but no API key set' });
      allPassed = false;
    }
  } else if (searchProvider === 'perplexity') {
    if (searchCfg.perplexity?.apiKey) {
      checks.push({ name: 'Web search', passed: true, detail: 'Perplexity Search configured' });
    } else {
      checks.push({ name: 'Web search', passed: false, detail: 'Perplexity enabled but no API key set' });
      allPassed = false;
    }
  }

  // Format output like a doctor report
  const output = checks.map(c =>
    `${c.passed ? 'PASS' : 'FAIL'} ${c.name}: ${c.detail}`
  ).join('\n');

  res.json({
    exitCode: allPassed ? 0 : 1,
    output,
    passed: allPassed,
    checks,
  });
});

export default router;
