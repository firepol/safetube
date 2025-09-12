# Video History PRD

## Overview
The Video History feature tracks and manages the viewing history of videos across all sources, enabling resume functionality and providing visual distinction between watched and unwatched content.

## User Stories
- As a child, I want to see which videos I've already watched
- As a child, I want to continue watching videos from where I left off
- As a parent, I want to know what content my child has been watching
- As a child, I want to easily find new content I haven't watched yet

## Success Criteria
- Watch history is accurately tracked for all video sources
- Video positions are saved and restored correctly
- Watched videos are clearly distinguished from unwatched ones
- History data persists across app restarts
- Resume functionality works reliably
- History is organized by date and source
- History data is properly backed up

## Technical Requirements
- JSON-based history storage with duration and watched status
- Position tracking per video
- Source-specific video identification
- History data validation
- Backup and recovery mechanism
- History cleanup/management
- Cross-source history tracking
- Video duration extraction for local files using ffprobe
- Watched status calculation based on position vs duration thresholds

## UI/UX Requirements
- Clear visual distinction for watched videos
- Easy-to-use resume functionality
- Organized history view
- Non-intrusive history indicators
- Clear date and time information
- Intuitive history navigation
- Smooth transitions between states

### Watched Videos Folder
- "Watched" folder appears in each source (similar to subfolders in local sources)
- When clicked, shows watched videos from that source in same sort order as the source
- Partially watched videos highlighted with blue border
- Fully watched videos appear normal

### History Folder
- "History" folder appears as last "source" on KidScreen
- When clicked, shows all watched videos from newest to oldest
- Includes pagination for large history
- Partially watched videos highlighted with blue border
- Shows source information for each video

## Testing Requirements
- Unit tests for history tracking
- Integration tests for resume functionality
- E2E tests for history scenarios
- Data persistence testing
- Cross-source history testing
- Edge case testing
- Performance testing for large history

## Documentation Requirements
- History data format documentation
- Resume functionality guide
- History management documentation
- Backup and recovery guide
- Troubleshooting guide for history issues 