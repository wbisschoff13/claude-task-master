---
created: 2026-01-06
status: DRAFT
source_decisions: thoughts/shared/decisions/2026-01-06_task-next-skip-parameter_decisions.md
source_exploration: thoughts/shared/exploration/2026-01-06_task-next-skip-parameter.md
task_ready: true
task_master_ready: true
estimated_complexity: low
priority: medium
---

# PRD: task-master next --skip Parameter

## 1. Executive Summary

**Problem Statement:**
When using multiple AI agents in parallel across different git worktrees, all agents receive the same "next" task when calling `task-master next`, creating conflicts where multiple agents attempt to work on the same task simultaneously.

**Solution Overview:**
Add an optional `--skip <count>` parameter to the `task-master next` command that skips the first N eligible tasks and returns the task at that index. This enables multiple agents to distribute work by using different skip values.

**Success Definition:**
- Users can run multiple agents in parallel with distinct skip values (0, 1, 2, ...) to receive different tasks
- No breaking changes to existing `task-master next` behavior
- All existing tests continue to pass
- New tests cover skip parameter behavior including edge cases

---

## 2. Goals & Non-Goals

### Goals

**G1: Enable Parallel Task Distribution**
- Multiple agents can call `task-master next` with different skip values to receive different tasks
- Simple ordinal skipping: Agent 1 uses `--skip 0` (or no flag), Agent 2 uses `--skip 1`, Agent 3 uses `--skip 2`

**G2: Maintain Backward Compatibility**
- Existing `task-master next` calls without `--skip` behave identically to current behavior
- No changes to task data model or storage schema
- No breaking changes to programmatic interfaces

**G3: Minimal Implementation Complexity**
- Leverage existing eligible task sorting logic
- No agent registration or coordination system
- Simple array indexing into sorted eligible tasks

**G4: Clear User Experience**
- Intuitive parameter name (`--skip`)
- Clear error messages for invalid input
- Helpful warning when skip exceeds available tasks

### Non-Goals

**NG1: Built-in Agent Coordination**
- No automatic agent claiming or assignment tracking
- No enforcement of unique task assignments across agents
- Users must manually coordinate skip values

**NG2: Specific Task ID Skipping**
- Cannot skip specific task IDs (e.g., `--skip 5,7`)
- Cannot skip tasks by criteria other than ordinal position

**NG3: Dynamic Task List Coordination**
- No mechanism to handle race conditions when task list changes between calls
- No atomic multi-agent task distribution

**NG4: MCP Tool Changes**
- MCP tools have separate layer and are out of scope for this feature

---

## 3. Target Users & Stakeholders

**Primary Users:**
- Advanced developers running multiple AI agents (Claude Code instances) in parallel
- Development teams using multiple git worktrees for concurrent feature development
- Automation scripts requiring parallel task processing

**Stakeholder Needs:**
- Users need simple way to distribute tasks across agents without complex setup
- Users expect clear documentation and examples for multi-agent workflows
- Project maintainers need backward compatibility and minimal code complexity

---

## 4. Functional Requirements

### API & Interface Changes

**[FR-001] Add --skip parameter to CLI command**
The `task-master next` command must accept an optional `--skip <count>` parameter.

Acceptance Criteria:
- Parameter accepts integer values >= 0
- Parameter is optional (defaults to 0)
- Works in combination with existing parameters (`--tag`, `--format`, `--silent`, `--project`)
- Commander.js option syntax: `.option('--skip <count>', 'Skip N eligible tasks (useful for parallel work with multiple agents)')`

**[FR-002] Update NextCommandOptions interface**
Add `skip?: number` field to the options interface.

Acceptance Criteria:
- Field is optional (`undefined` if not provided)
- Type is `number`
- Located in `apps/cli/src/commands/next.command.ts`

**[FR-003] Add skipCount parameter to domain facade**
Update `TasksDomain.getNext()` method signature to accept optional skip count.

Acceptance Criteria:
- Method signature: `async getNext(tag?: string, skipCount?: number): Promise<Task | null>`
- Default behavior: `skipCount` undefined or 0 returns first eligible task
- Located in `packages/tm-core/src/modules/tasks/tasks-domain.ts`

**[FR-004] Add skipCount parameter to service layer**
Update `TaskService.getNextTask()` method signature to accept optional skip count.

Acceptance Criteria:
- Method signature: `async getNextTask(tag?: string, skipCount?: number): Promise<Task | null>`
- Returns task at index `skipCount` in sorted eligible tasks array
- Returns `null` if skipCount >= eligible task count
- Located in `packages/tm-core/src/modules/tasks/services/task-service.ts`

### Core Behavior

**[FR-005] Skip behavior with eligible tasks**
When skip count is less than eligible task count, return the task at that index.

Acceptance Criteria:
- `--skip 0` returns first eligible task (same as no skip)
- `--skip 1` returns second eligible task
- `--skip N` returns task at index N (0-indexed)
- Works for both subtasks and top-level tasks
- Respects existing priority-based sorting

**[FR-006] Skip behavior when exceeding eligible count**
When skip count is greater than or equal to eligible task count, return null.

Acceptance Criteria:
- Returns `null` if `skipCount >= eligibleTasks.length`
- CLI displays message: "✓ No eligible task at skip index {skip}. Only {count} tasks are available."
- JSON output includes `task: null`, `found: false`, `hasAnyTasks: true`

**[FR-007] Skip behavior with no eligible tasks**
When no tasks are eligible, return null regardless of skip value.

Acceptance Criteria:
- Returns `null` (same as current behavior)
- CLI displays existing "no tasks available" message
- No additional skip-specific messaging

**[FR-008] Skip combines with tag filtering**
Skip parameter respects tag-filtered eligible task lists.

Acceptance Criteria:
- `task-master next --tag backend --skip 1` returns second eligible backend task
- Skip index applies to tag-filtered list, not global list
- Tag filtering happens before skip indexing

### Validation & Error Handling

**[FR-009] Validate skip is non-negative**
Reject negative skip values with clear error message.

Acceptance Criteria:
- Throws error: "Skip count must be a non-negative number"
- Validation occurs in CLI layer (`validateOptions()`)
- Error thrown before core logic executes

**[FR-010] Validate skip is numeric**
Reject non-numeric skip values.

Acceptance Criteria:
- Commander.js handles type coercion automatically
- Invalid values (e.g., `--skip abc`) produce error
- Error message indicates invalid type

**[FR-011] Skip equals zero vs. skip omitted**
Both `--skip 0` and omitting the parameter produce identical behavior.

Acceptance Criteria:
- Both return first eligible task
- No distinction in output or behavior
- Core layer treats `undefined` and `0` identically

---

## 5. Non-Functional Requirements

### Performance

**[NFR-001] No Performance Regression**
Skip parameter must not degrade existing `task-master next` performance.

Acceptance Criteria:
- Skip logic is O(1) array indexing
- No additional storage queries or expensive operations
- Execution time equivalent to current `getNext()` for skip=0

### Maintainability

**[NFR-002] Code Quality Standards**
Implementation must follow project coding standards.

Acceptance Criteria:
- All business logic in `@tm/core`, CLI is thin presentation layer
- No code duplication (DRY principle)
- TypeScript strict mode compliance
- Clear, self-documenting variable names

**[NFR-003] Test Coverage**
Comprehensive test coverage for skip parameter behavior.

Acceptance Criteria:
- 10 integration test cases (specified in Decision Register)
- 6 unit test cases (specified in Decision Register)
- All edge cases covered
- Tests document expected behavior

### Backward Compatibility

**[NFR-004] Zero Breaking Changes**
Existing workflows and scripts must continue working unchanged.

Acceptance Criteria:
- `task-master next` without `--skip` behaves identically to current version
- Existing tests pass without modification
- No changes to task data model or storage schema
- No changes to MCP tools or other interfaces

---

## 6. Content & CMS Specification

**Not applicable** - This is a CLI feature with no CMS or content components.

---

## 7. Visual & UX Constraints

### CLI Help Text

**[UX-001] Clear help text description**
The `--skip` option help text must clearly explain the use case.

Acceptance Criteria:
- Description: "Skip N eligible tasks (useful for parallel work with multiple agents)"
- Mentions primary use case (parallel work)
- Concise and scannable

**[UX-002] Consistent option syntax**
Follow existing CLI option patterns.

Acceptance Criteria:
- Syntax: `.option('--skip <count>', description)`
- No short flag (no `-s` alias)
- Angle brackets indicate required value
- Matches pattern of other numeric options

### Error Messages

**[UX-003] Clear validation error**
Negative skip value error message is actionable.

Acceptance Criteria:
- Message: "Skip count must be a non-negative number"
- Explains constraint clearly
- Uses consistent error formatting

**[UX-004] Helpful skip-too-high warning**
Warning when skip exceeds available tasks guides user.

Acceptance Criteria:
- Message: "✓ No eligible task at skip index {skip}. Only {count} tasks are available."
- Shows actual skip value provided
- Shows actual available count
- Uses checkmark prefix (consistent with other informational messages)

---

## 8. Infrastructure & Deployment Behavior

**Not applicable** - This is a CLI feature with no special deployment considerations beyond standard release process.

---

## 9. Error Handling & Edge Cases

### Edge Cases

**[EC-001] Skip with single eligible task**
When only one task is eligible and skip is 0 or 1.

Acceptance Criteria:
- Skip 0: Returns the single task
- Skip 1: Returns null with "No eligible task at skip index 1. Only 1 task is available."
- Existing behavior for no skip preserved

**[EC-002] Skip with duplicate priority tasks**
When multiple tasks have identical priority levels.

Acceptance Criteria:
- Uses existing tiebreaker: dependency count, then task ID
- Skip index respects final sorted order
- Deterministic results for same task set

**[EC-003] Skip with dynamic task list**
When task eligibility changes between agent calls.

Acceptance Criteria:
- No coordination or locking mechanism
- Each call reflects current state
- Acceptable for agents to receive different-than-expected tasks
- All returned tasks are valid eligible work

**[EC-004] Skip with subtasks from in-progress parent**
When eligible tasks include subtasks from in-progress parent.

Acceptance Criteria:
- Skip applies to subtask candidate list
- Respects Phase 1 priority (subtasks before top-level tasks)
- Returns correct subtask at skip index

**[EC-005] Skip with no tasks in project**
When project has no tasks at all.

Acceptance Criteria:
- Returns null with existing "No tasks found in this project" message
- No skip-specific messaging (no tasks exist to skip)

---

## 10. Acceptance Criteria (Global)

### Definition of Done

**[AC-001] Implementation Complete**
- [ ] All functional requirements (FR-001 through FR-011) implemented
- [ ] All non-functional requirements (NFR-001 through NFR-004) met
- [ ] All UX requirements (UX-001 through UX-004) satisfied
- [ ] All edge cases (EC-001 through EC-005) handled

**[AC-002] Testing Complete**
- [ ] All 10 integration tests pass
- [ ] All 6 unit tests pass
- [ ] No regressions in existing test suite
- [ ] Manual testing with parallel agents validates workflow

**[AC-003] Documentation Complete**
- [ ] CLI help text updated with `--skip` option
- [ ] Usage examples demonstrate multi-agent workflow
- [ ] Code comments explain skip logic where non-obvious

**[AC-004] Quality Gates Passed**
- [ ] TypeScript type checking passes (`npm run turbo:typecheck`)
- [ ] No ESLint violations
- [ ] Code review approved
- [ ] Changeset created for release notes

### Preconditions for Launch

- [ ] All acceptance criteria met
- [ ] No breaking changes detected
- [ ] Performance benchmarks show no regression
- [ ] Documentation reviewed for clarity

---

## 11. Out-of-Scope / Deferred Work

### Explicitly Out of Scope

**[OOS-001] Agent Registration System**
- No `assignedAgent` field in task model
- No atomic task claiming mechanism
- No built-in coordination between agents
- Deferred to future consideration if simple skipping proves insufficient

**[OOS-002] Skip Specific Task IDs**
- No `--skip 5,7` syntax to skip specific task IDs
- No skip by task criteria (priority, status, etc.)
- Only ordinal skipping supported

**[OOS-003] List-Eligible Command**
- No separate `task-master list-eligible` command
- No discovery phase before selection
- Single-command workflow only

**[OOS-004] MCP Tool Changes**
- No changes to MCP `next_task` tool
- MCP tools have separate layer and API

### Future Phases (Non-Binding)

**Potential enhancements if user feedback indicates need:**
- Agent registration system for automatic coordination
- Skip specific task IDs syntax
- Multi-task batch retrieval (`--take <count>`)
- Random task distribution for load balancing

---

## 12. Traceability

### Decision → PRD Mapping

**From Decision Register:**
- **Decision 1 (Architecture)** → FR-003, FR-004, NFR-002
- **Decision 2 (API Design)** → FR-001, FR-002, FR-003, FR-004, FR-005, FR-008
- **Decision 3 (Error Handling)** → FR-006, FR-007, UX-004, EC-001
- **Decision 4 (Validation)** → FR-009, FR-010, FR-011, UX-003
- **Decision 5 (Testing)** → NFR-003, AC-002
- **Decision 6 (Documentation)** → UX-001, UX-002, AC-003

### Exploration Risks Addressed

**Risk 1: Race Conditions** → EC-003 (accepted as documented behavior)
**Risk 2: Skip Index Changes** → EC-003 (documented as acceptable)
**Risk 3: No Unique Assignment Enforcement** → OOS-001 (deferred to agent registration system)

### Code Paths for Implementation Impact

**Primary Files:**
- `apps/cli/src/commands/next.command.ts:20-150` - CLI option parsing and validation
- `packages/tm-core/src/modules/tasks/tasks-domain.ts:153-154` - Domain facade
- `packages/tm-core/src/modules/tasks/services/task-service.ts:299-418` - Core skip logic
- `apps/cli/tests/integration/commands/next.command.test.ts` - Integration tests

**Implementation Order:**
1. Update service layer (`task-service.ts`) with skip logic
2. Update domain facade (`tasks-domain.ts`) with new parameter
3. Update CLI command (`next.command.ts`) with option and validation
4. Write unit tests for service layer
5. Write integration tests for CLI command
6. Update CLI help text
7. Create changeset

---

## Appendix: Usage Examples

### Basic Multi-Agent Workflow

```bash
# Terminal 1 - Agent 1 (takes first task)
task-master next
# Output: Task #5 (critical priority)

# Terminal 2 - Agent 2 (takes second task)
task-master next --skip 1
# Output: Task #7 (high priority)

# Terminal 3 - Agent 3 (takes third task)
task-master next --skip 2
# Output: Task #2 (medium priority)
```

### With Tag Filtering

```bash
# Agent 1 working on backend tasks
task-master next --tag backend

# Agent 2 working on backend tasks (skips first backend task)
task-master next --tag backend --skip 1

# Agent 3 working on frontend tasks
task-master next --tag frontend
```

### Programmatic Usage

```bash
# For scripts that need JSON output
task-master next --skip 1 --format json
# Output: {"task": {...}, "found": true, "tag": "master", "storageType": "json"}

# Silent mode for automation
task-master next --skip 2 --silent --format json > /tmp/next-task.json
```

### Error Cases

```bash
# Negative skip (error)
task-master next --skip -1
# Error: Skip count must be a non-negative number

# Skip exceeds available tasks (graceful)
task-master next --skip 10
# ✓ No eligible task at skip index 10. Only 3 tasks are available.
```
