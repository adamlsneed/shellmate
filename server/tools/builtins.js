// server/tools/builtins.js
/**
 * Registers the 6 built-in tools with the dynamic registry.
 * Executors are imported from executor.js (which keeps the actual implementation).
 */

import { registerTool } from './registry.js';
import {
  shellExec, fileRead, fileWrite, fileList, webSearch, webFetch,
} from './executor.js';

const BUILTIN_TOOLS = [
  {
    definition: {
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
    executor: (input) => shellExec(input),
    tier: 'action',
  },
  {
    definition: {
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
    executor: (input) => fileRead(input),
    tier: 'read',
  },
  {
    definition: {
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
    executor: (input) => fileWrite(input),
    tier: 'action',
  },
  {
    definition: {
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
    executor: (input) => fileList(input),
    tier: 'read',
  },
  {
    definition: {
      name: 'web_search',
      description: 'Search the web using Google. Returns top results with titles, URLs, and snippets.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          count: { type: 'number', description: 'Number of results (default 5, max 20)' },
        },
        required: ['query'],
      },
    },
    executor: (input, context) => webSearch(input, context),
    tier: 'read',
  },
  {
    definition: {
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
    executor: (input) => webFetch(input),
    tier: 'read',
  },
];

export function registerBuiltins() {
  for (const tool of BUILTIN_TOOLS) {
    registerTool(tool.definition, tool.executor, { tier: tool.tier });
  }
}
