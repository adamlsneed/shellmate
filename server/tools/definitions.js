// server/tools/definitions.js
/**
 * Backward-compatible re-exports from the dynamic registry.
 * Existing code that imports from here continues to work.
 */

export {
  getToolsForAgent,
  toAnthropicTools,
  toOpenAITools,
} from './registry.js';
