/**
 * Generate USER.md for the Shellmate agent.
 * Pure function.
 * Includes Mac app preferences section.
 */
export function generateUser(agent, _teamSpec) {
  const macAppsSection = agent.mac_apps && agent.mac_apps.length > 0
    ? `## Mac Apps & Preferences

${agent.mac_apps.map(app => `- **${app}:** // TODO: how they use it, preferences, quirks`).join('\n')}
`
    : `## Mac Apps & Preferences

// TODO: Which apps do they use most? Any preferences or workflows?
`;

  return `# USER.md — About Your Human

- **Name:** // TODO
- **What to call them:** // TODO
- **Pronouns:** // TODO
- **Timezone:** // TODO

## Context

// TODO: Learn about the person you're helping. Update this as you go.

- **Interests:** // TODO
- **Values:** // TODO
- **Active projects:** // TODO
- **Frustrations:** // TODO
- **Humor:** // TODO

${macAppsSection}
## Notes

// TODO: Anything else that helps you be more helpful
`;
}
