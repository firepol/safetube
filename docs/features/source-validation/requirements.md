# Requirements Document

## Introduction

The Source-Based Video Access Control feature enhances SafeTube's parental control system by ensuring that videos can only be accessed if they originate from approved video sources. This feature prevents children from watching videos whose channels are not explicitly approved by parents, even when those videos appear in History, Favorites, or as related YouTube content. The implementation provides robust validation at both the display and playback levels, with clear visual indicators for unavailable content and user-friendly error messaging.

## Requirements

### Requirement 1: Source Validation for History Videos
**User Story:** As a parent, I want videos in the History page that are no longer from approved sources to be visually disabled so my child cannot play unauthorized content

#### Acceptance Criteria
1. WHEN a video in History has a sourceId that does not exist in videoSources.json THEN the system SHALL display the video card in a grayed-out state
2. WHEN a video card is grayed out THEN the system SHALL apply 50% opacity to the entire card
3. WHEN a video card is grayed out THEN the system SHALL change the cursor to "not-allowed" on hover
4. WHEN a video card is grayed out THEN the system SHALL prevent all click interactions
5. WHEN a video card is grayed out THEN the system SHALL display a visual indicator icon showing unavailability

### Requirement 2: Source Validation for Favorited Videos
**User Story:** As a parent, I want favorited videos that are no longer from approved sources to be visually disabled so my child cannot play unauthorized content

#### Acceptance Criteria
1. WHEN a video in Favorites has a sourceId that does not exist in videoSources.json THEN the system SHALL display the video card in a grayed-out state
2. WHEN a favorited video is unavailable THEN the system SHALL maintain the favorite star indicator but disable interaction
3. WHEN a favorited video becomes available again THEN the system SHALL automatically restore normal display and playback
4. WHEN displaying unavailable favorites THEN the system SHALL apply consistent visual treatment with History page
5. WHEN a user attempts to unfavorite an unavailable video THEN the system SHALL allow the unfavorite action

### Requirement 3: Source ID Tracking in Favorites
**User Story:** As a developer, I want all favorited videos to store their source ID so the system can validate source availability

#### Acceptance Criteria
1. WHEN a video is added to favorites THEN the system SHALL store the sourceId field
2. WHEN reading existing favorites without sourceId THEN the system SHALL attempt to derive sourceId from video metadata
3. WHEN a sourceId cannot be determined THEN the system SHALL mark the favorite as unavailable
4. WHEN migrating existing favorites THEN the system SHALL preserve all existing favorite data
5. WHEN saving favorites data THEN the system SHALL validate sourceId is a non-empty string

### Requirement 4: Channel ID Storage for YouTube Sources
**User Story:** As a developer, I want YouTube channel sources to store their channelId so the system can validate video channel membership

#### Acceptance Criteria
1. WHEN creating a YouTube channel source THEN the system SHALL fetch and store the channelId from YouTube API
2. WHEN a YouTube channel source is loaded THEN the system SHALL include the channelId in the source data
3. WHEN a YouTube API call fails to retrieve channelId THEN the system SHALL display an appropriate error message
4. WHEN editing a YouTube channel source THEN the system SHALL preserve the existing channelId
5. WHEN channelId is missing for a channel source THEN the system SHALL attempt to fetch it on next load

### Requirement 5: YouTube Click Control Setting
**User Story:** As a parent, I want to control whether my child can click on videos in the YouTube iframe based on channel approval

#### Acceptance Criteria
1. WHEN the settings page loads THEN the system SHALL display "Block clicks to non-approved channels" checkbox in mainSettings
2. WHEN the setting is enabled (checked) THEN the system SHALL block all YouTube video clicks in iframe
3. WHEN the setting is disabled (unchecked) THEN the system SHALL validate clicked video's channelId against approved sources
4. WHEN the setting value changes THEN the system SHALL save to mainSettings.json immediately
5. WHEN mainSettings.json is missing the setting THEN the system SHALL default to enabled (most restrictive)

### Requirement 6: YouTube Click Validation
**User Story:** As a parent, I want clicks on YouTube videos in the iframe to be validated against approved channel sources when the less restrictive mode is enabled

#### Acceptance Criteria
1. WHEN a user clicks a YouTube video link in iframe AND setting is disabled THEN the system SHALL extract the video ID from the URL
2. WHEN a video ID is extracted THEN the system SHALL fetch video metadata including channelId from YouTube API
3. WHEN video metadata is fetched THEN the system SHALL check if channelId exists in any approved YouTube channel source
4. WHEN channelId is NOT found in approved sources THEN the system SHALL block playback and display error dialog
5. WHEN channelId IS found in approved sources THEN the system SHALL allow video playback

### Requirement 7: Playlist Video Validation
**User Story:** As a parent, I want videos from playlist sources to always be allowed since playlists are explicitly approved

#### Acceptance Criteria
1. WHEN a video belongs to a playlist source THEN the system SHALL allow playback regardless of channelId
2. WHEN validating a video with sourceType "youtube_playlist" THEN the system SHALL skip channel validation
3. WHEN a playlist contains videos from multiple channels THEN the system SHALL allow all videos in the playlist
4. WHEN checking source validity for playlist videos THEN the system SHALL only verify the playlist source exists
5. WHEN a playlist source is deleted THEN the system SHALL mark all playlist videos as unavailable

### Requirement 8: Local Video Source Validation
**User Story:** As a parent, I want local videos to be validated based on their folder source availability

#### Acceptance Criteria
1. WHEN a local video has a sourceId THEN the system SHALL check if that sourceId exists in local sources
2. WHEN a local video's folder source is deleted THEN the system SHALL mark the video as unavailable
3. WHEN validating local videos THEN the system SHALL check parent folder path matches source path
4. WHEN a local source path changes THEN the system SHALL update affected video availability
5. WHEN local video has no sourceId THEN the system SHALL attempt to match by file path prefix

### Requirement 9: Error Messaging for Blocked Videos
**User Story:** As a child, I want to understand why a video is blocked with a friendly and clear message

#### Acceptance Criteria
1. WHEN a video is blocked due to channel validation THEN the system SHALL display "This video's channel is not approved"
2. WHEN a video is blocked due to missing source THEN the system SHALL display "This video is no longer available"
3. WHEN displaying error messages THEN the system SHALL use child-friendly language and tone
4. WHEN an error dialog is shown THEN the system SHALL provide a clear "OK" or "Close" button
5. WHEN an error occurs THEN the system SHALL log technical details for parent/admin troubleshooting

### Requirement 10: Visual Unavailability Indicators
**User Story:** As a child, I want to clearly see which videos are unavailable before trying to click them

#### Acceptance Criteria
1. WHEN a video is unavailable THEN the system SHALL apply consistent visual treatment across all pages
2. WHEN displaying unavailable videos THEN the system SHALL use 50% opacity for the entire card
3. WHEN hovering unavailable videos THEN the system SHALL show "not-allowed" cursor
4. WHEN unavailable videos are shown THEN the system SHALL display a lock icon or similar indicator
5. WHEN mixing available and unavailable videos THEN the system SHALL maintain clear visual distinction

### Requirement 11: Performance and Caching
**User Story:** As a user, I want video availability checks to be fast and not impact the viewing experience

#### Acceptance Criteria
1. WHEN loading a page with many videos THEN the system SHALL complete source validation within 500ms
2. WHEN video sources are loaded THEN the system SHALL cache source IDs and channelIds in memory
3. WHEN validating multiple videos THEN the system SHALL batch validation operations
4. WHEN source configuration changes THEN the system SHALL invalidate and refresh validation cache
5. WHEN performing YouTube API calls THEN the system SHALL implement request throttling to avoid rate limits

### Requirement 12: Data Migration and Backwards Compatibility
**User Story:** As an existing SafeTube user, I want my favorites and history to work correctly after upgrading

#### Acceptance Criteria
1. WHEN upgrading from a version without sourceId in favorites THEN the system SHALL migrate existing favorites
2. WHEN favorites are missing sourceId THEN the system SHALL attempt to populate from watch history
3. WHEN watch history has source field THEN the system SHALL use it to populate favorite sourceId
4. WHEN migration fails for a favorite THEN the system SHALL mark it as unavailable but preserve the entry
5. WHEN channelId is missing from YouTube sources THEN the system SHALL fetch it on first validation attempt

### Requirement 13: Settings UI Integration
**User Story:** As a parent, I want to easily configure YouTube click control from the settings interface

#### Acceptance Criteria
1. WHEN viewing settings page THEN the system SHALL display "YouTube Click Control" section
2. WHEN the section is displayed THEN the system SHALL show checkbox with clear label and description
3. WHEN the checkbox label is clicked THEN the system SHALL toggle the setting value
4. WHEN the setting changes THEN the system SHALL show visual confirmation of save
5. WHEN hovering over the setting THEN the system SHALL display tooltip explaining the behavior difference

### Requirement 14: Admin Controls and Overrides
**User Story:** As a parent, I want to review and manage unavailable favorites and history items

#### Acceptance Criteria
1. WHEN accessing admin settings THEN the system SHALL display count of unavailable favorites
2. WHEN accessing admin settings THEN the system SHALL provide option to clear unavailable favorites
3. WHEN clearing unavailable items THEN the system SHALL show confirmation dialog with item count
4. WHEN confirmation is accepted THEN the system SHALL remove unavailable items and show success message
5. WHEN viewing unavailable items THEN the system SHALL display which source is missing

### Requirement 15: Error Recovery and Resilience
**User Story:** As a developer, I want the validation system to handle errors gracefully without breaking the app

#### Acceptance Criteria
1. WHEN YouTube API is unavailable THEN the system SHALL fall back to existing behavior (block all clicks if enabled)
2. WHEN source validation fails due to error THEN the system SHALL default to marking video as available with warning log
3. WHEN invalid sourceId format is encountered THEN the system SHALL handle gracefully and mark as unavailable
4. WHEN videoSources.json is corrupted THEN the system SHALL mark all videos as unavailable until fixed
5. WHEN encountering validation errors THEN the system SHALL provide clear error context in logs for debugging