# Kid Screen PRD

## Overview
The Kid Screen is the main interface where children can browse and watch whitelisted videos. It features a YouTube-like layout with horizontal sections for different video sources and categories.

## User Stories
- As a child, I want to see my last watched video at the top so I can continue watching it
- As a child, I want to see videos grouped by source (channels, playlists, folders) so I can easily find what I want to watch
- As a child, I want to distinguish between watched and unwatched videos so I know what's new
- As a parent, I want my child to only see whitelisted content so they stay safe

## Success Criteria
- All whitelisted video sources are displayed in their respective sections
- Last watched video appears at the top if available
- Watched videos are visually distinct from unwatched ones
- Videos are properly sorted according to source configuration
- UI is responsive and works well on different screen sizes
- Loading states are handled gracefully

## Technical Requirements
- React components for each section type
- Integration with video source configurations
- State management for video history
- Responsive grid layout system
- Image optimization for thumbnails
- Error handling for failed video loads

## Component Architecture

### Base Components
1. **VideoCardBase**
   - Base component for all video cards
   - Props:
     - thumbnail: string (URL)
     - title: string
     - duration: number | null (in seconds)
     - resumeAt: number | null (in seconds)
     - watched: boolean
     - type: 'youtube' | 'dlna' | 'local' | etc.
     - progress: number (0-100)

2. **VideoCardYouTube**
   - Extends VideoCardBase
   - YouTube-specific features and styling

3. **VideoCardDlna**
   - Extends VideoCardBase
   - DLNA-specific features and styling

4. **VideoCardLocal**
   - Extends VideoCardBase
   - Local file-specific features and styling

### Layout Components
1. **VideoGrid**
   - Displays videos in a responsive grid
   - Groups videos by type
   - Ensures first video of each type doesn't wrap
   - Props:
     - videos: VideoCardBase[]
     - groupByType: boolean

2. **VideoSection**
   - Container for a group of related videos
   - Props:
     - title: string
     - videos: VideoCardBase[]
     - type: string

## UI/UX Requirements
- Clean, distraction-free interface
- Large, easy-to-click video thumbnails
- Clear visual hierarchy
- Consistent spacing and alignment
- Loading skeletons for better UX

### Video Card Design
- Thumbnail with 16:9 aspect ratio
- Title below thumbnail
- Duration badge in bottom-right corner of thumbnail
- Progress bar overlay on thumbnail for partially watched videos
- Visual indicator for watched videos (e.g., colored border or overlay)
- Resume indicator for partially watched videos
- Source type indicator (small icon or badge)

### Watched Status Rules
- A video is considered "watched" if:
  - User has watched 95% of the video duration
  - OR user has watched until the last 30 seconds of the video
  - OR user has manually marked it as watched
- Progress tracking:
  - Progress bar shows percentage watched
  - Resume position is saved when video is paused/stopped
  - Progress updates every 5 seconds while watching

### Layout Design
- Videos are displayed in a responsive grid
- Each video source type starts on a new row
- Grid adjusts columns based on screen size:
  - Mobile: 1 column
  - Tablet: 2-3 columns
  - Desktop: 4-6 columns
- Last watched video appears in a featured section at the top
- Source type headers are sticky when scrolling

## Testing Requirements
- Unit tests for all React components
- Integration tests for video source loading
- E2E tests for main user flows
- Performance testing for large video lists
- Accessibility testing (WCAG compliance)
- Cross-browser testing

## Documentation Requirements
- Component documentation
- State management documentation
- Configuration file format documentation
- Video source integration guide
- UI component library documentation 