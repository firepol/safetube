# Improved Video ID System and Enhanced History Storage

## Current Issues Analysis
The current system has several problems:
1. **Inconsistent encoding**: Mix of base64/hex encoding with truncated IDs (`local_${hex.substring(0,16)}`)
2. **Lossy compression**: Truncated IDs can't be decoded back to original paths
3. **Complex routing**: Base64 encoding/decoding causes URL routing issues in frontend
4. **Poor debugging**: Hard to read `watched.json` file with cryptic encoded IDs
5. **Limited history data**: History page is slow because it needs to fetch additional metadata

## Proposed Solution: URI-Style Video IDs

### New Video ID Format
- **Local files**: `local:/path/to/video.mp4` (JSON-escaped as needed)
- **YouTube**: Keep existing `videoId` format (e.g., `dQw4w9WgXcQ`)
- **DLNA**: `dlna://192.168.1.100:8200/path/to/video.mp4`

### Enhanced History Storage
Store complete metadata in `watched.json`:
```json
{
  "videoId": "local:/home/user/Videos/kids/cartoon.mp4",
  "title": "Fun Cartoon Episode 1",
  "duration": 1200,
  "thumbnail": "/path/to/thumbnail.jpg",
  "source": "local-kids-videos",
  "position": 300,
  "lastWatched": "2025-01-15T10:00:00.000Z",
  "timeWatched": 600
}
```

## Implementation Plan (8 Atomic Tasks)

### Task 1: Update TypeScript Types
- [x] Extend `WatchedVideo` interface with new fields: `title`, `duration`, `thumbnail`, `source`
- [x] Create video ID utility functions for parsing URI-style IDs
- [x] Add backward compatibility flags
- **Test**: Type checking passes, interfaces compile correctly ✅

### Task 2: Create Video ID Utilities
- [x] Replace base64/hex encoding with URI-style parsing
- [x] Functions: `parseVideoId()`, `createLocalVideoId()`, `createDLNAVideoId()`
- [x] Handle JSON escaping for special characters in paths
- **Test**: Unit tests for all video ID parsing scenarios ✅ (20 tests pass)

### Task 3: Update Local Video Scanner
- [x] Generate `local:/path` IDs instead of encoded hashes
- [x] Keep original full file paths intact
- [x] Update video metadata collection to include thumbnails
- **Test**: Local folder scanning works with new ID format ✅

### Task 4: Update Video Loading System
- [x] Modify main process video loading to handle URI-style IDs
- [x] Update path resolution from `local:` prefix
- [x] Maintain compatibility with YouTube IDs
- [x] Add backward compatibility for legacy encoded IDs
- **Test**: All video types load correctly with new ID system ✅

### Task 5: Enhanced History Recording
- [x] Update `recordVideoWatching` to store complete metadata
- [x] Add thumbnail detection for local videos (same filename with image extension)
- [x] Include source information in history entries
- [x] Add firstWatched field to track when video was originally watched
- [x] Preserve existing data when updating entries
- **Test**: History entries saved with complete metadata ✅

### Task 6: Migrate Existing History Data
- [ ] Create migration script for existing `watched.json`
- [ ] Convert old encoded IDs to new format where possible
- [ ] Backfill metadata for migrated entries
- **Test**: Migration script preserves all existing watch history

### Task 7: Update Frontend Components
- [ ] Modify player routing to handle URI-style IDs (URL encoding/decoding)
- [ ] Update history page to use stored metadata (faster loading)
- [ ] Fix video card components to work with new ID format
- **Test**: All video playback and navigation works correctly

### Task 8: Update Cache System
- [ ] Ensure `.cache` files work with new local video IDs
- [ ] Update source loading to generate consistent IDs
- [ ] Verify emoji and special character handling
- **Test**: Cache system maintains consistency across app restarts

## Benefits
1. **Human-readable history**: `watched.json` shows actual file paths
2. **No data loss**: Full paths preserved, no truncation
3. **Faster history**: Complete metadata stored, no additional fetching needed
4. **Cleaner routing**: Simple URL encoding/decoding instead of base64
5. **Better debugging**: Easy to identify videos in JSON files
6. **Cross-platform**: Works reliably on Windows, Linux, macOS

## Backward Compatibility
- Migration script preserves existing watch history
- Graceful fallback for any unmigrated data
- No loss of time tracking or video progress

## Implementation Notes
- Each task should be implemented as an atomic commit
- Test each task manually or with automated tests before moving to the next
- Update this file with [x] when tasks are completed
- Note any issues or changes that arise during implementation