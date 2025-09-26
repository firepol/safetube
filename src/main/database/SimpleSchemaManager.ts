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
      sort_order TEXT,
      url TEXT,
      channel_id TEXT,
      path TEXT,
      max_depth INTEGER,
      thumbnail TEXT,
      total_videos INTEGER,
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

      // Drop all tables
      for (const table of tables) {
        await this.databaseService.run(`DROP TABLE IF EXISTS ${table.name}`);
      }

      log.info('[SimpleSchemaManager] Schema dropped successfully');
    } catch (error) {
      log.error('[SimpleSchemaManager] Error dropping schema:', error);
      throw error;
    }
  }
}

export default SimpleSchemaManager;