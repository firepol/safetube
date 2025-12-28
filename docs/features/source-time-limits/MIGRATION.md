# Source-Level Time Limits: Migration Guide

This document explains how the source-level time limits feature is deployed and how to handle upgrades.

## Overview

The source-level time limits feature introduces new database columns to track per-source time limits and usage. The migration is **automatic** and **non-destructive** - existing data is preserved and no user action is required.

## What's New

### Database Changes

Three columns are added to existing tables:

1. **sources table**
   - `daily_time_limit_minutes` (INTEGER, DEFAULT NULL)
   - Stores the daily time limit in minutes for each source

2. **usage_logs table**
   - `source_id` (TEXT, DEFAULT NULL)
   - Tracks which source each usage entry applies to
   - NULL = global usage (backward compatible)

3. **usage_extras table**
   - `source_id` (TEXT, DEFAULT NULL)
   - Tracks per-source time extensions
   - NULL = global extension (backward compatible)

### New Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_sources_daily_time_limit
  ON sources(daily_time_limit_minutes);

CREATE INDEX IF NOT EXISTS idx_usage_logs_source_id
  ON usage_logs(source_id, date);

CREATE INDEX IF NOT EXISTS idx_usage_extras_source_id
  ON usage_extras(source_id, date);
```

## Migration Process

### Automatic Migration

**When:** First launch of SafeTube with source-level time limits
**What happens:**
1. Database schema manager detects missing columns
2. Columns are added automatically via ALTER TABLE
3. All new columns default to NULL
4. Existing data is preserved untouched
5. User sees no disruption

**Duration:** < 1 second on most systems

### No Manual Action Required

Users simply:
1. Install/update SafeTube
2. Launch the app
3. Automatic schema migration runs in background
4. App starts normally

### Backward Compatibility

The migration is fully backward compatible:
- All new columns are optional (NULL by default)
- Existing usage logs continue to work
- Global time limits still function unchanged
- Old plugins/scripts continue working

## Data Preservation

### Existing Time Limits

**Global daily time limits** are unaffected:
- Schedule-based limits (Monday 30 min, Tuesday 45 min, etc.) continue working
- Still enforced the same way
- Stored in separate `time_limits` table

### Existing Usage History

**Usage logs** are preserved exactly:
- All historical watch time data remains
- New `source_id` column defaults to NULL (means "global")
- Queries filtering by `source_id IS NULL` get global usage
- Reports and statistics still work

### Existing Extensions

**Time extensions** are preserved:
- Historical extensions still recorded
- New `source_id` column defaults to NULL
- Existing extension mechanism unchanged

## Post-Migration Verification

After upgrading, verify everything is working:

### 1. Check Database Schema

**For advanced users:**
```bash
# Open SQLite CLI and check columns exist
sqlite3 /path/to/safetube.db

# Verify sources table has new column
.schema sources

# Should show:
# CREATE TABLE sources (
#   ...existing columns...
#   daily_time_limit_minutes INTEGER DEFAULT NULL,
#   ...
# );
```

### 2. Test Source Limits

1. Open Admin Settings → Video Sources
2. Select a source and click Edit
3. Set a daily time limit (e.g., 10 minutes)
4. Click Save
5. Verify limit appears in the list

### 3. Test Time Tracking

1. Play a video from the limited source
2. Watch for a few seconds/minutes
3. Open Admin → Video Sources
4. Check "Time Remaining" shows correct usage
5. Verify time decreases as video plays

### 4. Test Extensions

1. Limit a source to 1 minute (for testing)
2. Play video until limit reached
3. In Admin panel, click "+ Time" next to source
4. Grant 5 minute extension
5. Verify extension shows in time remaining

### 5. Check Global Limits Still Work

1. Set global daily limit (Monday 30 min, etc.)
2. Play videos until global limit reached
3. Verify global limit enforcement still blocks playback

## Rollback Procedure

**If something goes wrong**, you can safely rollback:

### Option 1: Revert to Previous Version

1. Close SafeTube
2. Install previous version
3. Launch SafeTube
4. App works normally (ignores new columns)

**Note:** If you set source limits before reverting, they won't apply in older version (but data is preserved).

### Option 2: Manual Database Cleanup (Advanced)

**Only if absolutely necessary:**

```sql
-- Remove source-level time limit limits (not recommended)
-- This erases the limits, but preserves other data
ALTER TABLE sources DROP COLUMN daily_time_limit_minutes;

-- Remove source_id from usage logs
-- WARNING: This breaks per-source usage tracking
ALTER TABLE usage_logs DROP COLUMN source_id;

-- Remove source_id from extensions
ALTER TABLE usage_extras DROP COLUMN source_id;
```

**Warning:** Manual database modifications should only be done by experienced users. Always backup first!

## Troubleshooting Migration Issues

### Migration Fails with Error

**Symptom:** App shows database error on startup

**Cause:** Database schema mismatch or corruption

**Solution:**
1. Check database file has read-write permissions
2. Ensure no other SafeTube instance is running
3. Try restarting the app
4. If still failing, contact support with error message

### Columns Not Added

**Symptom:** Columns missing after upgrade

**Cause:** Automatic migration didn't run or completed silently

**Solution:**
1. Verify app version is correct: **Settings → About**
2. Check if source limits UI appears (new feature indicator)
3. Manually verify schema with SQLite CLI

### Data Missing After Migration

**Symptom:** Historical data appears gone

**Cause:** Data isn't missing, just not visible in new UI

**Solution:**
1. Old data is still in database, new columns are NULL
2. Global usage (source_id = NULL) still works
3. Try playing a video and checking usage stats

## Database Backup

### Before Upgrading

**Automatic backup** is not performed. **It's recommended to backup manually:**

```bash
# On Linux/Mac
cp ~/.safetube/safetube.db ~/.safetube/safetube.db.backup

# On Windows
copy %APPDATA%\safetube\safetube.db %APPDATA%\safetube\safetube.db.backup
```

### After Migration

Keep the backup for at least one week to ensure everything works properly.

## File-Based Configuration

**No migration needed for:**
- `youtubePlayer.json` - Player configuration
- `timeLimits.json` - Schedule-based daily limits
- `usageLog.json` - Usage history (if using file-based storage)
- `watched.json` - Watch history
- `mainSettings.json` - App settings

All continue working unchanged alongside the new database columns.

## Version Compatibility

### Upgrading From Old Versions

| From Version | To Version | Migration Required | Data Loss |
|---|---|---|---|
| < 1.0 | 1.0+ with source limits | ✅ Yes (automatic) | ❌ None |
| 1.0-1.5 | 1.6+ with source limits | ✅ Yes (automatic) | ❌ None |
| Any | Latest | ✅ Yes (automatic) | ❌ None |

### Downgrading

If you downgrade to an older version:
1. Source limits won't apply (feature not in older version)
2. All data preserved (new columns are NULL)
3. Just re-upgrade when ready

## Performance Impact

### On Migration

- **Time:** < 1 second
- **CPU:** Minimal spike during schema updates
- **Memory:** No increase

### After Migration

- **Storage:** ~10KB per 1000 sources (for new columns)
- **Query speed:** Same as before (indexes added)
- **No degradation** to global time limit performance

## Configuration Changes

### No Configuration Files to Update

Source-level time limits are configured through:
- Admin UI (recommended)
- Database directly (advanced users)
- No config files need updating

### Existing Config Files

All existing configuration files continue working:
- `timeLimits.json` (schedule-based limits) unchanged
- `videoSources.json` (source list) updated with limits via UI
- Other files: No changes needed

## Support

### Migration Issues?

1. Check the troubleshooting section above
2. Review `/logs/` directory for error messages
3. Try [rollback procedure](#rollback-procedure) if necessary
4. Contact support with:
   - SafeTube version number
   - Error message (if any)
   - Database file size
   - OS (Windows/Mac/Linux)

### Common Questions

**Q: Will my existing time limits work?**
A: Yes! Global daily limits (Monday 30 min, etc.) continue working unchanged.

**Q: Will my usage history be preserved?**
A: Yes! All historical data is preserved. New columns default to NULL (equivalent to global).

**Q: Can I go back to the old version?**
A: Yes, safely. Source limits won't apply, but all data is preserved.

**Q: Do I need to set limits for all sources?**
A: No. Leave blank/NULL for unlimited access (default). Only set limits where needed.

**Q: Can I undo a limit I set?**
A: Yes. Edit the source and clear the limit field (leave blank), then save.

## Timeline

### Before Upgrade
- Backup database (optional but recommended)
- Note any custom scripts that interact with database
- Plan which sources to limit

### During Upgrade
- No user action required
- Migration runs automatically
- App might be unavailable for <1 second

### After Upgrade
- Verify schema with SQLite (optional)
- Test source limits with a low limit (e.g., 1 minute)
- Configure limits for sources you want to restrict
- Monitor usage for a few days

## Technical Details

### Schema Manager

Migration is handled by `SimpleSchemaManager` class:
- Detects schema version
- Runs ALTER TABLE statements
- Creates indexes
- Validates schema completeness

### ALTER TABLE Strategy

SQLite limitations on ALTER TABLE are handled:
- Single column additions per ALTER
- Indexes created separately
- Constraints enforced via code when needed
- Data integrity maintained throughout

### Constraint Handling

Foreign key constraints are enforced:
- `source_id` in usage tables references `sources(id)`
- ON DELETE SET NULL for cascading deletes
- Referential integrity preserved

## Related Documentation

- [Feature Overview](/docs/features/source-time-limits/README.md)
- [Requirements](/docs/features/source-time-limits/requirements.md)
- [Technical Design](/docs/features/source-time-limits/design.md)
- [API Reference](/docs/api/timeTracking-source-limits.md)
- [Admin Guide](/docs/admin-guide/source-time-limits.md)
