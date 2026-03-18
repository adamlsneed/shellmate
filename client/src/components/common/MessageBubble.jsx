/**
 * @param {{ role: 'user'|'assistant', content: string, showAvatar?: boolean, transformContent?: function }} props
 */
export function MessageBubble({ role, content, showAvatar = false, transformContent }) {
  const display = transformContent ? transformContent(content) : content;
  if (!display) return null;
  const lines = display.split('\n');
  const isUser = role === 'user';

  return (
    <div className={`flex items-end gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && showAvatar && (
        <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-xl flex-shrink-0">
          🐢
        </div>
      )}
      <div
        className={`max-w-[85%] px-5 py-4 text-body leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[var(--user-bubble)] text-[var(--user-bubble-text)] rounded-2xl rounded-br-md'
            : 'bg-[var(--assistant-bubble)] text-[var(--assistant-bubble-text)] rounded-2xl rounded-bl-md border border-[var(--border)]'
        }`}
      >
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
      {isUser && showAvatar && (
        <div className="w-10 h-10 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-xl flex-shrink-0">
          👤
        </div>
      )}
    </div>
  );
}
