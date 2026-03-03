import { useState, useRef, useEffect } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useAIConfig } from '../../store/aiConfig.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { BouncingDots } from '../common/LoadingSpinner.jsx';

// ---- Gateway panel ----------------------------------------------------------
function GatewayPanel() {
  const [status, setStatus] = useState('idle'); // idle | starting | done | error
  const [log, setLog] = useState('');
  const [copied, setCopied] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function copyCommand() {
    navigator.clipboard.writeText('openclaw gateway').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleStart() {
    setStatus('starting');
    setLog('');
    try {
      const res = await fetch('/api/gateway/restart', { method: 'POST' });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
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
            if (type === 'log') setLog(p => p + data);
            if (type === 'done') { setStatus('done'); }
            if (type === 'error') { setStatus('error'); setLog(p => p + '\n' + data); }
          } catch {}
        }
      }
    } catch (err) {
      setStatus('error');
      setLog('Error: ' + err.message);
    }
  }

  return (
    <div className="border border-gray-700 rounded-xl p-4 mb-6 bg-gray-800/30">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-semibold text-white">Start the OpenClaw gateway</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Your helper gets full capabilities once the gateway is running.
          </p>
        </div>
        {status === 'idle' && (
          <button
            onClick={handleStart}
            className="shrink-0 px-4 py-1.5 bg-shell-600 hover:bg-shell-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Start automatically
          </button>
        )}
        {status === 'starting' && (
          <span className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
            Starting...
          </span>
        )}
        {status === 'done' && (
          <span className="shrink-0 text-xs text-green-400">Done</span>
        )}
        {status === 'error' && (
          <button
            onClick={handleStart}
            className="shrink-0 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors"
          >
            Try again
          </button>
        )}
      </div>

      {/* Manual command -- always visible */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-3 py-2">
        <code className="text-xs text-shell-400 font-mono">openclaw gateway</code>
        <button
          onClick={copyCommand}
          className="text-xs text-gray-600 hover:text-gray-300 transition-colors ml-3 shrink-0"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {log && (
        <pre
          ref={logRef}
          className="mt-2 max-h-20 bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs font-mono text-green-400 overflow-y-auto scrollbar-thin whitespace-pre-wrap"
        >
          {log}
        </pre>
      )}
    </div>
  );
}

// ---- Agent chat preview -----------------------------------------------------
function AgentChat() {
  const { provider, apiKey, model, openclawEnv } = useAIConfig();
  const { teamSpec } = useTeamSpecStore();
  const agent = teamSpec.agent;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setError('');

    const userMsg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch('/api/agent-chat/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          ...(openclawEnv ? {} : { apiKey }),
          provider,
          model,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');
      setMessages([...next, { role: 'assistant', content: data.content }]);
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
      {/* Preview notice */}
      <div className="mb-3 px-3 py-2 bg-gray-800/40 border border-gray-700/50 rounded-lg text-xs text-gray-500">
        Preview mode -- personality and rules are loaded from your workspace files.
        External tools (web, shell, memory) require the gateway.
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 py-2 scrollbar-thin min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-xs mt-8">
            Say hello to {agent.name || 'your helper'} to test how it responds.
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
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

// ---- Validation terminal output ---------------------------------------------
function ValidationOutput({ output, isRunning }) {
  if (!output && !isRunning) return null;

  return (
    <div className="bg-gray-950 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-xs text-gray-500 ml-2 font-mono">terminal</span>
      </div>
      <pre className="p-4 text-xs font-mono text-green-400 overflow-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
        {isRunning ? 'Running openclaw doctor...' : output}
      </pre>
    </div>
  );
}

// ---- Main DoneStep ----------------------------------------------------------
export default function DoneStep() {
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
    try {
      const res = await fetch('/api/validate', { method: 'POST' });
      const data = await res.json();
      const output = data.output || '(no output)';
      setValidationOutput(output);
      // Check if the validation passed (no FAIL or error lines)
      const lower = output.toLowerCase();
      const passed = !lower.includes('fail') && !lower.includes('error');
      setValidationPassed(passed);
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
            <p className="text-sm font-semibold text-green-400">Your helper is ready!</p>
            <p className="text-xs text-green-600 mt-0.5">
              All checks passed. Chat with {agentName} below, or start the gateway to go live.
            </p>
          </div>
        )}

        {validated && !validationPassed && (
          <div className="mb-4 px-4 py-3 bg-yellow-900/20 border border-yellow-800/50 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-yellow-400">Validation found issues</p>
                <p className="text-xs text-yellow-600 mt-0.5">
                  Check the output below. You can still chat with {agentName} and start the gateway.
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

        <ValidationOutput output={validationOutput} isRunning={isValidating} />
      </div>

      {/* ---- Gateway ---- */}
      <GatewayPanel />

      {/* ---- Chat preview ---- */}
      <div className="flex-1 min-h-0 border border-gray-800 rounded-xl p-4 bg-gray-900/20">
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
          Full capabilities available once the gateway is running
        </p>
      </div>
    </div>
  );
}
