Add `skipCount` parameter to `getNextTask` method to enable flexible task retrieval with offset capabilities. This enhancement allows skipping a specified number of tasks before returning the next available task, improving workflow control for parallel development and task management scenarios.

The implementation adds an optional `skipCount` parameter (default: 0) to the TasksDomain's `getNextTask` method, integrates it into the MCP tool interface, and includes comprehensive test coverage for the new functionality.

## Key changes
- Added `skipCount` parameter to `TasksDomain.getNextTask()` method in `packages/tm-core/src/domains/tasks/index.ts`
- Updated MCP tool schema in `apps/mcp/src/tools/tasks/next-task.ts` to include `skipCount` as an optional parameter
- Added parameter validation to ensure `skipCount` is non-negative
- Added comprehensive unit tests in `packages/tm-core/src/domains/tasks/index.spec.ts` covering:
  - Skip with count of 0 (returns first available task)
  - Skip with count greater than 0 (returns task after skipping N tasks)
  - Skip count larger than available pending tasks (returns null)
  - Error handling for negative skipCount values
- Updated task state JSON formatting with minor structural improvements

## How to test

### Automated Tests
- [ ] `npm run turbo:typecheck` - Verify TypeScript type checking passes
- [ ] `npm run test` - Run all unit and integration tests
- [ ] `npm run turbo:build` - Verify build completes successfully

### Manual Testing
- [ ] Test `task-master next` CLI command (should return first available task)
- [ ] Test `task-master next --skip-count=2` via MCP tool (should skip first 2 pending tasks)
- [ ] Test with skipCount larger than available tasks (should return null/undefined)
- [ ] Verify negative skipCount values are rejected with appropriate error message
- [ ] Test edge case: skipCount equals exact number of pending tasks (should return null)

## Risk Assessment (Low)

This is a low-risk enhancement with backward compatibility fully maintained:

- **Default behavior unchanged**: Existing code continues to work as `skipCount` defaults to 0
- **Comprehensive test coverage**: New unit tests verify all edge cases and error conditions
- **Type-safe implementation**: TypeScript ensures proper parameter validation at compile time
- **Non-breaking addition**: No existing functionality is modified or removed
- **Clear error handling**: Invalid inputs (negative values) are rejected with descriptive errors

The change is isolated to a single method enhancement and does not affect the core task data structure or persistence layer.

## Checklist
- [x] Tests added or updated (comprehensive unit tests added)
- [ ] Documentation updated (may require updates to user-facing docs)
- [x] Backwards compatible (yes, default parameter value maintains existing behavior)
- [x] Secrets redacted or none present (no secrets in code changes)
