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
