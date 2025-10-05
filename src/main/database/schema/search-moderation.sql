-- Search + Moderation Feature Schema
-- This file contains all table definitions for search and wishlist functionality

-- Searches Table (Search History Tracking)
CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,                     -- Search query text
    search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
    result_count INTEGER NOT NULL DEFAULT 0, -- Number of results returned
    timestamp TEXT NOT NULL,                 -- ISO date when search was performed
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Searches table indexes
CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query);

-- Wishlist Table (Video Approval Workflow)
CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,                  -- Video ID (YouTube or local)
    title TEXT NOT NULL,                     -- Video title
    thumbnail TEXT,                          -- Thumbnail URL
    description TEXT,                        -- Video description
    channel_id TEXT,                         -- YouTube channel ID
    channel_name TEXT,                       -- Channel display name
    duration INTEGER,                        -- Duration in seconds
    url TEXT NOT NULL,                       -- Video URL or file path
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied')),
    requested_at TEXT NOT NULL,              -- ISO date when kid added to wishlist
    reviewed_at TEXT,                        -- ISO date when parent reviewed
    reviewed_by TEXT,                        -- Future: for multi-parent support
    denial_reason TEXT,                      -- Parent's reason for denial (optional)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one wishlist entry per video
    UNIQUE(video_id)
);

-- Wishlist table indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist(status);
CREATE INDEX IF NOT EXISTS idx_wishlist_requested_at ON wishlist(requested_at);
CREATE INDEX IF NOT EXISTS idx_wishlist_video_id ON wishlist(video_id);

-- Search Results Cache Table (24-hour cache for YouTube searches)
CREATE TABLE IF NOT EXISTS search_results_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    search_query TEXT NOT NULL,              -- Search query text
    video_id TEXT NOT NULL,                  -- Video ID from search results
    video_data TEXT NOT NULL,                -- JSON blob with full video metadata
    position INTEGER NOT NULL,               -- Position in search results (1-based)
    search_type TEXT NOT NULL CHECK(search_type IN ('database', 'youtube')),
    fetch_timestamp TEXT NOT NULL,           -- ISO date when cached
    expires_at TEXT NOT NULL,                -- ISO date when cache expires (fetch + 24h)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique entries per query and video
    UNIQUE(search_query, video_id, search_type)
);

-- Search results cache table indexes
CREATE INDEX IF NOT EXISTS idx_search_cache_query ON search_results_cache(search_query);
CREATE INDEX IF NOT EXISTS idx_search_cache_timestamp ON search_results_cache(fetch_timestamp);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires ON search_results_cache(expires_at);
