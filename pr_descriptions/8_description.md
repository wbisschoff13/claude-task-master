Add comprehensive JSON output tests for the `--skip` parameter to ensure programmatic interfaces (scripts, MCP tools, CI/CD pipelines) can reliably consume the `next` command output. This test suite validates JSON structure, field completeness, edge cases, and backward compatibility when using `--skip` with `--format json`.

## Key changes

- Add 379 new test cases covering JSON output with `--skip` parameter
- Validate JSON structure integrity when `--skip` is used
- Test edge cases: skip=0, skip exceeds available tasks, no tasks, all tasks completed
- Verify compatibility with other CLI flags: `--silent`, `--tag`
- Ensure backward compatibility for existing JSON consumers
- Test `skipValue` and `availableTaskCount` fields are correctly populated
- Validate JSON parsing for programmatic consumption

## How to test

### Automated Tests
- [x] `npm run test` (1483 passed, 1 flaky performance test unrelated to changes)
- [x] All new JSON output tests pass (379 new test cases)
- [ ] `npm run turbo:typecheck` (if you want to verify TypeScript)

### Manual Testing
```bash
# Basic JSON output with skip
task-master next --format json --skip 1

# Edge case: skip exceeds available tasks
task-master next --format json --skip 999

# Verify JSON structure
task-master next --format json | jq '.'
```

**Expected result:**
- Valid JSON output with all required fields
- `skipValue` field reflects the `--skip` parameter value
- `availableTaskCount` shows count of eligible tasks
- `task` field contains the next task or `null` if not found
- Backward compatible with existing JSON consumers

## Risk Assessment (Low)

This is a test-only PR with no production code changes. The new tests validate existing behavior and ensure JSON output remains stable for programmatic consumers. No breaking changes or user-facing modifications.

## Checklist

- [x] Tests added (379 new test cases for JSON output)
- [ ] Documentation updated (not needed - test-only change)
- [x] Backwards compatible (validates existing JSON structure)
- [x] Secrets redacted or none present
