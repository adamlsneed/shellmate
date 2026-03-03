import { useState, useRef, useEffect } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useAIConfig } from '../../store/aiConfig.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { BouncingDots } from '../common/LoadingSpinner.jsx';
import ToolCallDisplay from '../chat/ToolCallDisplay.jsx';

// ---- Agent chat preview (with SSE + tool execution) -------------------------
function AgentChat() {
  const { provider, apiKey, model, envKey } = useAIConfig();
  const { teamSpec } = useTeamSpecStore();
  const agent = teamSpec.agent;

  const [chatItems, setChatItems] = useState([]);
  const [apiMessages, setApiMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, loading]);

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

      // Parse SSE stream
      const reader = res.body.getReader();
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

      if (currentText) {
        setApiMessages(prev => [...prev, { role: 'assistant', content: currentText }]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 py-2 scrollbar-thin min-h-0">
        {chatItems.length === 0 && (
          <div className="text-center text-gray-600 text-xs mt-8">
            Say hello to {agent.name || 'your helper'} to test how it responds.
          </div>
        )}
        {chatItems.map((item, i) => {
          if (item.type === 'user') return <MessageBubble key={i} role="user" content={item.content} />;
          if (item.type === 'assistant') return <MessageBubble key={i} role="assistant" content={item.content} />;
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
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2">
              <BouncingDots />
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 text-center">{error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 pt-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name || 'your helper'}...`}
            rows={2}
            disabled={loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 resize-none disabled:opacity-50 leading-relaxed"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-700 mt-1">Enter to send -- Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ---- Validation checks display ----------------------------------------------
function ValidationOutput({ checks, isRunning }) {
  if (!checks && !isRunning) return null;

  return (
    <div className="bg-navy-950 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-navy-900">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-xs text-gray-500 ml-2 font-mono">checks</span>
      </div>
      <div className="p-4 space-y-1">
        {isRunning ? (
          <p className="text-xs font-mono text-gray-400">Running checks...</p>
        ) : (
          checks.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className={c.passed ? 'text-green-400' : 'text-red-400'}>
                {c.passed ? 'PASS' : 'FAIL'}
              </span>
              <span className="text-gray-400">{c.name}:</span>
              <span className="text-gray-300">{c.detail}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- Main DoneStep ----------------------------------------------------------
export default function DoneStep({ onComplete }) {
  const {
    teamSpec,
    validationOutput,
    setValidationOutput,
    isValidating,
    setIsValidating,
    reset,
  } = useTeamSpecStore();

  const [validated, setValidated] = useState(false);
  const [validationPassed, setValidationPassed] = useState(false);
  const [checks, setChecks] = useState(null);
  const hasRun = useRef(false);

  // Auto-validate on mount
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runValidation();
  }, []);

  async function runValidation() {
    setIsValidating(true);
    setValidationOutput('');
    setChecks(null);
    try {
      const res = await fetch('/api/validate', { method: 'POST' });
      const data = await res.json();
      setValidationOutput(data.output || '(no output)');
      setValidationPassed(data.passed);
      setChecks(data.checks || []);
      setValidated(true);
    } catch (err) {
      setValidationOutput(`Error: ${err.message}`);
      setValidationPassed(false);
      setValidated(true);
    } finally {
      setIsValidating(false);
    }
  }

  const agentName = teamSpec.agent?.name || 'your helper';

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">

      {/* ---- Validation section ---- */}
      <div className="mb-6">
        {isValidating && (
          <div className="flex items-center gap-2 mb-3">
            <span className="w-4 h-4 border-2 border-shell-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Validating configuration...</span>
          </div>
        )}

        {validated && validationPassed && (
          <div className="mb-4 px-4 py-3 bg-green-900/20 border border-green-800/50 rounded-xl">
            <p className="text-sm font-semibold text-green-400">{agentName} is ready!</p>
            <p className="text-xs text-green-600 mt-0.5">
              All checks passed. Try chatting below, then start using your helper for real.
            </p>
          </div>
        )}

        {validated && !validationPassed && (
          <div className="mb-4 px-4 py-3 bg-yellow-900/20 border border-yellow-800/50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-400">Some checks need attention</p>
                <p className="text-xs text-yellow-600 mt-0.5">
                  See details below. You can still chat with {agentName} and fix these later.
                </p>
              </div>
              <button
                onClick={runValidation}
                className="shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
              >
                Re-run
              </button>
            </div>
          </div>
        )}

        <ValidationOutput checks={checks} isRunning={isValidating} />
      </div>

      {/* ---- Start chatting button ---- */}
      {validated && onComplete && (
        <div className="mb-6">
          <button
            onClick={onComplete}
            className="w-full px-6 py-3 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Start chatting →
          </button>
        </div>
      )}

      {/* ---- Chat preview ---- */}
      <div className="flex-1 min-h-0 border border-gray-800 rounded-xl p-4 bg-navy-900/20">
        <AgentChat />
      </div>

      {/* ---- Footer ---- */}
      <div className="pt-4 flex justify-between items-center">
        <button
          onClick={reset}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Start over
        </button>
        <p className="text-xs text-gray-700">
          Your helper has full tool capabilities
        </p>
      </div>
    </div>
  );
}
