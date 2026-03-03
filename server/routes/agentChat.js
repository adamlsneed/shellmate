import { Router } from 'express';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { expandHome } from '../utils/paths.js';
import { readConfig } from '../utils/config.js';
import { resolveApiKey } from '../utils/ai-clients.js';
import { initSse, sendSse } from '../utils/sse.js';
import { getToolsForAgent } from '../tools/definitions.js';
import { runAnthropicLoop, runOpenAILoop } from '../tools/loop.js';

const router = Router();

function resolveAgentWorkspace(agentId) {
  const cfg = readConfig();
  const existing = (cfg.agents?.list || []).find(a => a.id === agentId);
  if (existing?.workspace) return expandHome(existing.workspace);
  if (existing) return expandHome(cfg.agents?.defaults?.workspace || '~/.shellmate/workspace');
  return expandHome(`~/.shellmate/workspace-${agentId}`);
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

  return parts.join('\n\n');
}

function getAgentConfig(agentId) {
  const cfg = readConfig();
  return (cfg.agents?.list || []).find(a => a.id === agentId) || {};
}

function getBraveApiKey() {
  const cfg = readConfig();
  return cfg.tools?.web?.search?.apiKey || '';
}

// POST /api/agent-chat/:agentId — SSE streaming with tool execution
router.post('/agent-chat/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { messages, apiKey: clientApiKey, provider = 'anthropic', model } = req.body;

  const workspace = resolveAgentWorkspace(agentId);
  const system = buildSystemPrompt(agentId, workspace);

  const actualProvider = (provider === 'default' || provider === 'openclaw') ? 'anthropic' : provider;
  const apiKey = resolveApiKey(actualProvider, clientApiKey);
  if (!apiKey) return res.status(400).json({ error: 'No API key available' });

  const agentConfig = getAgentConfig(agentId);
  const tools = getToolsForAgent(agentConfig);
  const context = { braveApiKey: getBraveApiKey() };

  // Set up SSE
  initSse(res);

  const onEvent = (event) => {
    sendSse(res, event.type, event);
  };

  try {
    const loopFn = actualProvider === 'openai' ? runOpenAILoop : runAnthropicLoop;
    await loopFn({
      apiKey,
      model: model || (actualProvider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-6'),
      system,
      messages,
      tools,
      maxTokens: 4096,
      onEvent,
      context,
    });
    sendSse(res, 'done', {});
  } catch (err) {
    sendSse(res, 'error', { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
