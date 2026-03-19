// server/tools/mac/apps.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_apps',
  description: 'Manage Mac applications. Actions: open_app, quit_app, list_running, frontmost_app.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['open_app', 'quit_app', 'list_running', 'frontmost_app'] },
      name: { type: 'string', description: 'Application name' },
    },
    required: ['action'],
  },
};

export const tier = {
  list_running: 'read',
  frontmost_app: 'read',
  open_app: 'action',
  quit_app: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'open_app':     return openApp(input);
    case 'quit_app':     return quitApp(input);
    case 'list_running': return listRunning();
    case 'frontmost_app': return frontmostApp();
    default: return `Unknown action: ${input.action}`;
  }
}

async function openApp({ name }) {
  if (!name) return 'Error: app name is required.';
  return runAppleScript(`
    tell application "${esc(name)}" to activate
    return "Opened ${esc(name)}"
  `.trim());
}

async function quitApp({ name }) {
  if (!name) return 'Error: app name is required.';
  return runAppleScript(`
    tell application "${esc(name)}" to quit
    return "Quit ${esc(name)}"
  `.trim());
}

async function listRunning() {
  return runAppleScript(`
    tell application "System Events"
      set appNames to name of every process whose background only is false
      set output to ""
      repeat with n in appNames
        set output to output & n & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

async function frontmostApp() {
  return runAppleScript(`
    tell application "System Events"
      set frontApp to name of first process whose frontmost is true
      return frontApp
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
