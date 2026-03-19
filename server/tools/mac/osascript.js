// server/tools/mac/osascript.js
/**
 * Shared helper for running AppleScript and JXA.
 * Handles TCC permission errors, timeouts, and structured error messages.
 */

import { exec } from 'child_process';

const DEFAULT_TIMEOUT = 10000;

/**
 * Run an AppleScript string and return stdout.
 * Supports multi-line scripts via heredoc (piped to osascript stdin).
 * Normalizes errors into human-readable messages.
 */
export function runAppleScript(script, { timeout = DEFAULT_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    // Use heredoc to support multi-line scripts reliably
    const cmd = `osascript <<'APPLESCRIPT'\n${script}\nAPPLESCRIPT`;
    exec(cmd, { timeout, shell: '/bin/bash' }, (err, stdout, stderr) => {
      if (err) {
        resolve(normalizeError(err, stderr));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Run a JXA (JavaScript for Automation) script and return stdout.
 * Supports multi-line scripts via heredoc.
 */
export function runJXA(script, { timeout = DEFAULT_TIMEOUT } = {}) {
  return new Promise((resolve) => {
    const cmd = `osascript -l JavaScript <<'JXASCRIPT'\n${script}\nJXASCRIPT`;
    exec(cmd, { timeout, shell: '/bin/bash' }, (err, stdout, stderr) => {
      if (err) {
        resolve(normalizeError(err, stderr));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Normalize osascript errors into human-readable strings.
 */
function normalizeError(err, stderr = '') {
  const msg = (stderr || err.message || '').toLowerCase();

  // TCC permission denied
  if (msg.includes('-1743') || msg.includes('not allowed assistive access') ||
      msg.includes('not authorized') || msg.includes('is not allowed to send keystrokes') ||
      msg.includes('denied')) {
    const appMatch = msg.match(/application "([^"]+)"/i) || msg.match(/process "([^"]+)"/i);
    const app = appMatch ? appMatch[1] : 'this app';
    return `Shellmate needs permission to access ${app}. Open System Settings > Privacy & Security and allow Shellmate.`;
  }

  // App not running
  if (msg.includes('is not running') || msg.includes("application isn't running")) {
    const appMatch = msg.match(/application "([^"]+)"/i);
    const app = appMatch ? appMatch[1] : 'The app';
    return `${app} is not open. Would you like me to open it first?`;
  }

  // App not found
  if (msg.includes("can't get application") || msg.includes('not found')) {
    return 'App not found on this Mac.';
  }

  // Timeout
  if (err.killed) {
    return `Request took too long (${DEFAULT_TIMEOUT / 1000}s). The app may be unresponsive.`;
  }

  // Generic — clean up the osascript noise
  const cleaned = (stderr || err.message || 'Unknown error')
    .replace(/osascript:.*?:\d+:\d+:\s*/g, '')
    .replace(/execution error:?\s*/gi, '')
    .trim();
  return `Error: ${cleaned}`;
}
