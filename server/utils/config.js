import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.shellmate');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'shellmate.json');

const LEGACY_DIR = path.join(os.homedir(), '.openclaw');
const LEGACY_CONFIG = path.join(LEGACY_DIR, 'openclaw.json');

export function backupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch { return {}; }
}

export function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  try { fs.chmodSync(path.dirname(CONFIG_PATH), 0o700); } catch {}
  try { fs.chmodSync(CONFIG_PATH, 0o600); } catch {}
}

export function backupConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const ts = backupTimestamp();
    fs.copyFileSync(CONFIG_PATH, `${CONFIG_PATH}.bak-${ts}`);
    try { fs.chmodSync(`${CONFIG_PATH}.bak-${ts}`, 0o600); } catch {}
  }
}

/**
 * Check if legacy ~/.openclaw/ exists but ~/.shellmate/ doesn't.
 */
export function detectLegacyConfig() {
  return fs.existsSync(LEGACY_CONFIG) && !fs.existsSync(CONFIG_PATH);
}

/**
 * Migrate legacy ~/.openclaw/ config and workspace to ~/.shellmate/.
 * Copies openclaw.json → shellmate.json and workspace/ → workspace/.
 */
export function migrateLegacyConfig() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });

  // Copy config file
  if (fs.existsSync(LEGACY_CONFIG)) {
    const cfg = JSON.parse(fs.readFileSync(LEGACY_CONFIG, 'utf8'));
    // Update workspace paths in config
    if (cfg.agents?.defaults?.workspace) {
      cfg.agents.defaults.workspace = cfg.agents.defaults.workspace.replace('/.openclaw/', '/.shellmate/');
    }
    if (cfg.agents?.list) {
      for (const agent of cfg.agents.list) {
        if (agent.workspace) {
          agent.workspace = agent.workspace.replace('/.openclaw/', '/.shellmate/');
        }
      }
    }
    writeConfig(cfg);
  }

  // Copy workspace directory if it exists
  const legacyWs = path.join(LEGACY_DIR, 'workspace');
  const newWs = path.join(CONFIG_DIR, 'workspace');
  if (fs.existsSync(legacyWs) && !fs.existsSync(newWs)) {
    copyDirSync(legacyWs, newWs);
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
