/**
 * Generate TOOLS.md for the Shellmate agent.
 * Pure function — receives agent spec, team spec, and optional context.
 * Documents Mac-native tools, discovered CLIs, and environment specifics.
 */

export function generateTools(agent, _teamSpec, { discoveredCLIs = [] } = {}) {
  const macApps = agent.mac_apps && agent.mac_apps.length > 0
    ? agent.mac_apps.map(app => `- ${app}`).join('\n')
    : '- (none specified)';

  const cliSection = discoveredCLIs.length > 0
    ? discoveredCLIs.map(c => `- \`${c.cmd}\` — ${c.description} (${c.path})`).join('\n')
    : '- No additional CLI tools discovered';

  return `# TOOLS.md — Mac Environment & Available Tools

You have built-in tools for running commands, reading/writing files, and searching the web.
You also have direct access to Mac apps and discovered CLI tools listed below.

## Mac Apps You Use

${macApps}

## Available Mac Tools

You have dedicated tools for interacting with these Mac apps (use the mac_* tools instead of shell commands):

- **Calendar** (mac_calendar) — list, create, delete, search events
- **Reminders** (mac_reminders) — list, create, complete, delete reminders
- **Contacts** (mac_contacts) — search contacts, get details, list groups
- **Notes** (mac_notes) — list, create, search, read notes
- **Messages** (mac_messages) — send iMessage, read recent messages
- **Mail** (mac_mail) — list inbox, search, compose drafts, read messages
- **Finder** (mac_finder) — open folders, reveal files, get desktop items
- **System** (mac_system) — battery, Wi-Fi, volume, screenshot, dark mode, disk space
- **Apps** (mac_apps) — open, quit, list running apps
- **Files** (mac_files) — organize folders, find duplicates, categorize files, bulk rename

> Use mac_* tools for Mac app interactions. Use shell_exec for general terminal commands.
> Use mac_files for batch file organization. Use file_read/file_write for individual files.

## Installed CLI Tools

${cliSection}

## Finder Paths

- ~/Desktop — quick drop zone
- ~/Downloads — downloaded files
- ~/Documents — documents and projects

## Tips

- For file organization tasks, prefer mac_files (smart categorization, duplicate detection)
- For Mac app interactions, use the dedicated mac_* tools — they're more reliable than shell_exec + osascript
- Web search uses DuckDuckGo by default — no API key needed
`;
}
