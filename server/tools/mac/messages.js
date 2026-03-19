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
