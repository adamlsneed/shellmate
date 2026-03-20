import { Router } from 'express';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { readConfig } from '../utils/config.js';
import { normalizeProvider, resolveApiKey } from '../utils/ai-clients.js';
import { resolveAgentWorkspace } from '../utils/workspace.js';
import { initSse, sendSse } from '../utils/sse.js';
import { getToolsForAgent } from '../tools/registry.js';
import { runAnthropicLoop, runOpenAILoop } from '../tools/loop.js';
import { getValidAccessToken } from '../utils/anthropic-oauth.js';

const router = Router();

function readWsFile(workspace, filename) {
  const p = path.join(workspace, filename);
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : null;
}

function buildSystemPrompt(workspace) {
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

function getSearchContext() {
  const cfg = readConfig();
  const searchCfg = cfg.tools?.web?.search || {};
  return {
    searchProvider: searchCfg.provider || 'duckduckgo',
    braveApiKey: searchCfg.apiKey || '',
    perplexityApiKey: searchCfg.perplexity?.apiKey || '',
  };
}

// POST /api/agent-chat/:agentId — SSE streaming with tool execution
router.post('/agent-chat/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { messages, apiKey: clientApiKey, provider = 'anthropic', model } = req.body;

  const workspace = resolveAgentWorkspace(agentId);
  const system = buildSystemPrompt(workspace);

  const actualProvider = normalizeProvider(provider);
  let apiKey = resolveApiKey(actualProvider, clientApiKey);

  // If the resolved key is an OAuth token, try to auto-refresh if expired
  if (apiKey?.startsWith('sk-ant-oat') || (!apiKey && actualProvider === 'anthropic')) {
    try {
      const freshToken = await getValidAccessToken();
      if (freshToken) apiKey = freshToken;
    } catch {}
  }

  if (!apiKey) return res.status(400).json({ error: 'No API key available' });

  const agentConfig = getAgentConfig(agentId);
  const tools = getToolsForAgent(agentConfig);
  const context = getSearchContext();

  initSse(res);

  const onEvent = (event) => {
    sendSse(res, event.type, event);
  };

  try {
    const loopFn = actualProvider === 'openai' ? runOpenAILoop : runAnthropicLoop;
    await loopFn({
      apiKey,
      model: model || (actualProvider === 'openai' ? 'gpt-4o' : (apiKey?.startsWith('sk-ant-oat') ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6')),
      system,
      messages,
      tools,
      maxTokens: 4096,
      onEvent,
      context,
    });
    sendSse(res, 'done', {});
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('authentication') || msg.includes('401') || msg.includes('invalid')) {
      sendSse(res, 'error', { message: 'Authentication error. Please check your API key or sign in again in Settings.' });
    } else {
      sendSse(res, 'error', { message: msg });
    }
  } finally {
    res.end();
  }
});

export default router;
