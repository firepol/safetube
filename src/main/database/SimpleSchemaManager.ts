import DatabaseService from '../services/DatabaseService';
import log from '../logger';
import { DEFAULT_ADMIN_PASSWORD_HASH } from '../../shared/constants';

interface SchemaVersion {
  version: string;
  updated_at: string;
}

/**
 * Simplified schema manager that creates tables programmatically
 * This approach is more reliable than parsing complex SQL files
 */
export class SimpleSchemaManager {
  private databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Initialize the database schema
   */
  async initializeSchema(): Promise<void> {
    try {
      log.info('[SimpleSchemaManager] Initializing database schema');

      // Migrate old schema_version table structure if needed
      await this.migrateSchemaVersionTable();

      const currentVersion = await this.getCurrentSchemaVersion();
      const isExistingDatabase = currentVersion && currentVersion.version === 'v1';

      if (isExistingDatabase) {
        log.debug('[SimpleSchemaManager] Schema version is v1, ensuring all tables exist');
        await this.fixSourcesTableColumns();
      }

      await this.databaseService.run('BEGIN IMMEDIATE TRANSACTION');
      try {
        // Create tables in dependency order (CREATE TABLE IF NOT EXISTS handles existing tables)
        await this.createSchemaVersionTable();
        await this.createSourcesTable();
        await this.createVideosTable();
        await this.createVideosFtsTable();
        await this.createViewRecordsTable();
        await this.createFavoritesTable();
        await this.createYoutubeApiResultsTable();
        await this.createUsageLogsTable();
        await this.createTimeLimitsTable();
        await this.createUsageExtrasTable();
        await this.createSettingsTable();
        await this.createDownloadsTable();
        await this.createDownloadedVideosTable();
        await this.createSearchesTable();
        await this.createWishlistTable();
        await this.createSearchResultsCacheTable();

        // Set default settings (INSERT OR IGNORE handles existing data)
        await this.insertDefaultSettings();

        // Update schema version
        await this.databaseService.run(`
          INSERT OR REPLACE INTO schema_version (id, version)
          VALUES (1, 'v1')
        `);

        await this.databaseService.run('COMMIT');
        if (isExistingDatabase) {
          log.info('[SimpleSchemaManager] Database schema verified and updated (missing tables created)');
        } else {
          log.info('[SimpleSchemaManager] Database schema initialized successfully to version v1');
        }
      } catch (error) {
        await this.databaseService.run('ROLLBACK');
        log.error('[SimpleSchemaManager] Error initializing schema, rolled back transaction:', error);
        throw new Error(`Schema initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (error) {
      log.error('[SimpleSchemaManager] Error initializing schema:', error);
      throw new Error(`Failed to initialize database schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create schema_version table
   */
  private async createSchemaVersionTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Create sources table
   */
  private async createSourcesTable(): Promise<void> {
  await this.databaseService.run(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      thumbnail TEXT,
      channel_id TEXT,
      path TEXT,
      sort_preference TEXT,
      position INTEGER,
      total_videos INTEGER,
      max_depth INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (
        (type = 'local' AND path IS NOT NULL) OR
        (type IN ('youtube_channel', 'youtube_playlist') AND url IS NOT NULL)
      )
    )
  `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_sources_title ON sources(title)');
  }

  /**
   * Create videos table
   */
  private async createVideosTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          published_at TEXT,
          thumbnail TEXT,
          duration INTEGER,
          url TEXT,
          is_available BOOLEAN NOT NULL DEFAULT 1,
          description TEXT,
          source_id TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_videos_source_id ON videos(source_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at)');
  }

  /**
   * Create videos_fts table and triggers
   */
  private async createVideosFtsTable(): Promise<void> {
    // Create FTS table
    await this.databaseService.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
          id UNINDEXED,
          title,
          description,
          content='videos',
          content_rowid='rowid'
      )
    `);

    // Create triggers to maintain FTS index
    await this.databaseService.run(`
      CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
          INSERT INTO videos_fts(rowid, id, title, description)
          VALUES (new.rowid, new.id, new.title, new.description);
      END
    `);

    await this.databaseService.run(`
      CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
          INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
          VALUES('delete', old.rowid, old.id, old.title, old.description);
      END
    `);

    await this.databaseService.run(`
      CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
          INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
          VALUES('delete', old.rowid, old.id, old.title, old.description);
          INSERT INTO videos_fts(rowid, id, title, description)
          VALUES (new.rowid, new.id, new.title, new.description);
      END
    `);
  }

  /**
   * Create view_records table
   */
  private async createViewRecordsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS view_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          position REAL NOT NULL DEFAULT 0,
          time_watched REAL NOT NULL DEFAULT 0,
          duration INTEGER,
          watched BOOLEAN NOT NULL DEFAULT 0,
          first_watched TEXT NOT NULL,
          last_watched TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
          UNIQUE(video_id)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_view_records_video_id ON view_records(video_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_view_records_source_id ON view_records(source_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_view_records_last_watched ON view_records(last_watched)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_view_records_watched ON view_records(watched)');
  }

  /**
   * Create favorites table
   */
  private async createFavoritesTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          date_added TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
          UNIQUE(video_id)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_favorites_video_id ON favorites(video_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_favorites_source_id ON favorites(source_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_favorites_date_added ON favorites(date_added)');
  }

  /**
   * Create youtube_api_results table
   */
  private async createYoutubeApiResultsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS youtube_api_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          position INTEGER NOT NULL,
          page_range TEXT NOT NULL,
          fetch_timestamp TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
          UNIQUE(source_id, video_id, page_range)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_youtube_api_source_id ON youtube_api_results(source_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_youtube_api_page_range ON youtube_api_results(source_id, page_range)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_youtube_api_position ON youtube_api_results(source_id, page_range, position)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_youtube_api_fetch_timestamp ON youtube_api_results(fetch_timestamp)');
  }

  /**
   * Create usage_logs table
   */
  private async createUsageLogsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          seconds_used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON usage_logs(date)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_usage_logs_updated_at ON usage_logs(updated_at)');
  }

  /**
   * Create time_limits table (single-row table)
   */
  private async createTimeLimitsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS time_limits (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          monday INTEGER NOT NULL DEFAULT 0,
          tuesday INTEGER NOT NULL DEFAULT 0,
          wednesday INTEGER NOT NULL DEFAULT 0,
          thursday INTEGER NOT NULL DEFAULT 0,
          friday INTEGER NOT NULL DEFAULT 0,
          saturday INTEGER NOT NULL DEFAULT 0,
          sunday INTEGER NOT NULL DEFAULT 0,
          warning_threshold_minutes INTEGER,
          countdown_warning_seconds INTEGER,
          audio_warning_seconds INTEGER,
          time_up_message TEXT,
          use_system_beep BOOLEAN DEFAULT 0,
          custom_beep_sound TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default row
    await this.databaseService.run(`
      INSERT OR IGNORE INTO time_limits (id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, warning_threshold_minutes, countdown_warning_seconds, audio_warning_seconds, time_up_message, use_system_beep, custom_beep_sound)
      VALUES (1, 30, 30, 30, 30, 45, 90, 90, 3, 60, 10, "Time's up for today! Here's your schedule:", 0, NULL)
    `);
  }

  /**
   * Create usage_extras table
   */
  private async createUsageExtrasTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS usage_extras (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          minutes_added INTEGER NOT NULL,
          reason TEXT,
          added_by TEXT DEFAULT 'admin',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_usage_extras_date ON usage_extras(date)');
  }

  /**
   * Create settings table (unified key-value store)
   */
  private async createSettingsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          type TEXT NOT NULL DEFAULT 'string',
          description TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for namespace queries
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)');
  }

  /**
   * Insert default settings, including the admin password
   */
  private async insertDefaultSettings(): Promise<void> {
    await this.databaseService.run(`
      INSERT OR IGNORE INTO settings (key, value, type, description)
      VALUES ('main.adminPassword', ?, 'string', 'Admin password hash')
    `, [JSON.stringify(DEFAULT_ADMIN_PASSWORD_HASH)]);
    await this.databaseService.run(`
      INSERT OR IGNORE INTO settings (key, value, type, description)
      VALUES ('main.allowYouTubeClicksToOtherVideos', ?, 'boolean', 'Allow YouTube clicks to other videos')
    `, [true]);
  }

  /**
   * Create downloads table (transient download tracking)
   */
  private async createDownloadsTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS downloads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL,
          source_id TEXT,
          status TEXT NOT NULL CHECK(status IN ('pending', 'downloading', 'completed', 'failed')),
          progress INTEGER NOT NULL DEFAULT 0,
          start_time INTEGER,
          end_time INTEGER,
          error_message TEXT,
          file_path TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(video_id),
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloads_video_id ON downloads(video_id)');
  }

  /**
   * Create downloaded_videos table (permanent download registry)
   */
  private async createDownloadedVideosTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS downloaded_videos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT UNIQUE,
          source_id TEXT NOT NULL,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          thumbnail_path TEXT,
          duration INTEGER,
          downloaded_at TEXT NOT NULL,
          file_size INTEGER,
          format TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloaded_videos_video_id ON downloaded_videos(video_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloaded_videos_source_id ON downloaded_videos(source_id)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloaded_videos_downloaded_at ON downloaded_videos(downloaded_at)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_downloaded_videos_file_path ON downloaded_videos(file_path)');
  }

  /**
   * Create searches table
   */
  private async createSearchesTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS searches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
          result_count INTEGER NOT NULL DEFAULT 0,
          timestamp TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp DESC)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query)');
  }

  /**
   * Create wishlist table
   */
  private async createWishlistTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS wishlist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          video_id TEXT NOT NULL,
          title TEXT NOT NULL,
          thumbnail TEXT,
          description TEXT,
          channel_id TEXT,
          channel_name TEXT,
          duration INTEGER,
          url TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied')),
          requested_at TEXT NOT NULL,
          reviewed_at TEXT,
          reviewed_by TEXT,
          denial_reason TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(video_id)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist(status)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_wishlist_requested_at ON wishlist(requested_at)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_wishlist_video_id ON wishlist(video_id)');
  }

  /**
   * Create search_results_cache table
   */
  private async createSearchResultsCacheTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS search_results_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          search_query TEXT NOT NULL,
          video_id TEXT NOT NULL,
          video_data TEXT NOT NULL,
          position INTEGER NOT NULL,
          search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
          fetch_timestamp TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(search_query, video_id, search_type)
      )
    `);

    // Create indexes
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_results_cache(search_query)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_search_cache_timestamp ON search_results_cache(fetch_timestamp)');
    await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_results_cache(expires_at)');
  }

  /**
   * Get current schema version
   */
  async getCurrentSchemaVersion(): Promise<SchemaVersion | null> {
    try {
      // Check if schema_version table exists
      const tableExists = await this.databaseService.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='schema_version'
      `);

      if (!tableExists) {
        return null;
      }

      // Get current version
      const version = await this.databaseService.get<SchemaVersion>(`
        SELECT version, updated_at
        FROM schema_version
        WHERE id = 1
      `);

      return version;
    } catch (error) {
      log.error('[SimpleSchemaManager] Error getting current schema version:', error);
      return null;
    }
  }

  /**
   * Drop all schema objects
   */
  async dropSchema(): Promise<void> {
    try {
      log.warn('[SimpleSchemaManager] Dropping entire schema');

      // Get all tables except sqlite system tables
      const tables = await this.databaseService.all<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);

      // Disable foreign keys temporarily to allow dropping tables in any order
      await this.databaseService.run('PRAGMA foreign_keys = OFF');

      // Drop all tables
      for (const table of tables) {
        try {
          await this.databaseService.run(`DROP TABLE IF EXISTS "${table.name}"`);
        } catch (error) {
          log.warn(`[SimpleSchemaManager] Failed to drop table ${table.name}:`, error);
          // Continue with other tables
        }
      }

      // Re-enable foreign keys
      await this.databaseService.run('PRAGMA foreign_keys = ON');

      log.info('[SimpleSchemaManager] Schema dropped successfully');
    } catch (error) {
      log.error('[SimpleSchemaManager] Error dropping schema:', error);
      throw error;
    }
  }

  /**
   * Migrate old schema_version table structure (with phase column) to new structure
   */
  private async migrateSchemaVersionTable(): Promise<void> {
    try {
      // Check if schema_version table exists
      const tableExists = await this.databaseService.get<{ name: string }>(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'
      `);

      if (!tableExists) {
        log.debug('[SimpleSchemaManager] schema_version table does not exist yet, no migration needed');
        return;
      }

      // Check if the old phase column exists
      const tableInfo = await this.databaseService.all<{ name: string }>(`
        PRAGMA table_info(schema_version)
      `);
      const hasPhaseColumn = tableInfo.some(col => col.name === 'phase');

      if (!hasPhaseColumn) {
        log.debug('[SimpleSchemaManager] schema_version table is already in new format');
        return;
      }

      log.info('[SimpleSchemaManager] Migrating schema_version table from old format (with phase column) to new format');

      // Wrap migration in transaction for atomicity
      await this.databaseService.run('BEGIN IMMEDIATE TRANSACTION');
      try {
        // Get current version data
        const oldVersion = await this.databaseService.get<{ version: string | number; phase?: string }>(`
          SELECT version, phase FROM schema_version WHERE id = 1
        `);

        // Drop old table
        await this.databaseService.run('DROP TABLE schema_version');

        // Create new table with updated structure
        await this.databaseService.run(`
          CREATE TABLE schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Insert version as 'v1' (unified schema)
        await this.databaseService.run(`
          INSERT INTO schema_version (id, version)
          VALUES (1, 'v1')
        `);

        await this.databaseService.run('COMMIT');
        log.info('[SimpleSchemaManager] schema_version table migrated successfully');
      } catch (migrationError) {
        await this.databaseService.run('ROLLBACK');
        log.error('[SimpleSchemaManager] Error during schema_version migration, rolled back:', migrationError);
        throw new Error(`Failed to migrate schema_version table: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`);
      }
    } catch (error) {
      log.error('[SimpleSchemaManager] Error migrating schema_version table:', error);
      throw error;
    }
  }

  /**
   * Fix sources table columns that may have been added manually or have wrong types
   */
  private async fixSourcesTableColumns(): Promise<void> {
    try {
      // Check if columns exist and are properly formatted
      const tableInfo = await this.databaseService.all<{ name: string; type: string; notnull: number; dflt_value: any }>(`
        PRAGMA table_info(sources)
      `);

      const hasValidThumbnail = tableInfo.some(col => col.name === 'thumbnail' && col.type === 'TEXT');
      const hasValidTotalVideos = tableInfo.some(col => col.name === 'total_videos' && col.type === 'INTEGER');
      const hasOldSortOrder = tableInfo.some(col => col.name === 'sort_order');
      const hasNewColumns = tableInfo.some(col => col.name === 'position' && col.type === 'INTEGER') && tableInfo.some(col => col.name === 'sort_preference');

      // Check if migration is needed
      if (hasValidThumbnail && hasValidTotalVideos && !hasOldSortOrder && hasNewColumns) {
        log.debug('[SimpleSchemaManager] Sources table columns are already properly formatted');
        return;
      }

      log.info('[SimpleSchemaManager] Fixing sources table columns (renaming sort_order → position, adding sort_preference)...');

      // Backup existing data
      const existingSources = await this.databaseService.all(`SELECT * FROM sources`);

      // Create new table with proper schema (optimized column order with correct types)
      await this.databaseService.run(`
        CREATE TABLE sources_new (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          url TEXT,
          thumbnail TEXT,
          channel_id TEXT,
          path TEXT,
          sort_preference TEXT,
          position INTEGER,
          total_videos INTEGER,
          max_depth INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CHECK (
            (type = 'local' AND path IS NOT NULL) OR
            (type IN ('youtube_channel', 'youtube_playlist') AND url IS NOT NULL)
          )
        )
      `);

      // Copy data to new table with proper type conversion and defaults
      for (const source of existingSources) {
        // Determine default sort_preference based on source type if not available
        let sortPreference = source.sort_preference || null;
        if (!sortPreference) {
          if (source.type === 'youtube_channel') {
            sortPreference = 'newestFirst';
          } else if (source.type === 'youtube_playlist') {
            sortPreference = 'playlistOrder';
          } else if (source.type === 'local') {
            sortPreference = 'alphabetical';
          }
        }

        // Convert old sort_order (TEXT) to position (INTEGER)
        // If sort_order was a number stored as text, parse it; otherwise use null
        let position = source.position || null;
        if (!position && source.sort_order !== undefined && source.sort_order !== null) {
          const parsedOrder = typeof source.sort_order === 'number' ? source.sort_order : parseInt(source.sort_order, 10);
          position = isNaN(parsedOrder) ? null : parsedOrder;
        }

        await this.databaseService.run(`
          INSERT INTO sources_new (
            id, type, title, url, thumbnail, channel_id, path, sort_preference,
            position, total_videos, max_depth, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          source.id, source.type, source.title, source.url,
          source.thumbnail, source.channel_id, source.path, sortPreference,
          position, source.total_videos, source.max_depth,
          source.created_at, source.updated_at
        ]);
      }

      // Replace old table
      await this.databaseService.run('DROP TABLE sources');
      await this.databaseService.run('ALTER TABLE sources_new RENAME TO sources');

      // Recreate indexes
      await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type)');
      await this.databaseService.run('CREATE INDEX IF NOT EXISTS idx_sources_title ON sources(title)');

      log.info('[SimpleSchemaManager] Sources table columns fixed successfully');
    } catch (error) {
      log.error('[SimpleSchemaManager] Error fixing sources table columns:', error);
      throw error;
    }
  }
}

export default SimpleSchemaManager;
