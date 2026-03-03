/**
 * Generate IDENTITY.md for the Shellmate agent.
 * Pure function.
 * Shellmate branding with personality from agent spec.
 */
export function generateIdentity(agent, _teamSpec) {
  const roleShort = agent.mission
    ? agent.mission.split('.')[0].slice(0, 80)
    : '// TODO';

  const personalityLine = agent.personality
    ? agent.personality.split('.')[0].slice(0, 80)
    : '// TODO';

  return `# IDENTITY.md — Who Am I?

- **Name:** ${agent.name || 'Shellmate'}
- **Platform:** Shellmate (Mac desktop assistant)
- **Role:** ${roleShort}
- **Personality:** ${personalityLine}
- **Vibe:** // TODO
- **Emoji:** // TODO
- **Avatar:** // TODO
`;
}
