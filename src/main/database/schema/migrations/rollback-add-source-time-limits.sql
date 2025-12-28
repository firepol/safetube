-- Rollback: Remove daily_time_limit_minutes column from sources table
-- This reverts the migration that added per-source daily time limit support
-- Version: 1.0 (revert to)
-- Description: Removes the daily_time_limit_minutes column and its index

-- Remove the index
DROP INDEX IF EXISTS idx_sources_daily_time_limit;

-- SQLite does not support dropping columns directly with ALTER TABLE
-- Therefore, the rollback must use the table recreation pattern:
-- 1. Create a temporary table with original schema (without daily_time_limit_minutes)
-- 2. Copy data from sources to temporary table
-- 3. Drop the original sources table
-- 4. Rename temporary table to sources

-- Create temporary table with original schema
CREATE TABLE IF NOT EXISTS sources_temp (
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

-- Copy data from sources to temporary table (excluding daily_time_limit_minutes)
INSERT INTO sources_temp
  (id, type, title, url, thumbnail, channel_id, path, sort_preference, position, total_videos, max_depth, created_at, updated_at)
SELECT
  id, type, title, url, thumbnail, channel_id, path, sort_preference, position, total_videos, max_depth, created_at, updated_at
FROM sources;

-- Drop triggers that depend on sources table
DROP TRIGGER IF EXISTS videos_fts_insert;
DROP TRIGGER IF EXISTS videos_fts_update;
DROP TRIGGER IF EXISTS videos_fts_delete;

-- Drop the original sources table
DROP TABLE IF EXISTS sources;

-- Rename temporary table to sources
ALTER TABLE sources_temp RENAME TO sources;

-- Recreate original indexes on sources table
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_title ON sources(title);
CREATE INDEX IF NOT EXISTS idx_sources_position ON sources(position);

-- Recreate triggers for FTS index
CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
    INSERT INTO videos_fts(rowid, id, title, description)
    VALUES (new.rowid, new.id, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, id, title, description)
    VALUES('delete', old.rowid, old.id, old.title, old.description);
END;
