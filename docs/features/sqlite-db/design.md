# Technical Design Document: SQLite Database Migration

## Overview

This design document specifies the technical architecture for migrating SafeTube from JSON file storage to a centralized SQLite database system. The migration will be implemented in two phases, with Phase 1 focusing on core video data and Phase 2 handling time tracking and configuration data.

The design follows SQLite best practices for Electron applications: all database operations are confined to the main process with renderer processes accessing data through IPC communication channels. This ensures proper concurrency handling, data consistency, and transaction safety.

## Architecture

### Database Service Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Main Process                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   IPC Handler   │    │  Database       │    │   Migration     │ │
│  │   Registry      │───▶│  Service Layer  │───▶│   Service       │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
│           │                       │                       │         │
│           │              ┌─────────────────┐              │         │
│           │              │  SQLite Engine  │              │         │
│           │              │  (WAL Mode)     │              │         │
│           │              └─────────────────┘              │         │
│           │                       │                       │         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   Error         │    │  Connection     │    │   Backup        │ │
│  │   Handler       │    │  Manager        │    │   Service       │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                          IPC Bridge                                │
├─────────────────────────────────────────────────────────────────────┤
│                        Renderer Process                            │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   React         │───▶│   Database      │───▶│   UI            │ │
│  │   Components    │    │   API Client    │    │   Integration   │ │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Database Service

The database service will be implemented as a singleton service in the main process:

```typescript
// src/main/services/DatabaseService.ts
class DatabaseService {
  private db: Database | null = null;
  private connectionManager: ConnectionManager;
  private migrationService: MigrationService;
  private errorHandler: ErrorHandler;
}
```

## Database Schema Design

### Phase 1 Tables

#### 1. Videos Table (Master Video Cache)

```sql
CREATE TABLE videos (
    id TEXT PRIMARY KEY,                    -- Video ID (YouTube ID or local path)
    title TEXT NOT NULL,                    -- Video title
    published_at TEXT,                      -- ISO date string (NULL for local)
    thumbnail TEXT,                         -- Thumbnail URL or local path
    duration INTEGER,                       -- Duration in seconds
    url TEXT,                               -- Original URL (YouTube) or file path (local)
    is_available BOOLEAN NOT NULL DEFAULT 1, -- Video availability flag
    description TEXT,                       -- Video description (can be long)
    source_id TEXT NOT NULL,                -- Foreign key to sources table
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_videos_source_id ON videos(source_id);
CREATE INDEX idx_videos_title ON videos(title);
CREATE INDEX idx_videos_published_at ON videos(published_at);
CREATE INDEX idx_videos_updated_at ON videos(updated_at);

-- Full-text search index for local search functionality
CREATE VIRTUAL TABLE videos_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    content='videos',
    content_rowid='rowid'
);

-- Triggers to maintain FTS index
CREATE TRIGGER videos_fts_insert AFTER INSERT ON videos BEGIN
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;

CREATE TRIGGER videos_fts_delete AFTER DELETE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
END;

CREATE TRIGGER videos_fts_update AFTER UPDATE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;
```

#### 2. View Records Table (Replaces watched.json)

```sql
CREATE TABLE view_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,                 -- Foreign key to videos table
    source_id TEXT NOT NULL,                -- Foreign key to sources table
    position REAL NOT NULL DEFAULT 0,       -- Playback position in seconds
    time_watched REAL NOT NULL DEFAULT 0,   -- Total time watched in seconds
    duration INTEGER,                       -- Video duration snapshot
    watched BOOLEAN NOT NULL DEFAULT 0,     -- Completion flag
    first_watched TEXT NOT NULL,            -- ISO date string
    last_watched TEXT NOT NULL,             -- ISO date string
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,

    -- Ensure one record per video
    UNIQUE(video_id)
);

-- Indexes for performance
CREATE INDEX idx_view_records_video_id ON view_records(video_id);
CREATE INDEX idx_view_records_source_id ON view_records(source_id);
CREATE INDEX idx_view_records_last_watched ON view_records(last_watched);
CREATE INDEX idx_view_records_watched ON view_records(watched);
```

#### 3. Favorites Table (Replaces favorites.json)

```sql
CREATE TABLE favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,                 -- Foreign key to videos table
    source_id TEXT NOT NULL,                -- Foreign key to sources table
    date_added TEXT NOT NULL,               -- ISO date string
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,

    -- Ensure one favorite record per video
    UNIQUE(video_id)
);

-- Indexes for performance
CREATE INDEX idx_favorites_video_id ON favorites(video_id);
CREATE INDEX idx_favorites_source_id ON favorites(source_id);
CREATE INDEX idx_favorites_date_added ON favorites(date_added);
```

#### 4. Sources Table (Replaces videoSources.json)

```sql
CREATE TABLE sources (
    id TEXT PRIMARY KEY,                    -- Source ID (user-defined)
    type TEXT NOT NULL,                     -- 'youtube_channel' | 'youtube_playlist' | 'local'
    title TEXT NOT NULL,                    -- Display title

    -- Display metadata (TEXT fields grouped)
    url TEXT,                              -- YouTube URL or source identifier
    thumbnail TEXT,                        -- Source thumbnail URL
    channel_id TEXT,                       -- YouTube channel ID
    path TEXT,                             -- Local folder path
    sort_preference TEXT,                  -- Video sorting preference ('newestFirst', 'playlistOrder', 'alphabetical', etc.)

    -- Numeric metadata (INTEGER fields grouped)
    position INTEGER,                      -- UI display position (1, 2, 3...) for drag-and-drop ordering
    total_videos INTEGER,                  -- Total video count for source
    max_depth INTEGER,                     -- Scan depth for local folders

    -- Audit timestamps
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Type-specific constraints
    CHECK (
        (type = 'local' AND path IS NOT NULL) OR
        (type IN ('youtube_channel', 'youtube_playlist') AND url IS NOT NULL)
    )
);

-- Indexes for performance
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_title ON sources(title);
CREATE INDEX idx_sources_position ON sources(position);
```

#### 5. YouTube API Results Table (Replaces .cache folder)

```sql
CREATE TABLE youtube_api_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,               -- Foreign key to sources table
    video_id TEXT NOT NULL,                -- Video ID from API response
    position INTEGER NOT NULL,             -- Position in paginated results (1-based)
    page_range TEXT NOT NULL,              -- Page range identifier (e.g., '1-50', '101-150')
    fetch_timestamp TEXT NOT NULL,         -- ISO date when fetched
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,

    -- Ensure unique position per source and page range
    UNIQUE(source_id, video_id, page_range)
);

-- Indexes for performance
CREATE INDEX idx_youtube_api_source_id ON youtube_api_results(source_id);
CREATE INDEX idx_youtube_api_page_range ON youtube_api_results(source_id, page_range);
CREATE INDEX idx_youtube_api_position ON youtube_api_results(source_id, page_range, position);
CREATE INDEX idx_youtube_api_fetch_timestamp ON youtube_api_results(fetch_timestamp);
```

### Phase 2 Tables

#### 6. Usage Logs Table (Replaces usageLog.json)

```sql
CREATE TABLE usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                     -- ISO date (YYYY-MM-DD)
    seconds_used INTEGER NOT NULL DEFAULT 0, -- Daily usage in seconds
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one record per date
    UNIQUE(date)
);

-- Indexes for performance
CREATE INDEX idx_usage_logs_date ON usage_logs(date);
CREATE INDEX idx_usage_logs_updated_at ON usage_logs(updated_at);
```

#### 7. Time Limits Table (Replaces timeLimits.json)

```sql
CREATE TABLE time_limits (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row table
    monday INTEGER NOT NULL DEFAULT 0,      -- Minutes allowed
    tuesday INTEGER NOT NULL DEFAULT 0,
    wednesday INTEGER NOT NULL DEFAULT 0,
    thursday INTEGER NOT NULL DEFAULT 0,
    friday INTEGER NOT NULL DEFAULT 0,
    saturday INTEGER NOT NULL DEFAULT 0,
    sunday INTEGER NOT NULL DEFAULT 0,
    warning_threshold_minutes INTEGER,       -- Warning threshold
    countdown_warning_seconds INTEGER,       -- Countdown warning time
    audio_warning_seconds INTEGER,           -- Audio warning time
    time_up_message TEXT,                   -- Custom time up message
    use_system_beep BOOLEAN DEFAULT 0,      -- Use system beep flag
    custom_beep_sound TEXT,                 -- Path to custom beep sound
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row
INSERT INTO time_limits (id) VALUES (1);
```

#### 8. Usage Extras Table (Replaces timeExtra.json)

```sql
CREATE TABLE usage_extras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,                     -- ISO date (YYYY-MM-DD)
    minutes_added INTEGER NOT NULL,         -- Extra minutes added
    reason TEXT,                           -- Optional reason for addition
    added_by TEXT DEFAULT 'admin',         -- Who added the time
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Allow multiple additions per date (for audit trail)
    INDEX idx_usage_extras_date (date)
);
```

#### 9. Settings Table (Consolidates multiple JSON configs)

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,                   -- Setting key (namespace.setting format)
    value TEXT,                            -- JSON-encoded setting value
    type TEXT NOT NULL DEFAULT 'string',   -- Value type hint
    description TEXT,                      -- Setting description
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Default settings migration mapping:
-- mainSettings.json -> 'main.*'
-- pagination.json -> 'pagination.*'
-- youtubePlayer.json -> 'youtube_player.*'
```

## Migration Strategy

### Migration Service Architecture

```typescript
// src/main/services/MigrationService.ts
class MigrationService {
  private backupService: BackupService;
  private validationService: ValidationService;

  async migratePhase1(): Promise<MigrationResult>
  async migratePhase2(): Promise<MigrationResult>
  async rollback(phase: 1 | 2): Promise<RollbackResult>
}
```

### Phase 1 Migration Steps

1. **Pre-Migration Backup**
   ```typescript
   // Backup all JSON files before starting
   await backupService.createBackup([
     'videoSources.json',
     'watched.json',
     'favorites.json'
   ]);
   ```

2. **Database Initialization**
   ```typescript
   // Initialize database with WAL mode
   await databaseService.initialize({
     path: path.join(AppPaths.getDataPath(), 'safetube.db'),
     mode: 'WAL',
     busyTimeout: 30000
   });
   ```

3. **Schema Creation**
   ```typescript
   // Create Phase 1 tables and indexes
   await databaseService.executeSchema(PHASE_1_SCHEMA);
   ```

4. **Data Migration Sequence**
   ```typescript
   // Step 1: Migrate sources (foundation for foreign keys)
   const sources = await loadVideoSources();
   await migrateSources(sources);

   // Step 2: Extract and migrate all videos from cache
   const videosFromCache = await extractVideosFromCache();
   const videosFromWatched = await extractVideosFromWatched();
   await migrateVideos([...videosFromCache, ...videosFromWatched]);

   // Step 3: Migrate viewing history
   const watchedData = await loadWatchedVideos();
   await migrateViewRecords(watchedData);

   // Step 4: Migrate favorites
   const favoritesData = await loadFavorites();
   await migrateFavorites(favoritesData);

   // Step 5: Migrate YouTube API cache
   await migrateCacheFolder();
   ```

5. **Data Validation**
   ```typescript
   // Verify migration integrity
   await validateMigration({
     sources: originalSources.length,
     videos: expectedVideoCount,
     viewRecords: originalWatched.length,
     favorites: originalFavorites.length
   });
   ```

### Phase 2 Migration Steps

1. **Time Tracking Data Migration**
   ```typescript
   // Migrate usage logs with date normalization
   const usageLog = await loadUsageLog();
   await migrateUsageLogs(usageLog);

   // Migrate time limits
   const timeLimits = await loadTimeLimits();
   await migrateTimeLimits(timeLimits);

   // Migrate extra time records
   const timeExtra = await loadTimeExtra();
   await migrateUsageExtras(timeExtra);
   ```

2. **Settings Consolidation**
   ```typescript
   // Consolidate multiple JSON configs into settings table
   const mainSettings = await loadMainSettings();
   const paginationConfig = await loadPaginationConfig();
   const youtubePlayerConfig = await loadYouTubePlayerConfig();

   await migrateSettings({
     main: mainSettings,
     pagination: paginationConfig,
     youtube_player: youtubePlayerConfig
   });
   ```

### Cache Folder Migration Strategy

```typescript
async migrateCacheFolder() {
  const cacheFiles = await fs.readdir(AppPaths.getCachePath());

  for (const file of cacheFiles) {
    if (file.endsWith('.json')) {
      const cacheData = await loadCacheFile(file);
      const sourceId = extractSourceIdFromFilename(file);

      // Convert cache entries to youtube_api_results records
      for (const [pageRange, videoIds] of Object.entries(cacheData)) {
        await insertYouTubeApiResults({
          sourceId,
          pageRange,
          videoIds: videoIds as string[],
          fetchTimestamp: new Date().toISOString()
        });
      }
    }
  }

  // Mark cache folder for removal (preserve for rollback)
  await fs.rename(AppPaths.getCachePath(), AppPaths.getCachePath() + '.migrated');
}
```

## Performance Design

### Query Optimization Strategies

1. **Indexing Strategy**
   - Primary key indexes on all tables
   - Foreign key indexes for JOIN operations
   - Composite indexes for common query patterns
   - Full-text search indexes for search functionality

2. **Connection Management**
   ```typescript
   class ConnectionManager {
     private pool: Database[] = [];
     private maxConnections = 5;

     async getConnection(): Promise<Database>
     async releaseConnection(db: Database): Promise<void>
   }
   ```

3. **Query Patterns**
   ```sql
   -- Optimized video loading with source information
   SELECT v.*, s.title as source_title, s.type as source_type
   FROM videos v
   JOIN sources s ON v.source_id = s.id
   WHERE s.id = ?
   ORDER BY v.published_at DESC
   LIMIT ? OFFSET ?;

   -- Optimized favorites with video metadata
   SELECT f.date_added, v.*, s.title as source_title
   FROM favorites f
   JOIN videos v ON f.video_id = v.id
   JOIN sources s ON f.source_id = s.id
   ORDER BY f.date_added DESC;

   -- Optimized search across videos
   SELECT v.*, s.title as source_title
   FROM videos_fts fts
   JOIN videos v ON fts.rowid = v.rowid
   JOIN sources s ON v.source_id = s.id
   WHERE videos_fts MATCH ?
   ORDER BY rank;
   ```

4. **Pagination Strategy**
   ```typescript
   interface PaginationConfig {
     limit: number;      // Default: 50 videos per page
     offset: number;     // Calculated: page * limit
     total?: number;     // Total count for UI
   }
   ```

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private queryTimes: Map<string, number[]> = new Map();

  async measureQuery<T>(operation: string, query: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await query();
    const duration = performance.now() - start;

    this.recordQueryTime(operation, duration);

    if (duration > 100) { // Log slow queries
      log.warn(`Slow query detected: ${operation} took ${duration}ms`);
    }

    return result;
  }
}
```

## IPC Communication Interface

### Database API Methods

```typescript
// src/main/ipc/databaseHandlers.ts
export const databaseHandlers = {
  // Video operations
  'db:videos:getBySource': async (sourceId: string, pagination: PaginationConfig) => Promise<VideoResult[]>,
  'db:videos:getById': async (videoId: string) => Promise<VideoResult | null>,
  'db:videos:search': async (query: string, filters?: SearchFilters) => Promise<VideoResult[]>,
  'db:videos:updateMetadata': async (videoId: string, metadata: VideoMetadata) => Promise<void>,
  'db:videos:updateAvailability': async (videoId: string, isAvailable: boolean) => Promise<void>,

  // View records operations
  'db:viewRecords:get': async (videoId: string) => Promise<ViewRecord | null>,
  'db:viewRecords:update': async (videoId: string, record: ViewRecordUpdate) => Promise<void>,
  'db:viewRecords:getHistory': async (pagination: PaginationConfig) => Promise<ViewRecord[]>,
  'db:viewRecords:getRecentlyWatched': async (limit: number) => Promise<ViewRecord[]>,

  // Favorites operations
  'db:favorites:getAll': async () => Promise<FavoriteVideo[]>,
  'db:favorites:add': async (favorite: FavoriteVideoInput) => Promise<void>,
  'db:favorites:remove': async (videoId: string) => Promise<void>,
  'db:favorites:isFavorite': async (videoId: string) => Promise<boolean>,

  // Sources operations
  'db:sources:getAll': async () => Promise<VideoSource[]>,
  'db:sources:getById': async (sourceId: string) => Promise<VideoSource | null>,
  'db:sources:create': async (source: VideoSourceInput) => Promise<string>,
  'db:sources:update': async (sourceId: string, source: VideoSourceUpdate) => Promise<void>,
  'db:sources:delete': async (sourceId: string) => Promise<void>,
  'db:sources:validate': async (sourceData: VideoSourceFormData) => Promise<ValidationResult>,

  // YouTube API cache operations
  'db:youtube:getCachedResults': async (sourceId: string, pageRange: string) => Promise<string[]>,
  'db:youtube:setCachedResults': async (sourceId: string, pageRange: string, videoIds: string[]) => Promise<void>,
  'db:youtube:clearCache': async (sourceId: string) => Promise<void>,
  'db:youtube:refreshCache': async (sourceId: string) => Promise<void>,

  // Search operations
  'db:search:videos': async (query: string, options?: SearchOptions) => Promise<SearchResult[]>,
  'db:search:suggestions': async (query: string) => Promise<string[]>,

  // Sync operations
  'db:sync:refreshSource': async (sourceId: string) => Promise<SyncResult>,
  'db:sync:refreshAllSources': async () => Promise<SyncResult[]>,
  'db:sync:getLastSync': async (sourceId: string) => Promise<Date | null>,

  // Migration operations (admin only)
  'db:migration:getStatus': async () => Promise<MigrationStatus>,
  'db:migration:runPhase1': async () => Promise<MigrationResult>,
  'db:migration:runPhase2': async () => Promise<MigrationResult>,
  'db:migration:rollback': async (phase: 1 | 2) => Promise<RollbackResult>
};
```

### IPC Data Contracts

```typescript
// Input/Output types for IPC methods
interface VideoResult {
  id: string;
  title: string;
  publishedAt: string | null;
  thumbnail: string;
  duration: number;
  url: string;
  isAvailable: boolean;
  description: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

interface ViewRecordUpdate {
  position: number;
  timeWatched: number;
  duration?: number;
  watched: boolean;
}

interface SearchOptions {
  sourceIds?: string[];
  includeUnavailable?: boolean;
  limit?: number;
  offset?: number;
}

interface SyncResult {
  sourceId: string;
  videosAdded: number;
  videosUpdated: number;
  videosRemoved: number;
  errors: string[];
  duration: number;
}
```

### Error Handling

```typescript
class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Error codes for client handling
export const DatabaseErrorCodes = {
  CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  QUERY_TIMEOUT: 'DB_QUERY_TIMEOUT',
  CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  MIGRATION_FAILED: 'DB_MIGRATION_FAILED',
  VALIDATION_FAILED: 'DB_VALIDATION_FAILED',
  FOREIGN_KEY_VIOLATION: 'DB_FOREIGN_KEY_VIOLATION',
  DUPLICATE_KEY: 'DB_DUPLICATE_KEY'
} as const;
```

## Integration Design

### Service Layer Integration

```typescript
// src/main/services/VideoService.ts
class VideoService {
  constructor(
    private databaseService: DatabaseService,
    private youtubeService: YouTubeService,
    private localVideoService: LocalVideoService
  ) {}

  async loadVideosFromSource(sourceId: string): Promise<VideoResult[]> {
    // Check database first
    const cachedVideos = await this.databaseService.getVideosBySource(sourceId);

    // Determine if refresh needed based on source type and cache age
    const source = await this.databaseService.getSource(sourceId);
    const needsRefresh = await this.shouldRefreshSource(source);

    if (needsRefresh) {
      await this.syncSourceVideos(sourceId);
      return await this.databaseService.getVideosBySource(sourceId);
    }

    return cachedVideos;
  }

  private async syncSourceVideos(sourceId: string): Promise<void> {
    const source = await this.databaseService.getSource(sourceId);

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    switch (source.type) {
      case 'youtube_channel':
      case 'youtube_playlist':
        return await this.syncYouTubeSource(source);
      case 'local':
        return await this.syncLocalSource(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }
}
```

### UI Integration Points

```typescript
// src/renderer/hooks/useDatabase.ts
export function useDatabase() {
  const getVideosBySource = useCallback(async (sourceId: string, page = 0) => {
    return await window.electron.invoke('db:videos:getBySource', sourceId, {
      limit: 50,
      offset: page * 50
    });
  }, []);

  const searchVideos = useCallback(async (query: string) => {
    return await window.electron.invoke('db:search:videos', query);
  }, []);

  const toggleFavorite = useCallback(async (video: VideoMetadata) => {
    const isFavorite = await window.electron.invoke('db:favorites:isFavorite', video.id);

    if (isFavorite) {
      await window.electron.invoke('db:favorites:remove', video.id);
    } else {
      await window.electron.invoke('db:favorites:add', {
        videoId: video.id,
        sourceId: video.source,
        dateAdded: new Date().toISOString()
      });
    }

    return !isFavorite;
  }, []);

  const syncSource = useCallback(async (sourceId: string) => {
    return await window.electron.invoke('db:sync:refreshSource', sourceId);
  }, []);

  return {
    getVideosBySource,
    searchVideos,
    toggleFavorite,
    syncSource
  };
}
```

### React Component Integration

```typescript
// src/renderer/components/VideoList.tsx
interface VideoListProps {
  sourceId: string;
}

export function VideoList({ sourceId }: VideoListProps) {
  const { getVideosBySource, syncSource } = useDatabase();
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getVideosBySource(sourceId);
      setVideos(result);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  }, [sourceId, getVideosBySource]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncSource(sourceId);
      await loadVideos(); // Refresh after sync
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [sourceId, syncSource, loadVideos]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  return (
    <div>
      <div className="video-list-header">
        <h2>Videos</h2>
        <button onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {loading ? (
        <div>Loading videos...</div>
      ) : (
        <div className="video-grid">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Security and Data Integrity

### SQLite Configuration

```typescript
// Database initialization with security settings
const databaseConfig = {
  path: path.join(AppPaths.getDataPath(), 'safetube.db'),
  options: {
    // Enable WAL mode for better concurrency
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,

    // Security settings
    busyTimeout: 30000,

    // Performance settings
    cacheSize: -2000, // 2MB cache
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    tempStore: 'MEMORY',

    // Foreign key enforcement
    foreignKeys: true
  }
};
```

### Data Validation Rules

```typescript
class DatabaseValidator {
  validateVideoId(videoId: string): boolean {
    // YouTube video IDs: 11 characters, alphanumeric and specific symbols
    const youtubeRegex = /^[a-zA-Z0-9_-]{11}$/;
    // Local video paths: must start with "local:" prefix
    const localRegex = /^local:/;

    return youtubeRegex.test(videoId) || localRegex.test(videoId);
  }

  validateSourceId(sourceId: string): boolean {
    // Source IDs: user-defined, no special constraints but must be non-empty
    return typeof sourceId === 'string' && sourceId.trim().length > 0;
  }

  validateTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  }
}
```

### Transaction Management

```typescript
class TransactionManager {
  async withTransaction<T>(operation: (db: Database) => Promise<T>): Promise<T> {
    const db = await this.connectionManager.getConnection();

    try {
      await db.exec('BEGIN TRANSACTION');
      const result = await operation(db);
      await db.exec('COMMIT');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    } finally {
      await this.connectionManager.releaseConnection(db);
    }
  }
}
```

### Concurrent Access Handling

```typescript
class ConcurrencyManager {
  private operationQueue: Map<string, Promise<any>> = new Map();

  async queueOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Ensure single operation per resource
    const existing = this.operationQueue.get(key);
    if (existing) {
      await existing;
    }

    const promise = operation();
    this.operationQueue.set(key, promise);

    try {
      return await promise;
    } finally {
      this.operationQueue.delete(key);
    }
  }
}
```

## Testing Strategy

### Unit Testing

```typescript
// src/main/services/__tests__/DatabaseService.test.ts
describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = path.join(__dirname, 'test.db');
    databaseService = new DatabaseService(testDbPath);
    await databaseService.initialize();
  });

  afterEach(async () => {
    await databaseService.close();
    await fs.unlink(testDbPath);
  });

  describe('video operations', () => {
    test('should create and retrieve videos', async () => {
      const video = createTestVideo();
      await databaseService.createVideo(video);

      const retrieved = await databaseService.getVideo(video.id);
      expect(retrieved).toMatchObject(video);
    });

    test('should handle foreign key constraints', async () => {
      const video = createTestVideo({ sourceId: 'nonexistent' });

      await expect(databaseService.createVideo(video))
        .rejects.toThrow('FOREIGN KEY constraint failed');
    });
  });
});
```

### Integration Testing

```typescript
// src/main/__tests__/migration.integration.test.ts
describe('Migration Integration', () => {
  test('should migrate Phase 1 data correctly', async () => {
    // Setup test JSON files
    const testSources = createTestVideoSources();
    const testWatched = createTestWatchedVideos();
    const testFavorites = createTestFavorites();

    await writeTestFile('videoSources.json', testSources);
    await writeTestFile('watched.json', testWatched);
    await writeTestFile('favorites.json', testFavorites);

    // Run migration
    const migrationResult = await migrationService.migratePhase1();

    expect(migrationResult.success).toBe(true);

    // Verify data integrity
    const migratedSources = await databaseService.getAllSources();
    const migratedVideos = await databaseService.getAllVideos();
    const migratedViewRecords = await databaseService.getAllViewRecords();
    const migratedFavorites = await databaseService.getAllFavorites();

    expect(migratedSources).toHaveLength(testSources.length);
    expect(migratedViewRecords).toHaveLength(testWatched.length);
    expect(migratedFavorites.favorites).toHaveLength(testFavorites.favorites.length);
  });
});
```

### Performance Testing

```typescript
// src/main/__tests__/performance.test.ts
describe('Database Performance', () => {
  test('should handle large datasets efficiently', async () => {
    // Create large test dataset
    const largeSources = createLargeTestDataset(100); // 100 sources
    const largeVideos = createLargeVideoDataset(10000); // 10k videos

    await populateTestDatabase(largeSources, largeVideos);

    // Test query performance
    const start = performance.now();
    const results = await databaseService.searchVideos('test query');
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Should complete within 100ms
    expect(results).toBeDefined();
  });

  test('should maintain performance with concurrent operations', async () => {
    const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
      databaseService.getVideosBySource(`source_${i}`)
    );

    const start = performance.now();
    const results = await Promise.all(concurrentOperations);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500); // All operations within 500ms
    expect(results).toHaveLength(10);
  });
});
```

## Rollback and Recovery Procedures

### Rollback Strategy

```typescript
class RollbackService {
  async rollbackToJson(phase: 1 | 2): Promise<RollbackResult> {
    try {
      // 1. Verify backup files exist
      await this.verifyBackupIntegrity(phase);

      // 2. Stop database operations
      await this.databaseService.close();

      // 3. Restore JSON files from backup
      await this.restoreJsonFiles(phase);

      // 4. Update application configuration to use JSON mode
      await this.switchToJsonMode();

      // 5. Restart with JSON-based services
      await this.initializeJsonServices();

      return { success: true, phase, restoredFiles: this.getRestoredFiles(phase) };
    } catch (error) {
      return { success: false, phase, error: error.message };
    }
  }

  private async verifyBackupIntegrity(phase: 1 | 2): Promise<void> {
    const requiredFiles = phase === 1
      ? ['videoSources.json', 'watched.json', 'favorites.json']
      : ['usageLog.json', 'timeLimits.json', 'timeExtra.json', 'mainSettings.json'];

    for (const file of requiredFiles) {
      const backupPath = path.join(AppPaths.getBackupPath(), `${file}.backup`);
      if (!await fs.pathExists(backupPath)) {
        throw new Error(`Backup file missing: ${file}`);
      }
    }
  }
}
```

### Recovery Procedures

```typescript
class RecoveryService {
  async detectCorruption(): Promise<CorruptionReport> {
    try {
      // Run SQLite integrity check
      const integrityResult = await this.databaseService.checkIntegrity();

      if (!integrityResult.ok) {
        return {
          isCorrupted: true,
          errors: integrityResult.errors,
          recommendation: 'restore_from_backup'
        };
      }

      // Validate data consistency
      const consistencyErrors = await this.validateDataConsistency();

      return {
        isCorrupted: consistencyErrors.length > 0,
        errors: consistencyErrors,
        recommendation: consistencyErrors.length > 0 ? 'repair_or_restore' : 'healthy'
      };
    } catch (error) {
      return {
        isCorrupted: true,
        errors: [error.message],
        recommendation: 'restore_from_backup'
      };
    }
  }

  async repairDatabase(): Promise<RepairResult> {
    // Attempt automatic repair using SQLite recovery mechanisms
    try {
      // 1. Create recovery database
      const recoveryDb = await this.createRecoveryDatabase();

      // 2. Export recoverable data
      const recoverableData = await this.exportRecoverableData();

      // 3. Rebuild clean database
      await this.rebuildDatabase(recoverableData);

      return { success: true, recoveredRecords: recoverableData.recordCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

This comprehensive design document provides the technical foundation for implementing the SQLite migration project. The design emphasizes data integrity, performance, and maintainability while ensuring a smooth transition from the current JSON-based storage system.

Do the design specifications look comprehensive and ready for implementation? I've covered all the major areas including database schema, migration strategy, performance optimization, IPC integration, and error handling procedures.