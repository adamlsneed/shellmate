/**
 * Generate MEMORY.md and memory/README.md for the Shellmate agent.
 * Pure functions.
 */
export function generateMemory(agent, _teamSpec) {
  return `# MEMORY.md - Long-Term Memory

## About the User

(Save their name, what they use their Mac for, and how they prefer to be helped.)

## Preferences & Habits

(What apps they use most, how they like things organized, communication style.)

## Key Decisions

(Important choices made — what was decided and why.)

## Active Context

(What are we currently working on? Any ongoing tasks or projects.)

## Lessons Learned

(What worked well, what didn't, corrections the user made.)
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
