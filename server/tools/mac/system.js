// server/tools/mac/system.js
import { exec } from 'child_process';
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_system',
  description: 'Mac system info and controls. Actions: battery_status, wifi_status, volume_control, screenshot, notification, dark_mode, disk_space.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['battery_status', 'wifi_status', 'volume_control', 'screenshot', 'notification', 'dark_mode', 'disk_space'] },
      level: { type: 'number', description: 'Volume level 0-100 (for volume_control)' },
      message: { type: 'string', description: 'Notification message' },
      title: { type: 'string', description: 'Notification title' },
      toggle: { type: 'string', enum: ['on', 'off', 'status'], description: 'Dark mode toggle (default: status)' },
    },
    required: ['action'],
  },
};

export const tier = {
  battery_status: 'read',
  wifi_status: 'read',
  disk_space: 'read',
  volume_control: 'action',
  screenshot: 'action',
  notification: 'action',
  dark_mode: 'action',
};

export async function execute(input) {
  switch (input.action) {
    case 'battery_status': return batteryStatus();
    case 'wifi_status':    return wifiStatus();
    case 'volume_control': return volumeControl(input);
    case 'screenshot':     return screenshot();
    case 'notification':   return notification(input);
    case 'dark_mode':      return darkMode(input);
    case 'disk_space':     return diskSpace();
    default: return `Unknown action: ${input.action}`;
  }
}

function batteryStatus() {
  return new Promise(resolve => {
    exec('pmset -g batt', (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      resolve(stdout.trim());
    });
  });
}

function wifiStatus() {
  return new Promise(resolve => {
    exec('/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I', (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      resolve(stdout.trim());
    });
  });
}

async function volumeControl({ level }) {
  if (level === undefined || level === null) {
    return runAppleScript('output volume of (get volume settings) & "% volume"');
  }
  const vol = Math.max(0, Math.min(100, Math.round(level)));
  return runAppleScript(`set volume output volume ${vol}
return "Volume set to ${vol}%"`);
}

function screenshot() {
  const path = `/tmp/shellmate-screenshot-${Date.now()}.png`;
  return new Promise(resolve => {
    exec(`screencapture -x ${path}`, (err) => {
      if (err) return resolve(`Error: ${err.message}`);
      resolve(`Screenshot saved to ${path}`);
    });
  });
}

async function notification({ message, title }) {
  if (!message) return 'Error: message is required.';
  const titlePart = title ? ` with title "${esc(title)}"` : '';
  return runAppleScript(`display notification "${esc(message)}"${titlePart}
return "Notification sent"`);
}

async function darkMode({ toggle = 'status' }) {
  if (toggle === 'status') {
    return runAppleScript('tell application "System Events" to tell appearance preferences to get dark mode');
  }
  const val = toggle === 'on' ? 'true' : 'false';
  return runAppleScript(`tell application "System Events" to tell appearance preferences to set dark mode to ${val}
return "Dark mode ${toggle}"`);
}

function diskSpace() {
  return new Promise(resolve => {
    exec('df -H / | tail -1', (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      const parts = stdout.trim().split(/\s+/);
      resolve(`Disk: ${parts[2]} used of ${parts[1]} (${parts[4]} full), ${parts[3]} available`);
    });
  });
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
