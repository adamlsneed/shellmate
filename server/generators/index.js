import { generateSoul } from './soul.js';
import { generateAgents } from './agents.js';
import { generateIdentity } from './identity.js';
import { generateUser } from './user.js';
import { generateTools } from './tools.js';
import { generateBootstrap } from './bootstrap.js';
import { generateMemory, generateMemoryReadme } from './memory.js';

function generateSkillsReadme(agent, teamSpec) {
  const recommended = teamSpec.capabilities?.recommendedSkills || [];
  const agentSkills = recommended.filter(s => s.source === 'clawhub' || s.source === 'workspace');

  const installLines = agentSkills.length > 0
    ? agentSkills.map(s => `# ${s.name}: ${s.reason}\nclawhub install ${s.id}`).join('\n\n')
    : '# Add workspace-local skills here\n# clawhub install <skill-id>';

  return `# Workspace Skills — ${agent.name || agent.id}

Skills placed in this folder are **local to this agent only** and override any global skill with the same name.

## How to install a skill into this workspace

\`\`\`bash
# From inside this workspace directory:
clawhub install <skill-id>

# Or specify the workspace explicitly:
clawhub install <skill-id> --workdir ~/.openclaw/workspace
\`\`\`

## Recommended skills for this agent

${installLines}

## Notes

- Skills here take precedence over bundled and managed (~/.openclaw/skills) skills of the same name.
- After installing, restart the OpenClaw gateway (or start a new session) for the skill to take effect.
- Browse all available skills at https://clawhub.ai
`;
}

/**
 * Generate all workspace files for the Shellmate agent.
 * Returns [{ path, content }] in canonical order.
 */
export function generateFiles(teamSpec) {
  const agent = teamSpec.agent;
  const prefix = 'workspace-main';

  return [
    { path: `${prefix}/SOUL.md`, content: generateSoul(agent, teamSpec) },
    { path: `${prefix}/AGENTS.md`, content: generateAgents(agent, teamSpec) },
    { path: `${prefix}/IDENTITY.md`, content: generateIdentity(agent, teamSpec) },
    { path: `${prefix}/USER.md`, content: generateUser(agent, teamSpec) },
    { path: `${prefix}/TOOLS.md`, content: generateTools(agent, teamSpec) },
    { path: `${prefix}/BOOTSTRAP.md`, content: generateBootstrap(agent, teamSpec) },
    { path: `${prefix}/MEMORY.md`, content: generateMemory(agent, teamSpec) },
    { path: `${prefix}/memory/README.md`, content: generateMemoryReadme(agent, teamSpec) },
    { path: `${prefix}/skills/README.md`, content: generateSkillsReadme(agent, teamSpec) },
  ];
}
