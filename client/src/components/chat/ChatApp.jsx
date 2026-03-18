import { useState, useRef, useEffect } from 'react';
import { useSSEChat } from '../../hooks/useSSEChat.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import ToolCallDisplay from './ToolCallDisplay.jsx';
import { QuickActions } from '../common/QuickActions.jsx';
import { useThemeStore } from '../../theme.js';

export default function ChatApp({ onSettings }) {
  const { chatItems, sendMessage, loading, error } = useSSEChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const { mode, toggle: toggleTheme } = useThemeStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems, loading]);

  function send(text) {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    sendMessage(msg);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmpty = chatItems.length === 0;

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐢</span>
          <span className="text-h3 text-[var(--accent)] font-bold">Shellmate</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="px-3 py-2 rounded-friendly text-body text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>
          {onSettings && (
            <button
              onClick={onSettings}
              className="px-3 py-2 rounded-friendly text-body text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              ⚙️ Settings
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {isEmpty && !loading && (
            <div className="text-center pt-12 pb-6">
              <div className="text-5xl mb-4">🐢</div>
              <h2 className="text-h2 text-[var(--text-primary)] mb-2">How can I help?</h2>
              <p className="text-body text-[var(--text-secondary)]">
                Ask me anything about your Mac, or try one of these:
              </p>
            </div>
          )}

          {isEmpty && !loading && <QuickActions onSelect={send} />}

          {chatItems.map((item, i) => {
            if (item.type === 'tool_call') return <ToolCallDisplay key={i} {...item} friendly={true} />;
            if (item.type === 'user') return <MessageBubble key={i} role="user" content={item.content} showAvatar={true} />;
            if (item.type === 'assistant') return <MessageBubble key={i} role="assistant" content={item.content} showAvatar={true} />;
            return null;
          })}

          {loading && (
            <div className="flex items-center gap-3 px-4">
              <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span className="text-body text-[var(--text-muted)]">Thinking...</span>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-friendly bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-body">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={2}
            className="flex-1 min-h-input px-5 py-3 rounded-friendly text-body bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-shell-300 resize-none"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="min-h-input px-6 rounded-friendly bg-[var(--accent)] text-white text-body font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
