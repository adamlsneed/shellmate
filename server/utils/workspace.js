import { expandHome } from './paths.js';
import { readConfig } from './config.js';

/**
 * Resolve the absolute workspace path for an agent.
 * Main agent uses agents.defaults.workspace; named agents get workspace-<id>.
 */
export function resolveAgentWorkspace(agentId) {
  const cfg = readConfig();
  const existing = (cfg.agents?.list || []).find(a => a.id === agentId);
  if (existing?.workspace) return expandHome(existing.workspace);
  if (existing) return expandHome(cfg.agents?.defaults?.workspace || '~/.shellmate/workspace');
  return expandHome(`~/.shellmate/workspace-${agentId}`);
}
