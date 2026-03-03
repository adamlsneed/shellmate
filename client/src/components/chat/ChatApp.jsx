import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { BouncingDots } from '../common/LoadingSpinner.jsx';
import ToolCallDisplay from './ToolCallDisplay.jsx';

/**
 * Full-screen chat interface for post-wizard use.
 * Streams SSE events from /api/agent-chat/main with tool execution.
 */
export default function ChatApp({ onSettings }) {
  const { provider, apiKey, model, envKey } = useAIConfig();

  // Each item: { type: 'user'|'assistant'|'tool_call'|'tool_result', ... }
  const [chatItems, setChatItems] = useState([]);
  // Messages in Anthropic/OpenAI format for API
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agentName, setAgentName] = useState('Shellmate');

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Load agent name from workspace
  useEffect(() => {
    fetch('/api/setup-status')
      .then(r => r.json())
      .then(data => {
        if (data.setupComplete) {
          // Try to get agent name from config
          fetch('/api/config')
            .then(r => r.json())
            .then(cfg => {
              // Agent name isn't in config, but we can load it from workspace SOUL.md
              // For now just use a sensible default
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, loading]);

  const parseSseStream = useCallback(async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentText = '';
    const toolCalls = new Map(); // id → { name, input, result }

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
              // Update or add the last assistant text item
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
            toolCalls.set(data.id, { name: data.name, input: data.input });
            setChatItems(prev => [
              ...prev,
              { type: 'tool_call', id: data.id, name: data.name, input: data.input, isExecuting: true },
            ]);
          }

          if (type === 'tool_result') {
            const tc = toolCalls.get(data.id);
            if (tc) tc.result = data.result;
            setChatItems(prev =>
              prev.map(item =>
                item.type === 'tool_call' && item.id === data.id
                  ? { ...item, result: data.result, isExecuting: false }
                  : item
              )
            );
            // After tool result, the API will send more text — reset tracker
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

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: text };
    const nextApiMessages = [...apiMessages, userMsg];
    setApiMessages(nextApiMessages);
    setChatItems(prev => [...prev, { type: 'user', content: text }]);
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

      // Add assistant response to API messages for context
      if (finalText) {
        setApiMessages(prev => [...prev, { role: 'assistant', content: finalText }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-shell-400">🐢 {agentName}</span>
        </div>
        <button
          onClick={onSettings}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Settings
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 scrollbar-thin">
        <div className="max-w-2xl mx-auto">
          {chatItems.length === 0 && !loading && (
            <div className="text-center text-gray-600 text-sm mt-16">
              Say hello to start chatting.
            </div>
          )}

          {chatItems.map((item, i) => {
            if (item.type === 'user') {
              return <MessageBubble key={i} role="user" content={item.content} />;
            }
            if (item.type === 'assistant') {
              return <MessageBubble key={i} role="assistant" content={item.content} />;
            }
            if (item.type === 'tool_call') {
              return (
                <ToolCallDisplay
                  key={`tool-${item.id}`}
                  name={item.name}
                  input={item.input}
                  result={item.result}
                  isExecuting={item.isExecuting}
                />
              );
            }
            return null;
          })}

          {loading && chatItems[chatItems.length - 1]?.type !== 'assistant' && (
            <div className="flex justify-start mb-4">
              <div className="w-8 h-8 rounded-full bg-shell-700 flex items-center justify-center text-sm mr-3 shrink-0">
                🐢
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <BouncingDots />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-400 text-center my-2">{error}</div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your helper..."
            rows={2}
            disabled={loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-5 py-3 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>
        <div className="max-w-2xl mx-auto mt-1 px-1">
          <span className="text-xs text-gray-700">Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
