import { useState, useCallback } from 'react';
import { useAIConfig } from '../store/aiConfig.js';

/**
 * Shared hook for SSE-based agent chat with tool execution.
 * Manages chatItems (UI display), apiMessages (API context), and SSE parsing.
 */
export function useSSEChat() {
  const { provider, apiKey, model, envKey } = useAIConfig();

  const [chatItems, setChatItems] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const parseSseStream = useCallback(async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        try {
          const { type, data } = JSON.parse(line.slice(5).trim());

          if (type === 'text') {
            currentText += data.content;
            setChatItems(prev => {
              const next = [...prev];
              const lastIdx = next.length - 1;
              if (lastIdx >= 0 && next[lastIdx].type === 'assistant') {
                next[lastIdx] = { ...next[lastIdx], content: currentText };
              } else {
                next.push({ type: 'assistant', content: currentText });
              }
              return next;
            });
          }

          if (type === 'tool_call') {
            setChatItems(prev => [
              ...prev,
              { type: 'tool_call', id: data.id, name: data.name, input: data.input, isExecuting: true },
            ]);
          }

          if (type === 'tool_result') {
            setChatItems(prev =>
              prev.map(item =>
                item.type === 'tool_call' && item.id === data.id
                  ? { ...item, result: data.result, isExecuting: false }
                  : item
              )
            );
            currentText = '';
          }

          if (type === 'error') {
            setError(data.message || 'An error occurred');
          }
        } catch {}
      }
    }

    return currentText;
  }, []);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setError('');

    const userMsg = { role: 'user', content: text.trim() };
    const nextApiMessages = [...apiMessages, userMsg];
    setApiMessages(nextApiMessages);
    setChatItems(prev => [...prev, { type: 'user', content: text.trim() }]);
    setLoading(true);

    try {
      const res = await fetch('/api/agent-chat/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextApiMessages,
          ...(envKey ? {} : { apiKey }),
          provider,
          model,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Chat failed');
      }

      const finalText = await parseSseStream(res);
      if (finalText) {
        setApiMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { chatItems, loading, error, sendMessage };
}
