import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_PATH = path.join(os.homedir(), '.openclaw', 'openclaw.json');

export function backupTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function readOpenClawConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch { return {}; }
}

export function writeOpenClawConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

export function backupConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const ts = backupTimestamp();
    fs.copyFileSync(CONFIG_PATH, `${CONFIG_PATH}.bak-${ts}`);
  }
}
