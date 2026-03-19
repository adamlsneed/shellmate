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
