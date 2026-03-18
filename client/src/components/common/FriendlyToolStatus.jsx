import { describeTool } from '../../theme.js';

export function FriendlyToolStatus({ name, input, result, isExecuting }) {
  const description = describeTool(name, input);
  const isDone = !!result;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-friendly bg-[var(--bg-card)] border border-[var(--border)] my-2">
      {isExecuting ? (
        <span className="inline-block w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      ) : isDone ? (
        <span className="text-green-500 text-xl">✓</span>
      ) : (
        <span className="text-[var(--text-muted)] text-xl">○</span>
      )}
      <span className="text-body text-[var(--text-primary)]">
        {isExecuting ? description : isDone ? description.replace('...', '') + ' — done' : description}
      </span>
    </div>
  );
}
