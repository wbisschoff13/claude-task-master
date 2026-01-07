# Add skipCount Parameter to TasksDomain.getNext()

This PR enhances the `TasksDomain.getNext()` method by adding a `skipCount` parameter, allowing users to skip eligible tasks when retrieving the next available task. This is useful for workflows where users want to skip previously attempted tasks.

## Key changes
- Added optional `skipCount` parameter to `TasksDomain.getNext()` method
- Parameter is passed through to `TaskService.getNextTask()`
- Added comprehensive JSDoc documentation with examples
- Added unit tests for parameter pass-through and edge cases
- Clarified skipCount fallthrough logic in `TaskService.getNextTask()` comment

## How to test

### Automated Tests
- ✅ `npm run turbo:typecheck` - TypeScript type checking passes
- ✅ `npm run test -w @tm/core -- src/modules/tasks/tasks-domain.spec.ts` - All 7 new tests pass
  - Tests parameter pass-through with various skipCount values (0, 1, 5)
  - Tests backward compatibility (skipCount omitted)
  - Tests error propagation from service layer
  - Tests null return when no task found

### Manual Testing
```bash
# Initialize Task Master project with sample tasks
task-master init

# Parse a PRD to create multiple tasks
task-master parse-prd .taskmaster/templates/example_prd.md

# Test skipCount functionality via CLI (once implemented)
task-master next                    # Get first eligible task
task-master next --skip 1          # Get second eligible task
task-master next --skip 2          # Get third eligible task
```

### Code Review Checklist
- [x] Parameter signature correctly added to domain facade
- [x] Proper pass-through to service layer maintained
- [x] JSDoc documentation includes examples and use cases
- [x] Backward compatibility preserved (skipCount is optional)
- [x] Unit tests cover parameter pass-through and edge cases
- [x] Comment in task-service.ts clarifies fallthrough behavior

## Risk Assessment (Low)

**Risk Level**: Low

This is a non-breaking enhancement that:
- Adds an optional parameter with sensible default behavior (undefined)
- Maintains full backward compatibility - existing calls without skipCount continue to work
- Only affects the public API surface, no internal logic changes
- Has comprehensive unit test coverage for the new functionality
- Passes TypeScript type checking

**Mitigations**:
- All new functionality is unit tested (7 tests, all passing)
- Parameter is optional, preserving existing behavior
- Clear JSDoc documentation prevents misuse
- Type safety enforced through TypeScript

## Additional Notes

The skipCount parameter enables use cases like:
- Skipping tasks that were previously started but not completed
- Implementing "next task" workflows that skip blocked tasks
- Providing task navigation with skip-ahead functionality

The implementation follows the architecture principle that business logic lives in tm-core, with the domain layer (TasksDomain) acting as a clean facade that passes parameters through to the service layer (TaskService).

---

**Commit message after squash merge**:
```
feat(tasks): add skipCount parameter to getNext domain method

Add optional skipCount parameter to TasksDomain.getNext() for skipping
eligible tasks. Includes JSDoc documentation and unit tests for parameter
pass-through and edge cases.
```
