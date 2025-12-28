# Source-Level Time Limits API Reference

Complete API documentation for the source-level time limits feature.

## Table of Contents

- [Core Functions](#core-functions)
- [IPC Handlers](#ipc-handlers)
- [Preload API](#preload-api)
- [React Service Layer](#react-service-layer)
- [Type Definitions](#type-definitions)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

## Core Functions

### `getSourceTimeState(sourceId: string): Promise<SourceTimeState>`

Gets the current time state for a specific source.

**Location:** `src/main/timeTracking.ts`

**Parameters:**
- `sourceId` (string): The unique identifier of the source (e.g., 'channel-123', 'playlist-456')

**Returns:** Promise<SourceTimeState>
```typescript
{
  sourceId: string;                      // The source ID queried
  dailyLimitMinutes: number | null;      // Daily limit in minutes, null = unlimited
  secondsUsedToday: number;              // Seconds watched today (0-86400)
  secondsRemainingToday: number | null;  // Seconds left (null if unlimited)
  isLimitExceeded: boolean;              // Whether limit is exceeded
  lastResetDate: string;                 // YYYY-MM-DD format
}
```

**Throws:**
- `Error` if source not found in database

**Example:**
```typescript
const state = await getSourceTimeState('youtube-channel-123');
if (state.isLimitExceeded) {
  console.log(`Limit exceeded. ${state.dailyLimitMinutes} min limit, ${state.secondsUsedToday}s used`);
}
```

**Notes:**
- If limit is NULL (unlimited), `secondsRemainingToday` is also NULL
- Does not block playback; use `enforceSourceTimeLimit()` for enforcement decisions
- Extensions are automatically included in remaining time calculation

---

### `recordSourceWatchTime(sourceId: string, secondsWatched: number): Promise<void>`

Records watch time for a specific source.

**Location:** `src/main/timeTracking.ts`

**Parameters:**
- `sourceId` (string): The source being watched
- `secondsWatched` (number): Seconds watched (will be rounded to nearest second)

**Returns:** Promise<void>

**Throws:**
- `Error` with FOREIGN KEY constraint if source doesn't exist (before inserting)

**Example:**
```typescript
// User watched for 3 minutes 45.3 seconds
await recordSourceWatchTime('youtube-channel-123', 225.3);
// Actually records 225 seconds (rounded)
```

**Notes:**
- Seconds are rounded to nearest integer (Math.round)
- Creates a new usage log entry if one doesn't exist for today
- Increments existing entry if one exists
- Uses date-based tracking (YYYY-MM-DD) for automatic daily reset
- Called automatically by `recordVideoWatching()` (global time tracking function)

---

### `enforceSourceTimeLimit(sourceId: string): Promise<SourceTimeEnforcement>`

Checks if a source's daily time limit has been exceeded.

**Location:** `src/main/timeTracking.ts`

**Parameters:**
- `sourceId` (string): The source to check

**Returns:** Promise<SourceTimeEnforcement>
```typescript
{
  canWatch: boolean;                     // Whether playback is allowed
  blockedSourceId?: string;              // Set if blocked (sourceId)
  blockedReason?: 'source_limit';        // Reason for block
  secondsRemaining?: number;             // Seconds left (if under limit)
  minutesRemaining?: number;             // Minutes left, floored (if under limit)
}
```

**Example:**
```typescript
const enforcement = await enforceSourceTimeLimit('youtube-channel-123');

if (!enforcement.canWatch) {
  // Block playback
  pauseVideo();
  navigateToTimeUp({ sourceId: enforcement.blockedSourceId });
} else {
  console.log(`${enforcement.minutesRemaining}m remaining for this source`);
}
```

**Notes:**
- Returns `{ canWatch: true }` if source has no limit (NULL)
- Respects extensions granted via `grantSourceTimeExtension()`
- Does not enforce global limit (use separate global enforcement)
- Used by player to decide whether to block playback

---

### `grantSourceTimeExtension(sourceId: string, minutesAdded: number, reason: string, addedBy: string): Promise<void>`

Grants a temporary time extension for a source.

**Location:** `src/main/timeTracking.ts`

**Parameters:**
- `sourceId` (string): Source to extend
- `minutesAdded` (number): Minutes to add (1-60)
- `reason` (string): Reason for extension (for audit trail)
- `addedBy` (string): Parent/admin name granting extension

**Returns:** Promise<void>

**Throws:**
- `Error` if sourceId not found
- `Error` if minutesAdded not an integer between 1-60

**Example:**
```typescript
// Parent grants 5 extra minutes
await grantSourceTimeExtension(
  'youtube-channel-123',
  5,
  'Child requested more time',
  'Mom'
);
```

**Notes:**
- Validates that minutesAdded is an integer (no floats)
- Range strictly enforced: 1-60 minutes
- Creates audit trail entry with timestamp, reason, and admin name
- Multiple extensions can be granted on the same day
- All extensions reset at midnight (automatic)
- Does not increase global limit (global enforcement still applies)

---

### `resetDailySourceUsage(): Promise<void>`

Placeholder function for documented daily reset mechanism.

**Location:** `src/main/timeTracking.ts`

**Notes:**
- Source usage automatically resets via date-based queries
- No action required in this function
- Reset happens naturally when date changes and new day queries find no records for that date
- Documented here for completeness

---

## IPC Handlers

IPC handlers expose time tracking functions to the renderer process securely.

### `timeTracking:getSourceState`

**Handler Location:** `src/main/ipcHandlers.ts`

**Parameters:**
```typescript
ipcMain.handle('timeTracking:getSourceState', async (event, sourceId: string) => {
  // Implementation
})
```

**Returns:** SourceTimeState

**Error Handling:** Throws error if source not found

---

### `timeTracking:grantSourceExtension`

**Handler Location:** `src/main/ipcHandlers.ts`

**Parameters:**
```typescript
ipcMain.handle('timeTracking:grantSourceExtension', async (event, {
  sourceId,
  minutesAdded,
  reason,
  addedBy
}) => {
  // Implementation
})
```

**Returns:** SourceTimeState (updated state after extension)

**Error Handling:** Validates all parameters, throws on invalid values

---

### `timeTracking:getAllSourceStates`

**Handler Location:** `src/main/ipcHandlers.ts`

**Parameters:**
```typescript
ipcMain.handle('timeTracking:getAllSourceStates', async (event) => {
  // Implementation
})
```

**Returns:** SourceTimeState[]

**Notes:** Returns states for all sources with and without limits

---

## Preload API

Preload script exposes time tracking methods securely to renderer.

### `window.electron.timeTracking.getSourceState(sourceId)`

**Type:**
```typescript
getSourceState: (sourceId: string) => Promise<SourceTimeState>
```

**Usage:**
```typescript
const state = await window.electron.timeTracking.getSourceState('channel-123');
```

---

### `window.electron.timeTracking.grantSourceExtension(sourceId, minutesAdded, reason?)`

**Type:**
```typescript
grantSourceExtension: (
  sourceId: string,
  minutesAdded: number,
  reason?: string
) => Promise<SourceTimeState>
```

**Usage:**
```typescript
const updatedState = await window.electron.timeTracking.grantSourceExtension(
  'channel-123',
  5,
  'User request'
);
```

**Notes:** Sets `addedBy` to 'parent' (future: get from settings)

---

### `window.electron.timeTracking.getAllSourceStates()`

**Type:**
```typescript
getAllSourceStates: () => Promise<SourceTimeState[]>
```

**Usage:**
```typescript
const allStates = await window.electron.timeTracking.getAllSourceStates();
```

---

## React Service Layer

`TimeTrackingService` class in renderer provides convenient wrapper methods.

### `TimeTrackingService.getSourceTimeState(sourceId: string)`

**Type:**
```typescript
static async getSourceTimeState(sourceId: string): Promise<SourceTimeState>
```

**Example:**
```typescript
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';

const state = await TimeTrackingService.getSourceTimeState('channel-123');
```

---

### `TimeTrackingService.grantSourceExtension(sourceId, minutesAdded, reason?)`

**Type:**
```typescript
static async grantSourceExtension(
  sourceId: string,
  minutesAdded: number,
  reason?: string
): Promise<SourceTimeState>
```

**Example:**
```typescript
const updated = await TimeTrackingService.grantSourceExtension(
  'channel-123',
  10,
  'User requested'
);
```

---

### `TimeTrackingService.getAllSourceStates()`

**Type:**
```typescript
static async getAllSourceStates(): Promise<SourceTimeState[]>
```

---

### `TimeTrackingService.formatTimeRemaining(sourceTimeState)`

**Type:**
```typescript
static formatTimeRemaining(sourceTimeState: SourceTimeState): string
```

**Returns:** Formatted string like "25m 30s" or "Unlimited"

**Example:**
```typescript
const display = TimeTrackingService.formatTimeRemaining(state);
// "25m 30s remaining"
```

---

### `TimeTrackingService.getExtensionOptions()`

**Type:**
```typescript
static getExtensionOptions(): number[]
```

**Returns:** [5, 10, 15, 30] (extension options in minutes)

---

## Type Definitions

### `SourceTimeState`

**Location:** `src/shared/types.ts`

```typescript
export interface SourceTimeState {
  sourceId: string;                      // Source identifier
  dailyLimitMinutes: number | null;      // Limit in minutes (null = unlimited)
  secondsUsedToday: number;              // Seconds watched today
  secondsRemainingToday: number | null;  // Seconds remaining (null if unlimited)
  isLimitExceeded: boolean;              // Whether limit exceeded
  lastResetDate: string;                 // YYYY-MM-DD format
}
```

### `SourceTimeEnforcement`

**Location:** `src/main/database/queries/types.ts`

```typescript
export interface SourceTimeEnforcement {
  canWatch: boolean;                     // Whether to allow playback
  blockedSourceId?: string | null;       // Which source is blocked (if any)
  blockedReason?: 'source_limit';        // Why it's blocked
  secondsRemaining?: number;             // Seconds left (if under limit)
  minutesRemaining?: number;             // Minutes left (if under limit)
}
```

### `Source` (Updated)

**Location:** `src/main/database/queries/types.ts`

```typescript
export interface Source {
  // ... existing fields
  daily_time_limit_minutes: number | null;  // NEW: Daily limit in minutes
}
```

### `UsageLog` (Updated)

**Location:** `src/main/database/queries/types.ts`

```typescript
export interface UsageLog {
  // ... existing fields
  source_id: string | null;              // NEW: Which source this usage is for
}
```

### `UsageExtra` (Updated)

**Location:** `src/main/database/queries/types.ts`

```typescript
export interface UsageExtra {
  // ... existing fields
  source_id: string | null;              // NEW: Which source extension is for
}
```

---

## Error Handling

### Common Errors

**Source not found:**
```
Error: Source [sourceId] not found
```
**Cause:** sourceId doesn't exist in database
**Fix:** Verify source exists before calling

**Invalid extension duration:**
```
Error: Extension duration must be between 1 and 60 minutes, got: [value]
```
**Cause:** minutesAdded outside valid range or not an integer
**Fix:** Validate input: `Number.isInteger(n) && n >= 1 && n <= 60`

**Database constraint:**
```
Error: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
```
**Cause:** Trying to record time for non-existent source
**Fix:** Ensure source exists before recording time

### Error Recovery Patterns

```typescript
try {
  const state = await TimeTrackingService.getSourceTimeState(sourceId);
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle missing source
    console.error(`Source ${sourceId} not found`);
  } else {
    // Handle other errors
    console.error('Failed to load source time state:', error);
  }
}
```

---

## Usage Examples

### Example 1: Display Remaining Time

```typescript
import { TimeTrackingService } from '@/renderer/services/timeTrackingService';

const sourceId = getCurrentPlayingSourceId();
const state = await TimeTrackingService.getSourceTimeState(sourceId);

if (state.isLimitExceeded) {
  showMessage('Source time limit reached');
} else if (state.dailyLimitMinutes) {
  const remaining = TimeTrackingService.formatTimeRemaining(state);
  console.log(`Time remaining for this source: ${remaining}`);
} else {
  console.log('Unlimited access to this source');
}
```

### Example 2: Grant Extension from Admin Panel

```typescript
const handleQuickExtension = async (sourceId: string, minutes: number) => {
  try {
    const updatedState = await TimeTrackingService.grantSourceExtension(
      sourceId,
      minutes,
      `Quick extension from admin panel`
    );

    showNotification(`Granted ${minutes} minutes`);
    refreshSourceDisplay(sourceId);
  } catch (error) {
    showError(`Failed to grant extension: ${error.message}`);
  }
};
```

### Example 3: Check Before Playback

```typescript
const checkCanPlayFromSource = async (sourceId: string) => {
  const enforcement = await enforceSourceTimeLimit(sourceId);

  if (!enforcement.canWatch) {
    pauseVideo();
    navigateToPage('/time-up', {
      sourceId: enforcement.blockedSourceId,
      reason: enforcement.blockedReason
    });
    return false;
  }

  return true;
};
```

### Example 4: Build Extension Menu

```typescript
const ExtensionMenu = ({ sourceId }: { sourceId: string }) => {
  const options = TimeTrackingService.getExtensionOptions();

  return (
    <div className="extension-menu">
      {options.map(minutes => (
        <button key={minutes} onClick={() => grantExtension(sourceId, minutes)}>
          {minutes} min
        </button>
      ))}
    </div>
  );
};
```

### Example 5: Monitor Source Time in Player

```typescript
useEffect(() => {
  const checkSourceLimit = setInterval(async () => {
    const state = await TimeTrackingService.getSourceTimeState(currentSourceId);

    setSourceTimeRemaining(state.secondsRemainingToday);

    if (state.secondsRemainingToday && state.secondsRemainingToday <= 5) {
      playWarningBeep();
    }

    if (state.isLimitExceeded) {
      pauseVideo();
      navigateToTimeUp();
    }
  }, 1000);

  return () => clearInterval(checkSourceLimit);
}, [currentSourceId]);
```

---

## Performance Considerations

### Query Performance

- **Indexed columns:** `(source_id, date)` in usage_logs for fast daily lookups
- **Query complexity:** O(1) for single source state, O(n) for all sources
- **Cache strategy:** Admin UI caches states, refreshes every 60 seconds

### Rate Limiting

- Player checks limit every second (necessary for enforcement)
- Admin panel refreshes every 60 seconds (user-visible update)
- Not recommended to call more frequently than 1 second

### Memory Usage

- SourceTimeState objects: ~200 bytes each
- Reasonable to load all source states: ~50KB for 250 sources
- No persistent caching (cleared on app restart)

---

## See Also

- [Feature Overview](/docs/features/source-time-limits/README.md)
- [Admin Guide](/docs/admin-guide/source-time-limits.md)
- [Migration Guide](/docs/features/source-time-limits/MIGRATION.md)
- [Technical Design](/docs/features/source-time-limits/design.md)
