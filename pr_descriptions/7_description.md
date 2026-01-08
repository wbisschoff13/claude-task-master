Fix a critical bug in the skip logic where parent tasks with eligible subtasks were incorrectly included in the top-level eligible task list, causing the skip parameter to count them twice. When using `--skip`, parent task hierarchies (parent + all subtasks) must be treated as a single unit in the skip index.

## Key changes
- **Bug fix**: Modified `task-service.ts` to exclude parent tasks with eligible subtasks from top-level consideration during skip indexing (lines 458-489)
- **Validation**: Added comprehensive unit test suite with 28 tests covering all skip logic scenarios (720+ lines)
- **Test coverage**: Basic skip indexing, boundary conditions, priority sorting, dependency resolution, subtask hierarchies, backward compatibility, performance with large task sets, error handling, and edge cases

## How to test

### Automated Tests
- [x] `npm run turbo:typecheck` - TypeScript compilation passes
- [x] `npx vitest run packages/tm-core/src/modules/tasks/services/task-service.spec.ts` - All 28 skip logic tests pass

### Manual Testing
```bash
# Create a project with in-progress task containing subtasks
task-master init
task-master parse-prd .taskmaster/docs/prd.md

# Set a parent task to in-progress
task-master set-status --id=1 --status=in-progress

# Verify skip parameter correctly treats parent+subtasks as single unit
# skip=0 should return first subtask (1.1)
task-master next --skip=0
# skip=2 should return third subtask (1.3) or next task if no third subtask
task-master next --skip=2
# skip=3 should skip the ENTIRE parent hierarchy and return next top-level task
task-master next --skip=3
```

## Risk Assessment
**Low risk** - This is a targeted bug fix with comprehensive test coverage. The change only affects the skip logic path when parent tasks have eligible subtasks. Backward compatibility is maintained for all other scenarios.

## Technical details
The bug occurred because parent tasks with eligible subtasks were being included in both the `candidateSubtasks` array (for their subtasks) AND the top-level `eligibleTasks` array. This meant a parent with 3 subtasks would consume 4 skip positions (1 for parent + 3 for subtasks) instead of 3 (just the subtasks).

The fix checks if a parent task has any pending subtasks with satisfied dependencies, and if so, excludes the parent from the top-level eligible tasks list. This ensures the entire hierarchy is treated as a single unit.

## Checklist
- [x] Tests added - 28 comprehensive unit tests for skip logic
- [x] Documentation updated - JSDoc comments updated with parent hierarchy behavior
- [x] Backwards compatible - Existing behavior preserved for non-hierarchical scenarios
- [x] No secrets or credentials in code
