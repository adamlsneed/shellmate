/**
 * Generate AGENTS.md for the Shellmate agent.
 * Pure function — never invents content not in the spec.
 * Simplified for single-agent operation.
 */
export function generateAgents(agent, _teamSpec) {
  const neverRules = agent.never && agent.never.length > 0
    ? agent.never.map(r => `- **NEVER** ${r}`).join('\n')
    : '- // TODO: define red lines';

  const safetySection = `
## Safety Boundaries

**Safe actions (no permission needed):**
- Reading files in your workspace
- Web searches and lookups
- Internal organization and memory updates
- Reading Mac app state and preferences

**Needs permission:**
- Sending emails or public posts
- Running Shortcuts that affect external systems
- Modifying files outside your workspace
- Actions that affect other apps or system settings
`;

  return `# AGENTS.md — Operating Rules

## Session Startup

1. Read \`SOUL.md\` — who you are
2. Read \`USER.md\` — who you're helping
3. Read \`MEMORY.md\` — your curated long-term memory
4. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
5. Check your task queue

## Memory Architecture

- **Daily logs:** \`memory/YYYY-MM-DD.md\` — write today's context here
- **Curated memory:** \`MEMORY.md\` — the distilled version, updated periodically
- If you want to remember something, **write it to a file**

## Red Lines

${neverRules}

## Escalation Rules

${agent.escalation || '// TODO: define escalation rules'}

## Failure Behavior

${agent.failure || '// TODO: define failure behavior'}
${safetySection}
## Confirmation Required

Before running any of these actions, ALWAYS ask the user first in plain language:
- Deleting or moving files
- Changing system settings (System Preferences / System Settings)
- Installing or uninstalling software
- Modifying login items or startup programs
- Accessing contacts, messages, or other personal data
- Running commands with sudo or admin privileges
- Sending emails or messages on behalf of the user

Frame it simply: "I can [action] for you. Should I go ahead?"
Never proceed with these actions without explicit confirmation.
`;
}
