# Source-Level Time Limits: Technical Design

## Overview

The source-level time limits feature extends SafeTube's existing global time tracking system to support per-source (per-channel/per-playlist/per-folder) daily time limits. The system enforces both limits simultaneously: if either source or global limit is reached, playback stops. Parents can grant temporary extensions for individual sources.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Interface                          │
│  (Video Source Settings + Quick Extension Controls)         │
└────────────────┬────────────────────────────────┬───────────┘
                 │                                │
                 │ Edit source limit              │ Grant extension
                 │                                │
┌────────────────▼────────────────────────────────▼───────────┐
│                  IPC Bridge                                  │
│  (Main Process Communication Layer)                         │
└────────────────┬────────────────────────────────┬───────────┘
                 │                                │
                 │                                │
┌────────────────▼──────────────┐  ┌─────────────▼───────────┐
│  Time Tracking Service        │  │ Source Extension Service │
│  (recordVideoWatching)        │  │ (grantSourceExtension)   │
│  - Track source time          │  │ - Calculate new limit    │
│  - Enforce source limit       │  │ - Log extension         │
│  - Calculate remaining time   │  │ - Update usage_extras   │
└────────────────┬──────────────┘  └─────────────┬───────────┘
                 │                                │
                 │                                │
┌────────────────▼────────────────────────────────▼───────────┐
│                    Database Layer                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ sources table                                        │   │
│  │  - daily_time_limit_minutes (NEW)                   │   │
│  │  - id, type, title, position, etc.                  │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ usage_logs table                                     │   │
│  │  - date, seconds_used, source_id (NEW)              │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ usage_extras table                                   │   │
│  │  - source_id (NEW), minutes_added, date, reason     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Changes

### Phase 1: Add Column to Sources Table

**File**: `src/main/database/schema/migrations/add-source-time-limits.sql`

```sql
-- Add daily_time_limit_minutes column to sources table
ALTER TABLE sources ADD COLUMN daily_time_limit_minutes INTEGER DEFAULT NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sources_daily_time_limit ON sources(daily_time_limit_minutes);
```

### Phase 2: Extend Usage Logs Table

**File**: `src/main/database/schema/migrations/extend-usage-logs.sql`

```sql
-- Add source_id to usage_logs table to track per-source usage
ALTER TABLE usage_logs ADD COLUMN source_id TEXT DEFAULT NULL;

-- Add foreign key constraint
-- Note: SQLite ALTER TABLE limitations may require recreation, documented in implementation
ALTER TABLE usage_logs ADD CONSTRAINT fk_usage_logs_source_id
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;

-- Create index for efficient source usage queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_source_id ON usage_logs(source_id, date);
```

### Phase 3: Extend Usage Extras Table

**File**: `src/main/database/schema/migrations/extend-usage-extras.sql`

```sql
-- Add source_id to usage_extras table to track per-source extensions
ALTER TABLE usage_extras ADD COLUMN source_id TEXT DEFAULT NULL;

-- Add foreign key constraint
ALTER TABLE usage_extras ADD CONSTRAINT fk_usage_extras_source_id
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;

-- Create index for efficient query
CREATE INDEX IF NOT EXISTS idx_usage_extras_source_id ON usage_extras(source_id, date);
```

### Updated Database Types

**File**: `src/main/database/queries/types.ts`

```typescript
// Extend existing Source interface
export interface Source {
  // ... existing fields
  daily_time_limit_minutes: number | null;  // NEW: Daily limit in minutes, null = unlimited
}

// Extend existing UsageLog interface
export interface UsageLog {
  // ... existing fields
  source_id: string | null;  // NEW: Associate usage with source
}

// Extend existing UsageExtra interface
export interface UsageExtra {
  // ... existing fields
  source_id: string | null;  // NEW: Associate extension with source
}

// New interface for source time state
export interface SourceTimeState {
  sourceId: string;
  dailyLimitMinutes: number | null;  // null = unlimited
  secondsUsedToday: number;
  secondsRemainingToday: number;
  isLimitExceeded: boolean;
  lastResetDate: string;  // YYYY-MM-DD
}

// Result of time enforcement check
export interface SourceTimeEnforcement {
  canWatch: boolean;
  blockedSourceId?: string | null;  // null if not blocked by source
  blockedReason?: 'source_limit' | 'global_limit';
  secondsRemaining?: number;
  minutesRemaining?: number;
}
```

## Core Service Modifications

### 1. Time Tracking Service Enhancement

**File**: `src/main/timeTracking.ts`

#### New Function: `getSourceTimeState()`

```typescript
/**
 * Get current time state for a specific source
 * Calculates remaining time, checks if limit is exceeded
 * @param sourceId - Source ID to check
 * @returns SourceTimeState with current usage and limit info
 */
async function getSourceTimeState(sourceId: string): Promise<SourceTimeState>
```

**Logic**:
1. Query `sources` table to get `daily_time_limit_minutes` for the source
2. Query `usage_logs` for today's usage for this source
3. Query `usage_extras` for today's extensions for this source
4. Calculate: remainingSeconds = (limitMinutes * 60) + (extensionMinutes * 60) - secondsUsed
5. Return `SourceTimeState` object

#### Enhanced Function: `recordVideoWatching()`

Modify existing function to:
1. Continue recording global watch time (existing behavior)
2. **NEW**: Record watch time per-source in `usage_logs` table with `source_id`
3. **NEW**: Call `enforceSourceTimeLimit()` to check if source limit exceeded
4. **NEW**: Return source time state in response

**Pseudocode**:
```typescript
async function recordVideoWatching(watchData) {
  // Existing: record to global usage_logs
  const globalState = await recordGlobalWatchTime(watchData);

  // NEW: record to source-specific usage_logs
  const sourceId = watchData.source;
  await recordSourceWatchTime(sourceId, watchData.watchSeconds);

  // NEW: check source limit enforcement
  const sourceState = await getSourceTimeState(sourceId);

  if (sourceState.isLimitExceeded) {
    // Block playback from this source
    return {
      ...globalState,
      sourceBlocked: true,
      blockedSourceId: sourceId,
      sourceTimeState: sourceState
    };
  }

  return { ...globalState, sourceTimeState: sourceState };
}
```

#### New Function: `recordSourceWatchTime()`

```typescript
/**
 * Record watch time for a specific source
 * @param sourceId - Source ID to record time for
 * @param secondsWatched - Time watched in seconds
 */
async function recordSourceWatchTime(sourceId: string, secondsWatched: number): Promise<void>
```

**Logic**:
1. Query `usage_logs` for today's entry for this source
2. If exists: increment `seconds_used`
3. If not exists: create new entry with today's date and source_id
4. Account for `usage_extras` extensions

#### New Function: `enforceSourceTimeLimit()`

```typescript
/**
 * Check if source daily time limit has been exceeded
 * @param sourceId - Source ID to check
 * @returns Enforcement decision object
 */
async function enforceSourceTimeLimit(sourceId: string): Promise<SourceTimeEnforcement>
```

**Logic**:
1. Get source limit from `sources.daily_time_limit_minutes`
2. If limit is NULL, return `{ canWatch: true }`
3. Get today's usage + extensions for source
4. If totalSecondsUsed >= (limitSeconds + extensionSeconds):
   - Return `{ canWatch: false, blockedSourceId: sourceId, blockedReason: 'source_limit' }`
5. Else return `{ canWatch: true }`

#### New Function: `grantSourceTimeExtension()`

```typescript
/**
 * Grant temporary time extension for a specific source
 * @param sourceId - Source ID to extend
 * @param minutesAdded - Minutes to add to today's limit
 * @param reason - Reason for extension
 * @param addedBy - Parent name/identifier
 */
async function grantSourceTimeExtension(
  sourceId: string,
  minutesAdded: number,
  reason: string,
  addedBy: string
): Promise<void>
```

**Logic**:
1. Validate: sourceId exists in `sources`, minutesAdded is 1-60
2. Insert into `usage_extras` table:
   - `date`: today's date (YYYY-MM-DD)
   - `source_id`: sourceId
   - `minutes_added`: minutesAdded
   - `reason`: reason
   - `added_by`: addedBy
3. Log to console/audit: "Extension granted: {source_id} +{minutesAdded} min"

#### New Function: `resetDailySourceUsage()`

```typescript
/**
 * Reset daily usage for all sources at midnight
 * Called by daily reset mechanism
 */
async function resetDailySourceUsage(): Promise<void>
```

**Logic**:
1. Runs at midnight local time (same as global reset)
2. No action needed - `usage_logs` is date-based, next day creates new entry
3. `usage_extras` is also date-based, will have no entries for new day

### 2. Type Updates

**File**: `src/shared/types.ts`

Add new interfaces:

```typescript
export interface SourceTimeState {
  sourceId: string;
  dailyLimitMinutes: number | null;
  secondsUsedToday: number;
  secondsRemainingToday: number;
  isLimitExceeded: boolean;
  lastResetDate: string;
}

export interface TimeTrackingState {
  // ... existing global fields
  sourceTimeState?: SourceTimeState;  // NEW: include source state
  sourceBlocked?: boolean;             // NEW: indicates source is blocked
  blockedSourceId?: string;            // NEW: which source is blocked
}
```

## IPC Communication Changes

### New IPC Channels

**File**: `src/main/ipcHandlers.ts` (or relevant IPC file)

```typescript
// Get source time state
ipcMain.handle('timeTracking:getSourceState', async (event, sourceId: string) => {
  const state = await getSourceTimeState(sourceId);
  return state;
});

// Grant source time extension
ipcMain.handle('timeTracking:grantSourceExtension', async (event, {
  sourceId,
  minutesAdded,
  reason,
  addedBy
}: {
  sourceId: string;
  minutesAdded: number;
  reason?: string;
  addedBy: string;
}) => {
  await grantSourceTimeExtension(sourceId, minutesAdded, reason || '', addedBy);
  // Return updated state
  return await getSourceTimeState(sourceId);
});

// Get all sources with their current time state
ipcMain.handle('timeTracking:getAllSourceStates', async (event) => {
  const sources = await getAllSources();
  const states = await Promise.all(
    sources.map(s => getSourceTimeState(s.id))
  );
  return states;
});
```

### Preload Script Updates

**File**: `src/preload/index.ts`

```typescript
// Add to electron API exposure
electron: {
  // ... existing
  timeTracking: {
    // ... existing
    getSourceState: (sourceId: string) =>
      ipcRenderer.invoke('timeTracking:getSourceState', sourceId),

    grantSourceExtension: (sourceId: string, minutesAdded: number, reason?: string) =>
      ipcRenderer.invoke('timeTracking:grantSourceExtension', {
        sourceId,
        minutesAdded,
        reason,
        addedBy: 'parent' // TODO: get actual parent name from settings
      }),

    getAllSourceStates: () =>
      ipcRenderer.invoke('timeTracking:getAllSourceStates')
  }
}
```

## Renderer Process Changes

### Time Tracking Service (Renderer)

**File**: `src/renderer/services/timeTrackingService.ts`

```typescript
export class TimeTrackingService {
  // Existing methods...

  /**
   * Get current time state for a source
   */
  static async getSourceTimeState(sourceId: string): Promise<SourceTimeState> {
    return window.electron.timeTracking.getSourceState(sourceId);
  }

  /**
   * Grant time extension for a source
   */
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

  /**
   * Get time states for all sources
   */
  static async getAllSourceStates(): Promise<SourceTimeState[]> {
    return window.electron.timeTracking.getAllSourceStates();
  }

  /**
   * Format time state for display
   */
  static formatTimeRemaining(sourceTimeState: SourceTimeState): string {
    if (sourceTimeState.dailyLimitMinutes === null) {
      return 'Unlimited';
    }

    const minutes = Math.floor(sourceTimeState.secondsRemainingToday / 60);
    const seconds = sourceTimeState.secondsRemainingToday % 60;

    return `${minutes}m ${seconds}s`;
  }

  /**
   * Format extension options for quick access
   */
  static getExtensionOptions(): number[] {
    return [5, 10, 15, 30];  // minutes
  }
}
```

## Enforcement Logic

### PlayerPage Integration

**File**: `src/renderer/pages/PlayerPage.tsx`

#### New Hook: Monitor Source Time Limit

```typescript
// Add to existing time tracking polling
const checkSourceTimeLimit = useCallback(async () => {
  if (!currentSource) return;

  const sourceState = await TimeTrackingService.getSourceTimeState(currentSource);

  if (sourceState.isLimitExceeded) {
    // Play beep if configured
    playAudioWarning();

    // Pause video
    pauseVideo();

    // Navigate to time-up screen with source info
    navigate('/time-up', {
      state: {
        blockedReason: 'source_limit',
        sourceId: currentSource,
        sourceTimeState: sourceState
      }
    });
  }

  // Update UI with remaining time
  setSourceTimeRemaining(sourceState.secondsRemainingToday);
}, [currentSource]);

// Call in existing time tracking interval (1 second)
useEffect(() => {
  const interval = setInterval(() => {
    // ... existing global time check
    checkSourceTimeLimit();
  }, 1000);

  return () => clearInterval(interval);
}, [checkSourceTimeLimit]);
```

#### Display Source Time

```typescript
// In player UI, show source time remaining
<div className="source-time-info">
  {sourceTimeRemaining !== null ? (
    <>
      <span className="label">Source Time:</span>
      <span className="time-remaining">
        {TimeTrackingService.formatTimeRemaining({
          secondsRemainingToday: sourceTimeRemaining,
          dailyLimitMinutes: currentSourceLimit
        })}
      </span>
    </>
  ) : null}
</div>
```

### /time-up Page Enhancement

**File**: `src/renderer/pages/TimeUpPage.tsx`

Add source-specific messaging:

```typescript
const TimeUpPage = () => {
  const location = useLocation();
  const { blockedReason, sourceId, sourceTimeState } = location.state || {};

  return (
    <div className="time-up-container">
      {blockedReason === 'source_limit' ? (
        <>
          <h2>Time's up for {sourceTitle}!</h2>
          <p>Daily limit reached for this source.</p>
          <p>You can watch other sources or request more time.</p>
        </>
      ) : (
        <>
          <h2>Time's up for today!</h2>
          <p>Your daily overall time limit has been reached.</p>
        </>
      )}

      {/* Request extension button if source-limited */}
      {blockedReason === 'source_limit' && (
        <RequestSourceExtensionButton sourceId={sourceId} />
      )}
    </div>
  );
};
```

## Admin Interface Changes

### Video Source Settings

**File**: `src/renderer/components/admin/VideoSourceForm.tsx`

Add new field:

```typescript
// In source form
<div className="form-group">
  <label htmlFor="dailyTimeLimit">Daily Time Limit</label>
  <input
    id="dailyTimeLimit"
    type="number"
    min="0"
    max="1440"
    step="1"
    placeholder="Leave blank for unlimited"
    value={formData.dailyTimeLimit || ''}
    onChange={(e) => setFormData({
      ...formData,
      dailyTimeLimit: e.target.value ? parseInt(e.target.value) : null
    })}
  />
  <small>Minutes per day. Leave blank for no limit.</small>
</div>
```

### Source List with Time Management

**File**: `src/renderer/components/admin/SourcesListPanel.tsx`

Add status columns and quick extension controls:

```typescript
// In sources table/list
columns={[
  { key: 'title', label: 'Source' },
  { key: 'type', label: 'Type' },
  {
    key: 'dailyTimeLimit',
    label: 'Daily Limit',
    render: (limit) => limit ? `${limit} min` : 'Unlimited'
  },
  {
    key: 'timeRemaining',
    label: 'Remaining Today',
    render: (_, source) => <SourceTimeDisplay sourceId={source.id} />
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (_, source) => (
      <div className="button-group">
        <button onClick={() => editSource(source)}>Edit</button>
        {source.dailyTimeLimit && (
          <QuickExtensionMenu sourceId={source.id} />
        )}
      </div>
    )
  }
]}
```

#### SourceTimeDisplay Component

```typescript
const SourceTimeDisplay: React.FC<{ sourceId: string }> = ({ sourceId }) => {
  const [timeState, setTimeState] = useState<SourceTimeState | null>(null);

  useEffect(() => {
    TimeTrackingService.getSourceTimeState(sourceId).then(setTimeState);

    // Refresh every 60 seconds
    const interval = setInterval(() => {
      TimeTrackingService.getSourceTimeState(sourceId).then(setTimeState);
    }, 60000);

    return () => clearInterval(interval);
  }, [sourceId]);

  if (!timeState || timeState.dailyLimitMinutes === null) {
    return <span>Unlimited</span>;
  }

  const minutes = Math.floor(timeState.secondsRemainingToday / 60);
  const progressPercent =
    (timeState.secondsUsedToday / (timeState.dailyLimitMinutes * 60)) * 100;

  const isWarning = timeState.secondsRemainingToday < 300; // < 5 min

  return (
    <div className={cn('time-display', isWarning && 'warning')}>
      <ProgressBar value={progressPercent} />
      <span>{minutes}m remaining</span>
    </div>
  );
};
```

#### QuickExtensionMenu Component

```typescript
const QuickExtensionMenu: React.FC<{ sourceId: string }> = ({ sourceId }) => {
  const handleExtend = async (minutes: number) => {
    try {
      await TimeTrackingService.grantSourceExtension(
        sourceId,
        minutes,
        'Quick extension from admin panel'
      );

      toast.success(`Granted ${minutes} minutes to ${sourceTitle}`);
      // Refresh time display
      refreshTimeState();
    } catch (error) {
      toast.error('Failed to grant extension');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button>+ Time</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {[5, 10, 15, 30].map(minutes => (
          <DropdownMenuItem
            key={minutes}
            onClick={() => handleExtend(minutes)}
          >
            {minutes} minutes
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

## Technical Decisions & Rationale

### 1. Database Structure for Per-Source Usage

**Decision**: Add `source_id` to `usage_logs` table instead of creating separate table

**Rationale**:
- Minimal schema changes (just add column to existing table)
- Reuses existing daily reset mechanism
- Efficient queries: `SELECT SUM(seconds_used) FROM usage_logs WHERE source_id=? AND date=?`
- Maintains consistency with global usage tracking approach

**Alternative Rejected**: Separate `source_usage_logs` table
- Would require duplicate daily reset logic
- More complex queries for both global and per-source usage

### 2. Limit Reached Behavior

**Decision**: Block ONLY the source with limit reached, not all sources

**Rationale**:
- Aligns with user requirement: "block only that source"
- Better UX: child can continue with other content
- Simpler enforcement: check source_id on recordVideoWatching call
- Matches parent's use case: "5 min for channel A, 10 min for channel B"

**Alternative Rejected**: Block all if any source limit reached
- Would be overly restrictive
- Defeats purpose of per-source limits

### 3. Extension Storage

**Decision**: Store extensions in `usage_extras` table with `source_id`

**Rationale**:
- Extensions already have audit trail in `usage_extras`
- Just adding `source_id` column
- Maintains existing extension recording mechanism
- Consistent with existing time management

### 4. Time Precision

**Decision**: Track and display to nearest second

**Rationale**:
- Matches existing global time tracking precision
- Sufficient for parental control use case
- Simplifies calculation (no fractional seconds)

### 5. Warning Beep at 5 Seconds

**Decision**: Use existing system beep configuration, no visual overlay

**Rationale**:
- User explicitly requested "audio beep only" (no overlay)
- Reuses existing beep mechanism from global limits
- Simpler implementation
- Less intrusive UI

## Error Handling

### Database Migration Errors

**Scenario**: ALTER TABLE fails due to schema constraints

**Mitigation**:
1. Pre-migration validation: check column doesn't exist
2. Fallback: if ALTER fails, use CREATE TABLE + COPY + DROP + RENAME pattern
3. Log detailed errors for debugging

### Missing Source ID in Usage Records

**Scenario**: Legacy usage_logs records don't have source_id

**Mitigation**:
1. source_id can be NULL in database
2. When querying, treat NULL as "global" or "unknown"
3. Migration script populates NULL values where possible from video->source mapping

### Race Condition on Concurrent Watch Sessions

**Scenario**: Same child watches two sources simultaneously

**Mitigation**:
1. Video playback is single-source (modal context)
2. Only one recordVideoWatching call at a time
3. If app behavior changes, add database row-level locking

## Testing Strategy

### Unit Tests

#### Time State Calculation Tests
- Test `getSourceTimeState()` with various limits and usage combinations
- Test with NULL limit (unlimited)
- Test with extensions applied
- Test at day boundary (midnight reset)

#### Extension Grant Tests
- Test `grantSourceTimeExtension()` validates inputs
- Test extension persists correctly
- Test audit trail records correctly

#### Enforcement Tests
- Test `enforceSourceTimeLimit()` returns correct block decision
- Test with limit reached exactly
- Test with limit exceeded
- Test with no limit (unlimited)

### Integration Tests

#### Database Migration Tests
- Test schema additions work correctly
- Test backward compatibility with old data
- Test concurrent processes during migration

#### IPC Communication Tests
- Test getSourceState returns correct data via IPC
- Test grantSourceExtension correctly updates database
- Test error handling on IPC failures

#### UI Component Tests
- Test SourceTimeDisplay updates correctly
- Test QuickExtensionMenu actions work
- Test PlayerPage displays source time correctly

### End-to-End Tests

#### Full User Flow
1. Parent sets 5 min limit on YouTube channel A
2. Child watches video from channel A
3. At 4:55, system shows warning
4. At 5:00, video pauses, /time-up page shows
5. Parent grants 2 min extension via admin panel
6. Child resumes watching (4 min 50 sec remaining now)
7. At midnight, limit resets to 5 min

#### Multi-Source Flow
1. Parent sets different limits for 3 sources
2. Child watches each source up to near-limit
3. System correctly enforces each source's specific limit
4. Global limit still enforced when all usage combines

## Performance Considerations

### Query Optimization

1. **Index on (source_id, date)** for fast daily usage lookups
2. **Cached source states** in memory, refresh every 60 seconds (admin UI)
3. **Real-time checks** in player (every second) only query database if near limit

### Memory Usage

- Source time states cached per-session in admin
- No persistent caching across app restarts
- ~1KB per source for state object

### Database Load

- One query per second in player (existing behavior)
- Adds source_id filter to existing queries
- Migration adds minimal load (one-time ALTER TABLE)

## Migration Path

### Backward Compatibility

1. `daily_time_limit_minutes` is nullable (NULL = no limit)
2. `source_id` in usage_logs is optional (NULL for legacy entries)
3. Existing global time limit logic continues unchanged
4. No schema breaking changes

### Migration Steps

1. Database schema version incremented to 1.1
2. ALTER TABLE statements execute on startup
3. Optional: populate source_id from video->source mapping for recent history
4. No data loss scenario

## Deployment Notes

- Feature is additive, fully backward compatible
- Requires database schema migration on first run
- Admin UI updated to show new fields
- PlayerPage UX enhanced but not required for existing functionality
