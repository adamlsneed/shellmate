const ACTIONS = [
  { label: '📧  Check my email',       prompt: 'Can you help me check my email?' },
  { label: '📸  Open my photos',        prompt: 'Can you open my Photos app?' },
  { label: '📅  What\'s on my calendar', prompt: 'What do I have coming up on my calendar?' },
  { label: '🔍  Search the web',        prompt: 'Can you search the web for something for me?' },
  { label: '📁  Find a file',           prompt: 'Can you help me find a file on my Mac?' },
  { label: '⚙️  Fix a problem',         prompt: 'Something on my Mac isn\'t working right. Can you help?' },
];

export function QuickActions({ onSelect }) {
  return (
    <div className="px-4 pb-4">
      <p className="text-body text-[var(--text-muted)] mb-3 text-center">
        Try asking me to...
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {ACTIONS.map(action => (
          <button
            key={action.label}
            onClick={() => onSelect(action.prompt)}
            className="px-5 py-3 rounded-friendly bg-[var(--bg-card)] border border-[var(--border)] text-body text-[var(--text-primary)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
