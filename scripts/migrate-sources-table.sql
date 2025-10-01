-- Migration: Fix sources table column types
-- Changes: sort_order TEXT → position INTEGER, add sort_preference TEXT

BEGIN TRANSACTION;

-- Create new sources table with correct schema
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
);

-- Copy data with type conversion and smart defaults
INSERT INTO sources_new (
    id, type, title, url, thumbnail, channel_id, path,
    sort_preference, position, total_videos, max_depth,
    created_at, updated_at
)
SELECT
    id,
    type,
    title,
    url,
    thumbnail,
    channel_id,
    path,
    -- Infer sort_preference based on type
    CASE
        WHEN type = 'youtube_channel' THEN 'newestFirst'
        WHEN type = 'youtube_playlist' THEN 'playlistOrder'
        WHEN type = 'local' THEN 'alphabetical'
        ELSE 'newestFirst'
    END as sort_preference,
    -- Convert sort_order TEXT to position INTEGER
    CAST(COALESCE(sort_order, '0') AS INTEGER) as position,
    total_videos,
    max_depth,
    created_at,
    updated_at
FROM sources;

-- Drop old table and rename
DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

-- Recreate indexes
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_title ON sources(title);
CREATE INDEX idx_sources_position ON sources(position);

COMMIT;

-- Verify migration
SELECT 'Migration complete! New schema:' as status;
.schema sources
SELECT 'Sample data:' as status;
SELECT id, type, title, sort_preference, position FROM sources LIMIT 5;
