// server/tools/mac/finder.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_finder',
  description: 'Interact with Finder. Actions: open_folder, reveal_file, get_selection, get_desktop_items.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['open_folder', 'reveal_file', 'get_selection', 'get_desktop_items'] },
      path: { type: 'string', description: 'File or folder path' },
    },
    required: ['action'],
  },
};

export const tier = {
  get_selection: 'read',
  get_desktop_items: 'read',
  open_folder: 'action',
  reveal_file: 'action',
};

export async function execute(input) {
  switch (input.action) {
    case 'open_folder':      return openFolder(input);
    case 'reveal_file':      return revealFile(input);
    case 'get_selection':    return getSelection();
    case 'get_desktop_items': return getDesktopItems();
    default: return `Unknown action: ${input.action}`;
  }
}

async function openFolder({ path: folderPath }) {
  if (!folderPath) return 'Error: path is required.';
  return runAppleScript(`
    tell application "Finder"
      open POSIX file "${esc(folderPath)}"
      activate
    end tell
    return "Opened ${esc(folderPath)}"
  `.trim());
}

async function revealFile({ path: filePath }) {
  if (!filePath) return 'Error: path is required.';
  return runAppleScript(`
    tell application "Finder"
      reveal POSIX file "${esc(filePath)}"
      activate
    end tell
    return "Revealed ${esc(filePath)} in Finder"
  `.trim());
}

async function getSelection() {
  return runAppleScript(`
    tell application "Finder"
      set sel to selection
      if (count of sel) is 0 then return "Nothing selected in Finder."
      set output to ""
      repeat with f in sel
        set output to output & (POSIX path of (f as alias)) & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

async function getDesktopItems() {
  return runAppleScript(`
    tell application "Finder"
      set items_ to every item of desktop
      if (count of items_) is 0 then return "Desktop is empty."
      set output to ""
      repeat with f in items_
        set output to output & (name of f) & " (" & (kind of f) & ")" & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
