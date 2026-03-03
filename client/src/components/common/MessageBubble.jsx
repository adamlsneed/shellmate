export function MessageBubble({ role, content }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
        role === 'user'
          ? 'bg-shell-700 text-white rounded-br-sm'
          : 'bg-gray-800 text-gray-100 rounded-bl-sm'
      }`}>
        {content.split('\n').map((line, j) => (
          <span key={j}>{line}{j < content.split('\n').length - 1 && <br />}</span>
        ))}
      </div>
    </div>
  );
}
