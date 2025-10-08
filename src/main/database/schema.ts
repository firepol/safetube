import { Database } from 'better-sqlite3';

const tables = {
  sources: `
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
    );
  `,
  videos: `
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
    );
  `,
  videos_fts: `
    CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
        id UNINDEXED,
        title,
        description,
        content='videos',
        content_rowid='rowid'
    );
  `,
  videos_fts_triggers: [
    `CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
        INSERT INTO videos_fts(rowid, id, title, description)
        VALUES (new.rowid, new.id, new.title, new.description);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
        INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
        VALUES('delete', old.rowid, old.id, old.title, old.description);
    END;`,
    `CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
        INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
        VALUES('delete', old.rowid, old.id, old.title, old.description);
        INSERT INTO videos_fts(rowid, id, title, description)
        VALUES (new.rowid, new.id, new.title, new.description);
    END;`,
  ],
  view_records: `
    CREATE TABLE IF NOT EXISTS view_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
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
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `,
  favorites: `
    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
        source_id TEXT NOT NULL,
        date_added TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `,
  youtube_api_results: `
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
    );
  `,
  usage_logs: `
    CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        seconds_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  time_limits: `
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
    );
  `,
  usage_extras: `
    CREATE TABLE IF NOT EXISTS usage_extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        minutes_added INTEGER NOT NULL,
        reason TEXT,
        added_by TEXT DEFAULT 'admin',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  settings: `
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT NOT NULL DEFAULT 'string',
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  downloads: `
    CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
        source_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'downloading', 'completed', 'failed')),
        progress INTEGER NOT NULL DEFAULT 0,
        start_time INTEGER,
        end_time INTEGER,
        error_message TEXT,
        file_path TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `,
  downloaded_videos: `
    CREATE TABLE IF NOT EXISTS downloaded_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL UNIQUE,
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
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL
    );
  `,
};

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_videos_source_id ON videos(source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);`,
  `CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at);`,
  `CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_view_records_video_id ON view_records(video_id);`,
  `CREATE INDEX IF NOT EXISTS idx_view_records_source_id ON view_records(source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_view_records_last_watched ON view_records(last_watched);`,
  `CREATE INDEX IF NOT EXISTS idx_view_records_watched ON view_records(watched);`,
  `CREATE INDEX IF NOT EXISTS idx_favorites_video_id ON favorites(video_id);`,
  `CREATE INDEX IF NOT EXISTS idx_favorites_source_id ON favorites(source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_favorites_date_added ON favorites(date_added);`,
  `CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);`,
  `CREATE INDEX IF NOT EXISTS idx_sources_title ON sources(title);`,
  `CREATE INDEX IF NOT EXISTS idx_sources_position ON sources(position);`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_api_source_id ON youtube_api_results(source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_api_page_range ON youtube_api_results(source_id, page_range);`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_api_position ON youtube_api_results(source_id, page_range, position);`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_api_fetch_timestamp ON youtube_api_results(fetch_timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_date ON usage_logs(date);`,
  `CREATE INDEX IF NOT EXISTS idx_usage_logs_updated_at ON usage_logs(updated_at);`,
  `CREATE INDEX IF NOT EXISTS idx_usage_extras_date ON usage_extras(date);`,
  `CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);`,
  `CREATE INDEX IF NOT EXISTS idx_downloads_video_id ON downloads(video_id);`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_videos_video_id ON downloaded_videos(video_id);`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_videos_source_id ON downloaded_videos(source_id);`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_videos_downloaded_at ON downloaded_videos(downloaded_at);`,
  `CREATE INDEX IF NOT EXISTS idx_downloaded_videos_file_path ON downloaded_videos(file_path);`,
];

/**
 * Creates all database tables and indexes in the correct order.
 * Uses "CREATE TABLE IF NOT EXISTS" to be safe.
 * @param db The better-sqlite3 database instance.
 */
export function initializeSchema(db: Database): void {
  db.transaction(() => {
    // Tables without dependencies
    db.exec(tables.sources);
    db.exec(tables.usage_logs);
    db.exec(tables.time_limits);
    db.exec(tables.usage_extras);
    db.exec(tables.settings);

    // Tables with dependencies on `sources`
    db.exec(tables.videos);
    db.exec(tables.downloads);

    // Tables with dependencies on `videos` and `sources`
    db.exec(tables.videos_fts);
    tables.videos_fts_triggers.forEach(trigger => db.exec(trigger));
    db.exec(tables.view_records);
    db.exec(tables.favorites);
    db.exec(tables.youtube_api_results);
    db.exec(tables.downloaded_videos);

    // Create all indexes
    indexes.forEach(index => db.exec(index));
  })();
}

/**
 * Seeds the database with initial default data if it doesn't exist.
 * Uses "INSERT OR IGNORE" to prevent errors on subsequent runs.
 * @param db The better-sqlite3 database instance.
 */
export function seedDefaultData(db: Database): void {  
  db.transaction(() => {
    // 1. Seed default time limits
    // From config.example/timeLimits.json
    const seedTimeLimitsStmt = db.prepare(`
      INSERT OR IGNORE INTO time_limits (
        id, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        warning_threshold_minutes, countdown_warning_seconds, audio_warning_seconds,
        time_up_message, use_system_beep, custom_beep_sound
      ) VALUES (
        1, 30, 30, 30, 30, 45, 90, 90,
        3, 60, 10, ?, 0, ''
      )
    `);
    // The message needs to be passed as a parameter to handle quotes correctly.
    seedTimeLimitsStmt.run("Time's up for today! Here's your schedule:");
 
    // 2. Seed default admin password
    // The password is 'paren234', hashed with bcrypt.
    const defaultAdminPasswordHash = '$2b$10$CD78JZagbb56sj/6SIJfyetZN5hYjICzbPovBm5/1mol2K53bWIWy';
 
    // The value MUST be a valid JSON string, so we stringify it.
    // This stores it as '"$2b$10$..."' in the database, which is what your query helpers expect.
    const jsonEncodedPassword = JSON.stringify(defaultAdminPasswordHash);
 
    const seedAdminPasswordStmt = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, type, description)
      VALUES ('main.adminPassword', ?, 'string', 'Hashed admin password')
    `);
    seedAdminPasswordStmt.run(jsonEncodedPassword);
  })();
}