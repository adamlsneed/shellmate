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
