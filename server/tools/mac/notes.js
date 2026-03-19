// server/tools/mac/notes.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_notes',
  description: 'Interact with Apple Notes. Actions: list_notes, create_note, search_notes, read_note.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list_notes', 'create_note', 'search_notes', 'read_note'] },
      folder: { type: 'string', description: 'Folder name (default: Notes)' },
      title: { type: 'string', description: 'Note title' },
      body: { type: 'string', description: 'Note body content' },
      query: { type: 'string', description: 'Search query' },
    },
    required: ['action'],
  },
};

export const tier = {
  list_notes: 'read',
  search_notes: 'read',
  read_note: 'read',
  create_note: 'action',
};

export async function execute(input) {
  switch (input.action) {
    case 'list_notes':   return listNotes(input);
    case 'create_note':  return createNote(input);
    case 'search_notes': return searchNotes(input);
    case 'read_note':    return readNote(input);
    default: return `Unknown action: ${input.action}`;
  }
}

async function listNotes({ folder }) {
  const folderClause = folder ? `of folder "${esc(folder)}"` : '';
  return runAppleScript(`
    tell application "Notes"
      set notesList to every note ${folderClause}
      if (count of notesList) is 0 then return "No notes found."
      set output to ""
      set maxNotes to 20
      set i to 0
      repeat with n in notesList
        set i to i + 1
        if i > maxNotes then exit repeat
        set output to output & (name of n) & " — " & (modification date of n as string) & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

async function createNote({ title, body, folder }) {
  if (!title && !body) return 'Error: title or body is required.';
  const noteTitle = title || 'Untitled';
  const noteBody = body || '';
  const folderClause = folder ? `in folder "${esc(folder)}"` : '';
  return runAppleScript(`
    tell application "Notes"
      make new note ${folderClause} with properties {name:"${esc(noteTitle)}", body:"${esc(noteBody)}"}
      return "Created note \\"${esc(noteTitle)}\\""
    end tell
  `.trim());
}

async function searchNotes({ query }) {
  if (!query) return 'Error: query is required.';
  return runAppleScript(`
    tell application "Notes"
      set matches to (every note whose name contains "${esc(query)}")
      if (count of matches) is 0 then return "No notes matching \\"${esc(query)}\\"."
      set output to ""
      repeat with n in matches
        set output to output & (name of n) & " — " & (modification date of n as string) & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

async function readNote({ title }) {
  if (!title) return 'Error: title is required.';
  return runAppleScript(`
    tell application "Notes"
      set matches to (every note whose name is "${esc(title)}")
      if (count of matches) is 0 then return "No note named \\"${esc(title)}\\"."
      set n to item 1 of matches
      return "Title: " & (name of n) & linefeed & "Modified: " & (modification date of n as string) & linefeed & linefeed & (plaintext of n)
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
