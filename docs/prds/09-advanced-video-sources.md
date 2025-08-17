# Advanced Video Sources & Local Folder Navigation PRD

## Overview

This feature expands SafeTube's video source system to support:
- Fetching and displaying videos from YouTube channels and playlists as configurable sources.
- Treating YouTube playlists and channels as "folders" on the homepage, with videos shown in the order defined by the source.
- Advanced local folder navigation, including support for subfolders, configurable maximum navigation depth, and automatic flattening of deeper content for easier access to videos in nested folders.
- **YouTube channel and playlist sources cache all video details in a dedicated JSON file per source for efficient loading and minimal API usage.**
- **Local folder sources are scanned on demand and do not require a cache file.**

## User Stories

- As a parent, I want to add a YouTube channel or playlist as a source, so my child can browse and watch only the videos I approve.
- As a parent, I want to configure a local folder (with optional subfolders) as a source, so my child can easily browse and play videos organized by show or category.
- As a parent, I want to control how many folder levels are shown, with deeper content automatically flattened at the maximum depth.
- As a child, I want to see YouTube playlists, channels, and local folders as "folders" on the homepage, and easily browse their contents.

## Success Criteria

- Parent can add YouTube channels and playlists as sources in `videoSources.json`.
- Videos from YouTube sources are fetched and displayed in the order defined by the source (playlist order, channel order, or configurable).
- **Each YouTube channel and playlist source maintains a dedicated JSON cache file with all video details for that source.**
- Parent can add a local folder as a source, with support for subfolders and configurable maximum navigation depth.
- The `maxDepth` setting controls both navigation depth AND flattening behavior: when the user reaches the maximum depth, all deeper content (subfolders and files) is automatically flattened and displayed together.
- UI allows navigation into subfolders up to the configured maximum depth.
- All configuration is via JSON for now; no admin UI required.

## Technical Requirements

- Update `videoSources.json` schema to support:
  - `type`: `"youtube_channel"`, `"youtube_playlist"`, `"local"`
  - `url` or `path` as appropriate
  - `maxDepth` for local sources (controls both navigation depth and flattening behavior)
  - `sortOrder` for all sources
- Implement YouTube channel/playlist fetching (using YouTube Data API or scraping).
- **Cache all video details for each YouTube channel and playlist source in a dedicated JSON file (one per source) for efficient loading and minimal API usage.**
- Implement local folder scanning with subfolder support and automatic flattening logic at maxDepth (no cache file needed for local sources).
- Update homepage (Kid Screen) to display sources as folders, and allow navigation as described.
- TypeScript interfaces for all new/updated config structures.
- Unit and integration tests for new source types and navigation logic.

## UI/UX Requirements

- Homepage shows each source as a folder/tile.
- Clicking a source shows its videos (or subfolders, if local and hierarchical).
- If a folder contains both files and subfolders, both are shown.
- **Local folder navigation behavior based on `maxDepth`:**
  - `maxDepth: 1` - User sees main folder with all subfolder content flattened
  - `maxDepth: 2` - User can navigate to depth 2, and at that depth all deeper content is flattened
  - `maxDepth: 3` - User can navigate to depth 3, and at that depth all deeper content is flattened
  - Higher values provide more organized, hierarchical navigation
  - Lower values provide more consolidated, flattened views
- Consistent styling with existing SafeTube UI.

## Testing Requirements

- Unit tests for YouTube source fetching and local folder scanning.
- Integration tests for navigation logic (including maxDepth behavior and flattening at depth limits).
- User acceptance: parent can configure sources and see expected behavior in the app.

## Documentation Requirements

- Update `specifications.md` with new source types and navigation logic.
- Update `videoSources.json` example and schema documentation.
- **Document that each YouTube channel and playlist source maintains a dedicated JSON cache file with all video details.**
- **Document that `maxDepth` for local sources controls both navigation depth and automatic flattening behavior.**
- Add migration notes for existing users (if needed). 