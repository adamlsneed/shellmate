// server/tools/registry.js
/**
 * Dynamic tool registry for Shellmate.
 * Singleton module — all tool sources register here on startup.
 */

const tools = new Map();       // name → { definition, executor, tier, category }
const denyMap = new Map();     // denyCategory → Set<toolName>

// Initialize static deny categories
const STATIC_DENY = {
  exec: ['shell_exec'],
  write: ['file_write'],
  read: ['file_read', 'file_list'],
  web: ['web_search', 'web_fetch'],
  browser: ['web_fetch'],
};
for (const [cat, names] of Object.entries(STATIC_DENY)) {
  denyMap.set(cat, new Set(names));
}

/**
 * Register a tool with the registry.
 * @param {object} definition - { name, description, input_schema }
 * @param {function} executor - async (input, context) => string
 * @param {object} opts - { tier, category } (tier: 'read'|'action'|'destructive' or per-action map)
 */
export function registerTool(definition, executor, opts = {}) {
  const { tier = 'action', category = null } = opts;
  tools.set(definition.name, { definition, executor, tier, category });
}

/**
 * Remove a tool from the registry.
 */
export function unregisterTool(name) {
  tools.delete(name);
  // Remove from all deny categories
  for (const set of denyMap.values()) {
    set.delete(name);
  }
}

/**
 * Add a tool to a deny category (used by CLI discovery).
 */
export function addToDenyCategory(category, toolName) {
  if (!denyMap.has(category)) denyMap.set(category, new Set());
  denyMap.get(category).add(toolName);
}

/**
 * Get tools available for an agent, filtering by its deny list.
 */
export function getToolsForAgent(agentConfig) {
  const deny = agentConfig?.tools?.deny || [];
  if (deny.length === 0) {
    return Array.from(tools.values()).map(t => t.definition);
  }

  const blocked = new Set();
  for (const d of deny) {
    const names = denyMap.get(d);
    if (names) {
      for (const name of names) blocked.add(name);
    }
  }

  return Array.from(tools.values())
    .filter(t => !blocked.has(t.definition.name))
    .map(t => t.definition);
}

/**
 * Execute a tool by name.
 */
export async function executeTool(name, input, context = {}) {
  const entry = tools.get(name);
  if (!entry) return `Unknown tool: ${name}`;
  return entry.executor(input, context);
}

/**
 * Get tool metadata for permission checks.
 */
export function getToolMeta(name) {
  const entry = tools.get(name);
  if (!entry) return null;
  return { name, tier: entry.tier, category: entry.category };
}

/**
 * Convert tools to Anthropic API format.
 */
export function toAnthropicTools(toolDefs) {
  return toolDefs.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Convert tools to OpenAI function calling format.
 */
export function toOpenAITools(toolDefs) {
  return toolDefs.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}
