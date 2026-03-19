import { create } from 'zustand';

// Human-readable tool descriptions (used by FriendlyToolStatus)
export const FRIENDLY_TOOL_NAMES = {
  shell_exec:    'Running a command',
  file_read:     'Reading a file',
  file_write:    'Saving a file',
  file_list:     'Looking at your files',
  web_search:    'Searching the web',
  web_fetch:     'Reading a webpage',
  mac_calendar:  'Checking your calendar',
  mac_reminders: 'Managing reminders',
  mac_contacts:  'Looking up contacts',
  mac_notes:     'Working with notes',
  mac_messages:  'Messaging',
  mac_mail:      'Checking email',
  mac_finder:    'Working with Finder',
  mac_system:    'Checking your Mac',
  mac_apps:      'Managing apps',
  mac_files:     'Organizing files',
};

// Friendly descriptions based on tool input
export function describeTool(name, input) {
  switch (name) {
    case 'shell_exec': {
      const cmd = input?.command || '';
      if (cmd.includes('osascript')) return 'Working with a Mac app...';
      if (cmd.includes('open '))     return 'Opening something for you...';
      if (cmd.includes('defaults'))  return 'Checking a setting...';
      if (cmd.includes('say '))      return 'Reading something aloud...';
      return 'Running a command on your Mac...';
    }
    case 'file_read':  return `Reading "${shortPath(input?.path)}"...`;
    case 'file_write': return `Saving "${shortPath(input?.path)}"...`;
    case 'file_list':  return `Looking through "${shortPath(input?.path)}"...`;
    case 'web_search': return `Searching for "${input?.query}"...`;
    case 'web_fetch':  return 'Reading a webpage...';
    case 'mac_calendar':  return describeAction(input, 'Checking your calendar');
    case 'mac_reminders': return describeAction(input, 'Managing your reminders');
    case 'mac_contacts':  return describeAction(input, 'Looking up contacts');
    case 'mac_notes':     return describeAction(input, 'Working with Notes');
    case 'mac_messages':  return input?.action === 'send_message' ? 'Sending a message...' : 'Reading messages...';
    case 'mac_mail':      return describeAction(input, 'Checking your email');
    case 'mac_finder':    return describeAction(input, 'Working with Finder');
    case 'mac_system': {
      const actions = { battery_status: 'Checking battery...', wifi_status: 'Checking Wi-Fi...', volume_control: 'Adjusting volume...', screenshot: 'Taking a screenshot...', notification: 'Sending a notification...', dark_mode: 'Checking dark mode...', disk_space: 'Checking disk space...' };
      return actions[input?.action] || 'Checking your Mac...';
    }
    case 'mac_apps':      return describeAction(input, 'Managing apps');
    case 'mac_files':     return describeAction(input, 'Organizing your files');
    default:              return 'Working on it...';
  }
}

function shortPath(p) {
  if (!p) return 'a file';
  const parts = p.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || 'a file';
}

function describeAction(input, fallback) {
  if (!input?.action) return fallback + '...';
  const action = input.action.replace(/_/g, ' ');
  return action.charAt(0).toUpperCase() + action.slice(1) + '...';
}

// Theme mode store (persisted to localStorage)
const THEME_KEY = 'shellmate-theme';

function safeGetTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
}

export const useThemeStore = create((set) => ({
  mode: safeGetTheme(),
  setMode: (mode) => {
    localStorage.setItem(THEME_KEY, mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
    set({ mode });
  },
  toggle: () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    set({ mode: next });
  },
}));

// Initialize theme on import
const saved = safeGetTheme();
document.documentElement.classList.toggle('dark', saved === 'dark');
