import DatabaseService from '../services/DatabaseService';
import log from '../logger';

interface SchemaVersion {
  version: number;
  phase: 'phase1' | 'phase2';
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
   * Initialize Phase 1 database schema
   */
  async initializePhase1Schema(): Promise<void> {
    try {
      log.info('[SimpleSchemaManager] Initializing Phase 1 schema');

      // Check if already initialized
      const currentVersion = await this.getCurrentSchemaVersion();
      if (currentVersion && currentVersion.phase === 'phase1') {
        log.debug('[SimpleSchemaManager] Phase 1 schema already initialized');
        // Check if we need to fix the sources table columns
        await this.fixSourcesTableColumns();
        return;
      }

      // Create tables in dependency order
      await this.createSchemaVersionTable();
      await this.createSourcesTable();
      await this.createVideosTable();
      await this.createVideosFtsTable();
      await this.createViewRecordsTable();
      await this.createFavoritesTable();
      await this.createYoutubeApiResultsTable();

      // Update schema version
      await this.databaseService.run(`
        INSERT OR REPLACE INTO schema_version (id, version, phase)
        VALUES (1, 1, 'phase1')
      `);

      log.info('[SimpleSchemaManager] Phase 1 schema initialized successfully');
    } catch (error) {
      log.error('[SimpleSchemaManager] Error initializing Phase 1 schema:', error);
      throw error;
    }
  }

  /**
   * Create schema_version table
   */
  private async createSchemaVersionTable(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          version INTEGER NOT NULL,
          phase TEXT NOT NULL,
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
   * Initialize Phase 2 database schema
   */
  async initializePhase2Schema(): Promise<void> {
    try {
      log.info('[SimpleSchemaManager] Initializing Phase 2 schema');

      // Check if already initialized
      const currentVersion = await this.getCurrentSchemaVersion();
      if (currentVersion && currentVersion.phase === 'phase2') {
        log.debug('[SimpleSchemaManager] Phase 2 schema already initialized');
        return;
      }

      // Create Phase 2 tables
      await this.createUsageLogsTable();
      await this.createTimeLimitsTable();
      await this.createUsageExtrasTable();

      // Update schema version
      await this.databaseService.run(`
        INSERT OR REPLACE INTO schema_version (id, version, phase)
        VALUES (1, 2, 'phase2')
      `);

      log.info('[SimpleSchemaManager] Phase 2 schema initialized successfully');
    } catch (error) {
      log.error('[SimpleSchemaManager] Error initializing Phase 2 schema:', error);
      throw error;
    }
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
      INSERT OR IGNORE INTO time_limits (id) VALUES (1)
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
        SELECT version, phase, updated_at
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
   * Validate Phase 1 schema
   */
  async validatePhase1Schema(): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      const errors: string[] = [];

      // Check all required tables exist
      const requiredTables = [
        'schema_version',
        'sources',
        'videos',
        'videos_fts',
        'view_records',
        'favorites',
        'youtube_api_results'
      ];

      const tables = await this.databaseService.all<{ name: string }>(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `);

      const tableNames = tables.map(t => t.name);

      for (const requiredTable of requiredTables) {
        if (!tableNames.includes(requiredTable)) {
          errors.push(`Missing table: ${requiredTable}`);
        }
      }

      // Check schema version
      const schemaVersion = await this.getCurrentSchemaVersion();
      if (!schemaVersion) {
        errors.push('Schema version not found');
      } else if (schemaVersion.phase !== 'phase1') {
        errors.push(`Expected phase1, got ${schemaVersion.phase}`);
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
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