// server/tools/plugins.js
/**
 * Plugin tool loader for Shellmate.
 * Loads user-defined tools from ~/.shellmate/tools/*.js when enabled.
 * Disabled by default — requires plugins.enabled: true in shellmate.json.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerTool, unregisterTool } from './registry.js';
import { readConfig } from '../utils/config.js';

const PLUGINS_DIR = path.join(os.homedir(), '.shellmate', 'tools');
let watcher = null;
const loadedPlugins = new Map(); // name → { path }

/**
 * Check if plugins are enabled in shellmate.json.
 */
function isPluginsEnabled() {
  const cfg = readConfig();
  return cfg.plugins?.enabled === true;
}

/**
 * Load a single plugin file. Returns the plugin name or null on failure.
 */
async function loadPlugin(filePath) {
  try {
    // Dynamic import with cache-busting query param for hot-reload
    const mod = await import(`${filePath}?t=${Date.now()}`);
    const plugin = mod.default;

    if (!plugin?.name || !plugin?.description || !plugin?.input_schema || !plugin?.execute) {
      console.warn(`[plugins] Skipping ${filePath}: missing name, description, input_schema, or execute`);
      return null;
    }

    const definition = {
      name: plugin.name,
      description: plugin.description,
      input_schema: plugin.input_schema,
    };

    registerTool(definition, plugin.execute, { tier: plugin.tier || 'action' });
    loadedPlugins.set(plugin.name, { path: filePath });
    return plugin.name;
  } catch (err) {
    console.warn(`[plugins] Failed to load ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Load all plugins from the plugins directory.
 */
export async function loadPlugins() {
  if (!isPluginsEnabled()) {
    return { loaded: 0, message: 'Plugins disabled (set plugins.enabled: true in shellmate.json)' };
  }

  if (!fs.existsSync(PLUGINS_DIR)) {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    return { loaded: 0, message: 'Plugin directory created (empty)' };
  }

  const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
  let loaded = 0;

  for (const file of files) {
    const name = await loadPlugin(path.join(PLUGINS_DIR, file));
    if (name) loaded++;
  }

  return { loaded, message: `Loaded ${loaded} plugin(s)` };
}

/**
 * Start watching the plugins directory for changes (hot-reload).
 */
export function watchPlugins() {
  if (!isPluginsEnabled() || !fs.existsSync(PLUGINS_DIR)) return;
  if (watcher) return; // already watching

  try {
    watcher = fs.watch(PLUGINS_DIR, async (eventType, filename) => {
      if (!filename?.endsWith('.js')) return;
      const filePath = path.join(PLUGINS_DIR, filename);

      if (fs.existsSync(filePath)) {
        // File added or changed — (re)load it
        const name = await loadPlugin(filePath);
        if (name) console.log(`[plugins] Loaded/reloaded: ${name}`);
      } else {
        // File removed — unregister if we loaded it
        for (const [name, info] of loadedPlugins) {
          if (info.path === filePath) {
            unregisterTool(name);
            loadedPlugins.delete(name);
            console.log(`[plugins] Unloaded: ${name}`);
            break;
          }
        }
      }
    });
  } catch (err) {
    console.warn(`[plugins] Watch failed: ${err.message}`);
  }
}

/**
 * Get the list of loaded plugins.
 */
export function getLoadedPlugins() {
  return Array.from(loadedPlugins.entries()).map(([name, info]) => ({
    name,
    path: info.path,
  }));
}
