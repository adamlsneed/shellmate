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
