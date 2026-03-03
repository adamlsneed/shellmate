/**
 * Generate MEMORY.md and memory/README.md for the Shellmate agent.
 * Pure functions.
 */
export function generateMemory(agent, _teamSpec) {
  return `# MEMORY.md - Long-Term Memory

## Role

**${agent.name || 'Shellmate'}** — ${agent.mission || '// TODO'}

## Goal

// TODO: Add long-term goals and current priorities

## Active Context

// TODO: What are you currently working on?

## Key Decisions

// TODO: Important decisions made so far

## Lessons Learned

// TODO: What have you learned that future-you should know?

---

_Update this file during sessions. This is your curated long-term memory._
`;
}

export function generateMemoryReadme(_agent, _teamSpec) {
  return `# memory/ - Session Logs

## Naming Convention

\`YYYY-MM-DD.md\` — one file per day.

## What to Log

- Tasks completed
- Decisions made and why
- Context that will be useful next session
- Errors encountered and how they were resolved
- Links, IDs, and references for ongoing work

## What NOT to Log

- Sensitive credentials (use environment variables)
- Redundant info already in SOUL.md or AGENTS.md

---

_These are raw daily notes. Distill important learnings into MEMORY.md periodically._
`;
}
