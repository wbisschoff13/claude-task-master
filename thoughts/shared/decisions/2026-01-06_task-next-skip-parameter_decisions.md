---
created: 2026-01-06
status: DECISIONS_FROZEN
supersedes:
  - thoughts/shared/exploration/2026-01-06_task-next-skip-parameter.md
authoritative_for:
  - plan:prd
  - plan:tasks
  - tm:create
---

# Decision Register — task-master next --skip Parameter

## Authority Statement

This document is the sole authoritative source of decisions for the `--skip` parameter feature.
All prior exploration and analysis is archived and non-authoritative.

If a decision is not recorded here, it is not decided.

---

## Decision Index

| Axis | Status | Blocking |
|-----|--------|----------|
| Architecture & Stack | DECIDED | No |
| API Design | DECIDED | No |
| Error Handling | DECIDED | No |
| Validation | DECIDED | No |
| Testing | DECIDED | No |
| Documentation | DECIDED | No |

---

## Decisions

### 1. Architecture & Stack

**Decision:** Implement Option A (Simple Skip Index) - Add a `--skip <count>` parameter that skips the first N eligible tasks in the sorted list and returns the task at that index.

**Status:** DECIDED

**Rationale:**
- Aligns with user's stated mental model and use case
- Minimal implementation complexity
- No storage schema changes or migrations required
- Leverages existing priority-based sorting logic
- Fast to implement and test

**Implications:**
- Skip logic lives in `@tm/core` (packages/tm-core/src/modules/tasks/services/task-service.ts)
- CLI layer (apps/cli/src/commands/next.command.ts) only handles option parsing
- No changes to storage layer or task data model
- Backward compatible with existing `getNext(tag?)` API

**Explicitly Excluded:**
- Option B: Skip specific task IDs (deferred to future consideration if needed)
- Option C: Agent registration system (rejected due to complexity)
- Option D: Separate list-eligible command (rejected for simplicity)

---

### 2. API Design

**Decision:** Add optional `skipCount` parameter throughout the call chain.

**Status:** DECIDED

**API Changes:**
```typescript
// Domain facade
packages/tm-core/src/modules/tasks/tasks-domain.ts
async getNext(tag?: string, skipCount?: number): Promise<Task | null>

// Service layer
packages/tm-core/src/modules/tasks/services/task-service.ts
async getNextTask(tag?: string, skipCount?: number): Promise<Task | null>

// CLI command
apps/cli/src/commands/next.command.ts
export interface NextCommandOptions {
  tag?: string;
  format?: 'text' | 'json';
  silent?: boolean;
  project?: string;
  skip?: number;  // NEW
}
```

**Behavior:**
- `skip` defaults to `0` (returns first eligible task, current behavior)
- `skip: 1` returns second eligible task (skips first)
- `skip: N` returns task at index N in sorted eligible list
- Works with both subtasks and top-level tasks

**CLI Usage Examples:**
```bash
task-master next                    # Returns task #1 (skip=0, default)
task-master next --skip 1           # Returns task #2
task-master next --skip 2           # Returns task #3
task-master next --tag frontend     # Returns 2nd frontend task
task-master next --skip 1 --tag api # Returns 2nd API task
```

**Implications:**
- Parameter name is `--skip` (not `--skip-count`, `--offset`, etc.)
- Option is optional positional/flag, not required
- Combines with existing options (`--tag`, `--format`, `--silent`, `--project`)
- Maintains consistent naming pattern with other numeric CLI options

---

### 3. Error Handling

**Decision:** Return `null` when skip count exceeds available eligible tasks, with optional warning message.

**Status:** DECIDED

**Behavior Specification:**

| Scenario | Behavior | Output |
|----------|----------|--------|
| `skip >= eligibleCount` | Return `null` | Show "No eligible task at skip index {skip}" message in text mode |
| `skip < 0` | Throw error | "Skip count must be non-negative" |
| No eligible tasks | Return `null` | Existing "no tasks available" message |
| Valid skip | Return task | Normal display |

**Implications:**
- CLI must check if returned task is `null` and display appropriate message
- No exceptions thrown for "skip too high" - graceful degradation
- JSON format includes `task: null` with `found: false` (existing pattern)
- Error thrown only for invalid input (negative numbers)

**Error Messages:**
```
Text mode:
✓ No eligible task at skip index 5. Only 3 tasks are available.

Error mode:
Error: Skip count must be a non-negative number
```

---

### 4. Validation

**Decision:** Validate skip parameter at CLI layer before passing to core.

**Status:** DECIDED

**Validation Rules:**
1. **Type check**: Must parse as integer (Commander.js handles this)
2. **Range check**: Must be `>= 0`
3. **NaN check**: Reject non-numeric values like `--skip abc`

**Implementation Location:**
```typescript
// apps/cli/src/commands/next.command.ts
private validateOptions(options: NextCommandOptions): void {
  // Existing validation...
  if (options.format && !['text', 'json'].includes(options.format)) {
    throw new Error(`Invalid format: ${options.format}...`);
  }

  // NEW: Skip validation
  if (options.skip !== undefined) {
    if (options.skip < 0) {
      throw new Error('Skip count must be a non-negative number');
    }
  }
}
```

**Implications:**
- No validation needed in core layer (trusts CLI)
- Core layer treats `undefined` skipCount as `0`
- Negative numbers rejected before core logic executes

---

### 5. Testing

**Decision:** Add comprehensive test coverage for skip parameter behavior.

**Status:** DECIDED

**Required Test Cases:**

**Integration Tests** (`apps/cli/tests/integration/commands/next.command.test.ts`):
1. `--skip 0` returns first eligible task (same as no skip)
2. `--skip 1` returns second eligible task
3. `--skip N` where N equals eligible count minus 1 returns last task
4. `--skip N` where N equals eligible count returns null
5. `--skip N` where N exceeds eligible count returns null with warning
6. `--skip -1` throws validation error
7. `--skip` with `--tag` filter respects tag filtering
8. `--skip` with priority ordering respects sorting
9. `--skip` with subtasks skips eligible subtasks
10. `--skip` with no eligible tasks returns null

**Unit Tests** (`packages/tm-core/src/modules/tasks/services/task-service.spec.ts`):
1. `getNextTask(tag, skipCount)` returns correct index
2. `getNextTask(tag, 0)` matches original behavior
3. `getNextTask(tag, undefined)` uses default skip=0
4. Empty eligible array with skip=0 returns null
5. Single eligible task with skip=0 returns that task
6. Single eligible task with skip=1 returns null

**Edge Cases:**
- Skip=0 explicitly provided vs. omitted (same behavior)
- Skip with duplicate priorities (uses tiebreaker: dependency count, then ID)
- Skip when task list changes between calls (no coordination, race condition acceptable)

**Implications:**
- All tests must pass before PR can be merged
- Tests document expected behavior for future developers
- Test fixtures should include varied priority tasks to verify sorting

---

### 6. Documentation

**Decision:** Update CLI help text and user-facing documentation.

**Status:** DECIDED

**Required Documentation Updates:**

**CLI Help Text:**
```typescript
this.description('Find the next available task to work on')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--skip <count>', 'Skip N eligible tasks (useful for parallel work with multiple agents)', '0')
  .option('-f, --format <format>', 'Output format (text, json)', 'text')
  // ... rest of options
```

**Usage Examples:**
```bash
# Get the next available task
task-master next

# Parallel worktree workflow - Agent 1 takes first task
task-master next

# Agent 2 takes second task
task-master next --skip 1

# Agent 3 takes third task
task-master next --skip 2

# With tag filtering
task-master next --tag backend --skip 1
```

**Documentation Locations:**
- CLI built-in help: `task-master next --help`
- Task Master docs: `apps/docs/docs/cli-commands/next.mdx` (if exists)
- README: Multi-worktree example (if applicable)

**Implications:**
- Help text should mention use case: "useful for parallel work with multiple agents"
- Examples should show realistic multi-agent workflow
- No changes to MCP tool documentation (MCP tools have separate layer)

---

## Deferred Decisions

### Deferred: Agent Registration System (Option C)

**What is deferred:**
Built-in agent claiming system with task assignment tracking (`assignedAgent` field, atomic claims).

**Why deferral is acceptable:**
- User's stated need is simple ordinal skipping for known agent count
- Agent registration requires storage schema changes and migration
- More complex than current use case requires
- Can be added later if simple skipping proves insufficient

**When/by whom it must be resolved:**
- Revisit if users report frequent race conditions or coordination issues
- Evaluate after real-world usage of skip parameter in multi-agent workflows
- Consider if Task Master adds more parallel-execution features

---

## Blocking Decisions

**None.** All decisions are frozen and implementation can proceed.

---

## Risk Acceptances

### Risk 1: Race Conditions in Parallel Agent Startup

**Risk description:**
If agents start at slightly different times, the eligible task list may change between calls, causing agents to receive unexpected tasks or conflicts.

**Impact:**
Medium - Could cause two agents to work on the same task, or for skip index to point to different tasks than intended.

**Mitigation:**
- Document that agents should start as close to simultaneously as possible
- Users should verify task assignments if conflicts occur
- Consider using `--tag` to partition tasks by agent type as additional coordination

**Acceptance rationale:**
- User's use case involves controlled manual startup of agents
- Acceptable trade-off for simplicity vs. coordination complexity
- Can add more sophisticated coordination later if needed

---

### Risk 2: Skip Index Points to Wrong Task After Completion

**Risk description:**
If task #1 completes while Agent 2 is starting, `--skip 1` might now return what was originally task #3 (since task #1 is no longer eligible).

**Impact:**
Low - Task #2 is still valid work, just not the originally intended distribution.

**Mitigation:**
- Document that task list is dynamic
- Users should accept any valid task assignment
- If specific task assignment is critical, use task ID filtering (future feature)

**Acceptance rationale:**
- All skipped tasks are valid eligible work
- Goal is task distribution, not specific task assignment
- Priority ordering ensures all returned tasks are appropriate

---

### Risk 3: No Enforcement of Unique Assignments

**Risk description:**
Nothing prevents two agents from accidentally using the same skip value (or overlapping values if more agents than skip offset).

**Impact:**
Low - User error in manual coordination, not a system issue.

**Mitigation:**
- Clear documentation of expected usage pattern
- Examples show distinct skip values (0, 1, 2, ...)
- CLI help text explains use case

**Acceptance rationale:**
- User controls agent startup and configuration
- Simple coordination is manageable for small number of agents (2-5)
- Built-in enforcement would require agent registration system (deferred)

---

## Final Validation Checklist

**Completeness:**
- [x] Every required axis has a decision
- [x] No BLOCKING items exist
- [x] Deferred decisions have clear resolution criteria

**Clarity & Authority:**
- [x] No decision contains option language ("could", "might", "consider")
- [x] No exploration reasoning is required to interpret decisions
- [x] A PRD could be written using ONLY this file

**Calibration Questions:**
- [x] Would you defend each decision in a stakeholder review? YES
- [x] Is there any ambiguity a competitor could exploit? NO
- [x] Does any decision unfairly advantage/disadvantage users, stakeholders, or groups? NO

**Traceability:**
- [x] All superseded exploration documents are listed
- [x] Code paths are referenced for implementation impact:
  - `apps/cli/src/commands/next.command.ts:20-150`
  - `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418`
  - `packages/tm-core/src/modules/tasks/tasks-domain.ts:153-154`
  - `apps/cli/tests/integration/commands/next.command.test.ts`

**Status: DECISIONS_FROZEN**

Implementation can proceed to PRD phase.
