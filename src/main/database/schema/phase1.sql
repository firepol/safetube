-- Phase 1 Database Schema for SafeTube SQLite Migration
-- This file contains all Phase 1 table definitions with proper indexes and constraints

-- Sources Table (Replaces videoSources.json)

CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,                    -- Source ID (user-defined)
    type TEXT NOT NULL,                     -- 'youtube_channel' | 'youtube_playlist' | 'local'
    title TEXT NOT NULL,                    -- Display title
    sort_order TEXT,                        -- Sort preference

    -- YouTube-specific fields
    url TEXT,                              -- YouTube URL
    channel_id TEXT,                       -- YouTube channel ID

    -- Local-specific fields
    path TEXT,                             -- Local folder path
    max_depth INTEGER,                     -- Scan depth for local folders

    -- New fields for caching and UI
    thumbnail TEXT,                        -- Cached thumbnail URL
    total_videos INTEGER,                   -- Cached total video count

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Type-specific constraints
    CHECK (
        (type = 'local' AND path IS NOT NULL) OR
        (type IN ('youtube_channel', 'youtube_playlist') AND url IS NOT NULL)
    )
);

-- Sources table indexes
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_title ON sources(title);

-- Videos Table (Master Video Cache)
CREATE TABLE IF NOT EXISTS videos (
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

-- Videos table indexes
CREATE INDEX IF NOT EXISTS idx_videos_source_id ON videos(source_id);
CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at);
CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);

-- Full-text search index for local search functionality
CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
    id UNINDEXED,
    title,
    description,
    content='videos',
    content_rowid='rowid'
);

-- Triggers to maintain FTS index
CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;

-- View Records Table (Replaces watched.json)
CREATE TABLE IF NOT EXISTS view_records (
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

-- View records table indexes
CREATE INDEX IF NOT EXISTS idx_view_records_video_id ON view_records(video_id);
CREATE INDEX IF NOT EXISTS idx_view_records_source_id ON view_records(source_id);
CREATE INDEX IF NOT EXISTS idx_view_records_last_watched ON view_records(last_watched);
CREATE INDEX IF NOT EXISTS idx_view_records_watched ON view_records(watched);

-- Favorites Table (Replaces favorites.json)
CREATE TABLE IF NOT EXISTS favorites (
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

-- Favorites table indexes
CREATE INDEX IF NOT EXISTS idx_favorites_video_id ON favorites(video_id);
CREATE INDEX IF NOT EXISTS idx_favorites_source_id ON favorites(source_id);
CREATE INDEX IF NOT EXISTS idx_favorites_date_added ON favorites(date_added);

-- YouTube API Results Table (Replaces .cache folder)
CREATE TABLE IF NOT EXISTS youtube_api_results (
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

-- YouTube API results table indexes
CREATE INDEX IF NOT EXISTS idx_youtube_api_source_id ON youtube_api_results(source_id);
CREATE INDEX IF NOT EXISTS idx_youtube_api_page_range ON youtube_api_results(source_id, page_range);
CREATE INDEX IF NOT EXISTS idx_youtube_api_position ON youtube_api_results(source_id, page_range, position);
CREATE INDEX IF NOT EXISTS idx_youtube_api_fetch_timestamp ON youtube_api_results(fetch_timestamp);

-- Schema Version Tracking
CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row table
    version INTEGER NOT NULL,                -- Current schema version
    phase TEXT NOT NULL,                     -- Current phase (phase1, phase2)
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial schema version
INSERT OR REPLACE INTO schema_version (id, version, phase) VALUES (1, 1, 'phase1');