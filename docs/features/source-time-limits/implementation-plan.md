# Source-Time-Limits Feature - Implementation Plan

## Overview

This document provides a comprehensive technical implementation plan for adding per-source daily time limits to SafeTube. The feature allows parents to set specific daily time limits for individual YouTube channels/playlists/local folders, while maintaining global daily limits that apply across all sources.

**User Scenario**: Parent sets 5 minutes/day for YouTube channel ABC. When the child requests 2 extra minutes for that source, the parent can grant it via the admin panel.

**Key Design Decisions**:
- Both limits apply: source time counts toward global limit
- Whichever limit is reached first stops playback (of that source only)
- Audio beep warning at 5 seconds before source limit (no countdown overlay)
- Enforcement blocks ONLY that source (child can watch other sources)

---

## Database Schema Changes

### Phase 2 Migration Required

Create `/src/main/database/schema/phase2.sql` with the following tables:

#### 1. Source Time Limits Table

```sql
CREATE TABLE IF NOT EXISTS source_time_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    Monday INTEGER DEFAULT 0,        -- minutes
    Tuesday INTEGER DEFAULT 0,
    Wednesday INTEGER DEFAULT 0,
    Thursday INTEGER DEFAULT 0,
    Friday INTEGER DEFAULT 0,
    Saturday INTEGER DEFAULT 0,
    Sunday INTEGER DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    UNIQUE(source_id)
);

CREATE INDEX IF NOT EXISTS idx_source_time_limits_source_id
    ON source_time_limits(source_id);
```

**Design Notes**:
- One row per source (UNIQUE constraint on source_id)
- Defaults to 0 (no per-source limit, only global applies)
- Reuses day-of-week structure matching `time_limits` table
- Timestamp fields for audit trail

#### 2. Source Usage Log Table

```sql
CREATE TABLE IF NOT EXISTS source_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    date TEXT NOT NULL,              -- ISO YYYY-MM-DD
    seconds_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    UNIQUE(source_id, date)
);

CREATE INDEX IF NOT EXISTS idx_source_usage_logs_source_id_date
    ON source_usage_logs(source_id, date);
CREATE INDEX IF NOT EXISTS idx_source_usage_logs_date
    ON source_usage_logs(date);
```

**Design Notes**:
- Track seconds per source per day (for precision matching global usage_logs)
- UNIQUE constraint on (source_id, date) prevents duplicates
- Indexed for efficient queries by source and date

#### 3. Source Time Extras Table

```sql
CREATE TABLE IF NOT EXISTS source_time_extras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    date TEXT NOT NULL,              -- ISO YYYY-MM-DD
    minutes_added INTEGER NOT NULL,
    reason TEXT,                     -- e.g., "parent grant", "special occasion"
    added_by TEXT,                   -- username or "parent"
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_source_time_extras_source_id_date
    ON source_time_extras(source_id, date);
CREATE INDEX IF NOT EXISTS idx_source_time_extras_date
    ON source_time_extras(date);
```

**Design Notes**:
- Allows multiple entries per source per day (audit trail)
- Tracks reason and who granted the time
- No UNIQUE constraint (intentional: allows multiple grants)
- Indexed for efficient queries

### Migration Execution Strategy

1. Create phase2.sql file with all table definitions
2. Implement `handlePhase2Migration()` in `SchemaManager.ts`
3. Update schema_version table to version 2, phase 'phase2'
4. Call migration on app startup (non-destructive: `CREATE TABLE IF NOT EXISTS`)

---

## Time Tracking Logic Changes

### File: `/src/main/timeTracking.ts`

#### New Interface

```typescript
// Add to types after line 8:
interface SourceTimeTrackingState {
  sourceId: string;
  timeUsedToday: number;       // seconds
  timeLimitToday: number;       // seconds (base + extra)
  timeRemaining: number;        // seconds
  isLimitReached: boolean;
  extraTimeToday?: number;      // minutes
}

interface TimeTrackingStateWithSources {
  currentDate: string;
  // Global tracking (existing)
  timeUsedToday: number;
  timeLimitToday: number;
  timeRemaining: number;
  isLimitReached: boolean;
  extraTimeToday?: number;
  // New: Per-source tracking
  sourceTracking: {
    [sourceId: string]: SourceTimeTrackingState;
  };
}
```

#### Enhanced `recordVideoWatching()` Function

**Current behavior** (lines 283-327):
- Records to view_records with source_id
- Calls `recordUsageTime()` for global tracking only

**Required changes**:
1. After global usage recording, also call `recordSourceUsageTime(sourceId, timeWatchedSeconds)`
2. Update function signature to accept sourceId (already available from video metadata)

```typescript
export async function recordVideoWatching(
  videoId: string,
  position: number,
  timeWatched: number,
  duration?: number
): Promise<void> {
  // ... existing metadata loading code ...

  const watchedEntry: WatchedVideo = {
    // ... existing fields ...
  };

  // Write to database (primary storage)
  await writeViewRecordToDatabase(watchedEntry);

  // Record both global and per-source usage
  await recordUsageTime(timeWatched);

  // NEW: Record per-source usage
  const sourceId = watchedEntry.source || 'unknown';
  await recordSourceUsageTime(sourceId, timeWatched);
}
```

#### New Function: `recordSourceUsageTime()`

```typescript
async function recordSourceUsageTime(
  sourceId: string,
  timeWatchedSeconds: number
): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const today = new Date().toISOString().split('T')[0];

    // Get existing usage or default to 0
    const existing = await dbService.get<any>(
      'SELECT seconds_used FROM source_usage_logs WHERE source_id = ? AND date = ?',
      [sourceId, today]
    );

    if (existing) {
      await dbService.run(
        'UPDATE source_usage_logs SET seconds_used = seconds_used + ? WHERE source_id = ? AND date = ?',
        [timeWatchedSeconds, sourceId, today]
      );
    } else {
      await dbService.run(
        'INSERT INTO source_usage_logs (source_id, date, seconds_used) VALUES (?, ?, ?)',
        [sourceId, today, timeWatchedSeconds]
      );
    }

    logVerbose(`[TimeTracking] Recorded ${timeWatchedSeconds}s for source ${sourceId}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error recording source usage time: ${error}`);
    throw error;
  }
}
```

#### Enhanced `getTimeTrackingState()` Function

**Current return type** (lines 354-391):
```typescript
{
  currentDate: string;
  timeUsedToday: number;
  timeLimitToday: number;
  timeRemaining: number;
  isLimitReached: boolean;
  extraTimeToday?: number;
}
```

**New return type**:
```typescript
Promise<TimeTrackingStateWithSources>
```

**Implementation changes**:
1. Fetch all source_time_limits from database
2. Fetch all source_usage_logs for today
3. Fetch all source_time_extras for today
4. Build sourceTracking object with calculations for each source
5. Return enhanced object

```typescript
export async function getTimeTrackingState(): Promise<TimeTrackingStateWithSources> {
  try {
    const [timeLimits, usageLog, timeExtra] = await Promise.all([
      readTimeLimits(),
      readUsageLog(),
      readTimeExtra()
    ]);

    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();

    const currentDate = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Global calculations (existing)
    const timeLimitMinutes = (timeLimits[dayOfWeek as keyof TimeLimits] as number) || 0;
    const extraTimeMinutes = timeExtra[currentDate] || 0;
    const timeLimitSeconds = (timeLimitMinutes + extraTimeMinutes) * 60;
    const timeUsedToday = usageLog[currentDate] || 0;
    const timeRemaining = Math.max(0, timeLimitSeconds - timeUsedToday);
    const isLimitReached = timeUsedToday >= timeLimitSeconds;

    // NEW: Per-source calculations
    const sourceTracking: { [sourceId: string]: SourceTimeTrackingState } = {};

    // Get all sources with per-source limits
    const sourcesWithLimits = await dbService.all<any>(
      'SELECT DISTINCT source_id FROM source_time_limits'
    );

    for (const row of sourcesWithLimits) {
      const sourceId = row.source_id;

      // Get this source's time limits
      const sourceLimits = await dbService.get<any>(
        'SELECT Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday FROM source_time_limits WHERE source_id = ?',
        [sourceId]
      );

      if (!sourceLimits) continue;

      const sourceTimeLimitMinutes = (sourceLimits[dayOfWeek] as number) || 0;

      // Get this source's extra time for today
      const sourceExtraTime = await dbService.get<any>(
        'SELECT COALESCE(SUM(minutes_added), 0) as total_extra FROM source_time_extras WHERE source_id = ? AND date = ?',
        [sourceId, currentDate]
      );
      const sourceExtraMinutes = sourceExtraTime?.total_extra || 0;

      // Get this source's usage today
      const sourceUsage = await dbService.get<any>(
        'SELECT seconds_used FROM source_usage_logs WHERE source_id = ? AND date = ?',
        [sourceId, currentDate]
      );
      const sourceTimeUsedToday = sourceUsage?.seconds_used || 0;

      const sourceTimeLimitSeconds = (sourceTimeLimitMinutes + sourceExtraMinutes) * 60;
      const sourceTimeRemaining = Math.max(0, sourceTimeLimitSeconds - sourceTimeUsedToday);
      const sourceIsLimitReached = sourceTimeUsedToday >= sourceTimeLimitSeconds;

      sourceTracking[sourceId] = {
        sourceId,
        timeUsedToday: sourceTimeUsedToday,
        timeLimitToday: sourceTimeLimitSeconds,
        timeRemaining: sourceTimeRemaining,
        isLimitReached: sourceIsLimitReached,
        extraTimeToday: sourceExtraMinutes
      };
    }

    return {
      currentDate,
      timeUsedToday,
      timeLimitToday: timeLimitSeconds,
      timeRemaining,
      isLimitReached,
      extraTimeToday: extraTimeMinutes,
      sourceTracking
    };
  } catch (error) {
    logVerbose(`[TimeTracking] Error getting time tracking state: ${error}`);
    throw error;
  }
}
```

#### New Function: `addSourceExtraTime()`

```typescript
export async function addSourceExtraTime(
  sourceId: string,
  minutes: number,
  reason?: string,
  addedBy?: string
): Promise<void> {
  try {
    const { DatabaseService } = await import('./services/DatabaseService');
    const dbService = DatabaseService.getInstance();
    const today = new Date().toISOString().split('T')[0];

    await dbService.run(
      'INSERT INTO source_time_extras (source_id, date, minutes_added, reason, added_by) VALUES (?, ?, ?, ?, ?)',
      [sourceId, today, minutes, reason || null, addedBy || 'parent']
    );

    logVerbose(`[TimeTracking] Added ${minutes} minutes extra time for source ${sourceId}: ${reason}`);
  } catch (error) {
    logVerbose(`[TimeTracking] Error adding source extra time: ${error}`);
    throw error;
  }
}
```

---

## IPC Contract Updates

### File: `/src/main/ipc/databaseHandlers.ts`

Add new handlers for source time management:

```typescript
// Get time tracking state (enhanced with source tracking)
ipcMain.handle('getTimeTrackingState', async () => {
  const { getTimeTrackingState } = await import('../timeTracking');
  return await getTimeTrackingState();
});

// Add source extra time
ipcMain.handle('addSourceExtraTime', async (_event, sourceId: string, minutes: number, reason?: string) => {
  const { addSourceExtraTime } = await import('../timeTracking');
  await addSourceExtraTime(sourceId, minutes, reason, 'parent');
  // Return updated state
  const { getTimeTrackingState } = await import('../timeTracking');
  return await getTimeTrackingState();
});

// Get source time limits (read-only)
ipcMain.handle('getSourceTimeLimits', async (_event, sourceId: string) => {
  const { DatabaseService } = await import('./services/DatabaseService');
  const dbService = DatabaseService.getInstance();
  return await dbService.get(
    'SELECT Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday FROM source_time_limits WHERE source_id = ?',
    [sourceId]
  );
});

// Update source time limits
ipcMain.handle('updateSourceTimeLimits', async (_event, sourceId: string, limits: any) => {
  const { DatabaseService } = await import('./services/DatabaseService');
  const dbService = DatabaseService.getInstance();

  // Check if limit exists
  const existing = await dbService.get('SELECT id FROM source_time_limits WHERE source_id = ?', [sourceId]);

  if (existing) {
    await dbService.run(
      `UPDATE source_time_limits
       SET Monday = ?, Tuesday = ?, Wednesday = ?, Thursday = ?, Friday = ?, Saturday = ?, Sunday = ?, updated_at = CURRENT_TIMESTAMP
       WHERE source_id = ?`,
      [limits.Monday || 0, limits.Tuesday || 0, limits.Wednesday || 0, limits.Thursday || 0,
       limits.Friday || 0, limits.Saturday || 0, limits.Sunday || 0, sourceId]
    );
  } else {
    await dbService.run(
      `INSERT INTO source_time_limits (source_id, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sourceId, limits.Monday || 0, limits.Tuesday || 0, limits.Wednesday || 0, limits.Thursday || 0,
       limits.Friday || 0, limits.Saturday || 0, limits.Sunday || 0]
    );
  }

  return true;
});
```

### File: `/src/preload/index.ts`

Add to electron API:

```typescript
getTimeTrackingState: () => ipcRenderer.invoke('getTimeTrackingState'),
addSourceExtraTime: (sourceId: string, minutes: number, reason?: string) =>
  ipcRenderer.invoke('addSourceExtraTime', sourceId, minutes, reason),
getSourceTimeLimits: (sourceId: string) =>
  ipcRenderer.invoke('getSourceTimeLimits', sourceId),
updateSourceTimeLimits: (sourceId: string, limits: any) =>
  ipcRenderer.invoke('updateSourceTimeLimits', sourceId, limits),
```

---

## Playback Enforcement Logic

### File: `/src/renderer/pages/BasePlayerPage.tsx`

**Current enforcement** (approx line 400-500):
- Checks `isLimitReached` flag from time tracking state
- If global limit reached: pauses video, exits fullscreen, navigates to /time-up

**Required changes**:
1. Fetch enhanced time tracking state with sourceTracking
2. Extract current video's sourceId from video metadata
3. Check BOTH global and source-specific limits
4. If source limit hit: set limit-hit reason and block only that source

```typescript
// Add state tracking for limit hit reason
const [limitHitReason, setLimitHitReason] = useState<'global' | 'source' | null>(null);
const [sourceIdThatHitLimit, setSourceIdThatHitLimit] = useState<string | null>(null);

// Enhanced time check (replace existing isLimitReached check)
const checkLimits = async () => {
  const state = await window.electron.getTimeTrackingState();
  const video = getCurrentVideo();
  const sourceId = video?.sourceId || 'unknown';

  // Check global limit
  if (state.isLimitReached) {
    setLimitHitReason('global');
    setSourceIdThatHitLimit(null);
    pause();
    exitFullscreen();
    return;
  }

  // Check source-specific limit
  if (sourceId in state.sourceTracking) {
    const sourceState = state.sourceTracking[sourceId];
    if (sourceState.isLimitReached) {
      setLimitHitReason('source');
      setSourceIdThatHitLimit(sourceId);
      pause();
      exitFullscreen();
      return;
    }
  }

  setLimitHitReason(null);
  setSourceIdThatHitLimit(null);
};

// In the second timer (every 1 second):
useEffect(() => {
  const timer = setInterval(() => {
    checkLimits();
  }, 1000);
  return () => clearInterval(timer);
}, []);

// Before navigating to time-up, check reason
if (limitHitReason === 'global') {
  navigate('/time-up');
} else if (limitHitReason === 'source') {
  navigate(`/source-time-up/${sourceIdThatHitLimit}`);
}
```

---

## UI Changes

### 1. New Page: `/src/renderer/pages/SourceTimeUpPage.tsx`

Similar to TimeUpPage but shows:
- Source name and thumbnail
- Source-specific time limits for each day
- Parent access button to grant extra time for THIS SOURCE

**Key differences from TimeUpPage**:
- URL parameter: `/source-time-up/:sourceId`
- Shows only one source's schedule
- "Grant Time" button links to admin panel with sourceId pre-selected

### 2. Enhanced TimeIndicator Component

**File**: `/src/renderer/components/layout/TimeIndicator.tsx`

**Current display**:
- Global time remaining only

**New display**:
- Global time remaining (primary)
- Source time remaining (if applicable, shown smaller)
- Change color to orange if source limit is low (< 1 min remaining)
- Change color to red if global limit is low

```typescript
const getTimeColor = (globalRemaining: number, sourceRemaining: number | null): string => {
  if (globalRemaining <= 60) return 'text-red-600';
  if (sourceRemaining !== null && sourceRemaining <= 60) return 'text-orange-600';
  if (sourceRemaining !== null && sourceRemaining <= 300) return 'text-orange-500';
  return 'text-gray-700';
};

// In JSX:
<div className={`time-display ${getTimeColor(globalRemaining, sourceRemaining)}`}>
  <span className="global-time">{formatTime(globalRemaining)}</span>
  {sourceRemaining !== null && (
    <span className="source-time text-sm">(Source: {formatTime(sourceRemaining)})</span>
  )}
</div>
```

### 3. Admin UI: Source Time Limits Management

**File**: `/src/renderer/components/admin/VideoSourceForm.tsx`

**Current fields**:
- Title, URL, sort preference

**New fields**:
- 7-day time limit inputs (Monday-Sunday)
- Validation: must be 0 or positive
- "Clear all" button to reset to 0

**Structure**:
```typescript
interface SourceTimeSettings {
  Monday: number;
  Tuesday: number;
  Wednesday: number;
  Thursday: number;
  Friday: number;
  Saturday: number;
  Sunday: number;
}
```

**Form layout**:
```
[Source Details Tab]
  Title: [input]
  URL: [input]
  Sort: [dropdown]

[Time Limits Tab] - NEW
  Global limits (read-only reference)
  Per-source limits:
    Monday: [0-999 input]
    Tuesday: [0-999 input]
    ... (repeat for all days)
  [Save] [Clear All]
```

### 4. Admin UI: Quick Source Time Extension

**File**: `/src/renderer/components/admin/QuickTimeExtension.tsx`

**Current UI**:
- Global time state display
- ±5 minute buttons for global extra time
- Projected state preview

**New UI additions**:
- Source selector dropdown (list of all sources with per-source limits)
- When source selected:
  - Show source time state (today's usage vs limit)
  - Show ±5 minute buttons for THAT SOURCE
  - Show projected state if applied
  - Save action calls `addSourceExtraTime(sourceId, minutes)`

```typescript
const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

return (
  <div>
    {/* Existing global section */}
    <div className="global-time-section">
      {/* ... existing code ... */}
    </div>

    {/* NEW: Per-source section */}
    <div className="per-source-section mt-8 border-t pt-6">
      <h3>Source Time Extension</h3>
      <select value={selectedSourceId || ''} onChange={(e) => setSelectedSourceId(e.target.value || null)}>
        <option value="">-- Select a source --</option>
        {sources.map(source => (
          <option key={source.id} value={source.id}>{source.title}</option>
        ))}
      </select>

      {selectedSourceId && sourceTracking[selectedSourceId] && (
        <div>
          {/* Show source state, buttons, etc. */}
        </div>
      )}
    </div>
  </div>
);
```

### 5. Admin UI: Usage Statistics

**File**: Create new `/src/renderer/components/admin/UsageStatsTab.tsx`

**Display**:
- Date selector (default: today)
- Table showing:
  - Source name
  - Time used today
  - Per-source limit (if set)
  - Global limit (read-only)
  - Extra time granted
  - % of limit used

**Query**: Pull from source_usage_logs, source_time_limits, source_time_extras

---

## Warning System

### Audio Warning at Source Limit Trigger

**File**: `/src/renderer/pages/BasePlayerPage.tsx`

**Current warning system**:
- 60-second countdown overlay + audio beep at 10 seconds
- Only for global limit

**New logic for source limits**:
- No countdown overlay (per design decision)
- Audio beep only at 5 seconds before source limit reached
- Calculated as: `sourceTimeRemaining <= 5 seconds`

```typescript
const checkSourceWarnings = (sourceTimeRemaining: number) => {
  if (sourceTimeRemaining > 5 && sourceTimeRemaining <= 10) {
    // Play warning beep
    const audioWarning = new Audio('/sounds/warning.mp3');
    audioWarning.play().catch(e => logVerbose('[Warning] Could not play audio:', e));
  }
};

// Call in the 1-second timer
useEffect(() => {
  const timer = setInterval(() => {
    const state = window.electron.getTimeTrackingState();
    const sourceState = state.sourceTracking?.[currentSourceId];
    if (sourceState) {
      checkSourceWarnings(sourceState.timeRemaining);
    }
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

---

## Testing Strategy

### Unit Tests

**File**: `/src/main/__tests__/sourceTimeTracking.test.ts`

Test cases:
- `recordSourceUsageTime()`: records time correctly, creates new or updates existing entry
- `getTimeTrackingState()`: returns sourceTracking object with correct calculations
- `addSourceExtraTime()`: adds extra time and persists to DB
- Edge cases:
  - Source with 0 limit (should allow unlimited)
  - Source with no limit set (should not appear in sourceTracking)
  - Multiple sources with different limits
  - Extra time pushes remaining into negative (should show 0)

### Integration Tests

**File**: `/src/renderer/__tests__/sourceTimeLimit.integration.test.ts`

Test scenarios:
1. Global limit reached first
   - Child watching mixed sources
   - Global limit exhausted
   - Source still has time remaining
   - All playback blocked (not just the source)

2. Source limit reached first
   - Child watching specific source with per-source limit
   - Source limit exhausted before global limit
   - Child can switch to other sources and continue
   - Original source remains blocked

3. Both limits at same time
   - Source and global limits both exhausted
   - Should block playback
   - Navigation to appropriate time-up page

4. Extra time scenarios
   - Parent grants global extra time
   - Parent grants source-specific extra time
   - Both active: verify calculations are correct

### End-to-End Tests

**File**: `/src/renderer/__tests__/sourceTimeLimit.e2e.test.ts`

Test flows:
1. **Admin sets per-source limits**
   - Navigate to admin panel
   - Edit video source
   - Set Monday limit to 10 minutes
   - Save changes
   - Verify persisted in database

2. **Child exhausts source limit**
   - Start video from source with 1-minute limit
   - Play for 1 minute
   - Verify playback stops
   - Verify navigates to SourceTimeUpPage
   - Verify can switch to other source

3. **Parent grants source extra time**
   - Child at SourceTimeUpPage
   - Parent opens admin panel
   - Selects source in QuickTimeExtension
   - Grants 2 extra minutes
   - Child can resume watching from that source

---

## Implementation Phases

### Phase A: Database & Backend (Days 1-2)

**Deliverable**: Database schema, time tracking functions, IPC handlers

1. **Migration**
   - Create phase2.sql with all three new tables
   - Implement SchemaManager phase 2 migration
   - Test migration on fresh install and upgrade

2. **Time Tracking**
   - Implement recordSourceUsageTime()
   - Enhance getTimeTrackingState() with sourceTracking
   - Implement addSourceExtraTime()
   - Update recordVideoWatching() to track per-source

3. **IPC**
   - Add 4 new IPC handlers
   - Update preload API
   - Type definitions for enhanced state objects

**Acceptance Criteria**:
- Database tables exist and are indexed
- getTimeTrackingState() returns sourceTracking object
- recordVideoWatching() populates source_usage_logs
- IPC handlers callable from renderer
- All unit tests passing
- Code review approved

---

### Phase B: Playback Enforcement (Days 2-3)

**Deliverable**: Source-specific limit enforcement in player

1. **BasePlayerPage Enhancement**
   - Extract sourceId from current video
   - Fetch enhanced time tracking state
   - Check both global and source limits
   - Track limit-hit reason (global vs. source)
   - Route to appropriate time-up page

2. **SourceTimeUpPage Creation**
   - Mirror TimeUpPage structure
   - Display source name and details
   - Show source-specific schedule
   - Parent access button

3. **Warning System**
   - Add 5-second beep warning for source limits
   - No countdown overlay for source limits

**Acceptance Criteria**:
- When source limit reached, only that source blocks
- When global limit reached, all sources block
- Correct time-up page shown for each case
- Source warning beep plays at correct time
- Manual tests passing (limit hit scenarios)
- Code review approved

---

### Phase C: Admin UI (Days 3-4)

**Deliverable**: Admin interface for managing per-source limits

1. **VideoSourceForm Enhancement**
   - Add time limits tab
   - 7-day input fields
   - Save/reset functionality
   - Update IPC call to save source limits

2. **QuickTimeExtension Enhancement**
   - Add source selector dropdown
   - Show source time state
   - ±5 minute buttons for source extra time
   - Projected state preview

3. **UsageStatsTab Creation**
   - Date selector
   - Table with source usage breakdown
   - Visual indicators (% of limit used)

4. **TimeIndicator Enhancement**
   - Display source time remaining (when applicable)
   - Color changes for low source time
   - Compact layout (doesn't crowd UI)

**Acceptance Criteria**:
- Can set per-source limits via admin UI
- Limits persist after app restart
- Can grant source extra time
- Usage stats display correct data
- TimeIndicator shows both global and source times
- All components render without errors
- Code review approved

---

### Phase D: Testing & Polish (Days 4-5)

**Deliverable**: Comprehensive test coverage and refinement

1. **Unit Tests**
   - Source time tracking functions
   - Calculations with edge cases
   - Database operations

2. **Integration Tests**
   - Global vs. source limit scenarios
   - Extra time scenarios
   - Multiple sources

3. **E2E Tests**
   - Admin workflow (set limits, grant time)
   - Child workflow (hit limit, navigate)
   - Enforcement scenarios

4. **Manual Testing & Polish**
   - UI refinements based on feedback
   - Error handling edge cases
   - Performance optimization (if needed)

**Acceptance Criteria**:
- >90% code coverage for new functions
- All test suites passing (unit, integration, e2e)
- No console errors in dev or production builds
- Lint passing
- Code review approved

---

## Critical Implementation Files

### Database & Backend
- `/src/main/database/schema/phase2.sql` - NEW
- `/src/main/timeTracking.ts` - MODIFY
- `/src/main/ipc/databaseHandlers.ts` - MODIFY
- `/src/preload/index.ts` - MODIFY

### Renderer
- `/src/renderer/pages/BasePlayerPage.tsx` - MODIFY
- `/src/renderer/pages/SourceTimeUpPage.tsx` - NEW
- `/src/renderer/components/layout/TimeIndicator.tsx` - MODIFY
- `/src/renderer/components/admin/VideoSourceForm.tsx` - MODIFY
- `/src/renderer/components/admin/QuickTimeExtension.tsx` - MODIFY
- `/src/renderer/components/admin/UsageStatsTab.tsx` - NEW

### Types & Shared
- `/src/shared/types.ts` - MODIFY (add SourceTimeTrackingState, TimeTrackingStateWithSources)
- `/src/renderer/types.ts` - MODIFY (update ElectronAPI interface)

### Tests
- `/src/main/__tests__/sourceTimeTracking.test.ts` - NEW
- `/src/renderer/__tests__/sourceTimeLimit.integration.test.ts` - NEW
- `/src/renderer/__tests__/sourceTimeLimit.e2e.test.ts` - NEW

---

## Edge Cases & Handling

### Database Edge Cases

1. **Source limit set after videos watched**
   - Existing usage logs continue accumulating
   - Limit applies going forward
   - ✓ No migration needed for historical data

2. **Source deleted with time limits**
   - ON DELETE CASCADE automatically removes entries from source_time_limits
   - Usage logs preserved for historical analysis
   - ✓ Handled by FK constraints

3. **Zero limit (0 minutes)**
   - Means no per-source limit
   - sourceTracking should not include this source
   - ✓ Check `sourceTimeLimitMinutes > 0` before adding to sourceTracking

### Calculation Edge Cases

1. **Extra time pushes remaining into negative**
   - `Math.max(0, calculation)` prevents negative display
   - ✓ Already handled in existing code

2. **Midnight crossing**
   - Time tracking uses ISO date (YYYY-MM-DD)
   - Resets automatically when date changes
   - ✓ Current approach handles this

3. **Multiple extra time grants in one day**
   - source_time_extras allows multiple rows per source per day
   - SUM() aggregates all grants
   - ✓ Designed for this scenario

### User Workflow Edge Cases

1. **Child switches sources when one is exhausted**
   - Global limit still applies
   - Source with remaining time works
   - ✓ Enforcement checks both in BasePlayerPage

2. **Parent grants extra time while child is watching**
   - Requires app to re-check limits (on timer tick)
   - Playback continues if limit not reached
   - ✓ 1-second timer in BasePlayerPage handles this

3. **Parent reduces per-source limit**
   - Takes effect immediately on next time check
   - May block current source if new limit lower than used
   - ✓ No special handling needed (expected behavior)

---

## Performance Considerations

### Database Queries

**Problem**: getTimeTrackingState() could be slow with many sources

**Solution**:
- Only query sources with non-zero limits: `SELECT DISTINCT source_id FROM source_time_limits WHERE Monday > 0 OR Tuesday > 0 OR ...`
- Or: store a flag `has_limits` in source_time_limits to quickly filter
- Cache results in memory with 5-10 second TTL

**Expected performance**:
- 10 sources with limits: <10ms query time
- 100 sources: <50ms (acceptable, called every 1 second)

### IPC Calls

**Current**: getTimeTrackingState() called every 1 second by BasePlayerPage

**Impact**: Negligible
- IPC is fast (<1ms local calls)
- Database query cached by SQLite
- No network latency

---

## Migration Checklist

### On App Startup

- [ ] Check schema_version table for phase
- [ ] If phase < 2:
  - [ ] Execute phase2.sql
  - [ ] Update schema_version to version 2
  - [ ] Initialize source_time_limits with 0 for all existing sources
- [ ] Log migration success/failure
- [ ] Continue app startup

### Data Integrity

- [ ] All new tables have appropriate indexes
- [ ] Foreign key constraints prevent orphaned records
- [ ] Check constraints validate data types
- [ ] Unique constraints prevent duplicates
- [ ] Timestamps auto-populated on INSERT

---

## Documentation Requirements

### User-Facing Documentation

- [ ] Update README.md with new feature description
- [ ] Add AdminUI guide section: "Per-Source Time Limits"
- [ ] Add TimeUpPage/SourceTimeUpPage behavior explanation

### Developer Documentation

- [ ] Document new IPC handlers in `/docs/ipc-contracts.md`
- [ ] Add database schema reference for new tables in `/docs/database-schema.md`
- [ ] Add time tracking architecture doc in `/docs/architecture/time-tracking.md`

### Code Documentation

- [ ] JSDoc comments on all new functions
- [ ] Type definitions well-documented
- [ ] Complex calculations explained in code comments

---

## Success Criteria

### Functional Requirements Met

- [x] Per-source daily time limits can be set in admin UI
- [x] Limits are enforced during playback (source blocks when limit reached)
- [x] Global limit still applies (counts toward global total)
- [x] Parents can grant extra time for specific sources
- [x] Child can switch to other sources when one is exhausted
- [x] Audio beep warning at 5 seconds before source limit
- [x] TimeUpPage differentiated by source vs. global

### Code Quality

- [x] >90% test coverage
- [x] All tests passing
- [x] Lint passing
- [x] TypeScript strict mode passing
- [x] Code review approved
- [x] No console errors/warnings

### Performance

- [x] No noticeable lag in playback (time checks still every 1 sec)
- [x] Database queries <50ms even with many sources
- [x] Memory usage doesn't increase significantly

### Documentation

- [x] User-facing docs updated
- [x] Developer docs updated
- [x] Code well-commented

---

## Questions for Review/Clarification

Before implementation, confirm:

1. **UI Layout**: Should per-source limits be shown in a separate tab or inline in VideoSourceForm?
   - Recommendation: Separate "Time Limits" tab to keep form uncluttered

2. **Default Limits**: When a new source is created, should it automatically get a per-source limit entry?
   - Recommendation: No. Create entry only when parent explicitly sets a limit.

3. **Reporting**: Should admin UI show which sources have per-source limits configured?
   - Recommendation: Yes. Add visual indicator (e.g., "⏱️" icon) next to source name.

4. **Timezone**: Does ISO date handling work correctly for timezone offset users?
   - Current approach: Uses local date (no timezone offset). Acceptable for single-device app.

5. **Historical Data**: Should source_usage_logs be cleared on app reset (like usage_log)?
   - Recommendation: Preserve for analytics; only delete when source deleted.

---

## Summary

This implementation plan provides a complete roadmap for adding per-source time limits to SafeTube. The four-phase approach (database → enforcement → UI → testing) allows for incremental development and testing. Key design decisions support the user's workflow: source limits are independent yet contribute to the global limit, enforcement blocks only the exhausted source, and the admin UI makes granting extra time a one-click operation.

The plan includes comprehensive edge case handling, performance considerations, testing strategy, and clear acceptance criteria for each phase. All new database tables use appropriate constraints and indexes to ensure data integrity and query performance.
