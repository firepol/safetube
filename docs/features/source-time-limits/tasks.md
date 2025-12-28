# Source-Level Time Limits: Implementation Plan

## Implementation Overview

The source-level time limits feature is organized into 6 implementation phases, building incrementally from database schema changes through admin UI implementation to enforcement in the player.

**Dependencies**: None (integrates with existing time tracking system)

---

## Phase 1: Database Schema and Type Updates (Foundation)

**Goal**: Establish database schema changes and update TypeScript type definitions

### Task 1.1: [x] Add Column to Sources Table
**References**: Requirements #1, #8

- Create: `src/main/database/schema/migrations/add-source-time-limits.sql` ✓
- Add: `daily_time_limit_minutes INTEGER DEFAULT NULL` to sources table ✓
- Add: Index `idx_sources_daily_time_limit ON sources(daily_time_limit_minutes)` ✓
- Document SQLite migration strategy ✓
- Create rollback script ✓
- Verify: No data loss, migrations apply correctly, index created ✓
- Test: Column exists, migration reversible, index improves performance ✓

**Completion Notes**: The column was already integrated into SimpleSchemaManager. Updated fixSourcesTableColumns() to preserve daily_time_limit_minutes during schema migrations.

---

### Task 1.2: [x] Extend Usage Logs Table
**References**: Requirements #2, #8

- Create: `src/main/database/schema/migrations/extend-usage-logs.sql` ✓
- Add: `source_id TEXT DEFAULT NULL` column ✓
- Add: Foreign key `REFERENCES sources(id) ON DELETE SET NULL` ✓
- Add: Index `idx_usage_logs_source_id ON usage_logs(source_id, date)` ✓
- Document handling of legacy NULL source_id entries ✓
- Test: Column nullable, FK constraint works, cascading delete correct, index improves query performance ✓

**Completion Notes**: Implemented composite UNIQUE(date, source_id) constraint to support both global and per-source usage tracking. Updated all query functions to filter for global usage (source_id IS NULL). Fixed NULL uniqueness issue by using DELETE + INSERT for upserts.

---

### Task 1.3: [x] Extend Usage Extras Table
**References**: Requirements #4, #11

- Create: `src/main/database/schema/migrations/extend-usage-extras.sql` ✓
- Add: `source_id TEXT DEFAULT NULL` column ✓
- Add: Foreign key `REFERENCES sources(id) ON DELETE SET NULL` ✓
- Add: Index `idx_usage_extras_source_id ON usage_extras(source_id, date)` ✓
- Test: Column exists, FK constraint works, cascading delete correct ✓
- Verify: Backward compatible with global extensions ✓

**Completion Notes**: Allows tracking multiple extensions per day per source. No UNIQUE constraint needed as extensions can be granted multiple times.

---

### Task 1.4: [x] Update Database Type Definitions
**References**: Requirements #2, #8

- File: `src/main/database/queries/types.ts` ✓
- Add to Source: `daily_time_limit_minutes: number | null` ✓
- Add to UsageLog: `source_id: string | null` ✓
- Add to UsageExtra: `source_id: string | null` ✓
- Create SourceTimeState interface ✓
- Create SourceTimeEnforcement interface ✓
- Verify: No TS errors, types exported, backward compatible ✓

**Completion Notes**: Added two new interfaces for Phase 1 to support source time tracking type safety.

---

### Task 1.5: [x] Update Shared Types
**References**: Requirements #2

- File: `src/shared/types.ts` ✓
- Create/extend SourceTimeState interface ✓
- Extend TimeTrackingState: add sourceTimeState?, sourceBlocked?, blockedSourceId? fields ✓
- Export all new types ✓
- Test: Type compilation, exports work correctly ✓

**Completion Notes**: All 5 Phase 1 tasks completed. TypeScript type checking passes. Database tests pass: 232/232.

---

## Rules & Tips (Lessons from Phase 1)

### Database Schema
- **NULL uniqueness in SQLite**: UNIQUE constraints treat NULL values as distinct. For composite constraints like UNIQUE(date, source_id), multiple NULL values don't violate uniqueness. When you need global+per-item tracking with NULL, either:
  1. Use DELETE + INSERT pattern for upserts (simpler, what we do)
  2. Use a sentinel value like 'global' instead of NULL (more explicit)
  3. Keep global tracking in a separate column/table

- **SimpleSchemaManager pattern**: The actual schema is defined programmatically in SimpleSchemaManager.ts, not in migration files. Migration files (.sql) are documentation/rollback reference. Always update both places.

- **Foreign key ON DELETE SET NULL**: Used for source_id in usage logs to allow historical tracking even if a source is deleted (source_id becomes NULL).

- **Composite indexes**: (source_id, date) index helps queries that filter by source and date range.

### TypeScript Types
- **SourceTimeState vs SourceTimeEnforcement**: Keep state (what is the current time) separate from enforcement (what can the user do). Makes logic clearer.

- **Backward compatibility**: Always make new fields optional (?:) in existing interfaces to avoid breaking existing code.

### Query Design
- **Filtering for global usage**: All existing queries that worked before must continue to work. They only track global usage now, so filter with `WHERE source_id IS NULL` to maintain backward compatibility.

- **Test isolation**: Database tests reset between runs. Verify UNIQUE constraints and data isolation work correctly.

---

## Phase 2: Time Tracking Service Enhancement (Core Logic)

**Goal**: Implement all time tracking logic for source-level limits
**Blockers**: Phase 1 complete

### Task 2.1: [ ] Implement `getSourceTimeState()` Function
**References**: Requirements #2, #3, #7

- File: `src/main/timeTracking.ts`
- Query sources table for daily_time_limit_minutes
- Query usage_logs: `SUM(seconds_used) WHERE source_id=? AND date=?`
- Query usage_extras: `SUM(minutes_added) WHERE source_id=? AND date=?`
- Calculate: secondsUsedToday, extensionSeconds, totalAllowedSeconds, secondsRemainingToday, isLimitExceeded
- Handle NULL limit as unlimited
- Return SourceTimeState object
- Test: Correct remaining time, NULL limit, extensions included, edge cases (0 min, no usage)

---

### Task 2.2: [ ] Implement `recordSourceWatchTime()` Function
**References**: Requirements #2

- File: `src/main/timeTracking.ts`
- Check if today's entry exists in usage_logs for source
- If exists: increment seconds_used
- If not exists: create new entry with today's date
- Round secondsWatched to nearest second
- Test: Creates/increments entries, accumulates correctly, tracks sources separately

---

### Task 2.3: [ ] Implement `enforceSourceTimeLimit()` Function
**References**: Requirements #3, #11

- File: `src/main/timeTracking.ts`
- Call getSourceTimeState(sourceId)
- If dailyLimitMinutes is NULL: return `{ canWatch: true }`
- If isLimitExceeded: return `{ canWatch: false, blockedSourceId, blockedReason: 'source_limit' }`
- Else: return `{ canWatch: true, secondsRemaining }`
- Test: NULL limit, under limit, at/over limit, correct block reason

---

### Task 2.4: [ ] Implement `grantSourceTimeExtension()` Function
**References**: Requirements #4, #11

- File: `src/main/timeTracking.ts`
- Validate sourceId exists (throw if not)
- Validate minutesAdded is 1-60 (throw if out of range)
- Insert into usage_extras: date, source_id, minutes_added, reason, added_by
- Log extension grant to console
- Test: Valid/invalid inputs, extension persists, affects getSourceTimeState

---

### Task 2.5: [ ] Enhance `recordVideoWatching()` Function
**References**: Requirements #2, #3, #11

- File: `src/main/timeTracking.ts`
- Continue existing global time recording (no change)
- Extract sourceId from watchData parameter
- Call recordSourceWatchTime(sourceId, watchData.watchSeconds)
- Call enforceSourceTimeLimit(sourceId)
- If blocked: return with sourceBlocked=true, blockedSourceId, sourceTimeState
- If not blocked: include sourceTimeState in response
- Verify backward compatible (sourceBlocked optional)
- Test: Global time recorded, source time recorded, enforcement checked, correct flags, global limit still works

---

### Task 2.6: [ ] Implement `resetDailySourceUsage()` Function
**References**: Requirements #2

- File: `src/main/timeTracking.ts`
- Function callable at midnight (integrate with existing mechanism)
- Document: source usage resets automatically via date-based queries
- Test: New day creates new entries, yesterday's usage not counted

---

## Phase 3: IPC Communication and Preload (Bridge)

**Goal**: Enable secure communication between renderer and main processes
**Blockers**: Phase 2 complete

### Task 3.1: [ ] Create IPC Handlers for Source Time Operations
**References**: Design section "IPC Communication Changes"

- File: `src/main/ipcHandlers.ts`
- Handler `timeTracking:getSourceState` (sourceId param)
  - Validate sourceId, call getSourceTimeState(), return SourceTimeState, handle errors
- Handler `timeTracking:grantSourceExtension` (sourceId, minutesAdded, reason, addedBy params)
  - Validate all params, call grantSourceTimeExtension(), return updated state, handle errors
- Handler `timeTracking:getAllSourceStates` (no params)
  - Get all sources, fetch SourceTimeState for each, return array, handle errors
- Test: Handlers return correct data, invalid inputs rejected, errors handled

---

### Task 3.2: [ ] Expose Preload Script API for Time Tracking
**References**: Design section "Preload Script Updates"

- File: `src/preload/index.ts`
- Add to electron.timeTracking API:
  - `getSourceState(sourceId): Promise<SourceTimeState>`
  - `grantSourceExtension(sourceId, minutesAdded, reason?): Promise<SourceTimeState>`
  - `getAllSourceStates(): Promise<SourceTimeState[]>`
- Wire each to IPC handlers via ipcRenderer.invoke()
- Test: Methods exposed on window.electron.timeTracking, callable from renderer

---

### Task 3.3: [ ] Add Type Definitions for Preload API
**References**: Design section "Preload Script Updates"

- File: `src/preload/electronAPI.ts` (or similar)
- Create TimeTrackingAPI interface with new methods
- Update global Window interface declaration
- Verify: No TS errors, intellisense works

---

## Phase 4: Renderer Service Layer (Client Logic)

**Goal**: Create service class for renderer-side time tracking
**Blockers**: Phase 3 complete

### Task 4.1: [ ] Create/Enhance TimeTrackingService in Renderer
**References**: Design section "Renderer Process Changes"

- File: `src/renderer/services/timeTrackingService.ts`
- Add static method: `getSourceTimeState(sourceId): Promise<SourceTimeState>`
  - Call window.electron.timeTracking.getSourceState(sourceId)
- Add static method: `grantSourceExtension(sourceId, minutesAdded, reason?): Promise<SourceTimeState>`
  - Call window.electron.timeTracking.grantSourceExtension()
- Add static method: `getAllSourceStates(): Promise<SourceTimeState[]>`
  - Call window.electron.timeTracking.getAllSourceStates()
- Add helper: `formatTimeRemaining(sourceTimeState): string`
  - Return "Unlimited" if no limit, else "Xm Ys"
- Add helper: `getExtensionOptions(): number[]`
  - Return [5, 10, 15, 30]
- Test: Methods call IPC correctly, helpers work, error handling in place

---

## Phase 5: Admin UI Components (Parent Interface)

**Goal**: Create admin interface for source time limit management
**Blockers**: Phase 4 complete

### Task 5.1: [ ] Add Daily Time Limit Field to VideoSourceForm
**References**: Requirements #1, #10

- File: `src/renderer/components/admin/VideoSourceForm.tsx`
- Add number input: `dailyTimeLimit` (0-1440 minutes, nullable)
- Validate: Range 0-1440, show error if invalid
- Handle NULL for unlimited
- Persist to database on save
- Load existing value on edit
- Test: Input renders, accepts/rejects values, persists correctly

---

### Task 5.2: [ ] Create SourceTimeDisplay Component
**References**: Requirements #5, #10

- File: `src/renderer/components/admin/SourceTimeDisplay.tsx`
- Fetch source time state via TimeTrackingService
- Show "Unlimited" if no limit
- Show progress bar (percentage of daily limit used)
- Show time remaining (Xm Ys format)
- Show warning state when < 5 minutes
- Show exceeded state when limit reached
- Refresh every 60 seconds
- Handle loading and error states
- Test: Displays correctly for all states, refreshes, handles errors

---

### Task 5.3: [ ] Create QuickExtensionMenu Component
**References**: Requirements #4, #10

- File: `src/renderer/components/admin/QuickExtensionMenu.tsx`
- Dropdown with quick options: 5, 10, 15, 30 minutes
- Optional custom time dialog
- Call grantSourceExtension on selection
- Show loading state during grant
- Show success/error toast messages
- Call parent callback to refresh display
- Test: Dropdown renders, options grant extensions, loading state shown

---

### Task 5.4: [ ] Integrate Components into Sources List
**References**: Requirements #1, #10

- File: `src/renderer/components/admin/SourcesListPanel.tsx` (or similar)
- Add "Daily Limit" column: shows limit or "Unlimited"
- Add "Time Remaining" column: displays SourceTimeDisplay component
- Update "Actions" column: add Edit button and QuickExtensionMenu
- Implement refresh callback to update time display
- Ensure responsive layout
- Test: Columns display correctly, components render, actions work

---

## Phase 6: Player Page Enforcement (Real-time Blocking)

**Goal**: Implement real-time source limit enforcement in the player
**Blockers**: Phase 5 complete (though can be done in parallel after Phase 4)

### Task 6.1: [ ] Add Time Tracking Hook to PlayerPage
**References**: Requirements #3, #7, #11

- File: `src/renderer/pages/PlayerPage.tsx`
- Add state: `sourceTimeRemaining`, `sourceTimeLimit`
- Create useEffect hook to check source time limit every second
- Call `TimeTrackingService.getSourceTimeState(currentSourceId)`
- If `isLimitExceeded`: play beep, pause video, navigate to /time-up with source-specific state
- Integrate with existing time tracking interval (after global check)
- Avoid duplicate requests
- Test: Hook initializes, calls service, updates state, blocks correctly, navigates to /time-up

---

### Task 6.2: [ ] Display Source Time Remaining in Player UI
**References**: Requirements #7

- File: `src/renderer/pages/PlayerPage.tsx`
- Add UI element in player controls showing "Source Time:"
- Display formatted time: "Unlimited" or "Xm Ys remaining"
- Add warning styling when < 5 minutes
- Update display every second when state changes
- Position logically in player controls
- Test: Formats correctly, shows unlimited, warning styling applied, updates every second

---

### Task 6.3: [ ] Enhance /time-up Page for Source Blocking
**References**: Requirements #3, #11

- File: `src/renderer/pages/TimeUpPage.tsx`
- Check `location.state.blockedReason` from navigation
- If `'source_limit'`: show source-specific message
  - "Time's up for [sourceName]!"
  - "You've reached your daily time limit for this source"
  - Buttons: "Choose Another Source", "Go Back"
- If other reason: show global message
  - "Time's up for today!"
  - Buttons: "Go Home"
- Fetch source title from database if available
- Style consistently with app theme
- Test: Shows correct message for source block, correct message for global block, actions work

---

### Task 6.4: [ ] Add Source Extension Request Component (Optional)
**References**: Requirements #4

- File: `src/renderer/pages/TimeUpPage.tsx` (or new component)
- Create optional dialog for child to request extension
- Options: 5, 10, 15, 30 minutes, custom time
- Show toast: "Extension request sent to parent"
- Parent grants via admin panel QuickExtensionMenu
- Note: This is optional for future consideration
- Test: Dialog renders, options selectable, message shown

---

## Phase 7: Testing and Documentation (Quality Assurance)

**Goal**: Comprehensive testing and documentation
**Blockers**: Phases 1-6 complete

### Task 7.1: [ ] Create Comprehensive Test Suite
**References**: Design section "Testing Strategy"

- Create test files:
  1. `src/main/timeTracking.test.ts` - All time tracking functions
  2. `src/renderer/services/timeTrackingService.test.ts` - Service methods
  3. `src/renderer/components/admin/SourceTimeDisplay.test.tsx` - Component tests
  4. `src/renderer/components/admin/QuickExtensionMenu.test.tsx` - Component tests
  5. `src/main/database/__tests__/sourceTimeLimitQueries.test.ts` - Database queries
- Cover: Unit tests, integration tests, component tests, end-to-end flows, edge cases
- Achieve: > 80% coverage, all tests passing, CI/CD integration
- Test: Coverage metrics, CI pipeline integration, no failing tests

---

### Task 7.2: [ ] Create Feature Documentation
**References**: Design section "Documentation Requirements"

- Create files:
  1. `docs/features/source-time-limits/README.md` - Feature overview and use cases
  2. `docs/api/timeTracking-source-limits.md` - API reference with examples
  3. `docs/admin-guide/source-time-limits.md` - Parent/admin guide
- Document: How to set limits, how to grant extensions, troubleshooting
- Include: API reference, database schema reference, examples
- Test: Documentation clarity, examples work correctly

---

### Task 7.3: [ ] Create Migration Guide
**References**: Design section "Migration Path"

- File: `docs/features/source-time-limits/MIGRATION.md`
- Document: Database migrations, backward compatibility, data loss guarantees
- Include: Steps for existing installations, rollback procedure, troubleshooting
- Test: Accuracy, completeness, rollback procedure works

---

## Quality Gates

Before considering implementation complete:

- [ ] All tests passing: `yarn test` returns 100% pass rate
- [ ] No TypeScript errors: `yarn type-check` clean
- [ ] Code review approved: At least 2 reviewers approve
- [ ] Performance acceptable: No measurable slowdown
- [ ] Documentation complete: All docs present and accurate
- [ ] Migration tested: Schema changes applied successfully
- [ ] No regressions: Existing time limit features still work
- [ ] Feature works as specified in requirements
- [ ] ≥80% test coverage achieved
- [ ] Backward compatibility maintained
- [ ] Error handling complete
- [ ] Logging for debugging in place
