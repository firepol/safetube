# Requirements Document

## Introduction

The favorites-fixes feature addresses two critical issues in the existing SafeTube favorites implementation:

1. **Missing YouTube Video Favorites**: Currently, favorites only work properly for local videos. YouTube videos from both the iframe and embedded players cannot be favorited due to architectural gaps in player integration and video metadata handling.

2. **Broken Local Video Thumbnails**: Local video thumbnails display "Video unavailable" instead of proper thumbnails due to incomplete thumbnail generation and serving mechanisms.

This feature ensures that ALL video types (YouTube, local, DLNA) can be favorited consistently and that local video thumbnails display correctly throughout the application.

## Requirements

### Requirement 1: YouTube Iframe Player Favorites Integration
**User Story:** As a child, I want to add YouTube videos from the iframe player to my favorites so that I can easily find them again

#### Acceptance Criteria
1. WHEN watching a YouTube video in the iframe player THEN the system SHALL display a functional favorite button
2. WHEN clicking the favorite button in the iframe player THEN the system SHALL add the YouTube video to favorites with proper metadata
3. WHEN the YouTube video is favorited THEN the system SHALL store the correct video ID, title, thumbnail, and duration
4. WHEN navigating back to video grids THEN favorited YouTube videos SHALL display the star icon correctly
5. WHEN accessing the favorites source THEN YouTube videos SHALL appear with proper thumbnails and metadata

### Requirement 2: YouTube Embedded Player Favorites Integration
**User Story:** As a child, I want to add YouTube videos from the embedded player to my favorites so that I have consistent favoriting across all players

#### Acceptance Criteria
1. WHEN watching a YouTube video in the embedded player THEN the system SHALL display a functional favorite button
2. WHEN clicking the favorite button in the embedded player THEN the system SHALL add the YouTube video to favorites with proper metadata
3. WHEN favoriting from embedded player THEN the system SHALL use the same video identification as iframe player
4. WHEN switching between player types THEN favorite status SHALL remain consistent
5. WHEN favorited YouTube videos are played THEN the system SHALL route to the appropriate player type

### Requirement 3: YouTube Video Metadata Preservation
**User Story:** As a child, I want my favorited YouTube videos to show proper titles and thumbnails so that I can recognize them easily

#### Acceptance Criteria
1. WHEN adding a YouTube video to favorites THEN the system SHALL capture title, thumbnail URL, and duration from the video metadata
2. WHEN displaying favorited YouTube videos THEN the system SHALL show high-quality thumbnails from YouTube's servers
3. WHEN YouTube thumbnails fail to load THEN the system SHALL gracefully fallback to placeholder thumbnails
4. WHEN favorited videos become unavailable THEN the system SHALL handle errors gracefully without breaking the UI
5. WHEN favorites are accessed offline THEN cached metadata SHALL be used when available

### Requirement 4: Local Video Thumbnail Generation Fix
**User Story:** As a child, I want to see proper thumbnails for my local videos so that I can identify them visually

#### Acceptance Criteria
1. WHEN local videos are scanned THEN the system SHALL generate thumbnail images from video frames
2. WHEN local video thumbnails are generated THEN they SHALL be cached properly for future access
3. WHEN displaying local videos THEN the system SHALL serve cached thumbnails correctly
4. WHEN thumbnail generation fails THEN the system SHALL use appropriate fallback icons
5. WHEN thumbnails are corrupted THEN the system SHALL regenerate them automatically

### Requirement 5: Local Video Thumbnail Serving Fix
**User Story:** As a child, I want local video thumbnails to load correctly without showing "Video unavailable" messages

#### Acceptance Criteria
1. WHEN local video thumbnails exist THEN they SHALL be served through the proper file protocol
2. WHEN the thumbnail service serves images THEN they SHALL use correct MIME types and headers
3. WHEN thumbnails are requested THEN the system SHALL verify file existence before serving
4. WHEN thumbnail files are missing THEN the system SHALL return appropriate fallback responses
5. WHEN local videos are favorited THEN their thumbnails SHALL display correctly in the favorites view

### Requirement 6: Cross-Player Video Identification Consistency
**User Story:** As a child, I want YouTube videos to maintain the same favorite status regardless of which player opened them

#### Acceptance Criteria
1. WHEN a YouTube video is favorited in iframe player THEN it SHALL show as favorited in embedded player
2. WHEN video IDs are processed THEN the system SHALL normalize them consistently across all players
3. WHEN switching between player types THEN favorite status SHALL be preserved accurately
4. WHEN videos are accessed from different sources THEN video identification SHALL remain consistent
5. WHEN favorites are toggled THEN the change SHALL be reflected immediately in all UI components

### Requirement 7: Player Page Favorites Integration
**User Story:** As a child, I want to add or remove favorites while watching any type of video

#### Acceptance Criteria
1. WHEN viewing a YouTube video in YouTubePlayerPage THEN the system SHALL display the favorite button
2. WHEN viewing a YouTube video in PlayerPage THEN the system SHALL display the favorite button
3. WHEN viewing a local video THEN the system SHALL display the favorite button
4. WHEN favorite status changes in player THEN the system SHALL update immediately with visual feedback
5. WHEN player pages load THEN favorite status SHALL be determined correctly for all video types

### Requirement 8: Video Grid Favorites Status Accuracy
**User Story:** As a child, I want to see accurate favorite status indicators on all video cards

#### Acceptance Criteria
1. WHEN YouTube videos are displayed in grids THEN favorite stars SHALL appear correctly for favorited videos
2. WHEN local videos are displayed in grids THEN favorite stars SHALL appear correctly for favorited videos
3. WHEN videos are toggled in grids THEN star status SHALL update immediately across all grid instances
4. WHEN favorites source is accessed THEN all favorited videos SHALL show filled stars
5. WHEN favorited videos appear in other sources THEN they SHALL display favorite indicators

### Requirement 9: Thumbnail Cache Management
**User Story:** As a parent, I want the system to manage video thumbnails efficiently without consuming excessive disk space

#### Acceptance Criteria
1. WHEN local video thumbnails are generated THEN they SHALL be stored in the designated cache directory
2. WHEN thumbnail cache exceeds size limits THEN the system SHALL clean up old thumbnails automatically
3. WHEN local videos are deleted THEN their cached thumbnails SHALL be cleaned up
4. WHEN thumbnail cache is corrupted THEN the system SHALL regenerate thumbnails gracefully
5. WHEN cache management runs THEN it SHALL not impact video playback performance

### Requirement 10: Error Handling and Recovery
**User Story:** As a child, I want the favorites feature to work reliably even when some videos become unavailable

#### Acceptance Criteria
1. WHEN YouTube videos become private or deleted THEN they SHALL remain in favorites with fallback display
2. WHEN local videos are moved or deleted THEN favorites SHALL handle the situation gracefully
3. WHEN network connectivity is lost THEN cached favorite data SHALL continue to work
4. WHEN thumbnail generation fails THEN the system SHALL retry automatically when possible
5. WHEN favorites data is corrupted THEN the system SHALL recover from backups when available

### Requirement 11: Performance and Scalability
**User Story:** As a child, I want the favorites feature to work quickly even with many favorited videos

#### Acceptance Criteria
1. WHEN loading favorites with many YouTube videos THEN the system SHALL load thumbnails asynchronously
2. WHEN checking favorite status for videos THEN the system SHALL use efficient caching strategies
3. WHEN displaying large numbers of favorites THEN the UI SHALL remain responsive
4. WHEN generating local video thumbnails THEN the process SHALL not block the main UI thread
5. WHEN managing thumbnail cache THEN operations SHALL be optimized for performance

### Requirement 12: Data Consistency and Integrity
**User Story:** As a parent, I want my child's favorite video data to be stored reliably and consistently

#### Acceptance Criteria
1. WHEN favorites are added or removed THEN the data SHALL be persisted atomically
2. WHEN multiple favorite operations occur simultaneously THEN data integrity SHALL be maintained
3. WHEN application restarts THEN all favorite data SHALL be preserved correctly
4. WHEN favorites configuration is modified THEN changes SHALL be validated before saving
5. WHEN data migration is needed THEN existing favorites SHALL be preserved during upgrades