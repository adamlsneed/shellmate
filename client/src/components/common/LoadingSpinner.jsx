export function Spinner({ size = 'sm' }) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className={`${dim} border-2 border-shell-500 border-t-transparent rounded-full animate-spin shrink-0`} />
  );
}

export function BouncingDots() {
  return (
    <span className="flex gap-1">
      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}
