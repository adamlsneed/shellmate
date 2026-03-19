// server/tools/permissions.js
/**
 * Trust-after-first-use permission system.
 * Manages session grants and pending confirmation Promises.
 *
 * Tiers:
 *   'read'        — always allowed, no confirmation
 *   'action'      — confirm on first use per session
 *   'destructive' — confirm on first use per session (stronger warning)
 *
 * Grants are keyed by `${toolName}:${tier}` so granting 'action' tier
 * does NOT auto-grant 'destructive' tier for the same tool.
 */

import crypto from 'crypto';

// Session grants: Map<'toolName:tier', true>
// Resets on server restart (no persistence).
const sessionGrants = new Map();

// Pending confirmations: Map<confirmId, { resolve }>
const pendingConfirms = new Map();

/**
 * Resolve the tier for a specific tool+action.
 * If the tool's tier is an object (per-action map), look up the action.
 * If it's a string, use it directly. Default: 'action'.
 */
export function resolveTier(toolMeta, actionName) {
  if (!toolMeta) return 'action';
  const tier = toolMeta.tier;
  if (typeof tier === 'object' && tier !== null && actionName) {
    return tier[actionName] || 'action';
  }
  return typeof tier === 'string' ? tier : 'action';
}

/**
 * Check if a tool+tier is already granted for this session.
 */
export function isGranted(toolName, tier) {
  if (tier === 'read') return true;
  return sessionGrants.has(`${toolName}:${tier}`);
}

/**
 * Grant a tool+tier for the rest of this session.
 */
export function grant(toolName, tier) {
  sessionGrants.set(`${toolName}:${tier}`, true);
}

/**
 * Create a pending confirmation. Returns { confirmId, promise }.
 * The promise resolves with { granted: boolean } when the client responds.
 * Auto-denies after timeoutMs (default 2 minutes) to prevent memory leaks
 * if the client disconnects or user never responds.
 */
export function createConfirmation({ timeoutMs = 120000 } = {}) {
  const confirmId = crypto.randomUUID();
  let resolve;
  const promise = new Promise(r => {
    resolve = r;
    setTimeout(() => {
      if (pendingConfirms.has(confirmId)) {
        pendingConfirms.delete(confirmId);
        r({ granted: false });
      }
    }, timeoutMs);
  });
  pendingConfirms.set(confirmId, { resolve });
  return { confirmId, promise };
}

/**
 * Resolve a pending confirmation (called by the grant API route).
 * Returns true if the confirmId was found, false if expired/invalid.
 */
export function resolveConfirmation(confirmId, granted) {
  const pending = pendingConfirms.get(confirmId);
  if (!pending) return false;
  pending.resolve({ granted });
  pendingConfirms.delete(confirmId);
  return true;
}

/**
 * Reset all session grants (e.g., on restart). Exposed for testing.
 */
export function resetGrants() {
  sessionGrants.clear();
  pendingConfirms.clear();
}
