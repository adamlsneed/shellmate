/**
 * Generate TOOLS.md for the Shellmate agent.
 * Pure function.
 * Mac-specific environment notes — apps, Shortcuts, Finder paths, and local setup.
 */
export function generateTools(agent, _teamSpec) {
  const macApps = agent.mac_apps && agent.mac_apps.length > 0
    ? agent.mac_apps.map(app => `- ${app}`).join('\n')
    : '// TODO: List the Mac apps you use regularly';

  return `# TOOLS.md — Mac Environment Notes

Skills define how your tools work. This file is for **your specifics** — the apps, paths, and quirks of your Mac setup.

## Mac Apps

${macApps}

## Shortcuts

// TODO: List Apple Shortcuts and what they do
// Example: "Morning Briefing" → reads calendar, weather, and tasks
// Shortcuts are stored in ~/Library/Shortcuts/

## Finder Paths

// TODO: Key folders and their purposes
// Example: ~/Documents/Projects → active project files
// Example: ~/Desktop → quick drop zone

## Automation Notes

// TODO: Any Automator workflows, cron jobs, or launchd agents
// Example: Daily backup script at ~/Scripts/backup.sh

## Other Environment Notes

// TODO: API key locations, local paths, service URLs, etc.
// Example: Homebrew prefix: /opt/homebrew
// Example: Default browser: Arc / Safari / Chrome
`;
}
