const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 1024;

export function detectProvider(model) {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gpt') || m.includes('o1') || m.includes('o3')) return 'openai';
  if (m.includes('anthropic/')) return 'anthropic';
  if (m.includes('openai')) return 'openai';
  return null;
}

export function normalizeModel(model) {
  if (model && model.includes('/')) return model.split('/').pop();
  return model;
}

/**
 * Normalize provider name — handles legacy 'openclaw' and new 'default' aliases.
 */
export function normalizeProvider(provider) {
  if (provider === 'default' || provider === 'openclaw') return 'anthropic';
  return provider;
}

export function resolveApiKey(provider, clientKey) {
  if (clientKey) return clientKey;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN || null;
  if (provider === 'openai') return process.env.OPENAI_API_KEY || null;
  return null;
}

export async function callAnthropic({ apiKey, model, messages, system, maxTokens = DEFAULT_MAX_TOKENS }) {
  const body = { model: normalizeModel(model), max_tokens: maxTokens, messages };
  if (system) body.system = system;

  const isOAuth = apiKey && apiKey.startsWith('sk-ant-oat');
  const headers = {
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  };
  if (isOAuth) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['anthropic-beta'] = 'oauth-2025-04-20';
  } else {
    headers['x-api-key'] = apiKey;
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Anthropic error ${res.status}`);
  return data.content?.[0]?.text || '';
}

export async function callOpenAI({ apiKey, model, messages, system, maxTokens = DEFAULT_MAX_TOKENS }) {
  const openaiMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: normalizeModel(model), max_tokens: maxTokens, messages: openaiMessages }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  return data.choices?.[0]?.message?.content || '';
}
