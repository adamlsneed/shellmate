import { Router } from 'express';
import { detectProvider, normalizeModel, normalizeProvider, callAnthropic, callOpenAI, resolveApiKey } from '../utils/ai-clients.js';

const router = Router();

router.post('/chat', async (req, res) => {
  const { messages, apiKey: clientApiKey, model, provider: explicitProvider, system, maxTokens } = req.body;

  if (!messages || !model) {
    return res.status(400).json({ error: 'messages and model are required' });
  }

  const provider = explicitProvider || detectProvider(model);
  if (!provider) {
    return res.status(400).json({ error: `Cannot detect provider for model: ${model}` });
  }

  const actualProvider = normalizeProvider(provider);
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

// Check whether the server has credentials available via env vars
router.get('/chat/env-status', async (_req, res) => {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const openaiKey = process.env.OPENAI_API_KEY;

    let model = null;
    let provider = null;
    if (anthropicKey) { model = 'claude-haiku-4-5-20251001'; provider = 'anthropic'; }
    else if (openaiKey) { model = 'gpt-4.1-mini'; provider = 'openai'; }

    const available = !!(model && provider);
    res.json({ available, provider, model, normalized: model ? normalizeModel(model) : null });
  } catch {
    res.json({ available: false, provider: null, model: null, normalized: null });
  }
});

export default router;
