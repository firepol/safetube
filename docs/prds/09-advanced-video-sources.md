# Advanced Video Sources & Local Folder Navigation PRD

## Overview

This feature expands SafeTube’s video source system to support:
- Fetching and displaying videos from YouTube channels and playlists as configurable sources.
- Treating YouTube playlists and channels as “folders” on the homepage, with videos shown in the order defined by the source.
- Advanced local folder navigation, including support for subfolders, configurable maximum navigation depth, and “flattened” views for easier access to videos in nested folders.
- **YouTube channel and playlist sources cache all video details in a dedicated JSON file per source for efficient loading and minimal API usage.**
- **Local folder sources are scanned on demand and do not require a cache file.**

## User Stories

- As a parent, I want to add a YouTube channel or playlist as a source, so my child can browse and watch only the videos I approve.
- As a parent, I want to configure a local folder (with optional subfolders) as a source, so my child can easily browse and play videos organized by show or category.
- As a parent, I want to control how many folder levels are shown, and whether subfolders are flattened or require navigation.
- As a child, I want to see YouTube playlists, channels, and local folders as “folders” on the homepage, and easily browse their contents.

## Success Criteria

- Parent can add YouTube channels and playlists as sources in `videoSources.json`.
- Videos from YouTube sources are fetched and displayed in the order defined by the source (playlist order, channel order, or configurable).
- **Each YouTube channel and playlist source maintains a dedicated JSON cache file with all video details for that source.**
- Parent can add a local folder as a source, with support for subfolders and configurable maximum navigation depth.
- If `maxDepth` is 2, all videos in subfolders are shown together in a flat list; if 3, navigation is hierarchical.
- UI allows navigation into subfolders as needed.
- All configuration is via JSON for now; no admin UI required.

## Technical Requirements

- Update `videoSources.json` schema to support:
  - `type`: `"youtube_channel"`, `"youtube_playlist"`, `"local"`
  - `url` or `path` as appropriate
  - `maxDepth` for local sources
  - `sortOrder` for all sources
- Implement YouTube channel/playlist fetching (using YouTube Data API or scraping).
- **Cache all video details for each YouTube channel and playlist source in a dedicated JSON file (one per source) for efficient loading and minimal API usage.**
- Implement local folder scanning with subfolder support and flattening logic (no cache file needed for local sources).
- Update homepage (Kid Screen) to display sources as folders, and allow navigation as described.
- TypeScript interfaces for all new/updated config structures.
- Unit and integration tests for new source types and navigation logic.

## UI/UX Requirements

- Homepage shows each source as a folder/tile.
- Clicking a source shows its videos (or subfolders, if local and hierarchical).
- If a folder contains both files and subfolders, both are shown.
- If `maxDepth` is 2, all videos in subfolders are shown together in a flat list.
- If `maxDepth` is 3, navigation is hierarchical.
- Consistent styling with existing SafeTube UI.

## Testing Requirements

- Unit tests for YouTube source fetching and local folder scanning.
- Integration tests for navigation logic (including maxDepth behavior).
- User acceptance: parent can configure sources and see expected behavior in the app.

## Documentation Requirements

- Update `specifications.md` with new source types and navigation logic.
- Update `videoSources.json` example and schema documentation.
- **Document that each YouTube channel and playlist source maintains a dedicated JSON cache file with all video details.**
- Add migration notes for existing users (if needed). 