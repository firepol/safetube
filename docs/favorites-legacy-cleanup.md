# Favorites Legacy Code Cleanup Analysis

## Overview

The codebase currently has **TWO** favorites systems running in parallel:

1. **FAVORITES** - New SQLite database-backed system (5 IPC channels)
2. **FAVORITES_LEGACY** - Old favorites.json file-backed system (13 IPC channels)

Since you don't want backwards compatibility and the migration to SQLite is complete, we can remove the legacy system entirely.

## Current Situation

### Database-Backed Favorites (Keep)

**IPC Channels** (`src/shared/ipc-channels.ts`):
```typescript
FAVORITES: {
  GET_ALL: 'database:favorites:get-all',
  ADD: 'database:favorites:add',
  REMOVE: 'database:favorites:remove',
  IS_FAVORITE: 'database:favorites:is-favorite',
  TOGGLE: 'database:favorites:toggle',
}
```

**Handlers**: `src/main/ipc/databaseHandlers.ts`
- All backed by SQLite database
- Work with `favorites` table

### File-Backed Legacy Favorites (Remove)

**IPC Channels** (`src/shared/ipc-channels.ts`):
```typescript
FAVORITES_LEGACY: {
  GET_ALL: 'favorites:get-all',                    // ❌ Remove
  ADD: 'favorites:add',                            // ❌ Remove
  REMOVE: 'favorites:remove',                      // ❌ Remove
  IS_FAVORITE: 'favorites:is-favorite',            // ❌ Remove
  TOGGLE: 'favorites:toggle',                      // ❌ Remove
  UPDATE_METADATA: 'favorites:update-metadata',    // ❌ Remove
  GET_BY_SOURCE: 'favorites:get-by-source',        // ❌ Remove
  GET_CONFIG: 'favorites:get-config',              // ❌ Remove
  UPDATE_CONFIG: 'favorites:update-config',        // ❌ Remove
  CLEANUP_ORPHANED: 'favorites:cleanup-orphaned',  // ❌ Remove
  SYNC_WATCH_HISTORY: 'favorites:sync-watch-history', // ❌ Remove
  GET_UNAVAILABLE: 'favorites:get-unavailable',    // ❌ Remove
  CLEAR_UNAVAILABLE: 'favorites:clear-unavailable' // ❌ Remove
}
```

**Handlers**: `src/main/services/ipcHandlerRegistry.ts` (lines 1208-1545)
- All use `AppPaths.getConfigPath('favorites.json')`
- Read/write to JSON file

## Legacy Methods Still in Use

**Active Usage** (`src/renderer/services/favoritesService.ts`):

1. ✅ **`favoritesUpdateMetadata`** (line 273)
   - Updates title, thumbnail, duration for a favorite
   - **Replacement**: Not needed - metadata is in `videos` table, joined with `favorites`

2. ✅ **`favoritesGetBySource`** (line 295)
   - Gets all favorites for a specific source
   - **Replacement**: Use `DatabaseClient.getFavorites()` + filter by sourceId

3. ✅ **`favoritesGetConfig`** (line 307)
   - Returns favorites configuration settings
   - **Replacement**: Remove - no longer needed with database

4. ✅ **`favoritesUpdateConfig`** (line 319)
   - Updates favorites configuration
   - **Replacement**: Remove - no longer needed with database

5. ✅ **`favoritesCleanupOrphaned`** (line 331)
   - Removes favorites for videos that no longer exist
   - **Replacement**: Database foreign keys handle this automatically

6. ✅ **`favoritesSyncWatchHistory`** (line 348)
   - Syncs watched status from watched.json to favorites
   - **Replacement**: Not needed - watch history is in `view_records` table

7. ❓ **`favoritesGetUnavailable`** - Not used in code
   - **Replacement**: Remove

8. ❓ **`favoritesClearUnavailable`** - Not used in code
   - **Replacement**: Remove

## Files to Modify

### 1. IPC Channels Definition
**File**: `src/shared/ipc-channels.ts`
- Remove entire `FAVORITES_LEGACY` section

### 2. IPC Handler Registry
**File**: `src/main/services/ipcHandlerRegistry.ts`
- Remove `registerFavoritesHandlers()` function (lines ~1208-1545)
- Remove call to `registerFavoritesHandlers()` in `registerAllHandlers()`

### 3. Preload Bridge
**File**: `src/preload/index.ts`
- Remove `FAVORITES_LEGACY` import
- Remove all `favorites*` methods that use `IPC.FAVORITES_LEGACY.*`

### 4. Renderer Types
**File**: `src/renderer/types.ts`
- Remove legacy favorites method signatures

### 5. Favorites Service
**File**: `src/renderer/services/favoritesService.ts`
- Replace legacy method calls with database equivalents

### 6. File Utils
**File**: `src/main/fileUtils.ts`
- Remove `readFavorites()` and `writeFavorites()` functions (if they exist)

## Migration Impact

### What Migration Already Did
✅ Migrated all favorites from `favorites.json` to SQLite `favorites` table
✅ Created backup of `favorites.json` in backup directory
✅ All favorite records now in database

### What Users Have
- SQLite database with all their favorites
- Backup of old `favorites.json` (in case needed)
- No data loss

### Post-Cleanup State
- Single favorites system (database only)
- Simpler codebase (18 fewer IPC channels)
- No dual-write concerns
- Foreign key constraints ensure data integrity

## Detailed Cleanup Plan

### Phase 1: Update FavoritesService (High Priority)

Replace legacy method implementations in `src/renderer/services/favoritesService.ts`:

```typescript
// OLD: favoritesUpdateMetadata
static async updateMetadata(videoId: string, metadata: any): Promise<void> {
  await window.electron.favoritesUpdateMetadata(videoId, metadata);
}

// NEW: Not needed - metadata in videos table via foreign key
static async updateMetadata(videoId: string, metadata: any): Promise<void> {
  // Metadata updates go through DatabaseClient.updateVideoMetadata()
  // Favorites table only stores the relationship, not metadata
  throw new Error('Use DatabaseClient.updateVideoMetadata() instead');
}

// ---

// OLD: favoritesGetBySource
static async getBySource(sourceId: string): Promise<FavoriteVideo[]> {
  return await window.electron.favoritesGetBySource(sourceId);
}

// NEW: Filter in-memory after getting all favorites
static async getBySource(sourceId: string): Promise<FavoriteVideo[]> {
  const allFavorites = await this.getFavorites();
  return allFavorites.filter(f => f.sourceId === sourceId);
}

// ---

// OLD: Config methods
static async getConfig(): Promise<FavoritesConfig> {
  return await window.electron.favoritesGetConfig();
}
static async updateConfig(config: FavoritesConfig): Promise<void> {
  await window.electron.favoritesUpdateConfig(config);
}

// NEW: Remove entirely - no config needed for database
// If config is still needed, store in mainSettings.json or database

// ---

// OLD: Cleanup methods
static async cleanupOrphaned(): Promise<any[]> {
  return await window.electron.favoritesCleanupOrphaned();
}
static async syncWatchHistory(): Promise<any[]> {
  return await window.electron.favoritesSyncWatchHistory();
}

// NEW: Remove - handled by database foreign keys and triggers
```

### Phase 2: Remove IPC Channels and Handlers

1. Remove `FAVORITES_LEGACY` from `src/shared/ipc-channels.ts`
2. Remove `registerFavoritesHandlers()` from `src/main/services/ipcHandlerRegistry.ts`
3. Remove call in `registerAllHandlers()`
4. Run `yarn sync-ipc` to update preload

### Phase 3: Remove Preload Methods

Remove from `src/preload/index.ts`:
- All `favorites*` methods using `IPC.FAVORITES_LEGACY.*`

### Phase 4: Update Types

Remove from `src/renderer/types.ts`:
- Legacy favorites method signatures

### Phase 5: Test and Verify

1. Run contract tests: `yarn test:contract`
2. Verify all tests pass
3. Test favorites functionality in app
4. Verify no runtime errors

## Benefits of Cleanup

### Code Reduction
- **-13 IPC channels** (from 103 to 90)
- **~400 lines** of handler code removed
- **~100 lines** of preload code removed
- **Simpler mental model** - one favorites system instead of two

### Performance
- No dual reads/writes
- Single source of truth
- Database queries more efficient than JSON file I/O

### Maintainability
- No confusion about which system to use
- No risk of data inconsistency between systems
- Clearer code paths

### Contract Test Impact
After cleanup:
```
Before: 103 channels, 13 FAVORITES_LEGACY
After:  90 channels, 5 FAVORITES (database)
```

## Risks and Mitigation

### Risk: Users with old app versions
**Mitigation**: Already mitigated - migration ran and backed up data

### Risk: Breaking functionality
**Mitigation**: Careful testing of replacement code before removing handlers

### Risk: Lost features
**Mitigation**: Analyze each legacy method to ensure database equivalent exists

## Recommendation

✅ **Proceed with cleanup** - The migration is complete, backups exist, and maintaining two systems is technical debt.

**Suggested Approach**:
1. Start with Phase 1 (update FavoritesService)
2. Test thoroughly
3. Then remove infrastructure (Phases 2-4)
4. Verify with contract tests

This is safe, reduces complexity, and aligns with your "no backwards compatibility" requirement.
