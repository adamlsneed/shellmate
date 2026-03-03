import { Router } from 'express';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { expandHome } from '../utils/paths.js';
import { readOpenClawConfig } from '../utils/config.js';
import { callAnthropic, callOpenAI, resolveApiKey } from '../utils/ai-clients.js';
import { initSse, sendSse } from '../utils/sse.js';
import { getOpenclawBinary } from '../utils/openclaw-binary.js';

const router = Router();

function resolveAgentWorkspace(agentId) {
  const cfg = readOpenClawConfig();
  const existing = (cfg.agents?.list || []).find(a => a.id === agentId);
  if (existing?.workspace) return expandHome(existing.workspace);
  if (existing) return expandHome(cfg.agents?.defaults?.workspace || '~/.openclaw/workspace');
  return expandHome(`~/.openclaw/workspace-${agentId}`);
}

function readWsFile(workspace, filename) {
  const p = path.join(workspace, filename);
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : null;
}

function buildSystemPrompt(agentId, workspace) {
  const soul     = readWsFile(workspace, 'SOUL.md');
  const agents   = readWsFile(workspace, 'AGENTS.md');
  const user     = readWsFile(workspace, 'USER.md');
  const identity = readWsFile(workspace, 'IDENTITY.md');
  const tools    = readWsFile(workspace, 'TOOLS.md');
  const memory   = readWsFile(workspace, 'MEMORY.md');

  const parts = [];
  if (soul)     parts.push(soul);
  if (identity) parts.push(`---\n${identity}`);
  if (agents)   parts.push(`---\n${agents}`);
  if (user)     parts.push(`---\n${user}`);
  if (tools)    parts.push(`---\n${tools}`);
  if (memory)   parts.push(`---\n## Long-term memory\n${memory}`);

  parts.push(`---
## Preview mode
You are running in builder preview mode. You do not have access to external tools (web, files, shell) in this preview — respond based on your personality and knowledge only. Mention this briefly if asked about tools or actions. When the OpenClaw gateway is running, you will have full capabilities.`);

  return parts.join('\n\n');
}

// POST /api/agent-chat/:agentId
router.post('/agent-chat/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { messages, apiKey: clientApiKey, provider = 'anthropic', model } = req.body;

  const workspace = resolveAgentWorkspace(agentId);
  const system = buildSystemPrompt(agentId, workspace);

  const actualProvider = provider === 'openclaw' ? 'anthropic' : provider;
  const apiKey = resolveApiKey(actualProvider, clientApiKey);
  if (!apiKey) return res.status(400).json({ error: 'No API key available' });

  try {
    let content;
    if (actualProvider === 'openai') {
      content = await callOpenAI({ apiKey, model: model || 'gpt-4o', messages, system });
    } else {
      content = await callAnthropic({ apiKey, model: model || 'claude-sonnet-4-6', messages, system });
    }
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gateway/restart — restart the OpenClaw gateway via SSE stream
router.post('/gateway/restart', (req, res) => {
  initSse(res);

  const bin = getOpenclawBinary();

  // Kill any existing gateway process then start a fresh one in the background.
  // Running via sh -c '...' so the shell exits immediately after forking openclaw.
  sendSse(res, 'log', 'Starting OpenClaw gateway...\n');

  const proc = spawn('sh', ['-c', `pkill -f "openclaw gateway" 2>/dev/null; sleep 0.5; "${bin}" gateway &`], {
    shell: false,
  });

  proc.stdout.on('data', d => sendSse(res, 'log', d.toString()));
  proc.stderr.on('data', d => sendSse(res, 'log', d.toString()));

  proc.on('error', (err) => {
    sendSse(res, 'error', err.message);
    res.end();
  });

  proc.on('close', code => {
    if (code === 0) {
      sendSse(res, 'done', 'Gateway started — your agent will be live in a few seconds');
    } else {
      sendSse(res, 'error', `Could not start automatically (exit ${code}). Run this in your terminal: openclaw gateway`);
    }
    res.end();
  });
});

export default router;
