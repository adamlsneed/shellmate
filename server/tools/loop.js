/**
 * Agentic tool-use loop for Anthropic and OpenAI.
 * Calls the AI, executes tool calls, feeds results back, repeats until done.
 */

import { normalizeModel } from '../utils/ai-clients.js';
import { executeTool } from './registry.js';
import { toAnthropicTools, toOpenAITools } from './registry.js';

const MAX_ROUNDS = 15;
const ANTHROPIC_VERSION = '2023-06-01';

// ── Raw API callers (return full response, not just text) ───────────────────

async function callAnthropicRaw({ apiKey, model, messages, system, tools, maxTokens = 4096 }) {
  const body = {
    model: normalizeModel(model),
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;
  if (tools && tools.length > 0) body.tools = toAnthropicTools(tools);

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
  return data;
}

async function callOpenAIRaw({ apiKey, model, messages, system, tools, maxTokens = 4096 }) {
  const openaiMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : [...messages];

  const body = {
    model: normalizeModel(model),
    max_tokens: maxTokens,
    messages: openaiMessages,
  };
  if (tools && tools.length > 0) body.tools = toOpenAITools(tools);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `OpenAI error ${res.status}`);
  return data;
}

// ── Anthropic tool-use loop ─────────────────────────────────────────────────

export async function runAnthropicLoop({ apiKey, model, system, messages, tools, maxTokens, onEvent, context }) {
  let conversation = [...messages];
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    const response = await callAnthropicRaw({ apiKey, model, messages: conversation, system, tools, maxTokens });

    // Collect text and tool_use blocks from response
    const textParts = [];
    const toolUses = [];
    for (const block of response.content || []) {
      if (block.type === 'text') {
        textParts.push(block.text);
        onEvent({ type: 'text', content: block.text });
      } else if (block.type === 'tool_use') {
        toolUses.push(block);
        onEvent({ type: 'tool_call', name: block.name, input: block.input, id: block.id });
      }
    }

    // If no tool_use, we're done
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { role: 'assistant', content: textParts.join('') };
    }

    // Add assistant message with all content blocks to conversation
    conversation.push({ role: 'assistant', content: response.content });

    // Execute all tool calls and build tool_result blocks
    const toolResults = [];
    for (const tu of toolUses) {
      const result = await executeTool(tu.name, tu.input, context);
      onEvent({ type: 'tool_result', id: tu.id, name: tu.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: result,
      });
    }

    conversation.push({ role: 'user', content: toolResults });
  }

  onEvent({ type: 'text', content: '\n\n[Reached maximum tool rounds]' });
  return { role: 'assistant', content: '[Reached maximum tool rounds]' };
}

// ── OpenAI tool-use loop ────────────────────────────────────────────────────

export async function runOpenAILoop({ apiKey, model, system, messages, tools, maxTokens, onEvent, context }) {
  let conversation = [...messages];
  let round = 0;

  while (round < MAX_ROUNDS) {
    round++;
    const response = await callOpenAIRaw({ apiKey, model, messages: conversation, system, tools, maxTokens });
    const choice = response.choices?.[0];
    if (!choice) throw new Error('No response from OpenAI');

    const msg = choice.message;

    // Emit text if present
    if (msg.content) {
      onEvent({ type: 'text', content: msg.content });
    }

    // If no tool calls, we're done
    if (choice.finish_reason !== 'tool_calls' || !msg.tool_calls || msg.tool_calls.length === 0) {
      return { role: 'assistant', content: msg.content || '' };
    }

    // Add assistant message (with tool_calls) to conversation
    conversation.push(msg);

    // Execute tool calls
    for (const tc of msg.tool_calls) {
      const fn = tc.function;
      let input;
      try { input = JSON.parse(fn.arguments); } catch { input = {}; }

      onEvent({ type: 'tool_call', name: fn.name, input, id: tc.id });

      const result = await executeTool(fn.name, input, context);
      onEvent({ type: 'tool_result', id: tc.id, name: fn.name, result });

      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  onEvent({ type: 'text', content: '\n\n[Reached maximum tool rounds]' });
  return { role: 'assistant', content: '[Reached maximum tool rounds]' };
}
