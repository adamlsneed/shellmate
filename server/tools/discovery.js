// server/tools/discovery.js
/**
 * CLI auto-discovery for Shellmate.
 * Scans for commonly useful CLI tools via `which`, caches results,
 * and registers lightweight wrapper tools with the registry.
 */

import { exec, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { registerTool, unregisterTool, addToDenyCategory } from './registry.js';

const CACHE_PATH = path.join(os.homedir(), '.shellmate', 'discovered-tools.json');
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * CLI tools to scan for. Each entry: { cmd, name?, description }
 * name defaults to cmd if not specified.
 */
const CLI_CANDIDATES = [
  { cmd: 'ffmpeg',       description: 'Video/audio processing' },
  { cmd: 'convert',      name: 'imagemagick', description: 'Image processing (ImageMagick)' },
  { cmd: 'pandoc',       description: 'Document format conversion' },
  { cmd: 'yt-dlp',       name: 'yt_dlp', description: 'Video/audio downloader' },
  { cmd: 'jq',           description: 'JSON processor' },
  { cmd: 'sqlite3',      description: 'SQLite database shell' },
  { cmd: 'python3',      description: 'Python 3 interpreter' },
  { cmd: 'node',         description: 'Node.js runtime' },
  { cmd: 'brew',         description: 'Homebrew package manager' },
  { cmd: 'git',          description: 'Version control' },
  { cmd: 'curl',         description: 'HTTP client' },
  { cmd: 'wget',         description: 'File downloader' },
  { cmd: 'rsync',        description: 'File synchronization' },
  { cmd: 'zip',          description: 'Create ZIP archives' },
  { cmd: 'unzip',        description: 'Extract ZIP archives' },
  { cmd: 'say',          description: 'Text-to-speech (macOS)' },
  { cmd: 'pbcopy',       description: 'Copy to clipboard (macOS)' },
  { cmd: 'pbpaste',      description: 'Paste from clipboard (macOS)' },
  { cmd: 'open',         description: 'Open files/URLs with default app (macOS)' },
  { cmd: 'defaults',     description: 'Read/write macOS preferences' },
  { cmd: 'diskutil',     description: 'Disk management (macOS)' },
  { cmd: 'caffeinate',   description: 'Prevent Mac from sleeping' },
  { cmd: 'sips',         description: 'Image processing (macOS built-in)' },
  { cmd: 'mdls',         description: 'Read file metadata (Spotlight)' },
  { cmd: 'mdfind',       description: 'Spotlight search from terminal' },
  { cmd: 'screencapture', description: 'Screen capture (macOS)' },
];

// Track registered CLI tool names for cleanup on rescan
const registeredCLINames = new Set();

/**
 * Parse a command-line string into an args array.
 * Respects single and double quotes.
 */
function parseArgs(str) {
  const args = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === ' ' && !inSingle && !inDouble) {
      if (current) { args.push(current); current = ''; }
      continue;
    }
    current += c;
  }
  if (current) args.push(current);
  return args;
}

/**
 * Check if a command exists using `which`.
 * Returns the path or null.
 */
function whichCmd(cmd) {
  return new Promise(resolve => {
    exec(`which ${cmd}`, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

/**
 * Read the discovery cache. Returns null if stale or missing.
 */
function readCache() {
  try {
    const stat = fs.statSync(CACHE_PATH);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Write the discovery cache.
 */
function writeCache(data) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

/**
 * Scan for CLI tools. Returns array of { name, cmd, path, description }.
 */
async function scanCLIs() {
  const found = [];
  const results = await Promise.all(
    CLI_CANDIDATES.map(async (c) => {
      const p = await whichCmd(c.cmd);
      return p ? { name: c.name || c.cmd, cmd: c.cmd, path: p, description: c.description } : null;
    })
  );
  for (const r of results) {
    if (r) found.push(r);
  }
  return found;
}

/**
 * Register a single discovered CLI as a tool.
 */
function registerCLI(cli) {
  const safeName = `cli_${cli.name.replace(/[^a-z0-9]/gi, '_')}`;
  const definition = {
    name: safeName,
    description: `Run ${cli.cmd}. ${cli.description}. Installed at ${cli.path}.`,
    input_schema: {
      type: 'object',
      properties: {
        args: { type: 'string', description: `Command-line arguments for ${cli.cmd}` },
      },
      required: ['args'],
    },
  };

  const executor = (input) => {
    return new Promise(resolve => {
      // Use execFile with args array to prevent command injection.
      // Split args on whitespace (respecting quoted strings).
      const args = parseArgs(input.args || '');
      execFile(cli.path, args, { timeout: 30000, maxBuffer: 5 * 1024 * 1024, cwd: os.homedir() }, (err, stdout, stderr) => {
        const parts = [];
        if (stdout) parts.push(stdout.slice(0, 50000));
        if (stderr) parts.push(`STDERR:\n${stderr.slice(0, 10000)}`);
        if (err && err.killed) parts.push('[Process killed — timeout 30s]');
        else if (err && !stdout && !stderr) parts.push(`Error: ${err.message}`);
        resolve(parts.join('\n') || '(no output)');
      });
    });
  };

  registerTool(definition, executor, { tier: 'action' });
  addToDenyCategory('exec', safeName);
  addToDenyCategory('cli', safeName);
  registeredCLINames.add(safeName);
}

/**
 * Discover and register CLI tools.
 * Uses cache if fresh, otherwise scans and caches.
 */
export async function discoverCLIs({ forceRescan = false } = {}) {
  let clis;

  if (!forceRescan) {
    const cached = readCache();
    if (cached) {
      clis = cached;
    }
  }

  if (!clis) {
    clis = await scanCLIs();
    writeCache(clis);
  }

  // Clean up stale CLI tools from previous registration
  for (const name of registeredCLINames) {
    unregisterTool(name);
  }
  registeredCLINames.clear();

  for (const cli of clis) {
    registerCLI(cli);
  }

  return clis;
}

/**
 * Force rescan — clears cache and re-discovers.
 */
export async function rescanCLIs() {
  return discoverCLIs({ forceRescan: true });
}

/**
 * Get the list of discovered CLIs (from cache, no re-scan).
 */
export function getDiscoveredCLIs() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return [];
  }
}
