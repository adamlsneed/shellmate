export function BigButton({ children, onClick, variant = 'primary', disabled, className = '' }) {
  const base = 'min-h-btn px-8 rounded-friendly text-body font-semibold transition-all duration-150 focus:outline-none focus:ring-4 focus:ring-shell-300 disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-[var(--accent)] text-white hover:opacity-90 active:scale-[0.98]',
    secondary: 'bg-[var(--bg-card)] text-[var(--text-primary)] border-2 border-[var(--border)] hover:border-[var(--accent)]',
    ghost:     'text-[var(--accent)] hover:bg-[var(--accent-light)] hover:bg-opacity-10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
