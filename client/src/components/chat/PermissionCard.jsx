// client/src/components/chat/PermissionCard.jsx
import { useState } from 'react';

/**
 * Inline permission confirmation card shown in the chat stream.
 * Displays what the tool wants to do and Allow/Deny buttons.
 * Once resolved, shows the result (allowed or denied).
 */
export default function PermissionCard({ confirmId, tool, action, tier, description, onGrant }) {
  const [resolved, setResolved] = useState(null); // null | 'allowed' | 'denied'
  const [loading, setLoading] = useState(false);

  async function handleGrant(granted) {
    setLoading(true);
    await onGrant(confirmId, granted);
    setResolved(granted ? 'allowed' : 'denied');
    setLoading(false);
  }

  const isDestructive = tier === 'destructive';
  const toolLabel = tool.replace(/^mac_/, '').replace(/_/g, ' ');

  // Already resolved
  if (resolved) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-friendly my-2 border ${
        resolved === 'allowed'
          ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
      }`}>
        <span className="text-xl">{resolved === 'allowed' ? '✓' : '✕'}</span>
        <span className="text-body text-[var(--text-primary)]">
          {resolved === 'allowed'
            ? `Allowed ${toolLabel} for this session`
            : `Denied ${toolLabel}`
          }
        </span>
      </div>
    );
  }

  // Pending confirmation
  return (
    <div className={`px-4 py-4 rounded-friendly my-2 border ${
      isDestructive
        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl mt-0.5">{isDestructive ? '⚠️' : '🔐'}</span>
        <div>
          <p className="text-body font-semibold text-[var(--text-primary)]">
            Shellmate wants to {description}
          </p>
          {isDestructive && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              This action may modify or send data on your behalf.
            </p>
          )}
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Allow {toolLabel} actions for this session?
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-8">
        <button
          onClick={() => handleGrant(true)}
          disabled={loading}
          className="px-4 py-2 rounded-friendly text-sm font-semibold bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
        >
          Allow
        </button>
        <button
          onClick={() => handleGrant(false)}
          disabled={loading}
          className="px-4 py-2 rounded-friendly text-sm font-semibold bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 transition-all"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
