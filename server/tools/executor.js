/**
 * Server-side tool executors for Shellmate built-in tools.
 * Each function takes tool input and returns a string result.
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Sensitive paths that the AI should never access
const BLOCKED_PATHS = [
  '.ssh', '.gnupg', '.aws', '.config/gcloud', '.azure',
  '.npmrc', '.pypirc', '.docker', '.kube',
  'Library/Keychains',
];

function isPathBlocked(filePath) {
  const resolved = filePath.startsWith('~')
    ? path.join(os.homedir(), filePath.slice(1))
    : path.resolve(filePath);
  const home = os.homedir();

  // Block system directories
  if (resolved.startsWith('/etc/') || resolved.startsWith('/var/') ||
      resolved.startsWith('/System/') || resolved.startsWith('/Library/') ||
      resolved.startsWith('/usr/') || resolved.startsWith('/bin/') ||
      resolved.startsWith('/sbin/')) {
    return 'Access to system directories is not allowed';
  }

  // Block sensitive dotfiles/directories
  for (const blocked of BLOCKED_PATHS) {
    if (resolved.startsWith(path.join(home, blocked))) {
      return `Access to ~/${blocked} is not allowed for security`;
    }
  }

  return null;
}

function isUrlBlocked(urlStr) {
  try {
    const parsed = new URL(urlStr);
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Only http and https URLs are allowed';
    }
    const host = parsed.hostname;
    // Block localhost variants
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') {
      return 'Requests to localhost are not allowed';
    }
    // Block private IP ranges
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && !parts.some(isNaN)) {
      if (parts[0] === 10) return 'Requests to private networks are not allowed';
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return 'Requests to private networks are not allowed';
      if (parts[0] === 192 && parts[1] === 168) return 'Requests to private networks are not allowed';
      if (parts[0] === 169 && parts[1] === 254) return 'Requests to link-local addresses are not allowed';
    }
    return null;
  } catch {
    return 'Invalid URL';
  }
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_OUTPUT = 100_000; // truncate shell output at 100k chars

function truncate(str, max = MAX_OUTPUT) {
  if (str.length <= max) return str;
  return str.slice(0, max) + `\n...[truncated at ${max} chars]`;
}

export function shellExec({ command, cwd, timeout = 30000 }) {
  timeout = Math.min(Math.max(timeout || 30000, 1000), 60000);
  return new Promise((resolve) => {
    const opts = {
      cwd: cwd || os.homedir(),
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      shell: true,
    };
    exec(command, opts, (err, stdout, stderr) => {
      const parts = [];
      if (stdout) parts.push(truncate(stdout));
      if (stderr) parts.push(`STDERR:\n${truncate(stderr)}`);
      if (err && err.killed) parts.push(`[Process killed — timeout ${timeout}ms]`);
      else if (err && !stdout && !stderr) parts.push(`Error: ${err.message}`);
      resolve(parts.join('\n') || '(no output)');
    });
  });
}

export function fileRead({ path: filePath }) {
  try {
    const blocked = isPathBlocked(filePath);
    if (blocked) return blocked;
    const resolved = filePath.startsWith('~')
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;
    const stat = fs.statSync(resolved);
    if (stat.size > MAX_FILE_SIZE) {
      return `File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB.`;
    }
    return fs.readFileSync(resolved, 'utf8');
  } catch (err) {
    return `Error reading file: ${err.message}`;
  }
}

export function fileWrite({ path: filePath, content }) {
  try {
    const blocked = isPathBlocked(filePath);
    if (blocked) return blocked;
    const resolved = filePath.startsWith('~')
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    return `Written ${content.length} bytes to ${resolved}`;
  } catch (err) {
    return `Error writing file: ${err.message}`;
  }
}

export function fileList({ path: dirPath, recursive = false }) {
  try {
    const blocked = isPathBlocked(dirPath);
    if (blocked) return blocked;
    const resolved = dirPath.startsWith('~')
      ? path.join(os.homedir(), dirPath.slice(1))
      : dirPath;

    if (!fs.existsSync(resolved)) return `Directory not found: ${resolved}`;

    const entries = [];
    function walk(dir, depth) {
      if (depth > 3) return;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const rel = path.relative(resolved, path.join(dir, item.name));
        const suffix = item.isDirectory() ? '/' : '';
        entries.push(rel + suffix);
        if (recursive && item.isDirectory() && !item.name.startsWith('.')) {
          walk(path.join(dir, item.name), depth + 1);
        }
      }
    }
    walk(resolved, 0);
    return entries.join('\n') || '(empty directory)';
  } catch (err) {
    return `Error listing directory: ${err.message}`;
  }
}

export async function webSearch({ query, count = 5 }, braveApiKey) {
  if (!braveApiKey) return 'Web search not configured — no Brave API key found.';
  try {
    const params = new URLSearchParams({ q: query, count: Math.min(count, 20) });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: { 'X-Subscription-Token': braveApiKey, Accept: 'application/json' },
    });
    if (!res.ok) return `Search API error: ${res.status} ${res.statusText}`;
    const data = await res.json();
    const results = (data.web?.results || []).slice(0, count);
    if (results.length === 0) return 'No results found.';
    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description || ''}`
    ).join('\n\n');
  } catch (err) {
    return `Search error: ${err.message}`;
  }
}

export async function webFetch({ url }) {
  try {
    const blocked = isUrlBlocked(url);
    if (blocked) return blocked;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Shellmate/1.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return `Fetch error: ${res.status} ${res.statusText}`;
    const html = await res.text();
    // Strip HTML tags, scripts, styles — keep text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    return truncate(text, 50000);
  } catch (err) {
    if (err.name === 'AbortError') return 'Fetch timed out (15s limit).';
    return `Fetch error: ${err.message}`;
  }
}

/**
 * Execute a tool by name with given input. Returns string result.
 */
export async function executeTool(name, input, context = {}) {
  switch (name) {
    case 'shell_exec':  return shellExec(input);
    case 'file_read':   return fileRead(input);
    case 'file_write':  return fileWrite(input);
    case 'file_list':   return fileList(input);
    case 'web_search':  return webSearch(input, context.braveApiKey);
    case 'web_fetch':   return webFetch(input);
    default:            return `Unknown tool: ${name}`;
  }
}
