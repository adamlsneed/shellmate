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
