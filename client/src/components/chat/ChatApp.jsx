import { useState } from 'react';
import { useSSEChat } from '../../hooks/useSSEChat.js';
import { useScrollToBottom, useAutofocus } from '../../hooks/useChatUI.js';
import { MessageBubble } from '../common/MessageBubble.jsx';
import { BouncingDots } from '../common/LoadingSpinner.jsx';
import ToolCallDisplay from './ToolCallDisplay.jsx';

/**
 * Full-screen chat interface for post-wizard use.
 * Streams SSE events from /api/agent-chat/main with tool execution.
 */
export default function ChatApp({ onSettings }) {
  const { chatItems, loading, error, sendMessage } = useSSEChat();
  const [input, setInput] = useState('');
  const bottomRef = useScrollToBottom([chatItems, loading]);
  const [inputRef, focusInput] = useAutofocus();

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await sendMessage(text);
    focusInput();
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
          <span className="text-lg font-bold text-shell-400">🐢 Shellmate</span>
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
