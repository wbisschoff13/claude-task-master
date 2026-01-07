This PR improves user experience when using `task-master next --skip` by detecting when the skip value exceeds the number of available eligible tasks and displaying helpful guidance. Previously, users would see a generic "no tasks found" message without context, making it unclear whether skip exceeded available tasks or no tasks existed at all.

## Key changes
- Added skip-exceeded detection that compares skip value against count of eligible (pending/deferred) tasks with no unmet dependencies
- Display user-friendly message showing the skip index used and actual number of available tasks
- Provide actionable tip suggesting the correct skip value to get the last available task
- Extracted eligibility calculation logic into `countEligibleTasks()` and `areAllDependenciesDone()` methods for better testability and code organization
- Extended `NextTaskResult` interface to include `skipValue` and `availableTaskCount` for display logic

## How to test

### Automated Tests
- [ ] `npm run turbo:typecheck` - Verify TypeScript types pass
- [ ] `npm run test` - Run all unit and integration tests
- [ ] `npm run turbo:build` - Ensure build succeeds

### Manual Testing
- [ ] Create 3 pending tasks with no dependencies
- [ ] Run `task-master next --skip=0` - Should show first task
- [ ] Run `task-master next --skip=2` - Should show third task
- [ ] Run `task-master next --skip=3` - Should show: "✓ No eligible task at skip index 3. Only 3 tasks available." with tip to use `--skip=2`
- [ ] Run `task-master next --skip=10` - Should show appropriate message for large skip value
- [ ] Create tasks with dependencies and verify only eligible tasks are counted

## Risk Assessment
**Low** - This is a display enhancement that adds new messaging without changing core task selection logic. The eligibility counting logic is isolated and only affects error messaging paths. No breaking changes to existing functionality.

## Checklist
- [x] Tests added or updated (existing tests cover core logic, new display code is cosmetic)
- [ ] Documentation updated (if user docs exist, update to mention skip behavior)
- [x] Backwards compatible (yes, only adds helpful messaging)
- [x] Secrets redacted or none present (none present)
