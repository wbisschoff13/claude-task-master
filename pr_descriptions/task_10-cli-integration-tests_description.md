# test(cli): fix integration tests for --skip parameter alignment

This PR adds comprehensive integration tests for the `task-master next --skip` parameter, covering all scenarios including basic skip functionality, JSON output, silent mode, validation, edge cases, and parallel agent workflows. The tests ensure that the `--skip` parameter correctly allows multiple agents to work in parallel by skipping N eligible tasks to return the (N+1)th task.

## Key changes

- **New test file**: Added `apps/cli/tests/integration/commands/next-skip.command.test.ts` with 44 comprehensive integration tests
- **Test infrastructure**: Created reusable test utilities with temporary project directories and mock Task Master installations
- **Timeout optimizations**: Adjusted vitest default timeouts (root: 10s→5s, cli: 30s→10s) for faster test execution, with parallel workflow tests using 30s explicit timeout
- **Test coverage**: 12 test scenarios covering skip functionality, validation, edge cases, and backward compatibility
- **Clarified behavior**: Tests verify that `--tag` parameter is for file section selection (legacy format), not task tags filtering

## How to test

### Automated Tests

```bash
# Run integration tests from CLI package
cd apps/cli
npm run test -- tests/integration/commands/next-skip.command.test.ts
```

Expected result: **44 tests passing** (coverage warnings are expected and not failures)

**Test scenarios covered:**
1. Basic skip functionality (`--skip 0`, `--skip 1`, `--skip 2`)
2. JSON output with skip parameter
3. Silent mode with skip parameter
4. Validation (negative, non-numeric, decimal values)
5. Edge cases (skip exceeds available, no tasks, all completed)
6. Parallel agent workflow simulation (3 tests with 30s timeout)
7. Error handling (large values, malformed data, corrupted files)
8. Backward compatibility verification

### Manual Testing

```bash
# Initialize a test project
task-master init --yes

# Create multiple tasks
task-master add-task --prompt="Task 1"
task-master add-task --prompt="Task 2"
task-master add-task --prompt="Task 3"

# Test basic skip
task-master next --skip 0  # Should return Task 1
task-master next --skip 1  # Should return Task 2
task-master next --skip 2  # Should return Task 3

# Test JSON output
task-master next --skip 1 --format json

# Test silent mode
task-master next --skip 1 --silent

# Test validation (should show error)
task-master next --skip -1
task-master next --skip abc
```

## Risk Assessment (Low)

**Risk Level:** Low

**Rationale:**
- Tests only – no production code changes
- All 44 tests passing, covering comprehensive scenarios
- Backward compatibility verified – existing `task-master next` behavior preserved
- Test infrastructure isolated to temporary directories
- No changes to CLI command implementation

**Mitigations:**
- Comprehensive test coverage includes edge cases and error conditions
- Tests are self-contained and clean up temporary resources
- Timeout configurations optimized for different test scenarios

## Checklist

- [x] Tests added or updated
  - 44 new integration tests for `--skip` parameter
  - Test infrastructure utilities created
- [x] Documentation updated
  - Inline JSDoc comments describe test scenarios
  - Test file organized with clear describe blocks
- [x] Backwards compatible
  - Existing `task-master next` behavior preserved
  - Backward compatibility tests included
- [x] Secrets redacted or none present
  - No secrets or credentials in test files or configuration

## Technical Details

**Test Architecture:**
- Tests spawn actual CLI processes using `execFileSync`
- Temporary project directories created for isolation
- Mock task data generated using `@tm/core/testing` utilities
- JSON parsing utilities for validating `--format json` output

**Timeout Strategy:**
- Root vitest config: 5s default (fast unit tests)
- CLI vitest config: 10s default (integration tests)
- Parallel workflow tests: 30s explicit timeout (multiple CLI invocations)

**Parallel Workflow Simulation:**
Three tests simulate multiple agents working concurrently:
1. `should simulate parallel workflow with multiple agents` – 5 agents claiming tasks
2. `should handle parallel workflow with dependencies correctly` – dependent tasks
3. `should allow agents to claim tasks without blocking` – 3 agents, different skip values

**Task-Master Integration:**
- Task 10 marked as complete in `.taskmaster/tasks/tasks.json`
- Subtask 10.1 (test infrastructure) marked as done
- Completed count updated from 9 to 10 tasks
