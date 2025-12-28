# Source-Level Time Limits Feature

## Overview

The Source-Level Time Limits feature extends SafeTube's parental control system by allowing parents to set daily time limits for individual video sources (YouTube channels, playlists, and local folders) in addition to the existing global daily time limit.

When a child reaches a source's daily time limit, playback from that source is blocked while other sources remain accessible. Parents can grant temporary time extensions for individual sources on-demand, enabling flexible time management such as "2 extra minutes for this channel."

This feature integrates seamlessly with the global time limit system, providing granular control over content consumption patterns while maintaining backward compatibility.

## Use Cases

### Use Case 1: Channel-Specific Control
A parent wants to limit their child's access to a popular but "time-consuming" YouTube channel to 30 minutes per day, while allowing unlimited access to educational channels. Source-level limits make this possible.

**Example:**
- YouTube channel "Gaming Videos" → 30 minutes/day
- YouTube channel "Educational Tutorials" → Unlimited
- YouTube channel "Music Videos" → 10 minutes/day

### Use Case 2: Content Management
A parent wants stricter limits on entertainment content but more relaxed limits on educational content.

**Example:**
- Entertainment folder → 20 minutes/day
- Educational folder → 60 minutes/day
- Parent still enforces 90-minute global daily limit

### Use Case 3: Temporary Extensions
A child watches videos for their allotted time and requests more time. Instead of changing the permanent limit, the parent grants a temporary extension through the admin panel.

**Example:**
- YouTube channel has 30-minute limit (already used)
- Child requests more time
- Parent grants a 5-minute extension via one-click button
- Child can watch 5 more minutes from that channel today
- Limit resets tomorrow

### Use Case 4: Multi-User Fairness
Multiple children in the family want equal access to shared entertainment channels, but one child tends to hog a particular channel.

**Example:**
- Shared "Entertainment" channel → 25 minutes/day per child
- Shared "Gaming" channel → 15 minutes/day per child
- (Note: This would require per-profile time tracking in future versions)

## Key Features

### 1. Per-Source Daily Limits
- Set daily time limits (in minutes) for any video source
- NULL/blank = unlimited access
- Range: 0-1440 minutes (0 = block entirely, 1440 = 24-hour access)

### 2. Time Tracking
- Tracks watch time per source separately from global usage
- Maintains second-level precision
- Automatically resets at midnight (local time)

### 3. Dual Enforcement
- Source limits and global limits are enforced independently
- Both must be satisfied for playback to continue
- If either limit is exceeded, playback blocks

### 4. Extension System
- Parents can grant temporary time extensions (1-60 minutes)
- Extensions are source-specific
- Multiple extensions can be granted on the same day
- All extensions reset at midnight

### 5. Visual Feedback
- Progress bar showing usage percentage
- Time remaining display (Xm Ys format)
- Warning state when < 5 minutes remaining
- Exceeded state when limit reached
- Auto-refresh every 60 seconds in admin panel

### 6. Audio Warnings
- 5-second beep plays when source limit is about to expire
- System beep (respects user audio settings)
- No intrusive visual overlays

### 7. Smart Blocking
- Only the specific source is blocked, not all sources
- Child can switch to other sources with available time
- Clear messaging: "Time's up for [Source Name]"
- Request more time functionality on blocked screen

## How It Works

### Setting a Source Limit

1. Navigate to Admin Settings → Video Sources
2. Find the source you want to limit (YouTube channel, playlist, or folder)
3. Click "Edit" on that source
4. Enter a daily time limit in minutes (or leave blank for unlimited)
5. Click "Save"

The limit is immediately enforced and applies to all subsequent watch sessions.

### Viewing Remaining Time

**In Admin Panel:**
- Each source shows its remaining time for today
- Progress bar indicates usage percentage
- Color coding: Green (>5min), Orange (1-5min), Red (exceeded)
- Time updates every 60 seconds automatically

**During Playback:**
- Player UI shows current source time remaining
- Updates every second during playback
- Display format: "X minutes Y seconds remaining"

### Granting Extensions

1. In Admin Settings, find the source with a limit
2. Click the "+ Time" button next to that source
3. Select extension duration (5, 10, 15, or 30 minutes)
4. Confirm the action
5. Time remaining is immediately increased by that amount

The extension applies to today only and resets at midnight.

### When Limit is Exceeded

When a child tries to continue watching after the source limit is reached:

1. Video pauses immediately
2. Page navigates to "Time's up" screen
3. Screen shows source-specific message
4. Options to:
   - Choose another source (if global time available)
   - Request more time from parent
   - Go home

## Integration with Global Limits

Source-level limits work together with the global daily time limit:

**Example Scenario:**
- Global limit: 120 minutes/day
- YouTube channel A limit: 30 minutes/day
- YouTube channel B limit: 45 minutes/day

| Scenario | Result | Reason |
|----------|--------|--------|
| Watch 30 min on Channel A | Blocked | Channel A limit reached |
| Watch 90 min total across all sources | Allowed | Both source and global limits OK |
| Watch 120 min total across all sources | Blocked | Global limit reached |
| Watch 45 min on Channel B | Blocked | Channel B limit reached |

**Key Rules:**
- If source limit is reached → Only that source blocks
- If global limit is reached → All sources block
- Extensions don't override global limits (global limit still enforced)
- Both limits reset independently at midnight

## Database Schema

### Sources Table
```sql
-- New column in sources table
daily_time_limit_minutes INTEGER DEFAULT NULL  -- NULL means unlimited
```

### Usage Logs Table
```sql
-- New column added to track per-source usage
source_id TEXT DEFAULT NULL  -- Foreign key to sources(id)
seconds_used INTEGER          -- Time used for this source today

-- Unique constraint ensures one entry per day per source (NULL = global)
UNIQUE(date, source_id)
```

### Usage Extras Table (Extensions)
```sql
-- New column added to track per-source extensions
source_id TEXT DEFAULT NULL  -- Foreign key to sources(id)
minutes_added INTEGER        -- Minutes granted by this extension
date TEXT                    -- Date of extension (YYYY-MM-DD)
reason TEXT                  -- Why extension was granted
added_by TEXT               -- Parent name who granted it
```

## API Reference

### Core Functions

See `/docs/api/timeTracking-source-limits.md` for complete API documentation including:
- `getSourceTimeState(sourceId)` - Get current time state for a source
- `recordSourceWatchTime(sourceId, seconds)` - Record watch time
- `enforceSourceTimeLimit(sourceId)` - Check if limit exceeded
- `grantSourceTimeExtension(sourceId, minutes, reason, addedBy)` - Grant extension

### IPC Channels

- `timeTracking:getSourceState` - Get current source time state
- `timeTracking:grantSourceExtension` - Grant extension to a source
- `timeTracking:getAllSourceStates` - Get time states for all sources

## Configuration

No additional configuration required. The feature uses the standard database and respects all existing app settings for:
- Time zone (for midnight reset)
- Audio settings (for beep warnings)
- Database location

## Troubleshooting

### Limits not being enforced
- Verify the source has a daily limit set (not NULL)
- Check that today's usage has been recorded (check database usage_logs table)
- Restart app if recently added limit

### Extension granted but doesn't appear
- Verify the source_id is correct in the database
- Check that both source and usage_extras entries exist
- Refresh the admin panel (it auto-refreshes every 60 seconds)

### Time seems incorrect
- Verify system time zone is correct
- Database dates are in YYYY-MM-DD format in local timezone
- Limits reset at midnight local time, not UTC

### Beep not playing
- Check app audio settings (use_system_beep)
- Verify system sound is not muted
- Confirm the source has a daily limit set

## Data Persistence

All source limits and usage data are persisted in SQLite database:
- Limits persist across app restarts
- Usage history maintained indefinitely (for reporting)
- Extensions logged with timestamp and parent name

## Performance

- Query optimization: Composite index on (source_id, date) in usage_logs
- Caching: Source states cached in memory, refreshed every 60 seconds in admin UI
- Real-time checks: Player checks limit every second only when near limit
- Database load: Minimal - one query per second per active playback session

## Backward Compatibility

- Fully backward compatible with existing global time limit system
- Sources without limits (NULL) are unaffected
- Existing usage logs remain valid (source_id is optional)
- No data migration required on upgrade

## Future Enhancements

Potential improvements for future versions:
- Per-profile source limits (different limits for different family members)
- Weekly limits (not just daily)
- Time-of-day restrictions (e.g., no YouTube after 8pm)
- Quota sharing between sources (e.g., "150 min total across entertainment sources")
- Usage reports by source with trends
- Automatic limit suggestions based on usage patterns
