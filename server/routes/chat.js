import { Router } from 'express';
import { detectProvider, normalizeModel, callAnthropic, callOpenAI, resolveApiKey } from '../utils/ai-clients.js';
import { readOpenClawConfig } from '../utils/config.js';

const router = Router();

const ANTHROPIC_MODELS = ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'];
const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];

router.post('/chat', async (req, res) => {
  const { messages, apiKey: clientApiKey, model, provider: explicitProvider, system, maxTokens } = req.body;

  if (!messages || !model) {
    return res.status(400).json({ error: 'messages and model are required' });
  }

  const provider = explicitProvider || detectProvider(model);
  if (!provider) {
    return res.status(400).json({ error: `Cannot detect provider for model: ${model}` });
  }

  // Resolve API key: use client-supplied key, or fall back to environment variables
  const actualProvider = provider === 'openclaw' ? 'anthropic' : provider;
  const apiKey = resolveApiKey(actualProvider, clientApiKey);

  if (!apiKey) {
    return res.status(400).json({ error: 'No API key available. Set ANTHROPIC_API_KEY in your environment, or enter a key manually.' });
  }

  const opts = { apiKey, model, messages, system };
  if (maxTokens) opts.maxTokens = maxTokens;

  try {
    let content;
    if (actualProvider === 'anthropic') {
      content = await callAnthropic(opts);
    } else if (actualProvider === 'openai') {
      content = await callOpenAI(opts);
    } else {
      return res.status(400).json({ error: `Unsupported provider: ${actualProvider}` });
    }
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check whether the server has credentials available for "Shellmate default" mode
router.get('/chat/openclaw-status', async (req, res) => {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // Always use a capable model for the builder — env key availability determines provider
    let model = null;
    let provider = null;
    if (anthropicKey) { model = 'claude-sonnet-4-6'; provider = 'anthropic'; }
    else if (openaiKey) { model = 'gpt-4o'; provider = 'openai'; }

    const available = !!(model && provider);
    res.json({ available, provider, model, normalized: model ? normalizeModel(model) : null });
  } catch {
    res.json({ available: false, provider: null, model: null, normalized: null });
  }
});

// Legacy endpoint kept for compatibility
router.get('/chat/default-model', async (req, res) => {
  try {
    const cfg = readOpenClawConfig();
    const primary = cfg?.agents?.defaults?.model?.primary || null;
    const provider = primary ? detectProvider(primary) : null;
    res.json({ model: primary, provider, normalized: primary ? normalizeModel(primary) : null });
  } catch {
    res.json({ model: null, provider: null, normalized: null });
  }
});

export default router;
