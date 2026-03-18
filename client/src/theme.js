import { create } from 'zustand';

// Human-readable tool descriptions (used by FriendlyToolStatus)
export const FRIENDLY_TOOL_NAMES = {
  shell_exec:  'Running a command',
  file_read:   'Reading a file',
  file_write:  'Saving a file',
  file_list:   'Looking at your files',
  web_search:  'Searching the web',
  web_fetch:   'Reading a webpage',
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
    default:           return 'Working on it...';
  }
}

function shortPath(p) {
  if (!p) return 'a file';
  const parts = p.split('/');
  return parts[parts.length - 1] || parts[parts.length - 2] || 'a file';
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
