# Plan 3: Mac-Native Tools

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 Mac-native tool modules that interact with macOS apps via AppleScript/JXA, register them with the dynamic tool registry, update the deny map, and add friendly UI descriptions.

**Architecture:** Each Mac tool is a self-contained module in `server/tools/mac/` that exports a tool definition + executor. All use a shared `osascript.js` helper for running AppleScript with structured error handling. An `index.js` loader registers all tools with the registry on startup. Each tool uses an action-dispatch pattern — one tool name with an `action` enum parameter.

**Tech Stack:** Node.js ESM, AppleScript via `osascript` CLI, child_process.exec

**Spec:** `docs/superpowers/specs/2026-03-19-mac-native-tools-design.md` (section 2)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `server/tools/mac/osascript.js` | Create | Shared AppleScript/JXA runner with TCC error detection, timeout, structured error handling |
| `server/tools/mac/calendar.js` | Create | Apple Calendar: list/create/delete/search events |
| `server/tools/mac/reminders.js` | Create | Apple Reminders: list/create/complete/delete |
| `server/tools/mac/contacts.js` | Create | Apple Contacts: search/get/list groups |
| `server/tools/mac/notes.js` | Create | Apple Notes: list/create/search/read |
| `server/tools/mac/messages.js` | Create | iMessage: send/read recent |
| `server/tools/mac/mail.js` | Create | Apple Mail: list inbox/search/compose draft/read |
| `server/tools/mac/finder.js` | Create | Finder: open folder/reveal/get selection/desktop items |
| `server/tools/mac/system.js` | Create | System: battery/wifi/volume/screenshot/notification/dark mode/disk space |
| `server/tools/mac/apps.js` | Create | Apps: open/quit/list running/frontmost |
| `server/tools/mac/files.js` | Create | File organization: organize/duplicates/categorize/stats/move/rename/large files |
| `server/tools/mac/index.js` | Create | Loads and registers all Mac tools with the registry + deny map |
| `server/index.js` | Modify | Import and call `registerMacTools()` on startup |
| `client/src/theme.js` | Modify | Add friendly descriptions for all Mac tools |

---

## Task 1: Create the osascript Helper

**Files:**
- Create: `server/tools/mac/osascript.js`

- [ ] **Step 1: Create the shared AppleScript runner**

```js
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
    // Try to extract the app name
    const appMatch = msg.match(/application "([^"]+)"/i) || msg.match(/process "([^"]+)"/i);
    const app = appMatch ? appMatch[1] : 'this app';
    return `Shellmate needs permission to access ${app}. Open System Settings > Privacy & Security and allow Shellmate.`;
  }

  // App not running
  if (msg.includes('is not running') || msg.includes('application isn\'t running')) {
    const appMatch = msg.match(/application "([^"]+)"/i);
    const app = appMatch ? appMatch[1] : 'The app';
    return `${app} is not open. Would you like me to open it first?`;
  }

  // App not found
  if (msg.includes('can\'t get application') || msg.includes('not found')) {
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
```

- [ ] **Step 2: Verify it works**

Run: `node -e "import('./server/tools/mac/osascript.js').then(async m => { const r = await m.runAppleScript('return \"hello\"'); console.log(r); })"`
Expected: `hello`

- [ ] **Step 3: Commit**

```bash
git add server/tools/mac/osascript.js
git commit -m "feat: add shared osascript helper with TCC error detection"
```

---

## Task 2: Calendar Tool

**Files:**
- Create: `server/tools/mac/calendar.js`

- [ ] **Step 1: Create the Calendar tool module**

```js
// server/tools/mac/calendar.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_calendar',
  description: 'Interact with Apple Calendar. Actions: list_events, create_event, delete_event, search_events.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list_events', 'create_event', 'delete_event', 'search_events'], description: 'The action to perform' },
      date: { type: 'string', description: 'Date in YYYY-MM-DD format (default: today)' },
      title: { type: 'string', description: 'Event title (for create/delete)' },
      time: { type: 'string', description: 'Start time in HH:MM format (for create)' },
      duration: { type: 'number', description: 'Duration in minutes (for create, default 60)' },
      calendar: { type: 'string', description: 'Calendar name (optional)' },
      query: { type: 'string', description: 'Search query (for search_events)' },
    },
    required: ['action'],
  },
};

export const tier = {
  list_events: 'read',
  search_events: 'read',
  create_event: 'action',
  delete_event: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'list_events':  return listEvents(input);
    case 'create_event': return createEvent(input);
    case 'delete_event': return deleteEvent(input);
    case 'search_events': return searchEvents(input);
    default: return `Unknown action: ${input.action}`;
  }
}

async function listEvents({ date }) {
  const d = date || new Date().toISOString().slice(0, 10);
  return runAppleScript(`
    set targetDate to date "${formatDateForAS(d)}"
    set endDate to targetDate + 1 * days
    set output to ""
    tell application "Calendar"
      repeat with cal in calendars
        set evts to (every event of cal whose start date >= targetDate and start date < endDate)
        repeat with e in evts
          set output to output & (start date of e as string) & " | " & (summary of e) & " | " & (name of cal) & linefeed
        end repeat
      end repeat
    end tell
    if output is "" then return "No events on ${d}."
    return output
  `.trim());
}

async function createEvent({ title, date, time, duration = 60, calendar }) {
  if (!title) return 'Error: title is required for create_event.';
  const d = date || new Date().toISOString().slice(0, 10);
  const t = time || '09:00';
  const calClause = calendar
    ? `set targetCal to calendar "${calendar}"`
    : 'set targetCal to first calendar';
  return runAppleScript(`
    tell application "Calendar"
      ${calClause}
      set startDate to date "${formatDateForAS(d)} ${t}"
      set endDate to startDate + ${duration} * minutes
      make new event at end of events of targetCal with properties {summary:"${escAS(title)}", start date:startDate, end date:endDate}
      return "Created event \\"${escAS(title)}\\" on ${d} at ${t} (${duration} min)"
    end tell
  `.trim());
}

async function deleteEvent({ title, date }) {
  if (!title) return 'Error: title is required for delete_event.';
  const d = date || new Date().toISOString().slice(0, 10);
  return runAppleScript(`
    set targetDate to date "${formatDateForAS(d)}"
    set endDate to targetDate + 1 * days
    set deleted to false
    tell application "Calendar"
      repeat with cal in calendars
        set evts to (every event of cal whose summary is "${escAS(title)}" and start date >= targetDate and start date < endDate)
        repeat with e in evts
          delete e
          set deleted to true
        end repeat
      end repeat
    end tell
    if deleted then return "Deleted event \\"${escAS(title)}\\" on ${d}."
    return "No event named \\"${escAS(title)}\\" found on ${d}."
  `.trim());
}

async function searchEvents({ query }) {
  if (!query) return 'Error: query is required for search_events.';
  return runAppleScript(`
    set output to ""
    tell application "Calendar"
      repeat with cal in calendars
        set evts to (every event of cal whose summary contains "${escAS(query)}")
        repeat with e in evts
          set output to output & (start date of e as string) & " | " & (summary of e) & " | " & (name of cal) & linefeed
        end repeat
      end repeat
    end tell
    if output is "" then return "No events matching \\"${escAS(query)}\\"."
    return output
  `.trim());
}

function formatDateForAS(isoDate) {
  // AppleScript expects "Month Day, Year" format
  const [y, m, d] = isoDate.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function escAS(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 2: Verify Calendar tool works**

Run: `node -e "import('./server/tools/mac/calendar.js').then(async m => { const r = await m.execute({ action: 'list_events' }); console.log(r.substring(0, 200)); })"`
Expected: Calendar events or "No events" message

- [ ] **Step 3: Commit**

```bash
git add server/tools/mac/calendar.js
git commit -m "feat: add mac_calendar tool — list, create, delete, search events"
```

---

## Task 3: Reminders Tool

**Files:**
- Create: `server/tools/mac/reminders.js`

- [ ] **Step 1: Create the Reminders tool module**

```js
// server/tools/mac/reminders.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_reminders',
  description: 'Interact with Apple Reminders. Actions: list_reminders, create_reminder, complete_reminder, delete_reminder.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list_reminders', 'create_reminder', 'complete_reminder', 'delete_reminder'] },
      list: { type: 'string', description: 'Reminder list name (default: Reminders)' },
      title: { type: 'string', description: 'Reminder title' },
      due_date: { type: 'string', description: 'Due date in YYYY-MM-DD format (optional)' },
      notes: { type: 'string', description: 'Reminder notes (optional)' },
      show_completed: { type: 'boolean', description: 'Include completed reminders (default false)' },
    },
    required: ['action'],
  },
};

export const tier = {
  list_reminders: 'read',
  create_reminder: 'action',
  complete_reminder: 'action',
  delete_reminder: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'list_reminders':    return listReminders(input);
    case 'create_reminder':   return createReminder(input);
    case 'complete_reminder': return completeReminder(input);
    case 'delete_reminder':   return deleteReminder(input);
    default: return `Unknown action: ${input.action}`;
  }
}

async function listReminders({ list, show_completed = false }) {
  const listName = list || 'Reminders';
  const filter = show_completed ? '' : 'whose completed is false';
  return runAppleScript(`
    tell application "Reminders"
      set output to ""
      try
        set targetList to list "${esc(listName)}"
        set rems to (every reminder of targetList ${filter})
        repeat with r in rems
          set dueStr to ""
          try
            set dueStr to " (due: " & (due date of r as string) & ")"
          end try
          set output to output & (name of r) & dueStr & linefeed
        end repeat
      on error
        return "List \\"${esc(listName)}\\" not found. Available lists: " & (name of every list as string)
      end try
      if output is "" then return "No reminders in \\"${esc(listName)}\\"."
      return output
    end tell
  `.trim());
}

async function createReminder({ title, list, due_date, notes }) {
  if (!title) return 'Error: title is required.';
  const listName = list || 'Reminders';
  const dueLine = due_date ? `set due date of newRem to date "${formatDate(due_date)}"` : '';
  const notesLine = notes ? `set body of newRem to "${esc(notes)}"` : '';
  return runAppleScript(`
    tell application "Reminders"
      try
        set targetList to list "${esc(listName)}"
      on error
        set targetList to default list
      end try
      set newRem to make new reminder at end of reminders of targetList with properties {name:"${esc(title)}"}
      ${dueLine}
      ${notesLine}
      return "Created reminder \\"${esc(title)}\\" in ${esc(listName)}"
    end tell
  `.trim());
}

async function completeReminder({ title, list }) {
  if (!title) return 'Error: title is required.';
  const listName = list || 'Reminders';
  return runAppleScript(`
    tell application "Reminders"
      try
        set targetList to list "${esc(listName)}"
        set rems to (every reminder of targetList whose name is "${esc(title)}" and completed is false)
        if (count of rems) > 0 then
          set completed of item 1 of rems to true
          return "Completed \\"${esc(title)}\\""
        else
          return "No incomplete reminder named \\"${esc(title)}\\" found."
        end if
      on error errMsg
        return "Error: " & errMsg
      end try
    end tell
  `.trim());
}

async function deleteReminder({ title, list }) {
  if (!title) return 'Error: title is required.';
  const listName = list || 'Reminders';
  return runAppleScript(`
    tell application "Reminders"
      try
        set targetList to list "${esc(listName)}"
        set rems to (every reminder of targetList whose name is "${esc(title)}")
        if (count of rems) > 0 then
          delete item 1 of rems
          return "Deleted \\"${esc(title)}\\""
        else
          return "No reminder named \\"${esc(title)}\\" found."
        end if
      on error errMsg
        return "Error: " & errMsg
      end try
    end tell
  `.trim());
}

function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 2: Verify**

Run: `node -e "import('./server/tools/mac/reminders.js').then(async m => { const r = await m.execute({ action: 'list_reminders' }); console.log(r.substring(0, 200)); })"`

- [ ] **Step 3: Commit**

```bash
git add server/tools/mac/reminders.js
git commit -m "feat: add mac_reminders tool — list, create, complete, delete"
```

---

## Task 4: Contacts, Notes, Messages, Mail Tools (batch)

**Files:**
- Create: `server/tools/mac/contacts.js`
- Create: `server/tools/mac/notes.js`
- Create: `server/tools/mac/messages.js`
- Create: `server/tools/mac/mail.js`

- [ ] **Step 1: Create contacts.js**

```js
// server/tools/mac/contacts.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_contacts',
  description: 'Search and read Apple Contacts. Actions: search_contacts, get_contact, list_groups.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['search_contacts', 'get_contact', 'list_groups'] },
      query: { type: 'string', description: 'Search query (name, email, phone)' },
      name: { type: 'string', description: 'Full name for get_contact' },
    },
    required: ['action'],
  },
};

export const tier = 'read';

export async function execute(input) {
  switch (input.action) {
    case 'search_contacts': return searchContacts(input);
    case 'get_contact':     return getContact(input);
    case 'list_groups':     return listGroups();
    default: return `Unknown action: ${input.action}`;
  }
}

async function searchContacts({ query }) {
  if (!query) return 'Error: query is required.';
  return runAppleScript(`
    tell application "Contacts"
      set matches to (every person whose name contains "${esc(query)}")
      if (count of matches) is 0 then return "No contacts matching \\"${esc(query)}\\"."
      set output to ""
      repeat with p in matches
        set output to output & (name of p)
        try
          set output to output & " — " & (value of first email of p)
        end try
        try
          set output to output & " — " & (value of first phone of p)
        end try
        set output to output & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

async function getContact({ name }) {
  if (!name) return 'Error: name is required.';
  return runAppleScript(`
    tell application "Contacts"
      set matches to (every person whose name is "${esc(name)}")
      if (count of matches) is 0 then return "No contact named \\"${esc(name)}\\"."
      set p to item 1 of matches
      set output to "Name: " & (name of p) & linefeed
      try
        repeat with e in emails of p
          set output to output & "Email: " & (value of e) & " (" & (label of e) & ")" & linefeed
        end repeat
      end try
      try
        repeat with ph in phones of p
          set output to output & "Phone: " & (value of ph) & " (" & (label of ph) & ")" & linefeed
        end repeat
      end try
      try
        set addr to first address of p
        set output to output & "Address: " & (formatted address of addr) & linefeed
      end try
      try
        set output to output & "Birthday: " & (birth date of p as string) & linefeed
      end try
      try
        set output to output & "Notes: " & (note of p) & linefeed
      end try
      return output
    end tell
  `.trim());
}

async function listGroups() {
  return runAppleScript(`
    tell application "Contacts"
      if (count of groups) is 0 then return "No contact groups."
      set output to ""
      repeat with g in groups
        set output to output & (name of g) & " (" & (count of people of g) & " contacts)" & linefeed
      end repeat
      return output
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 2: Create notes.js**

```js
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
```

- [ ] **Step 3: Create messages.js**

```js
// server/tools/mac/messages.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_messages',
  description: 'Send and read iMessages. Actions: send_message, read_recent.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['send_message', 'read_recent'] },
      to: { type: 'string', description: 'Recipient phone number or email (for send)' },
      text: { type: 'string', description: 'Message text (for send)' },
      count: { type: 'number', description: 'Number of recent messages to read (default 10)' },
    },
    required: ['action'],
  },
};

export const tier = {
  read_recent: 'read',
  send_message: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'send_message': return sendMessage(input);
    case 'read_recent':  return readRecent(input);
    default: return `Unknown action: ${input.action}`;
  }
}

async function sendMessage({ to, text }) {
  if (!to) return 'Error: "to" (phone number or email) is required.';
  if (!text) return 'Error: "text" is required.';
  return runAppleScript(`
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${esc(to)}" of targetService
      send "${esc(text)}" to targetBuddy
      return "Message sent to ${esc(to)}"
    end tell
  `.trim());
}

async function readRecent({ count = 10 }) {
  return runAppleScript(`
    tell application "Messages"
      set output to ""
      set chatList to every chat
      set msgCount to 0
      repeat with c in chatList
        if msgCount >= ${count} then exit repeat
        repeat with m in (messages of c)
          if msgCount >= ${count} then exit repeat
          set sender to ""
          try
            set sender to handle of sender of m
          end try
          set output to output & (date sent of m as string) & " | " & sender & " | " & (text of m) & linefeed
          set msgCount to msgCount + 1
        end repeat
      end repeat
      if output is "" then return "No recent messages found."
      return output
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 4: Create mail.js**

```js
// server/tools/mac/mail.js
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_mail',
  description: 'Interact with Apple Mail. Actions: list_inbox, search_mail, compose_draft, read_message.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list_inbox', 'search_mail', 'compose_draft', 'read_message'] },
      count: { type: 'number', description: 'Number of messages (default 10)' },
      query: { type: 'string', description: 'Search query' },
      to: { type: 'string', description: 'Recipient email (for compose)' },
      subject: { type: 'string', description: 'Email subject (for compose or read)' },
      body: { type: 'string', description: 'Email body (for compose)' },
    },
    required: ['action'],
  },
};

export const tier = {
  list_inbox: 'read',
  search_mail: 'read',
  read_message: 'read',
  compose_draft: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'list_inbox':    return listInbox(input);
    case 'search_mail':   return searchMail(input);
    case 'compose_draft': return composeDraft(input);
    case 'read_message':  return readMessage(input);
    default: return `Unknown action: ${input.action}`;
  }
}

async function listInbox({ count = 10 }) {
  return runAppleScript(`
    tell application "Mail"
      set inbox to mailbox "INBOX" of account 1
      set msgs to messages 1 thru ${Math.min(count, 50)} of inbox
      set output to ""
      repeat with m in msgs
        set output to output & (date received of m as string) & " | " & (sender of m) & " | " & (subject of m) & linefeed
      end repeat
      if output is "" then return "Inbox is empty."
      return output
    end tell
  `.trim());
}

async function searchMail({ query, count = 10 }) {
  if (!query) return 'Error: query is required.';
  return runAppleScript(`
    tell application "Mail"
      set output to ""
      set msgCount to 0
      repeat with acct in accounts
        repeat with mbox in mailboxes of acct
          set matches to (messages of mbox whose subject contains "${esc(query)}")
          repeat with m in matches
            if msgCount >= ${count} then exit repeat
            set output to output & (date received of m as string) & " | " & (sender of m) & " | " & (subject of m) & linefeed
            set msgCount to msgCount + 1
          end repeat
          if msgCount >= ${count} then exit repeat
        end repeat
        if msgCount >= ${count} then exit repeat
      end repeat
      if output is "" then return "No emails matching \\"${esc(query)}\\"."
      return output
    end tell
  `.trim());
}

async function composeDraft({ to, subject, body }) {
  if (!to) return 'Error: "to" email address is required.';
  return runAppleScript(`
    tell application "Mail"
      set newMsg to make new outgoing message with properties {subject:"${esc(subject || '')}", content:"${esc(body || '')}"}
      make new to recipient at end of to recipients of newMsg with properties {address:"${esc(to)}"}
      return "Draft created to ${esc(to)} with subject \\"${esc(subject || '(no subject)')}\\"."
    end tell
  `.trim());
}

async function readMessage({ subject }) {
  if (!subject) return 'Error: subject is required.';
  return runAppleScript(`
    tell application "Mail"
      set output to ""
      repeat with acct in accounts
        repeat with mbox in mailboxes of acct
          set matches to (messages of mbox whose subject contains "${esc(subject)}")
          if (count of matches) > 0 then
            set m to item 1 of matches
            set output to "From: " & (sender of m) & linefeed & "Date: " & (date received of m as string) & linefeed & "Subject: " & (subject of m) & linefeed & linefeed & (content of m)
            return output
          end if
        end repeat
      end repeat
      return "No email with subject containing \\"${esc(subject)}\\"."
    end tell
  `.trim());
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

- [ ] **Step 5: Commit all four**

```bash
git add server/tools/mac/contacts.js server/tools/mac/notes.js server/tools/mac/messages.js server/tools/mac/mail.js
git commit -m "feat: add mac_contacts, mac_notes, mac_messages, mac_mail tools"
```

---

## Task 5: Finder, System, Apps Tools (batch)

**Files:**
- Create: `server/tools/mac/finder.js`
- Create: `server/tools/mac/system.js`
- Create: `server/tools/mac/apps.js`

- [ ] **Step 1: Create finder.js**

```js
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
```

- [ ] **Step 2: Create system.js**

```js
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
```

- [ ] **Step 3: Create apps.js**

```js
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
```

- [ ] **Step 4: Commit all three**

```bash
git add server/tools/mac/finder.js server/tools/mac/system.js server/tools/mac/apps.js
git commit -m "feat: add mac_finder, mac_system, mac_apps tools"
```

---

## Task 6: File Organization Tool

**Files:**
- Create: `server/tools/mac/files.js`

- [ ] **Step 1: Create files.js**

```js
// server/tools/mac/files.js
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAppleScript } from './osascript.js';

export const definition = {
  name: 'mac_files',
  description: 'Organize and analyze files. Actions: folder_stats, find_large_files, categorize_files, find_duplicates, organize_folder, move_files, bulk_rename, empty_trash.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['folder_stats', 'find_large_files', 'categorize_files', 'find_duplicates', 'organize_folder', 'move_files', 'bulk_rename', 'empty_trash'] },
      path: { type: 'string', description: 'Target folder path' },
      destination: { type: 'string', description: 'Destination folder (for move_files)' },
      pattern: { type: 'string', description: 'Glob or rename pattern' },
      min_size_mb: { type: 'number', description: 'Minimum size in MB (for find_large_files, default 100)' },
      organize_by: { type: 'string', enum: ['type', 'date'], description: 'How to organize (for organize_folder, default type)' },
    },
    required: ['action'],
  },
};

export const tier = {
  folder_stats: 'read',
  find_large_files: 'read',
  categorize_files: 'read',
  find_duplicates: 'read',
  organize_folder: 'action',
  move_files: 'action',
  bulk_rename: 'action',
  empty_trash: 'destructive',
};

export async function execute(input) {
  switch (input.action) {
    case 'folder_stats':     return folderStats(input);
    case 'find_large_files': return findLargeFiles(input);
    case 'categorize_files': return categorizeFiles(input);
    case 'find_duplicates':  return findDuplicates(input);
    case 'organize_folder':  return organizeFolder(input);
    case 'move_files':       return moveFiles(input);
    case 'bulk_rename':      return bulkRename(input);
    case 'empty_trash':      return emptyTrash();
    default: return `Unknown action: ${input.action}`;
  }
}

function resolvePath(p) {
  return p?.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : (p || os.homedir());
}

async function folderStats({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  return new Promise(resolve => {
    exec(`find "${dir}" -maxdepth 1 -type f | wc -l && du -sh "${dir}" 2>/dev/null | cut -f1`, { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      const lines = stdout.trim().split('\n');
      resolve(`Folder: ${dir}\nFiles: ${lines[0]?.trim() || '?'}\nSize: ${lines[1]?.trim() || '?'}`);
    });
  });
}

async function findLargeFiles({ path: dirPath, min_size_mb = 100 }) {
  const dir = resolvePath(dirPath);
  return new Promise(resolve => {
    exec(`find "${dir}" -type f -size +${min_size_mb}M -exec ls -lh {} \\; 2>/dev/null | sort -rk5 | head -20`, { timeout: 30000 }, (err, stdout) => {
      if (err) return resolve(`Error: ${err.message}`);
      if (!stdout.trim()) return resolve(`No files larger than ${min_size_mb}MB in ${dir}.`);
      resolve(`Files larger than ${min_size_mb}MB:\n${stdout.trim()}`);
    });
  });
}

async function categorizeFiles({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    const cats = {};
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase() || '(no extension)';
      if (!cats[ext]) cats[ext] = [];
      cats[ext].push(f.name);
    }
    const lines = Object.entries(cats)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([ext, names]) => `${ext}: ${names.length} files`);
    return `File types in ${dir}:\n${lines.join('\n')}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function findDuplicates({ path: dirPath }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    const sizeMap = {};
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f.name));
      const key = stat.size;
      if (!sizeMap[key]) sizeMap[key] = [];
      sizeMap[key].push(f.name);
    }
    const dupes = Object.entries(sizeMap)
      .filter(([, names]) => names.length > 1)
      .map(([size, names]) => `${names.join(', ')} (${formatSize(parseInt(size))})`);
    if (dupes.length === 0) return `No potential duplicates found in ${dir}.`;
    return `Potential duplicates (same size):\n${dupes.join('\n')}`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function organizeFolder({ path: dirPath, organize_by = 'type' }) {
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile());
    let moved = 0;
    for (const f of files) {
      const ext = path.extname(f.name).slice(1).toLowerCase() || 'other';
      let targetDir;
      if (organize_by === 'date') {
        const stat = fs.statSync(path.join(dir, f.name));
        const d = stat.mtime;
        targetDir = path.join(dir, `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
      } else {
        targetDir = path.join(dir, getCategoryForExt(ext));
      }
      fs.mkdirSync(targetDir, { recursive: true });
      fs.renameSync(path.join(dir, f.name), path.join(targetDir, f.name));
      moved++;
    }
    return `Organized ${moved} files in ${dir} by ${organize_by}.`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function moveFiles({ path: srcPath, destination }) {
  if (!srcPath || !destination) return 'Error: path and destination are required.';
  const src = resolvePath(srcPath);
  const dest = resolvePath(destination);
  return new Promise(resolve => {
    fs.mkdirSync(dest, { recursive: true });
    exec(`mv "${src}" "${dest}/"`, (err) => {
      if (err) return resolve(`Error: ${err.message}`);
      resolve(`Moved ${src} to ${dest}/`);
    });
  });
}

async function bulkRename({ path: dirPath, pattern }) {
  if (!pattern) return 'Error: pattern is required (e.g., "photo_{n}" to rename as photo_1, photo_2, ...).';
  const dir = resolvePath(dirPath);
  try {
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile()).sort((a, b) => a.name.localeCompare(b.name));
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      const ext = path.extname(files[i].name);
      const newName = pattern.replace('{n}', i + 1).replace('{name}', path.basename(files[i].name, ext)) + ext;
      fs.renameSync(path.join(dir, files[i].name), path.join(dir, newName));
      count++;
    }
    return `Renamed ${count} files with pattern "${pattern}".`;
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

async function emptyTrash() {
  return runAppleScript(`
    tell application "Finder"
      set trashCount to count of items of trash
      if trashCount is 0 then return "Trash is already empty."
      empty the trash
      return "Emptied " & trashCount & " items from Trash."
    end tell
  `.trim());
}

function getCategoryForExt(ext) {
  const map = {
    images: ['jpg','jpeg','png','gif','bmp','svg','webp','heic','tiff','ico'],
    documents: ['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','rtf','csv','pages','numbers','key'],
    videos: ['mp4','mov','avi','mkv','wmv','flv','webm','m4v'],
    audio: ['mp3','wav','aac','flac','ogg','m4a','wma','aiff'],
    archives: ['zip','tar','gz','rar','7z','dmg','iso'],
    code: ['js','ts','py','rb','go','rs','java','c','cpp','h','css','html','json','xml','yaml','yml','md','sh'],
  };
  for (const [cat, exts] of Object.entries(map)) {
    if (exts.includes(ext)) return cat;
  }
  return 'other';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}
```

- [ ] **Step 2: Commit**

```bash
git add server/tools/mac/files.js
git commit -m "feat: add mac_files tool — organize, analyze, move, rename files"
```

---

## Task 7: Mac Tools Loader + Registry Integration

**Files:**
- Create: `server/tools/mac/index.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create mac/index.js that registers all tools**

```js
// server/tools/mac/index.js
/**
 * Loads and registers all Mac-native tools with the dynamic registry.
 */

import { registerTool, addToDenyCategory } from '../registry.js';

import * as calendar from './calendar.js';
import * as reminders from './reminders.js';
import * as contacts from './contacts.js';
import * as notes from './notes.js';
import * as messages from './messages.js';
import * as mail from './mail.js';
import * as finder from './finder.js';
import * as system from './system.js';
import * as apps from './apps.js';
import * as files from './files.js';

const MAC_TOOLS = [calendar, reminders, contacts, notes, messages, mail, finder, system, apps, files];

// All Mac tool names for the 'mac' deny category
const MAC_TOOL_NAMES = MAC_TOOLS.map(t => t.definition.name);

export function registerMacTools() {
  for (const tool of MAC_TOOLS) {
    registerTool(tool.definition, tool.execute, { tier: tool.tier });
  }

  // Add all Mac tools to the 'mac' deny category
  for (const name of MAC_TOOL_NAMES) {
    addToDenyCategory('mac', name);
  }

  // Add granular deny categories
  addToDenyCategory('calendar', 'mac_calendar');
  addToDenyCategory('reminders', 'mac_reminders');
  addToDenyCategory('contacts', 'mac_contacts');
  addToDenyCategory('notes', 'mac_notes');
  addToDenyCategory('messages', 'mac_messages');
  addToDenyCategory('mail', 'mac_mail');
  addToDenyCategory('files', 'mac_files');
}
```

- [ ] **Step 2: Update server/index.js to register Mac tools on startup**

In `server/index.js`, add import after the builtins import (after line 16):
```js
import { registerMacTools } from './tools/mac/index.js';
```

And add after the `registerBuiltins();` call (after line 22):
```js
  registerMacTools();
```

- [ ] **Step 3: Verify all tools are registered**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const tools = getToolsForAgent({}); console.log(tools.length + ' tools:', tools.map(t => t.name).join(', ')); })"`
Expected: `16 tools: shell_exec, file_read, file_write, file_list, web_search, web_fetch, mac_calendar, mac_reminders, mac_contacts, mac_notes, mac_messages, mac_mail, mac_finder, mac_system, mac_apps, mac_files`

- [ ] **Step 4: Commit**

```bash
git add server/tools/mac/index.js server/index.js
git commit -m "feat: register all Mac-native tools with registry and deny map"
```

---

## Task 8: Friendly Tool Descriptions in UI

**Files:**
- Modify: `client/src/theme.js`

- [ ] **Step 1: Update FRIENDLY_TOOL_NAMES and describeTool**

In `client/src/theme.js`, replace the `FRIENDLY_TOOL_NAMES` object (lines 4-11):
```js
export const FRIENDLY_TOOL_NAMES = {
  shell_exec:  'Running a command',
  file_read:   'Reading a file',
  file_write:  'Saving a file',
  file_list:   'Looking at your files',
  web_search:  'Searching the web',
  web_fetch:   'Reading a webpage',
};
```
with:
```js
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
```

Then update the `describeTool` function to add Mac tool cases. Replace the `default` case at line 29:
```js
    default:           return 'Working on it...';
```
with:
```js
    case 'mac_calendar':  return describeAction(input, 'Checking your calendar');
    case 'mac_reminders': return describeAction(input, 'Managing your reminders');
    case 'mac_contacts':  return describeAction(input, 'Looking up contacts');
    case 'mac_notes':     return describeAction(input, 'Working with Notes');
    case 'mac_messages':  return input?.action === 'send_message' ? `Sending a message...` : 'Reading messages...';
    case 'mac_mail':      return describeAction(input, 'Checking your email');
    case 'mac_finder':    return describeAction(input, 'Working with Finder');
    case 'mac_system': {
      const actions = { battery_status: 'Checking battery...', wifi_status: 'Checking Wi-Fi...', volume_control: 'Adjusting volume...', screenshot: 'Taking a screenshot...', notification: 'Sending a notification...', dark_mode: 'Checking dark mode...', disk_space: 'Checking disk space...' };
      return actions[input?.action] || 'Checking your Mac...';
    }
    case 'mac_apps':      return describeAction(input, 'Managing apps');
    case 'mac_files':     return describeAction(input, 'Organizing your files');
    default:              return 'Working on it...';
```

And add the `describeAction` helper after the `shortPath` function (after line 37):
```js
function describeAction(input, fallback) {
  if (!input?.action) return fallback + '...';
  const action = input.action.replace(/_/g, ' ');
  return action.charAt(0).toUpperCase() + action.slice(1) + '...';
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build

- [ ] **Step 3: Commit**

```bash
git add client/src/theme.js
git commit -m "feat: add friendly descriptions for all Mac tools in chat UI"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Verify server starts with all 16 tools**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const tools = getToolsForAgent({}); console.log(tools.length + ' tools registered'); })"`
Expected: `16 tools registered`

- [ ] **Step 2: Test a Mac tool end-to-end**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { executeTool } = await import('./server/tools/registry.js'); const r = await executeTool('mac_apps', { action: 'list_running' }); console.log(r.substring(0, 200)); })"`
Expected: List of running apps

- [ ] **Step 3: Verify deny map works**

Run: `node -e "import('./server/index.js').then(async m => { await m.createServer(); const { getToolsForAgent } = await import('./server/tools/registry.js'); const tools = getToolsForAgent({ tools: { deny: ['mac'] } }); console.log(tools.length + ' tools (mac denied):', tools.map(t => t.name).join(', ')); })"`
Expected: `6 tools (mac denied): shell_exec, file_read, file_write, file_list, web_search, web_fetch`

- [ ] **Step 4: Verify client build**

Run: `npm run build 2>&1 | tail -3`
Expected: Clean build

- [ ] **Step 5: Commit any fixes**

---

## Next Plans

- **Plan 4:** CLI discovery + plugins + UI polish
