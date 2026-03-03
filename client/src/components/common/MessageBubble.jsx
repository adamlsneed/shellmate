/**
 * Shared message bubble component.
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - message text
 * @param {boolean} [showAvatar] - show emoji avatar (default false)
 * @param {function} [transformContent] - optional content transform (e.g. strip spec blocks)
 */
export function MessageBubble({ role, content, showAvatar = false, transformContent }) {
  const isUser = role === 'user';
  const text = transformContent ? transformContent(content) : content;
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mb-4' : ''}`}>
      {showAvatar && !isUser && (
        <div className="w-8 h-8 rounded-full bg-shell-700 flex items-center justify-center text-sm mr-3 mt-0.5 shrink-0">
          🐢
        </div>
      )}
      <div className={`max-w-[${showAvatar ? '75' : '80'}%] rounded-2xl px-${showAvatar ? '4' : '3'} py-${showAvatar ? '3' : '2'} text-sm leading-relaxed ${
        isUser
          ? 'bg-shell-700 text-white rounded-br-sm'
          : 'bg-gray-800 text-gray-100 rounded-bl-sm'
      }`}>
        {lines.map((line, i) => (
          <span key={i}>{line}{i < lines.length - 1 && <br />}</span>
        ))}
      </div>
      {showAvatar && isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm ml-3 mt-0.5 shrink-0">
          👤
        </div>
      )}
    </div>
  );
}
