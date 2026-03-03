/**
 * Tool schema registry for Shellmate built-in tools.
 * Each tool has a name, description, and input_schema (JSON Schema).
 */

export const TOOLS = [
  {
    name: 'shell_exec',
    description: 'Run a terminal command and return stdout/stderr. Use for system commands, scripts, and automation.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional, defaults to home)' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (optional, default 30000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'file_read',
    description: 'Read the contents of a file. Returns the text content.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file to read' },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_write',
    description: 'Create or overwrite a file with the given content. Creates parent directories if needed.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to write to' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_list',
    description: 'List files and directories at a given path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' },
        recursive: { type: 'boolean', description: 'List recursively (max depth 3, default false)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web using Brave Search API. Returns top results with titles, URLs, and snippets.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        count: { type: 'number', description: 'Number of results (default 5, max 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return its content as plain text (HTML stripped).',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
];

/**
 * Maps tools.deny values to tool names.
 * e.g. deny: ['exec', 'write'] blocks shell_exec and file_write.
 */
const DENY_MAP = {
  exec: ['shell_exec'],
  write: ['file_write'],
  read: ['file_read', 'file_list'],
  web: ['web_search', 'web_fetch'],
  browser: ['web_fetch'],
};

/**
 * Returns tools available for an agent, filtering by its deny list.
 */
export function getToolsForAgent(agentConfig) {
  const deny = agentConfig?.tools?.deny || [];
  if (deny.length === 0) return TOOLS;

  const blocked = new Set();
  for (const d of deny) {
    for (const name of (DENY_MAP[d] || [])) {
      blocked.add(name);
    }
  }

  return TOOLS.filter(t => !blocked.has(t.name));
}

/**
 * Convert tools to Anthropic format (already matches).
 */
export function toAnthropicTools(tools) {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Convert tools to OpenAI function calling format.
 */
export function toOpenAITools(tools) {
  return tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}
