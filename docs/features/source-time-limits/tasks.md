# Source-Level Time Limits: Implementation Plan

## Implementation Overview

The source-level time limits feature is organized into 6 phases, building incrementally from database schema changes through admin UI implementation to enforcement in the player.

**Total Estimated Effort**: ~12-16 work-days
**Dependencies**: None (integrates with existing time tracking system)

---

## Phase 1: Database Schema and Type Updates (Foundation)

**Goal**: Establish database schema changes and update TypeScript type definitions
**Effort**: ~2 days
**Blockers**: None

### Task 1.1: Add Column to Sources Table

**References**: Requirements #1, #8

- Create migration file: `src/main/database/schema/migrations/add-source-time-limits.sql`
- Add `daily_time_limit_minutes INTEGER DEFAULT NULL` column to `sources` table
- Add index: `idx_sources_daily_time_limit ON sources(daily_time_limit_minutes)`
- Document migration strategy for SQLite limitations (if needed)
- Create rollback script

**Definition of Done**:
- Migration file created and documented
- Schema changes applied successfully to both test and example databases
- Index creation verified
- No existing data lost or corrupted
- Migration is reversible

**Tests Required**:
- Unit test: Column exists after migration
- Unit test: Migration can be applied to empty database
- Integration test: Migration applies to existing database with source data
- Integration test: Rollback restores previous state
- Unit test: Index exists and improves query performance

**Code Review**:
- Database architect review of schema design
- Review migration strategy for SQLite limitations
- Performance review of index placement
- Data integrity check

---

### Task 1.2: Extend Usage Logs Table

**References**: Requirements #2, #8

- Create migration file: `src/main/database/schema/migrations/extend-usage-logs.sql`
- Add `source_id TEXT DEFAULT NULL` column to `usage_logs` table
- Add foreign key: `REFERENCES sources(id) ON DELETE SET NULL`
- Add index: `idx_usage_logs_source_id ON usage_logs(source_id, date)`
- Document handling of legacy NULL source_id entries

**Definition of Done**:
- Migration file created
- Column added and index created
- Foreign key constraint in place
- Legacy entries have NULL source_id (backward compatible)
- Queries can filter by source_id

**Tests Required**:
- Unit test: Column exists and nullable
- Integration test: Foreign key constraint works
- Integration test: Index improves query performance for source queries
- Unit test: Legacy entries handle NULL source_id correctly
- Integration test: Cascading delete works correctly

**Code Review**:
- Database constraint review
- Foreign key strategy review
- Migration complexity assessment
- Legacy data handling review

---

### Task 1.3: Extend Usage Extras Table

**References**: Requirements #4, #11

- Create migration file: `src/main/database/schema/migrations/extend-usage-extras.sql`
- Add `source_id TEXT DEFAULT NULL` column to `usage_extras` table
- Add foreign key: `REFERENCES sources(id) ON DELETE SET NULL`
- Add index: `idx_usage_extras_source_id ON usage_extras(source_id, date)`

**Definition of Done**:
- Migration file created
- Column and index added
- Foreign key constraint created
- Extensions can be tracked per-source
- Backward compatible with global extensions

**Tests Required**:
- Unit test: Column exists and nullable
- Integration test: Extensions can be created with source_id
- Integration test: Query returns extensions for specific source
- Unit test: NULL source_id handled correctly for global extensions

**Code Review**:
- Foreign key design review
- Data integrity review

---

### Task 1.4: Update Database Type Definitions

**References**: Requirements #2, #8

- File: `src/main/database/queries/types.ts`
- Add `daily_time_limit_minutes: number | null` to `Source` interface
- Add `source_id: string | null` to `UsageLog` interface
- Add `source_id: string | null` to `UsageExtra` interface
- Create new `SourceTimeState` interface with all fields:
  - `sourceId: string`
  - `dailyLimitMinutes: number | null`
  - `secondsUsedToday: number`
  - `secondsRemainingToday: number`
  - `isLimitExceeded: boolean`
  - `lastResetDate: string`
- Create new `SourceTimeEnforcement` interface:
  - `canWatch: boolean`
  - `blockedSourceId?: string | null`
  - `blockedReason?: 'source_limit' | 'global_limit'`
  - `secondsRemaining?: number`
  - `minutesRemaining?: number`

**Definition of Done**:
- All interfaces updated and properly typed
- Exported for use across codebase
- No TypeScript errors
- Backward compatible with existing code

**Tests Required**:
- Type safety tests: Verify interfaces compile correctly
- Test: Source interface accepts new field
- Test: UsageLog interface accepts source_id
- Test: UsageExtra interface accepts source_id
- Type test: SourceTimeState and SourceTimeEnforcement have correct structure

**Code Review**:
- Interface design review
- Type safety review by TypeScript expert

---

### Task 1.5: Update Shared Types

**References**: Requirements #2

- File: `src/shared/types.ts`
- Create/extend `SourceTimeState` interface (if not already there)
- Create/extend `TimeTrackingState` interface to include optional `sourceTimeState` field
- Add optional fields to `TimeTrackingState`:
  - `sourceBlocked?: boolean`
  - `blockedSourceId?: string`
  - `sourceTimeState?: SourceTimeState`
- Export all new types

**Definition of Done**:
- Shared types updated
- Can be imported in both main and renderer processes
- Backward compatible

**Tests Required**:
- Type compilation test
- Test: Types export correctly from shared module

**Code Review**:
- Shared type design review

---

## Phase 2: Time Tracking Service Enhancement (Core Logic)

**Goal**: Implement all time tracking logic for source-level limits
**Effort**: ~3-4 days
**Blockers**: Phase 1 complete

### Task 2.1: Implement `getSourceTimeState()` Function

**References**: Requirements #2, #3, #7

- File: `src/main/timeTracking.ts`
- Function: `async getSourceTimeState(sourceId: string): Promise<SourceTimeState>`
- Query `sources` table for `daily_time_limit_minutes`
- Query `usage_logs` for today's usage: `SELECT SUM(seconds_used) FROM usage_logs WHERE source_id=? AND date=?`
- Query `usage_extras` for today's extensions: `SELECT SUM(minutes_added) FROM usage_extras WHERE source_id=? AND date=?`
- Calculate:
  - `secondsUsedToday` = sum from usage_logs
  - `extensionSeconds` = sum from usage_extras * 60
  - `totalAllowedSeconds` = (limitMinutes * 60) + extensionSeconds
  - `secondsRemainingToday` = max(0, totalAllowedSeconds - secondsUsedToday)
  - `isLimitExceeded` = secondsUsedToday >= totalAllowedSeconds
- Return `SourceTimeState` object
- Handle NULL limit as "unlimited" (return large remaining time)

**Definition of Done**:
- Function implemented and working
- Handles NULL limit correctly
- Includes extensions in calculation
- Returns accurate state
- Handles edge cases (no usage, no extensions, etc.)

**Tests Required**:
- Unit test: Returns correct remaining time with limit and usage
- Unit test: Handles NULL limit (returns large remaining value)
- Unit test: Includes extensions in calculation
- Unit test: Returns isLimitExceeded=false when under limit
- Unit test: Returns isLimitExceeded=true when over limit
- Unit test: Returns isLimitExceeded=true when exactly at limit
- Unit test: Returns today's date in lastResetDate
- Integration test: Works with actual database queries
- Integration test: Handles no usage records gracefully
- Edge case test: Limit of 0 minutes

**Code Review**:
- Logic review by senior developer
- Query efficiency review
- Edge case handling review

---

### Task 2.2: Implement `recordSourceWatchTime()` Function

**References**: Requirements #2

- File: `src/main/timeTracking.ts`
- Function: `async recordSourceWatchTime(sourceId: string, secondsWatched: number): Promise<void>`
- Check if today's entry exists in `usage_logs` for this source:
  - `SELECT id FROM usage_logs WHERE source_id=? AND date=?`
- If exists: increment `seconds_used`:
  - `UPDATE usage_logs SET seconds_used = seconds_used + ? WHERE id=?`
- If not exists: create new entry:
  - `INSERT INTO usage_logs (date, seconds_used, source_id) VALUES (?, ?, ?)`
- Round secondsWatched to nearest second
- Log to console if enabled

**Definition of Done**:
- Function correctly records watch time
- Creates or updates usage records
- Handles both new and existing entries
- Data persists correctly

**Tests Required**:
- Unit test: Creates new usage_logs entry for source
- Unit test: Increments existing usage_logs entry
- Unit test: Rounds watch time to second
- Integration test: Data persists to database
- Integration test: Multiple calls accumulate correctly
- Integration test: Different sources tracked separately

**Code Review**:
- SQL efficiency review
- Data integrity review

---

### Task 2.3: Implement `enforceSourceTimeLimit()` Function

**References**: Requirements #3, #11

- File: `src/main/timeTracking.ts`
- Function: `async enforceSourceTimeLimit(sourceId: string): Promise<SourceTimeEnforcement>`
- Call `getSourceTimeState(sourceId)`
- If `dailyLimitMinutes` is NULL: return `{ canWatch: true }`
- If `isLimitExceeded`: return:
  ```typescript
  {
    canWatch: false,
    blockedSourceId: sourceId,
    blockedReason: 'source_limit',
    secondsRemaining: 0,
    minutesRemaining: 0
  }
  ```
- Else: return `{ canWatch: true, secondsRemaining: state.secondsRemainingToday }`

**Definition of Done**:
- Function returns correct enforcement decision
- Handles NULL limits
- Distinguishes between can/cannot watch

**Tests Required**:
- Unit test: Returns canWatch=true with NULL limit
- Unit test: Returns canWatch=true when under limit
- Unit test: Returns canWatch=false when limit reached
- Unit test: Returns correct sourceId in block response
- Unit test: Returns correct secondsRemaining values

**Code Review**:
- Logic review
- Return value structure review

---

### Task 2.4: Implement `grantSourceTimeExtension()` Function

**References**: Requirements #4, #11

- File: `src/main/timeTracking.ts`
- Function: `async grantSourceTimeExtension(sourceId: string, minutesAdded: number, reason: string, addedBy: string): Promise<void>`
- Validation:
  - Verify sourceId exists in `sources` table (throw if not)
  - Verify minutesAdded is number 1-60 (throw if outside range)
- Insert into `usage_extras`:
  ```sql
  INSERT INTO usage_extras (date, source_id, minutes_added, reason, added_by)
  VALUES (TODAY, ?, ?, ?, ?)
  ```
- Log to console: `[TimeTracking] Extension granted: source=${sourceId} +${minutesAdded}min reason=${reason} by=${addedBy}`
- Return updated `SourceTimeState` after insert

**Definition of Done**:
- Function validates inputs correctly
- Extension persists to database
- Audit trail is recorded
- Logged for debugging

**Tests Required**:
- Unit test: Validates sourceId exists (throws if not)
- Unit test: Validates minutesAdded range (throws if out of range)
- Unit test: Inserts extension into usage_extras
- Unit test: Uses today's date in insert
- Integration test: Extension appears in database
- Integration test: Extension affects getSourceTimeState result
- Unit test: Logs extension information

**Code Review**:
- Validation logic review
- Database insert review
- Logging review

---

### Task 2.5: Enhance `recordVideoWatching()` Function

**References**: Requirements #2, #3, #11

- File: `src/main/timeTracking.ts`
- Existing function must be modified to:
  1. Continue existing global time recording (no change)
  2. **NEW**: Extract `sourceId` from `watchData` parameter
  3. **NEW**: Call `recordSourceWatchTime(sourceId, watchData.watchSeconds)`
  4. **NEW**: Call `enforceSourceTimeLimit(sourceId)` to check if blocked
  5. **NEW**: If source is blocked, include in return:
     - `sourceBlocked: true`
     - `blockedSourceId: sourceId`
     - `sourceTimeState: sourceState`
  6. **NEW**: If source is blocked, do NOT record the watch time (not after block)
  7. Return enhanced `TimeTrackingState` with source info

**Logic Flow**:
```
recordVideoWatching(watchData) {
  // 1. Record global usage (existing)
  const globalState = recordGlobalWatchTime(watchData);

  // 2. Check enforcement (existing)
  if (globalState.blocked) {
    return { ...globalState };
  }

  // 3. NEW: Record source usage
  const sourceId = watchData.source;
  if (sourceId) {
    await recordSourceWatchTime(sourceId, watchData.watchSeconds);

    // 4. NEW: Check source enforcement
    const sourceEnforcement = await enforceSourceTimeLimit(sourceId);
    if (!sourceEnforcement.canWatch) {
      // Block from this source
      const sourceState = await getSourceTimeState(sourceId);
      return {
        ...globalState,
        sourceBlocked: true,
        blockedSourceId: sourceId,
        sourceTimeState: sourceState
      };
    }

    // 5. Include source state in response
    const sourceState = await getSourceTimeState(sourceId);
    return {
      ...globalState,
      sourceTimeState: sourceState
    };
  }

  return { ...globalState };
}
```

**Definition of Done**:
- Existing global time tracking continues unchanged
- Source time is recorded correctly
- Source enforcement is checked
- Block decision is returned in response
- Backward compatible (sourceBlocked is optional)

**Tests Required**:
- Unit test: Global time still recorded for source video
- Unit test: Source time recorded alongside global time
- Unit test: Source enforcement checked after global
- Unit test: Returns sourceTimeState in response
- Unit test: Returns sourceBlocked=true when source limit exceeded
- Unit test: Returns sourceBlocked=false when under limit
- Integration test: Does not record time after source block
- Regression test: Global time limit still blocks correctly

**Code Review**:
- Flow logic review
- Backward compatibility review
- Integration with global system review

---

### Task 2.6: Implement `resetDailySourceUsage()` Function

**References**: Requirements #2

- File: `src/main/timeTracking.ts`
- Function: `async resetDailySourceUsage(): Promise<void>`
- Called at midnight by existing daily reset mechanism
- No action needed - `usage_logs` is date-based, next day creates new entries
- Document that source usage resets automatically through date-based queries

**Definition of Done**:
- Function exists and is called at midnight
- Documentation is clear about date-based reset mechanism
- No data is explicitly deleted

**Tests Required**:
- Unit test: Function callable
- Integration test: New day creates new usage entries
- Integration test: Yesterday's usage not counted in new day

**Code Review**:
- Reset mechanism review

---

## Phase 3: IPC Communication and Preload (Bridge)

**Goal**: Enable secure communication between renderer and main processes
**Effort**: ~1.5 days
**Blockers**: Phase 2 complete

### Task 3.1: Create IPC Handlers for Source Time Operations

**References**: Design section "IPC Communication Changes"

- File: `src/main/ipcHandlers.ts` (or relevant IPC handler file)
- Add new IPC channel handlers:

```typescript
// Handle: timeTracking:getSourceState
ipcMain.handle('timeTracking:getSourceState', async (event, sourceId: string) => {
  // Validate sourceId is string
  // Call getSourceTimeState(sourceId)
  // Return SourceTimeState
  // Catch and return error with proper message
});

// Handle: timeTracking:grantSourceExtension
ipcMain.handle('timeTracking:grantSourceExtension', async (event, params: {
  sourceId: string,
  minutesAdded: number,
  reason?: string,
  addedBy: string
}) => {
  // Validate all parameters
  // Call grantSourceTimeExtension()
  // Return updated SourceTimeState
  // Catch and return error with proper message
});

// Handle: timeTracking:getAllSourceStates
ipcMain.handle('timeTracking:getAllSourceStates', async (event) => {
  // Get all sources
  // For each source, get SourceTimeState
  // Return array of SourceTimeState
  // Catch and return error
});
```

**Definition of Done**:
- All IPC handlers registered
- Input validation performed
- Errors handled with proper messages
- Can be called from renderer process

**Tests Required**:
- Unit test: getSourceState handler returns correct state
- Unit test: grantSourceExtension handler grants extension
- Unit test: getAllSourceStates returns all sources
- Unit test: Invalid sourceId returns error
- Unit test: Invalid minutesAdded returns error
- Integration test: IPC communication works end-to-end
- Security test: Only valid inputs accepted

**Code Review**:
- IPC architecture review
- Input validation review
- Error handling review

---

### Task 3.2: Expose Preload Script API for Time Tracking

**References**: Design section "Preload Script Updates"

- File: `src/preload/index.ts`
- Add to `electron` API exposure:

```typescript
electron: {
  // ... existing timeTracking field
  timeTracking: {
    // ... existing methods
    getSourceState: (sourceId: string) =>
      ipcRenderer.invoke('timeTracking:getSourceState', sourceId),

    grantSourceExtension: (sourceId: string, minutesAdded: number, reason?: string) =>
      ipcRenderer.invoke('timeTracking:grantSourceExtension', {
        sourceId,
        minutesAdded,
        reason: reason || '',
        addedBy: 'parent' // TODO: get from settings
      }),

    getAllSourceStates: () =>
      ipcRenderer.invoke('timeTracking:getAllSourceStates')
  }
}
```

**Definition of Done**:
- Preload API exposed correctly
- Methods callable from renderer
- Return types match IPC responses
- No errors in preload

**Tests Required**:
- Unit test: Methods are exposed on window.electron.timeTracking
- Type test: Method signatures match expected types
- Integration test: Can call methods from renderer process

**Code Review**:
- Security boundary review
- API design review

---

### Task 3.3: Add Type Definitions for Preload API

**References**: Design section "Preload Script Updates"

- File: `src/preload/electronAPI.ts` (or relevant types file)
- Create interface for extended timeTracking API:

```typescript
interface TimeTrackingAPI {
  getSourceState(sourceId: string): Promise<SourceTimeState>;
  grantSourceExtension(
    sourceId: string,
    minutesAdded: number,
    reason?: string
  ): Promise<SourceTimeState>;
  getAllSourceStates(): Promise<SourceTimeState[]>;
  // ... existing methods
}
```

- Update module declaration:
```typescript
declare global {
  interface Window {
    electron: {
      timeTracking: TimeTrackingAPI;
      // ... rest of API
    }
  }
}
```

**Definition of Done**:
- Type definitions created
- No TypeScript errors in preload or renderer
- VSCode intellisense works

**Tests Required**:
- Type compilation test
- Test: Types export correctly

**Code Review**:
- Type definition review

---

## Phase 4: Renderer Service Layer (Client Logic)

**Goal**: Create service class for renderer-side time tracking
**Effort**: ~1 day
**Blockers**: Phase 3 complete

### Task 4.1: Create/Enhance TimeTrackingService in Renderer

**References**: Design section "Renderer Process Changes"

- File: `src/renderer/services/timeTrackingService.ts`
- If service exists, add new static methods:

```typescript
static async getSourceTimeState(sourceId: string): Promise<SourceTimeState> {
  return window.electron.timeTracking.getSourceState(sourceId);
}

static async grantSourceExtension(
  sourceId: string,
  minutesAdded: number,
  reason?: string
): Promise<SourceTimeState> {
  return window.electron.timeTracking.grantSourceExtension(
    sourceId,
    minutesAdded,
    reason
  );
}

static async getAllSourceStates(): Promise<SourceTimeState[]> {
  return window.electron.timeTracking.getAllSourceStates();
}

static formatTimeRemaining(sourceTimeState: SourceTimeState): string {
  if (sourceTimeState.dailyLimitMinutes === null) {
    return 'Unlimited';
  }

  const minutes = Math.floor(sourceTimeState.secondsRemainingToday / 60);
  const seconds = sourceTimeState.secondsRemainingToday % 60;

  return `${minutes}m ${seconds}s`;
}

static getExtensionOptions(): number[] {
  return [5, 10, 15, 30];  // minutes
}
```

**Definition of Done**:
- Service methods implemented
- Methods callable from React components
- Helper methods work correctly
- Error handling in place

**Tests Required**:
- Unit test: getSourceTimeState calls IPC correctly
- Unit test: grantSourceExtension calls IPC correctly
- Unit test: formatTimeRemaining formats correctly
- Unit test: Extension options are correct

**Code Review**:
- Service design review
- IPC integration review

---

## Phase 5: Admin UI Components (Parent Interface)

**Goal**: Create admin interface for source time limit management
**Effort**: ~3 days
**Blockers**: Phase 4 complete

### Task 5.1: Add Daily Time Limit Field to VideoSourceForm

**References**: Requirements #1, #10

- File: `src/renderer/components/admin/VideoSourceForm.tsx`
- Add input field to form:

```tsx
<div className="form-group">
  <label htmlFor="dailyTimeLimit">Daily Time Limit</label>
  <input
    id="dailyTimeLimit"
    type="number"
    min="0"
    max="1440"
    step="1"
    placeholder="Leave blank for unlimited"
    value={formData.dailyTimeLimit === null ? '' : formData.dailyTimeLimit}
    onChange={(e) => setFormData({
      ...formData,
      dailyTimeLimit: e.target.value ? parseInt(e.target.value) : null
    })}
    onBlur={(e) => {
      // Validate range
      if (e.target.value && (parseInt(e.target.value) < 0 || parseInt(e.target.value) > 1440)) {
        toast.error('Daily limit must be between 0 and 1440 minutes');
        setFormData({ ...formData, dailyTimeLimit: null });
      }
    }}
  />
  <small>Minutes per day. Leave blank for no limit (unlimited).</small>
</div>
```

- Update form submission to persist `dailyTimeLimit` to database
- Handle NULL value (no limit)

**Definition of Done**:
- Input field renders correctly
- Accepts values 0-1440
- Can set to NULL (unlimited)
- Validates input
- Persists to database

**Tests Required**:
- Unit test: Input field renders
- Unit test: Accepts valid values (0-1440)
- Unit test: Rejects invalid values
- Unit test: Handles NULL (blank input)
- Integration test: Value saves to database
- Integration test: Value loads on edit

**Code Review**:
- Form design review
- Input validation review
- Integration with existing form

---

### Task 5.2: Create SourceTimeDisplay Component

**References**: Requirements #5, #10

- File: `src/renderer/components/admin/SourceTimeDisplay.tsx`
- Create component:

```tsx
interface SourceTimeDisplayProps {
  sourceId: string;
  sourceName?: string;
}

const SourceTimeDisplay: React.FC<SourceTimeDisplayProps> = ({
  sourceId,
  sourceName
}) => {
  const [timeState, setTimeState] = useState<SourceTimeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeState = async () => {
      try {
        setLoading(true);
        const state = await TimeTrackingService.getSourceTimeState(sourceId);
        setTimeState(state);
        setError(null);
      } catch (err) {
        setError('Failed to load time state');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeState();

    // Refresh every 60 seconds
    const interval = setInterval(fetchTimeState, 60000);
    return () => clearInterval(interval);
  }, [sourceId]);

  if (loading) return <span>Loading...</span>;
  if (error) return <span className="error">{error}</span>;
  if (!timeState) return <span>No data</span>;

  // If unlimited, show that
  if (timeState.dailyLimitMinutes === null) {
    return <span className="unlimited">Unlimited</span>;
  }

  // Calculate percentage used
  const totalSeconds = timeState.dailyLimitMinutes * 60;
  const percentageUsed = (timeState.secondsUsedToday / totalSeconds) * 100;

  const minutes = Math.floor(timeState.secondsRemainingToday / 60);
  const seconds = timeState.secondsRemainingToday % 60;

  const isWarning = timeState.secondsRemainingToday < 300; // < 5 min
  const isExceeded = timeState.isLimitExceeded;

  return (
    <div className={cn(
      'source-time-display',
      isWarning && 'warning',
      isExceeded && 'exceeded'
    )}>
      <div className="progress-bar">
        <div
          className={cn('progress-fill', isWarning && 'warning-fill')}
          style={{ width: `${Math.min(percentageUsed, 100)}%` }}
        />
      </div>
      <div className="time-info">
        <span className={cn('time-remaining', isExceeded && 'exceeded')}>
          {isExceeded
            ? 'Limit reached'
            : `${minutes}m ${seconds}s remaining`
          }
        </span>
        <span className="time-used">
          ({Math.floor(timeState.secondsUsedToday / 60)}m used)
        </span>
      </div>
    </div>
  );
};
```

- Add CSS styling for warning and exceeded states
- Implement loading state
- Handle errors gracefully

**Definition of Done**:
- Component renders time state correctly
- Shows unlimited when limit is NULL
- Shows progress bar with percentage
- Shows warning state when < 5 min
- Shows exceeded state when limit reached
- Refreshes every 60 seconds
- Handles errors gracefully
- Styled appropriately

**Tests Required**:
- Unit test: Component renders with data
- Unit test: Shows unlimited for NULL limit
- Unit test: Calculates percentage correctly
- Unit test: Shows warning state correctly
- Unit test: Shows exceeded state correctly
- Unit test: Handles loading state
- Unit test: Handles error state
- Integration test: Fetches and displays data from service

**Code Review**:
- Component design review
- State management review
- Styling review

---

### Task 5.3: Create QuickExtensionMenu Component

**References**: Requirements #4, #10

- File: `src/renderer/components/admin/QuickExtensionMenu.tsx`
- Create component for quick extension options:

```tsx
interface QuickExtensionMenuProps {
  sourceId: string;
  sourceName?: string;
  onExtensionGranted?: (sourceId: string, minutes: number) => void;
}

const QuickExtensionMenu: React.FC<QuickExtensionMenuProps> = ({
  sourceId,
  sourceName,
  onExtensionGranted
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleExtend = async (minutes: number) => {
    try {
      setIsLoading(true);
      await TimeTrackingService.grantSourceExtension(
        sourceId,
        minutes,
        `Quick extension from admin panel (${minutes} min requested)`
      );

      // Show success message
      toast.success(`Granted ${minutes} minutes to ${sourceName || sourceId}`);

      // Call callback for parent component to refresh
      onExtensionGranted?.(sourceId, minutes);
    } catch (error) {
      toast.error('Failed to grant extension');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const extensionOptions = TimeTrackingService.getExtensionOptions();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button disabled={isLoading} className="button-small">
          {isLoading ? 'Adding...' : '+ Time'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Add time (minutes)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {extensionOptions.map(minutes => (
          <DropdownMenuItem
            key={minutes}
            onClick={() => handleExtend(minutes)}
            disabled={isLoading}
          >
            {minutes} minutes
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            // Open custom time dialog
            openCustomExtensionDialog(sourceId);
          }}
        >
          Custom time...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

- Include loading state
- Show success/error messages
- Call parent callback to refresh display
- Handle errors

**Definition of Done**:
- Dropdown menu renders correctly
- Quick options available (5, 10, 15, 30 min)
- Extension is granted when clicked
- Success message shown
- Parent component can refresh data
- Loading state shown
- Errors handled

**Tests Required**:
- Unit test: Component renders dropdown
- Unit test: Options clickable
- Unit test: Calls grantSourceExtension
- Unit test: Shows loading state
- Unit test: Shows success message
- Unit test: Calls callback on success
- Integration test: Extension persists correctly

**Code Review**:
- Component design review
- Error handling review
- UX flow review

---

### Task 5.4: Integrate Components into Sources List

**References**: Requirements #1, #10

- File: `src/renderer/components/admin/SourcesListPanel.tsx` (or similar)
- Update source list/table to include new columns:
  1. "Daily Limit" - shows limit value or "Unlimited"
  2. "Time Remaining" - displays `<SourceTimeDisplay>`
  3. Update "Actions" column to include edit and quick extension

**Example structure**:
```tsx
columns={[
  { key: 'title', label: 'Source', width: '200px' },
  { key: 'type', label: 'Type', width: '100px' },
  {
    key: 'dailyTimeLimit',
    label: 'Daily Limit',
    width: '100px',
    render: (limit) => limit ? `${limit} min` : 'Unlimited'
  },
  {
    key: 'timeRemaining',
    label: 'Remaining Today',
    width: '180px',
    render: (_, source) => (
      <SourceTimeDisplay
        sourceId={source.id}
        sourceName={source.title}
      />
    )
  },
  {
    key: 'actions',
    label: 'Actions',
    width: '150px',
    render: (_, source) => (
      <div className="action-buttons">
        <button
          className="button-small"
          onClick={() => editSource(source)}
        >
          Edit
        </button>
        {source.dailyTimeLimit && (
          <QuickExtensionMenu
            sourceId={source.id}
            sourceName={source.title}
            onExtensionGranted={refreshSourceTimes}
          />
        )}
      </div>
    )
  }
]}
```

- Ensure columns display correctly
- Add CSS for layout
- Ensure responsive design
- Implement refresh callback

**Definition of Done**:
- Columns display correctly
- SourceTimeDisplay component renders in each row
- QuickExtensionMenu shows for sources with limits
- Edit and extension buttons work
- Layout is responsive
- Data refreshes when needed

**Tests Required**:
- Integration test: Sources list displays with new columns
- Integration test: SourceTimeDisplay renders in list
- Integration test: QuickExtensionMenu shows for limited sources
- Integration test: Extension granted updates display
- UI test: Layout responsive on different screen sizes

**Code Review**:
- Layout design review
- Integration pattern review
- Responsive design review

---

## Phase 6: Player Page Enforcement (Real-time Blocking)

**Goal**: Implement real-time source limit enforcement in the player
**Effort**: ~2-3 days
**Blockers**: Phase 5 complete (though can be done in parallel after Phase 4)

### Task 6.1: Add Time Tracking Hook to PlayerPage

**References**: Requirements #3, #7, #11

- File: `src/renderer/pages/PlayerPage.tsx`
- Create hook or add to existing time tracking:

```tsx
const [sourceTimeRemaining, setSourceTimeRemaining] = useState<number | null>(null);
const [sourceTimeLimit, setSourceTimeLimit] = useState<number | null>(null);

useEffect(() => {
  const checkSourceTimeLimit = async () => {
    if (!currentSourceId) return;

    try {
      const sourceState = await TimeTrackingService.getSourceTimeState(currentSourceId);
      setSourceTimeLimit(sourceState.dailyLimitMinutes);
      setSourceTimeRemaining(sourceState.secondsRemainingToday);

      // Check if limit exceeded
      if (sourceState.isLimitExceeded) {
        // Play warning beep if configured
        await playAudioWarning();

        // Pause video
        pauseVideo();

        // Navigate to time-up page
        navigate('/time-up', {
          state: {
            blockedReason: 'source_limit',
            sourceId: currentSourceId,
            sourceTimeState: sourceState
          }
        });
      }
    } catch (error) {
      console.error('Error checking source time limit:', error);
    }
  };

  // Check every second (integrate with existing time check)
  const interval = setInterval(checkSourceTimeLimit, 1000);

  return () => clearInterval(interval);
}, [currentSourceId, navigate]);
```

- Integrate with existing time tracking interval
- Call after global limit check
- Don't make duplicate requests

**Definition of Done**:
- Hook checks source time limit every second
- Updates state correctly
- Blocks when limit reached
- Plays beep warning
- Navigates to /time-up

**Tests Required**:
- Unit test: Hook initializes correctly
- Unit test: Calls getSourceTimeState
- Unit test: Updates sourceTimeRemaining state
- Unit test: Detects limit exceeded
- Unit test: Pauses video on block
- Unit test: Navigates to /time-up
- Integration test: Works in actual player

**Code Review**:
- Hook design review
- Integration with existing time check review
- Performance review (no duplicate calls)

---

### Task 6.2: Display Source Time Remaining in Player UI

**References**: Requirements #7

- File: `src/renderer/pages/PlayerPage.tsx`
- Add UI element to player controls showing source time:

```tsx
{sourceTimeRemaining !== null && sourceTimeLimit !== null && (
  <div className="source-time-info">
    <div className="label">Source Time:</div>
    <div className={cn(
      'time-remaining',
      sourceTimeRemaining < 300 && 'warning'
    )}>
      {TimeTrackingService.formatTimeRemaining({
        dailyLimitMinutes: sourceTimeLimit,
        secondsRemainingToday: sourceTimeRemaining
      })}
    </div>
  </div>
)}
```

- Show time in format "X minutes Y seconds remaining"
- Show "Unlimited" if no limit
- Add warning styling if < 5 min
- Update every second with state changes
- Position logically in player controls

**Definition of Done**:
- Source time displays in player UI
- Updates every second
- Shows correct format
- Shows warning styling when < 5 min
- Positioned appropriately
- Responsive on different screen sizes

**Tests Required**:
- Unit test: Formats time correctly
- Unit test: Shows unlimited for NULL limit
- Unit test: Shows warning styling when < 5 min
- UI test: Displays in player controls
- Integration test: Updates every second

**Code Review**:
- UI design review
- Styling review
- Integration with player layout

---

### Task 6.3: Enhance /time-up Page for Source Blocking

**References**: Requirements #3, #11

- File: `src/renderer/pages/TimeUpPage.tsx`
- Add source-specific message and display:

```tsx
const TimeUpPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { blockedReason, sourceId, sourceTimeState } = location.state || {};

  // TODO: Get source title from database/state
  const getSourceTitle = async () => {
    // Query database for source title
  };

  const [sourceTitle, setSourceTitle] = useState<string>('');

  useEffect(() => {
    if (sourceId) {
      getSourceTitle().then(setSourceTitle);
    }
  }, [sourceId]);

  return (
    <div className="time-up-container">
      {blockedReason === 'source_limit' ? (
        <>
          <h2>Time's up for {sourceTitle}!</h2>
          <p className="explanation">
            You've reached your daily time limit for this source.
          </p>
          <p className="helper-text">
            You can watch other sources, or ask your parent for more time.
          </p>

          <div className="actions">
            <button
              className="button-primary"
              onClick={() => navigate('/source')}
            >
              Choose Another Source
            </button>
            <button
              className="button-secondary"
              onClick={() => navigate(-1)}
            >
              Go Back
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Time's up for today!</h2>
          <p className="explanation">
            You've reached your daily overall time limit.
          </p>
          <p className="helper-text">
            Ask your parent if you need more time.
          </p>

          <div className="actions">
            <button
              className="button-primary"
              onClick={() => navigate('/home')}
            >
              Go Home
            </button>
          </div>
        </>
      )}
    </div>
  );
};
```

- Show source-specific message when source limit exceeded
- Show global message when global limit exceeded
- Provide appropriate actions for each scenario
- Style consistently with app theme

**Definition of Done**:
- Source-specific message displays correctly
- Message differs from global limit message
- Actions available and working
- Styled appropriately
- Source title displayed

**Tests Required**:
- Unit test: Renders source-specific message
- Unit test: Renders global message
- Integration test: Shows correct message for source block
- Integration test: Shows correct message for global block
- Integration test: Action buttons work

**Code Review**:
- Message clarity review
- Action flow review
- Styling consistency review

---

### Task 6.4: Add Source Extension Request Component

**References**: Requirements #4

- File: `src/renderer/pages/TimeUpPage.tsx` (or new component)
- Create optional extension request dialog:

```tsx
const RequestSourceExtensionButton = ({ sourceId }: { sourceId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState(5);

  const handleRequest = async () => {
    // In child-facing app, this would show a "request" dialog
    // Parent would see it in admin panel and grant via QuickExtensionMenu
    // For now, just show a message

    toast.info(
      'Extension request sent to parent. Wait for approval.',
      { duration: 10000 }
    );

    // Optional: Navigate away after request
    setTimeout(() => {
      // Parent can grant via admin panel
    }, 2000);

    setIsOpen(false);
  };

  return (
    <>
      <button
        className="button-secondary"
        onClick={() => setIsOpen(true)}
      >
        Request More Time
      </button>

      {isOpen && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request More Time</DialogTitle>
            </DialogHeader>
            <p>How many extra minutes do you need?</p>
            <div className="extension-options">
              {[5, 10, 15, 30].map(minutes => (
                <button
                  key={minutes}
                  onClick={() => setSelectedMinutes(minutes)}
                  className={cn(
                    'option-button',
                    selectedMinutes === minutes && 'selected'
                  )}
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <DialogFooter>
              <button onClick={() => setIsOpen(false)}>Cancel</button>
              <button
                className="button-primary"
                onClick={handleRequest}
              >
                Send Request
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
```

**Note**: This is optional feature for future consideration. Child interface for requesting extensions is more complex and may be handled differently.

**Definition of Done**:
- Component renders correctly
- Options selectable
- Shows messaging
- Can be integrated into /time-up page

**Tests Required**:
- Unit test: Component renders
- Unit test: Options selectable
- Unit test: Message shown

**Code Review**:
- Component design review
- UX flow review

---

## Phase 7: Testing and Documentation (Quality Assurance)

**Goal**: Comprehensive testing and documentation
**Effort**: ~2 days
**Blockers**: Phases 1-6 complete

### Task 7.1: Create Comprehensive Test Suite

**References**: Design section "Testing Strategy"

- Create test files for:
  1. `src/main/timeTracking.test.ts` - All time tracking functions
  2. `src/renderer/services/timeTrackingService.test.ts` - Service methods
  3. `src/renderer/components/admin/SourceTimeDisplay.test.tsx` - Component tests
  4. `src/renderer/components/admin/QuickExtensionMenu.test.tsx` - Component tests
  5. `src/main/database/__tests__/sourceTimeLimitQueries.test.ts` - Database queries

- Tests must cover:
  - Unit tests for all functions
  - Integration tests for database operations
  - Component tests for React components
  - End-to-end flow tests
  - Edge cases and error conditions

**Definition of Done**:
- All test files created
- Tests pass with > 80% coverage
- CI/CD pipeline runs tests
- No failing tests

**Tests Required** (see individual task tests above)

**Code Review**:
- Test quality review
- Coverage assessment
- Test organization review

---

### Task 7.2: Create Feature Documentation

**References**: Design section "Documentation Requirements"

- Create documentation files:
  1. `docs/features/source-time-limits/README.md` - Feature overview
  2. `docs/api/timeTracking-source-limits.md` - API reference
  3. `docs/admin-guide/source-time-limits.md` - Parent/admin guide

**Contents**:
- Feature overview and use cases
- How to set source time limits
- How to grant extensions
- Troubleshooting guide
- API reference with examples
- Database schema reference

**Definition of Done**:
- Documentation files created
- Clear and complete
- Examples provided
- Covers all scenarios

**Tests Required**:
- Manual review: Documentation is clear
- Manual review: Examples work correctly

**Code Review**:
- Documentation clarity review
- Completeness review

---

### Task 7.3: Create Migration Guide

**References**: Design section "Migration Path"

- File: `docs/features/source-time-limits/MIGRATION.md`
- Document:
  - Database schema migrations
  - No data loss guarantees
  - Backward compatibility
  - Steps for existing installations
  - Rollback procedure
  - Troubleshooting migration issues

**Definition of Done**:
- Migration guide complete
- Clear step-by-step instructions
- Addresses common issues
- Rollback procedure documented

**Code Review**:
- Accuracy review
- Completeness review

---

## Implementation Checklist

Use this checklist to track progress:

### Phase 1: Database (Days 1-2)
- [ ] 1.1 Add column to sources table
- [ ] 1.2 Extend usage_logs table
- [ ] 1.3 Extend usage_extras table
- [ ] 1.4 Update database types
- [ ] 1.5 Update shared types

### Phase 2: Time Tracking (Days 3-6)
- [ ] 2.1 Implement getSourceTimeState()
- [ ] 2.2 Implement recordSourceWatchTime()
- [ ] 2.3 Implement enforceSourceTimeLimit()
- [ ] 2.4 Implement grantSourceTimeExtension()
- [ ] 2.5 Enhance recordVideoWatching()
- [ ] 2.6 Implement resetDailySourceUsage()

### Phase 3: IPC (Days 7-8)
- [ ] 3.1 Create IPC handlers
- [ ] 3.2 Expose preload API
- [ ] 3.3 Add type definitions

### Phase 4: Renderer Service (Day 9)
- [ ] 4.1 Create/enhance TimeTrackingService

### Phase 5: Admin UI (Days 10-12)
- [ ] 5.1 Add field to VideoSourceForm
- [ ] 5.2 Create SourceTimeDisplay component
- [ ] 5.3 Create QuickExtensionMenu component
- [ ] 5.4 Integrate into sources list

### Phase 6: Player Enforcement (Days 13-14)
- [ ] 6.1 Add time tracking hook
- [ ] 6.2 Display time in UI
- [ ] 6.3 Enhance /time-up page
- [ ] 6.4 Add extension request component (optional)

### Phase 7: Testing & Docs (Days 15-16)
- [ ] 7.1 Create test suite
- [ ] 7.2 Create feature documentation
- [ ] 7.3 Create migration guide

---

## Definition of Done Criteria

All tasks must meet these criteria before marking complete:

1. **Functionality**: Feature works as specified in requirements
2. **Testing**: All required tests pass with ≥80% coverage
3. **Code Quality**: Code review approved, no outstanding issues
4. **Documentation**: Code documented, feature documented
5. **Backward Compatibility**: Existing features still work
6. **Performance**: No degradation from baseline
7. **Error Handling**: All error cases handled gracefully
8. **Logging**: Appropriate logging for debugging

---

## Quality Gates

Before considering implementation complete:

1. **All tests passing**: `yarn test` returns 100% pass rate
2. **No TypeScript errors**: `yarn type-check` clean
3. **Code review approved**: At least 2 reviewers approve
4. **Performance acceptable**: No measurable slowdown
5. **Documentation complete**: All docs present and accurate
6. **Migration tested**: Schema changes applied successfully
7. **No regressions**: Existing time limit features still work
