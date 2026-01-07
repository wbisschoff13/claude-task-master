---
created: 2026-01-06
status: EXPLORATION
source: user-idea
code_paths:
  - apps/cli/src/commands/next.command.ts:1-264
  - packages/tm-core/src/modules/tasks/services/task-service.ts:299-418
  - packages/tm-core/src/modules/tasks/tasks-domain.ts:153-154
---

# Exploration: Add --skip Parameter to 'task-master next'

## Problem Statement

**What problem are we trying to solve?**

When using multiple AI agents in parallel across different git worktrees for "vibecoding" scenarios, all agents will receive the same "next" task when calling `task-master next`. This creates conflicts where multiple agents attempt to work on the same task simultaneously.

**Why does it matter?**

- Parallel development workflows are inefficient when agents compete for the same task
- Users with multiple worktrees want agents to work on different tasks in parallel
- No current mechanism exists to distribute work across multiple agents

**Who is affected?**

- Advanced users running multiple AI agents (Claude Code instances) in parallel
- Teams using multiple worktrees for concurrent feature development
- Automation scripts that need to process tasks in parallel

## Current State

**What exists today?**

The `task-master next` command currently selects a single "next available" task using this logic:

1. **Priority 1**: Eligible subtasks from in-progress parent tasks
2. **Priority 2**: Top-level tasks with pending/in-progress status
3. **Sorting**: By priority (critical > high > medium > low), then dependency count, then task ID

**Known constraints**

- Tasks must have status `pending` or `in-progress` to be eligible
- All task dependencies must be satisfied (completed)
- Command supports: `--tag`, `--format`, `--silent`, `--project` options
- Business logic lives in `@tm/core`, CLI is a thin presentation layer

**Relevant code paths**

- CLI command: `apps/cli/src/commands/next.command.ts:20-150`
- Task selection logic: `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`
- Domain facade: `packages/tm-core/src/modules/tasks/tasks-domain.ts:153-154`

## Design Options

### Option A: Simple Skip Index (Skip First N Tasks)

**Description:**

Add a `--skip <count>` parameter that skips the first N eligible tasks in the sorted list. For example:
- Agent 1: `task-master next` (returns task #1)
- Agent 2: `task-master next --skip 1` (returns task #2, skipping task #1)
- Agent 3: `task-master next --skip 2` (returns task #3, skipping tasks #1-2)

**Pros:**

- **Simple implementation**: Just index into the sorted eligible tasks array
- **Predictable distribution**: Easy to reason about which agent gets which task
- **Low complexity**: Minimal changes to existing logic
- **No state changes**: Doesn't modify task status or add new fields
- **Works with existing sorting**: Leverages current priority-based ordering

**Cons:**

- **Race conditions**: If agents start at different times, they may get different tasks due to changing eligibility
- **Wasted skips**: If a task becomes ineligible (blocked/completed), skip count may point to wrong task
- **No coordination**: Agents must manually agree on skip counts (no built-in coordination mechanism)
- **Fragile**: Requires human to correctly calculate skip offsets based on number of agents
- **Uneven workload**: If task #1 is quick, Agent 1 sits idle while Agent 2 works on longer task #2

**Risks:**

- [Medium] Users may incorrectly calculate skip values, leading to conflicts or skipped tasks
- [Low] If task list changes between agent calls, skip logic may point to unexpected tasks
- [Low] No validation that skip count doesn't exceed available eligible tasks

**Complexity:** Low

**Assumptions:**

- All agents start at approximately the same time
- Task eligibility list remains relatively stable during agent startup
- User manually coordinates skip counts across agents

### Option B: Skip Specific Task IDs

**Description:**

Add a `--skip <task-id>` parameter that skips a specific task ID (or comma-separated list). For example:
- Agent 1: `task-master next` (gets task #5, the highest priority)
- Agent 2: `task-master next --skip 5` (gets next highest priority after task #5)
- Agent 3: `task-master next --skip 5,7` (skips both tasks #5 and #7)

**Pros:**

- **Explicit control**: Users can exactly specify which tasks to avoid
- **More flexible**: Can skip non-contiguous tasks
- **Handles dynamic changes**: If agents report their assigned tasks, others can skip those specific IDs
- **Script-friendly**: Easy to automate: `--skip $(agent1-task-id),$(agent2-task-id)`
- **Clearer intent**: More obvious what's being skipped

**Cons:**

- **Requires coordination**: Agents must communicate their assigned task IDs to others
- **More complex parsing**: Need to parse comma-separated list of task IDs
- **Manual lookup**: User needs to know task IDs ahead of time
- **Potentially verbose**: If skipping many tasks, command line becomes long
- **No auto-discovery**: Must call `next` once to get task ID, then call again for other agents

**Risks:**

- [Medium] User error in typing task IDs could cause unexpected skips
- [Low] Comma-separated parsing edge cases (spaces, invalid IDs)
- [Low] No validation that skipped task IDs actually exist

**Complexity:** Medium

**Assumptions:**

- Users can obtain task IDs through initial `next` calls
- Scripting/automation will handle task ID distribution
- Task IDs are known before parallel work begins

### Option C: Agent Registration System

**Description:**

Implement a lightweight agent registration system where agents "claim" tasks atomically. Add a `--agent-id <name>` parameter:
- Agent 1: `task-master next --agent-id agent-1` (claims and returns task #5)
- Agent 2: `task-master next --agent-id agent-2` (claims and returns task #7, skipping #5)
- Agent 3: `task-master next --agent-id agent-3` (claims and returns task #2, skipping #5, #7)

Tasks would track which agent is working on them (new field: `assignedAgent`).

**Pros:**

- **Automatic coordination**: No manual skip calculations needed
- **Conflict prevention**: Built-in mechanism prevents duplicate assignments
- **Persistent tracking**: Can query which agent is working on what
- **Scalable**: Works with any number of agents without manual configuration
- **Future-proof**: Foundation for advanced features (agent status, workload balancing)

**Cons:**

- **Higher complexity**: Requires new data model field and claiming logic
- **State changes**: Modifies task structure (adds `assignedAgent` field)
- **Storage changes**: Needs migration or schema update
- **Overhead**: Requires reading/writing task state on each call
- **Cleanup needed**: Need mechanism to clear assignments when agent completes work

**Risks:**

- [High] Requires storage layer changes and migration path
- [Medium] Concurrent access could lead to race conditions without proper locking
- [Medium] Abandoned assignments (agent crashes) need timeout/cleanup logic
- [Low] Backward compatibility concerns with existing task files

**Complexity:** High

**Assumptions:**

- Users are willing to accept storage schema changes
- File locking or atomic operations are available for concurrent access
- Agent IDs can be enforced (not required today)

### Option D: Eligible Tasks List Command

**Description:**

Add a `task-master list-eligible` command that shows all eligible tasks (with their IDs), then allow `next --skip-id <task-id>` to skip a specific task. This separates "discovery" from "selection":

```bash
# Agent 1
task-master list-eligible  # Shows: #5 (high), #7 (high), #2 (medium)
task-master next --skip-id  # Takes first (task #5)

# Agent 2
task-master next --skip-id 5  # Skips #5, takes #7

# Agent 3
task-master next --skip-id 5,7  # Skips #5, #7, takes #2
```

**Pros:**

- **Separation of concerns**: Discovery and selection are separate operations
- **No guessing**: Users see full eligible list before making decisions
- **Combines well**: Can use with other options (tag filters, etc.)
- **Incremental value**: `list-eligible` command useful on its own
- **Flexible**: Users can make informed decisions about which tasks to skip

**Cons:**

- **Two-step process**: Requires two commands (or prior knowledge) per agent
- **More manual**: User must coordinate both discovery and assignment
- **Potential for stale data**: Eligible list may change between list and next calls
- **CLI verbosity**: More commands to learn and use
- **Scripting complexity**: Automation needs to parse list output

**Risks:**

- [Medium] Time gap between listing and selecting could cause race conditions
- [Low] Users may find two-step process cumbersome for simple use cases
- [Low] Output parsing complexity for scripts

**Complexity:** Medium

**Assumptions:**

- Users accept two-command workflow
- Time between list and next calls is minimal
- Eligible task list remains relatively stable

## Research Findings

**Source 1: Current task selection implementation (Code analysis)**

Found in: `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`

The `getNextTask()` method already builds a complete sorted array of eligible tasks (`candidateSubtasks` array and `eligibleTasks` array). Currently returns index `[0]`. Adding skip functionality would be straightforward: return index `[skipCount]` instead.

**Assumption:** The sorting logic is stable and produces deterministic order.

**Source 2: CLI command pattern (Code analysis)**

Found in: `apps/cli/src/commands/next.command.ts:20-60`

Commands use Commander.js with a class-based pattern. Options are defined in the constructor via `.option()` calls, validated in `validateOptions()`, and passed to tm-core methods. The current `getNext()` method signature is: `async getNext(tag?: string): Promise<Task | null>`.

**Assumption:** Adding a new parameter requires updating the interface at three layers: CLI options, domain facade, and service.

**Source 3: Parallel worktree use case (User requirement)**

From user request: "for use for when a user want's to vibecode with multiple worktrees and doesn't want all of the agents to just work on the same one, but one agent might do --skip 1 and the other might do --skip 2, while the third one just works on next"

**Key insight:** User's mental model is simple ordinal skipping (skip 1st, skip 2nd), not specific task IDs. This aligns with Option A.

**Source 4: Task Master architecture documentation**

Found in: `/Users/werner/Development/claude-task-master/CLAUDE.md` and `.taskmaster/CLAUDE.md`

Architecture follows strict separation: business logic in `@tm/core`, presentation in CLI/MCP. The guideline states: "ALL business logic must live in `@tm/core`, NOT in presentation layers."

**Implication:** Skip logic must be implemented in `task-service.ts`, not in the CLI command.

**Source 5: Existing test patterns**

Found in: `apps/cli/tests/integration/commands/next.command.test.ts:1-80`

Integration tests use temporary directories, create task fixtures, and execute CLI via `execSync`. Tests verify output and exit codes.

**Assumption:** New skip functionality should have test coverage for various skip values and edge cases (skip > eligible count, skip = 0, negative values, etc.).

## Constraints & Non-Negotiables

### Technical Constraints

- **Architecture separation**: Skip logic must live in `@tm/core`, not CLI layer (per project guidelines)
- **TypeScript strict mode**: All new code must pass type checking
- **Backward compatibility**: Existing `getNext(tag?)` API must continue working
- **No storage schema changes**: Preferred to avoid migrations (unless Option C chosen)

### Business Constraints

- **Minimal changes**: User wants a simple parameter, not a complex system
- **Fast implementation**: Should be straightforward to add and test
- **No breaking changes**: Existing scripts and workflows must continue working

### Time Constraints

- **Quick win feature**: This is an enhancement, not a major refactor
- **Low-risk implementation**: Should not require extensive testing or refactoring

### User Experience Considerations

- **Discoverability**: Parameter name should be intuitive (`--skip` vs `--skip-count` vs `--offset`)
- **Error handling**: Clear messages when skip count exceeds available tasks
- **Documentation**: Should be easy to explain and use

## Open Questions

### Blocking Questions

- [ ] Should the skip parameter validate against the total eligible task count and error/warn if skip is too high?
- [ ] What should happen when skip count equals or exceeds eligible task count? Return null, throw error, or wrap around?
- [ ] Should we add validation to prevent negative skip values?

### Non-Blocking Questions

- [ ] Should we add a `--list-eligible` command to show all eligible tasks (Option D)?
- [ ] Could this benefit from a `--random` flag to distribute tasks randomly among agents?
- [ ] Should we consider a `--agent <name>` parameter for future coordination features (Option C)?
- [ ] Would a `--take <count>` parameter be useful to get multiple tasks at once?

## Preliminary Assessment (Non-Binding)

**Leaning toward:** Option A (Simple Skip Index) because:

1. **Aligns with user's mental model**: User's example directly matches this approach (`--skip 1`, `--skip 2`)
2. **Minimal implementation**: Can be done with small, focused changes to existing code
3. **No schema changes**: Doesn't require storage migration or new fields
4. **Leverages existing sorting**: Builds on current priority-based ordering
5. **Fast to implement**: Low complexity means quick delivery

**Confidence level:** Medium

**Reasons for uncertainty:**

- Race conditions in parallel scenarios could cause unexpected behavior
- No built-in validation that agents aren't accidentally assigned the same task
- User must manually coordinate skip counts (error-prone with many agents)

**Recommended next step:**

Implement Option A as a "fast-follow" feature for immediate user feedback, then evaluate real-world usage to determine if more sophisticated options (B, C, or D) are needed. Specifically:

1. Add `--skip <count>` parameter to CLI
2. Modify `getNextTask(tag?, skipCount?)` to return task at skip index
3. Add validation: error if skip < 0, return null if skip >= eligible count
4. Write integration tests for skip = 0, 1, 2, and edge cases
5. Gather user feedback on parallel worktree workflows

**If exploration is inconclusive:**

Create a quick prototype of Option A and test it manually with 2-3 parallel agent processes to verify behavior matches user expectations. If race conditions prove problematic, revisit Option B (specific task IDs) or Option C (agent registration).

---

**Next actions for PRD phase:**

1. Freeze on Option A unless blockers emerge
2. Define exact parameter name: `--skip` vs `--skip-count` vs `--offset`
3. Specify edge case behavior: what happens when skip >= eligible count
4. Design validation rules and error messages
5. Plan test cases and coverage requirements
