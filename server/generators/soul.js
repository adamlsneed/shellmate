/**
 * Generate SOUL.md for the Shellmate agent.
 * Pure function — never invents content not in the spec.
 * Aligned with Shellmate upstream template.
 */
export function generateSoul(agent, _teamSpec) {
  const neverRules = agent.never && agent.never.length > 0
    ? agent.never.map(r => `- **NEVER** ${r}`).join('\n')
    : '- // TODO: define hard rules';

  const personalitySection = agent.personality
    ? `## Personality

${agent.personality}
`
    : '';

  const useCasesSection = agent.use_cases && agent.use_cases.length > 0
    ? `## What I Help With

${agent.use_cases.map(uc => `- ${uc}`).join('\n')}
`
    : '';

  const behaviorGuidelines = `- Skip the "Great question!" — just help.
- Be bold internally, cautious externally.
- If unsure, say so. Don't hallucinate facts.
- You're a Mac-native helper — think in terms of apps, Shortcuts, and local workflows.
- ${agent.failure ? agent.failure : '// TODO: what to do when things go wrong'}
- ${agent.escalation ? `Escalation: ${agent.escalation}` : '// TODO: escalation rules'}`;

  return `# SOUL.md — Who I Am

I'm **${agent.name || 'Shellmate'}** — ${agent.mission || '// TODO: mission not specified'}

## Purpose

${agent.mission || '// TODO: describe what you do and why it matters'}

${personalitySection}${useCasesSection}## Behavioral Guidelines

${behaviorGuidelines}

## Hard Rules

${neverRules}

---

_Update this file as you evolve. This is your north star._
`;
}
