Add comprehensive test coverage for the `--skip` CLI parameter, ensuring robust validation and functionality for task skipping behavior. This test suite verifies that the CLI properly validates the skip parameter (rejecting negative and decimal values) and correctly skips the specified number of eligible tasks when retrieving the next task.

## Key changes
- Added 9 new integration tests to `apps/cli/tests/integration/commands/next.command.test.ts` covering:
  - **Parameter validation tests** (7 tests):
    - Valid skip values (0, positive integers, omitted parameter)
    - Invalid values (negative integers, decimals, non-numeric strings)
    - Descriptive error messages for validation failures
  - **Functionality tests** (2 tests):
    - Skipping a single task returns a different task
    - Skipping multiple tasks works correctly
- Updated `runNext` test helper to accept command arguments for flexible testing
- Tests validate both Commander.js built-in validation and custom validation logic
- All 17 tests in the next command test suite pass (9 new + 8 existing)

## How to test

### Automated Tests
- [ ] `npm run turbo:typecheck` - ⚠️ Note: Pre-existing type error in @tm/core (unrelated to this PR)
- [x] `npm run test -w @tm/cli -- tests/integration/commands/next.command.test.ts` - All 17 tests pass (✓)

### Manual Testing
```bash
# Build the CLI
npm run turbo:build

# Test --skip parameter validation
task-master next --skip 0      # Should work (skip 0 tasks)
task-master next --skip 1      # Should work (skip 1 task)
task-master next --skip -1     # Should fail with error
task-master next --skip 1.5    # Should fail with error
task-master next              # Should work (no skip parameter)

# Test functionality with multiple pending tasks
task-master next              # Get first task
task-master next --skip 1     # Get second task
task-master next --skip 2     # Get third task
```

## Risk Assessment (Low)

This is a low-risk test-only addition with no production code changes:

- **No production code modified**: Only test files are changed
- **Comprehensive coverage**: New tests cover all validation edge cases and functionality
- **Non-breaking**: Existing functionality remains unchanged
- **All tests passing**: 17/17 tests pass in the next command suite
- **Pre-existing issues**: Type checking fails due to unrelated @tm/core error (exists before this PR)

The test suite provides confidence that the `--skip` parameter implementation (added in previous tasks) works correctly and handles edge cases appropriately.

## Checklist
- [x] Tests added or updated (9 new integration tests added)
- [ ] Documentation updated (N/A - test-only change)
- [x] Backwards compatible (yes - no production code changes)
- [x] Secrets redacted or none present (no secrets in test files)
