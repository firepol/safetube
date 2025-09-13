# YouTube Video Download PRD

## Overview
The YouTube Video Download feature allows users to download YouTube videos for offline viewing using yt-dlp. Downloaded videos are organized by source (channel or playlist) and stored in a dedicated "Downloaded" local source, separate from the original YouTube sources to keep them clean. The feature provides background downloading with progress tracking and a unified download management system.

## User Stories
- As a parent, I want to download YouTube videos for offline viewing so that my child can watch content without internet access
- As a parent, I want downloaded videos organized by channel/playlist so that I can easily find and manage them
- As a user, I want to see download progress in real-time so that I know when videos will be available
- As a user, I want to prevent duplicate downloads so that I don't waste storage space
- As a parent, I want to configure the download location so that I can manage storage effectively
- As a parent, I want downloaded videos to appear in a separate source so that they don't clutter the original YouTube sources

## Success Criteria
- Users can download YouTube videos with a single click from the player page
- Downloaded videos are automatically organized by source (channel/playlist)
- Download progress is displayed in real-time with visual feedback
- Duplicate downloads are prevented automatically
- Downloaded videos appear in a dedicated "Downloaded" source
- Download location is configurable through the admin interface
- Background downloads don't block the UI
- Downloaded videos integrate seamlessly with existing playback system
- Download status persists across app restarts

## Technical Requirements

### Core Functionality
- **yt-dlp Integration**: Use existing yt-dlp dependency for video downloading
- **Background Processing**: Non-blocking download process with progress tracking
- **File Organization**: Automatic folder structure based on source type and hierarchy
- **Duplicate Prevention**: Track download status to prevent re-downloading
- **Progress Tracking**: Real-time progress updates with percentage and status
- **Error Handling**: Graceful handling of download failures with retry options

### File Organization Logic
- **Default Location**: `%USERPROFILE%/Videos/SafeTube/` (Windows) or equivalent on other platforms
- **Channel Videos**: Saved to `Downloaded/{channel-title}/`
- **Playlist Videos**: Saved to `Downloaded/{playlist-title}/`
- **Channel Priority**: If video belongs to both playlist and channel, save to channel folder
- **Folder Creation**: Create folders only when first download is initiated

### Configuration System
- **Main Settings JSON**: New `mainSettings.json` configuration file
- **Download Path**: Configurable download location with validation
- **Admin Interface**: New "Main Settings" tab in admin page
- **Default Values**: Sensible defaults with user customization options

### Integration Requirements
- **Source System**: Integrate with existing video source loading system
- **Player Integration**: Downloaded videos work with existing player infrastructure
- **History Tracking**: Downloaded videos integrate with watch history system
- **Time Tracking**: Downloaded videos respect time limits and tracking

## UI/UX Requirements

### Player Page Integration
- **Download Button**: Centered under video area, similar to convert button styling
- **Download Status**: Progress indicator under video area when downloading
- **Visual Consistency**: Match existing conversion UI styling and behavior
- **Button States**: Disabled state when already downloaded or downloading

### Admin Interface
- **Main Settings Tab**: New tab in admin page for global settings
- **Download Path Configuration**: File picker for download location
- **Path Validation**: Real-time validation of selected download path
- **Default Path Display**: Show current default path with option to reset

### Progress Feedback
- **Real-time Updates**: Progress bar with percentage and speed
- **Status Messages**: Clear status messages (downloading, completed, failed)
- **Error Display**: User-friendly error messages with retry options
- **Completion Notification**: Visual feedback when download completes

### Downloaded Source
- **Source Integration**: Appears as new source type in video grid
- **Folder Structure**: Organized display matching file system structure
- **Source Metadata**: Clear indication that videos are downloaded
- **Navigation**: Seamless navigation between downloaded and online sources

## Testing Requirements

### Unit Tests
- Download status tracking and duplicate prevention
- File organization logic for different source types
- Configuration file handling and validation
- Progress tracking and status updates

### Integration Tests
- yt-dlp integration and error handling
- File system operations and folder creation
- Source system integration with downloaded videos
- Player integration with downloaded video files

### End-to-End Tests
- Complete download workflow from player page
- Admin configuration and path changes
- Downloaded source navigation and playback
- Error scenarios and recovery

### Performance Tests
- Background download performance impact
- Large file download handling
- Multiple concurrent downloads
- Storage space management

## Documentation Requirements

### User Documentation
- Download feature usage guide
- Admin configuration instructions
- Troubleshooting common issues
- Storage management recommendations

### Technical Documentation
- yt-dlp integration details
- File organization algorithm
- Configuration file format
- API endpoints and IPC communication

### Configuration Documentation
- Main settings JSON schema
- Download path configuration options
- Default values and validation rules
- Migration guide for existing installations

## Implementation Plan

### Phase 1: Core Infrastructure
- Create mainSettings.json configuration system
- Implement download status tracking
- Add yt-dlp download functionality
- Create background download process

### Phase 2: UI Integration
- Add download button to player page
- Implement progress tracking UI
- Create admin interface for main settings
- Add downloaded source to video grid

### Phase 3: File Organization
- Implement folder structure logic
- Add source type detection
- Create downloaded source integration
- Implement duplicate prevention

### Phase 4: Polish and Testing
- Add comprehensive error handling
- Implement retry mechanisms
- Add progress persistence
- Complete testing suite

## Dependencies
- Existing yt-dlp integration
- Video source system
- Admin page infrastructure
- File system utilities
- IPC communication system
- Configuration management

## Risks and Mitigation
- **Storage Space**: Implement storage monitoring and warnings
- **Download Failures**: Robust error handling and retry mechanisms
- **Performance Impact**: Background processing with resource limits
- **File Corruption**: Validation and integrity checks
- **Network Issues**: Graceful handling of connectivity problems

## Future Enhancements
- Batch download functionality
- Download quality selection
- Automatic cleanup of old downloads
- Download scheduling
- Bandwidth limiting
- Download resume capability
