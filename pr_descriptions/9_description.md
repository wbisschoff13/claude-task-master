# What type of PR is this?
<!-- Check one -->

 - [ ] 🐛 Bug fix
 - [x] ✨ Feature
 - [ ] 🔌 Integration
 - [ ] 📝 Docs
 - [ ] 🧹 Refactor
 - [ ] Other:

## Description

This PR adds complexity-based filtering to the `expand --all` command, allowing users to expand only tasks that meet a minimum complexity threshold (1-10). This helps focus AI expansion efforts on the most complex tasks first.

The feature integrates with the existing `analyze-complexity` command and gracefully degrades when the complexity report is missing. Implementation spans MCP tool layer, CLI commands, and core expansion logic with comprehensive test coverage.

### Key Changes

- **MCP Tool**: Added `threshold` parameter to `expand-all` tool schema with Zod validation
- **CLI**: Added `--threshold / -t` flag to `expand` command for CLI usage
- **Core Logic**: Implemented complexity score filtering before task expansion
- **Validation**: Range validation (1-10) with user-friendly warning messages
- **UX**: Improved error messages guide users to run `analyze-complexity` when report is missing
- **Tests**: Added 5 comprehensive test cases covering filtering edge cases (threshold met, below threshold, missing report, zero threshold)
- **Test Quality**: Removed global `fs` mock, improved test isolation with local `jest.spyOn()`

### Technical Implementation

The threshold filtering happens after initial task eligibility filtering (status + subtask check) but before expansion begins:

1. Filter tasks by status (`pending` or `in-progress`) and subtask count
2. If threshold is set, read complexity report and filter by minimum score
3. Log before/after counts for transparency
4. Proceed with expansion on filtered task list

Error handling ensures graceful degradation:
- Missing complexity report → Log warning, expand all eligible tasks
- Invalid threshold range (< 1 or > 10) → Log warning, ignore threshold
- Read errors → Log warning, proceed without threshold

## Related Issues

<!-- Link issues: Fixes #123 -->
N/A (feature addition)

## How to Test This

### Automated Tests
- [x] `npm test -- tests/unit/scripts/modules/task-manager/expand-all-tasks.test.js`
  - All 17 tests passing (12 existing + 5 new threshold tests)

**Expected result:**
```
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

### Manual Testing

#### Test 1: Basic threshold filtering with complexity report
```bash
# Create test tasks
task-master init
task-master add-task "Simple task"
task-master add-task "Complex task"

# Analyze complexity
task-master analyze-complexity

# Expand only high-complexity tasks (>= 6)
task-master expand --all --threshold 6

# Expected: Only tasks with complexity >= 6 are expanded
# Log output shows: "Threshold filter: X tasks → Y tasks (Z excluded)"
```

#### Test 2: Threshold without complexity report
```bash
# Skip analyze-complexity step
task-master expand --all --threshold 5

# Expected: Warning message displayed, all eligible tasks expanded
# Log output: "Threshold specified but no complexity report found. Run 'task-master analyze-complexity' first..."
```

#### Test 3: Invalid threshold range
```bash
task-master expand --all --threshold 15

# Expected: Warning about invalid range, threshold ignored
# Log output: "Threshold 15 is outside valid range (1-10). Ignoring threshold filter."
```

#### Test 4: CLI flag shorthand
```bash
task-master expand --all -t 7

# Expected: Same behavior as --threshold 7
```

#### Test 5: MCP tool usage
```bash
# Via MCP client (Claude, Cursor, etc.)
mcp-tool-call: expand-all, threshold: 6

# Expected: Only tasks with complexity >= 6 expanded
```

**Expected result:**
- Threshold filtering works correctly when complexity report exists
- Graceful degradation with helpful warnings when report missing
- Invalid threshold values are rejected with clear messages
- All existing expand functionality remains unchanged

## Contributor Checklist

- [ ] Created changeset: `npm run changeset` (TODO: Add before merge)
- [x] Tests pass: `npm test`
- [ ] Format check passes: `npm run format-check` (or `npm run format` to fix)
- [ ] Addressed CodeRabbit comments (if any)
- [x] Linked related issues (if any)
- [x] Manually tested the changes

## Changelog Entry

Added `--threshold` flag to `expand --all` command for filtering tasks by minimum complexity score (1-10). Requires complexity report from `analyze-complexity` command. Gracefully degrades when report is missing with helpful guidance.

---

### For Maintainers

- [x] PR title follows conventional commits
- [x] Target branch correct (main)
- [ ] Labels added
- [ ] Milestone assigned (if applicable)

---

## Risk Assessment: **Low**

**Risk Level**: Low

**Justification**:
- All changes are additive - no existing functionality modified
- Graceful degradation ensures feature doesn't break existing workflows
- Comprehensive test coverage (5 new tests, all passing)
- Input validation prevents invalid states
- Clear error messaging guides users to correct usage

**Mitigations**:
- Backwards compatible: threshold is optional, defaults to null (no filtering)
- Missing complexity report handled gracefully with warning
- Invalid threshold values rejected with clear user feedback
- Test isolation improved (removed global mocks)

## Breaking Changes

None. Feature is opt-in via optional `--threshold` flag.

## Migration Notes

No migration required. Feature is fully backwards compatible.

## Additional Context

This feature helps users prioritize AI expansion efforts on the most complex tasks, saving time and API costs. It's particularly useful in large projects where expanding all tasks would be expensive or time-consuming.

The implementation follows the project's pattern of graceful degradation and user-friendly error messaging. Tests use local mocks for better isolation and removed the global `fs` mock to prevent test pollution.
