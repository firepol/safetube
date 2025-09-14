# Favorites PRD

## Overview
The Favorites feature allows children to bookmark videos from any source (YouTube channels, playlists, local files, DLNA) for quick and easy access. Favorites are stored in a dedicated JSON file with complete video metadata, eliminating the need to fetch data when displaying the favorites collection. The feature integrates seamlessly with the existing video grid system as a separate source, similar to History and Downloaded.

## User Stories
- As a child, I want to save my favorite videos so that I can easily find and watch them again
- As a child, I want to add videos to favorites with a simple star button so that it's easy to bookmark content I like
- As a child, I want to remove videos from favorites when I no longer want them saved
- As a child, I want to see all my favorite videos in one place so that I can quickly choose what to watch
- As a parent, I want my child to be able to curate their own collection of appropriate content
- As a parent, I want favorites to work with all video sources so that my child can bookmark any approved content

## Success Criteria
- Children can add any video from any source to favorites with a single click
- Children can remove videos from favorites with a clear, distinguishable button
- Favorited videos are visually distinct from non-favorited videos
- Favorites appear as a separate source in the main video grid
- All favorited videos display with complete metadata without requiring additional data fetching
- Favorites persist across app restarts and crashes
- Favorites integrate seamlessly with existing video playback infrastructure
- The favorites list supports pagination for large collections
- Star buttons are intuitive and follow established UI patterns

## Technical Requirements

### Core Functionality
- **JSON Storage System**: Favorites stored in `config/favorites.json` with complete video metadata
- **Cross-Source Support**: Works with YouTube channels, playlists, local files, and DLNA sources
- **Unique Video Identification**: Uses existing video ID system for consistent identification across sources
- **Metadata Storage**: Store title, thumbnail, duration, source info, and URL/path for each favorite
- **Duplicate Prevention**: Prevent duplicate favorites and handle edge cases gracefully
- **Data Persistence**: Automatic backup and recovery mechanisms following existing patterns

### Data Structure
```typescript
interface FavoriteVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number; // seconds
  sourceType: 'youtube_channel' | 'youtube_playlist' | 'local';
  sourceId: string;
  sourceName: string;
  url?: string; // for YouTube videos
  path?: string; // for local videos
  dateAdded: string; // ISO date string
}
```

### Integration Requirements
- **Source System Integration**: Favorites appear as additional source in main video grid
- **Player Integration**: Favorited videos work with existing MediaSource and iframe players
- **History Integration**: Favorited videos integrate with watch history and resume functionality
- **Time Tracking**: Favorited videos respect time limits and contribute to daily usage tracking

### File Management
- **Configuration File**: `config/favorites.json` following existing JSON configuration patterns
- **Backup System**: Automatic backup before modifications using existing fileUtils
- **Error Handling**: Graceful handling of corrupted files, missing data, and write failures
- **Type Safety**: Full TypeScript interfaces and validation

## UI/UX Requirements

### Star Button Implementation
- **Add to Favorites**: ⭐ "Add to Favorites" button with star emoji, visible on non-favorited videos
- **Remove from Favorites**: "Remove from ⭐" button with danger styling (red with opacity), visible only on favorited videos
- **Button Placement**: Positioned below video title in VideoCardBase component, integrated naturally
- **Visual States**: Clear visual distinction between add/remove states using color and opacity
- **Hover Effects**: Appropriate hover states that match existing button patterns
- **Accessibility**: Proper ARIA labels and keyboard navigation support

### Favorites Source Page
- **Source Integration**: Appears as "Favorites" source in main video grid alongside other sources
- **Thumbnail Display**: Uses star icon or aggregated thumbnail for source representation
- **Video Grid Layout**: Standard video grid layout matching other sources
- **Sorting**: Videos sorted by date added (newest first) by default
- **Pagination**: Standard pagination for collections larger than 50 videos
- **Empty State**: Appropriate messaging and visual design when no favorites exist

### Visual Design Consistency
- **Star Icon**: Consistent use of ⭐ emoji throughout the interface
- **Color Scheme**: Danger/warning colors for remove button (red with ~60% opacity)
- **Typography**: Follow existing font hierarchy and sizing
- **Spacing**: Consistent spacing with other UI elements in VideoCardBase
- **Animations**: Smooth transitions for button state changes

### User Flow
1. Child browses any video source
2. Child sees "Add to Favorites ⭐" button on video cards
3. Child clicks star button to add video to favorites
4. Button changes to "Remove from ⭐" with danger styling
5. Child can navigate to Favorites source to see all saved videos
6. Child can remove favorites by clicking the remove button on favorited videos

## Testing Requirements

### Unit Tests
- Favorites data management functions (add, remove, list, validate)
- TypeScript interface validation and type safety
- JSON file operations and error handling
- Duplicate prevention logic
- Cross-source video ID handling

### Integration Tests
- Favorites integration with existing video sources
- Star button functionality across all video types
- Favorites source page navigation and display
- Video playback from favorites collection
- Data persistence across app restarts

### UI Tests
- Star button visibility and state changes
- Visual distinction between favorited and non-favorited videos
- Favorites source page layout and functionality
- Error handling for corrupted favorites data
- Accessibility compliance for star buttons and favorites page

### Performance Tests
- Large favorites collection handling (1000+ videos)
- Favorites data loading and display performance
- Memory usage with extensive favorites metadata
- UI responsiveness during favorites operations

## Implementation Plan

### Phase 1: Core Data Layer
- Create FavoriteVideo TypeScript interface in shared/types.ts
- Implement favorites management functions (add, remove, list, load, save)
- Create favorites.json configuration file structure
- Add comprehensive unit tests for data layer

### Phase 2: UI Integration
- Add star button to VideoCardBase component with state management
- Implement add/remove favorites functionality in UI
- Create visual states for favorited vs non-favorited videos
- Add hover effects and accessibility features

### Phase 3: Favorites Source
- Create Favorites source integration with existing source system
- Implement Favorites page component with video grid layout
- Add pagination support for large favorites collections
- Integrate with existing routing and navigation system

### Phase 4: Polish and Testing
- Complete integration testing across all video sources
- Performance optimization for large favorites collections
- Error handling and edge case resolution
- Accessibility improvements and keyboard navigation

## Dependencies
- Existing video source system and VideoCardBase component
- JSON configuration management and fileUtils
- Video player infrastructure (MediaSource and iframe players)
- TypeScript type system and shared interfaces
- Routing system and navigation components

## Risks and Mitigation
- **Storage Space**: Favorites metadata could grow large with extensive collections
  - *Mitigation*: Implement data cleanup and size monitoring
- **Data Corruption**: JSON file corruption could lose all favorites
  - *Mitigation*: Use existing backup system and validation
- **Performance Impact**: Large favorites collections could slow UI
  - *Mitigation*: Implement pagination and lazy loading
- **Cross-Source Compatibility**: Different video sources may have inconsistent metadata
  - *Mitigation*: Robust data validation and fallback handling

## Future Enhancements
- Favorites organization with custom categories or tags
- Export/import functionality for favorites backup
- Sharing favorites between different user profiles
- Smart recommendations based on favorited content
- Bulk favorites management (select multiple, clear all, etc.)
- Favorites search and filtering functionality