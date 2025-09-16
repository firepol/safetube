# Favorites PRD (Simplified Star/Unstar)

## Overview
The Favorites feature provides a simple and intuitive way for children to bookmark videos using star icons. Videos can be favorited/unfavorited through hover interactions on video cards or traditional buttons on player pages. The feature focuses purely on star/unstar functionality without complex playlist management, keeping the user experience simple and focused. Favorited videos appear as a separate source in the video grid, similar to History and Downloaded.

## User Stories
- As a child, I want to save my favorite videos with a simple star click so that I can easily find them again
- As a child, I want to see a star appear when I hover over videos so that I know I can favorite them
- As a child, I want favorited videos to show a star icon so that I can see which ones I've saved
- As a child, I want to unfavorite videos by clicking the star when I no longer want them saved
- As a child, I want to see all my favorite videos in one place so that I can quickly choose what to watch
- As a child, I want the star functionality to work the same way across all video types
- As a parent, I want my child to be able to curate their own simple collection of appropriate content

## Success Criteria
- Star hole (☆) appears on video card hover, indicating favoritability
- Single click on star hole adds video to favorites and shows filled star (⭐)
- Filled star (⭐) is always visible on favorited videos as overlay icon
- Single click on filled star removes video from favorites
- Player pages show traditional "Add to Favorites ⭐" / "Remove from ⭐" buttons
- Favorites appear as a separate source in the main video grid
- Star interactions work consistently across all video sources
- Favorites persist across app restarts and crashes
- Star functionality integrates seamlessly with existing video infrastructure
- The favorites list supports pagination for large collections

## Technical Requirements

### Core Functionality
- **Simplified JSON Storage**: Favorites stored in `config/favorites.json` with basic video ID list
- **Cross-Source Support**: Works with YouTube channels, playlists, local files, and DLNA sources
- **Unique Video Identification**: Uses existing video ID system for consistent identification across sources
- **Minimal Metadata**: Store only essential data (video ID, date added) - fetch full metadata when needed
- **Duplicate Prevention**: Simple set-based storage prevents duplicate favorites automatically
- **Data Persistence**: Automatic backup and recovery mechanisms following existing patterns

### Data Structure
```typescript
interface FavoriteVideo {
  videoId: string;
  dateAdded: string; // ISO date string
}

interface FavoritesConfig {
  favorites: FavoriteVideo[];
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

### Star Icon Implementation
- **Hover State**: Star hole (☆) appears on video card hover, positioned as overlay icon
- **Unfavorited Videos**: Show star hole on hover only, no permanent star visible
- **Favorited Videos**: Filled star (⭐) always visible as overlay icon, positioned like checkmark for watched videos
- **Click Behavior**: Click star hole to favorite, click filled star to unfavorite
- **Icon Placement**: Positioned as overlay icon in same area as watched video checkmarks
- **Visual Consistency**: Star overlays follow same styling patterns as existing video status overlays
- **Accessibility**: Proper ARIA labels and keyboard navigation support

### Player Page Integration
- **Traditional Buttons**: "Add to Favorites ⭐" / "Remove from ⭐" buttons on player pages
- **Button Styling**: Standard button styling consistent with existing player page buttons
- **Dynamic State**: Button text and functionality changes based on current favorite status

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
2. Child hovers over video card and sees star hole (☆) appear as overlay
3. Child clicks star hole to add video to favorites
4. Star hole immediately changes to filled star (⭐) and remains visible as overlay
5. Child can navigate to Favorites source to see all saved videos
6. Child can remove favorites by clicking the filled star (⭐) on favorited videos
7. On player pages, child can use traditional "Add to Favorites ⭐" / "Remove from ⭐" buttons

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

### Phase 1: Core Data Layer (Simplified)
- Create simplified FavoriteVideo TypeScript interface in shared/types.ts
- Implement basic favorites management functions (add, remove, isFavorited, list)
- Create minimal favorites.json configuration file structure
- Add comprehensive unit tests for data layer

### Phase 2: Star Icon UI Integration
- Add star hover state to VideoCardBase component with CSS transitions
- Implement star overlay positioning (same area as watched checkmarks)
- Create star hole (☆) on hover for unfavorited videos
- Add filled star (⭐) overlay for favorited videos
- Implement click handlers for star icons

### Phase 3: Player Page Integration
- Add "Add to Favorites ⭐" / "Remove from ⭐" buttons to player pages
- Implement dynamic button state based on favorite status
- Integrate with existing player page button styling and layout

### Phase 4: Favorites Source & Polish
- Create Favorites source integration with existing source system
- Implement Favorites page component with standard video grid layout
- Add pagination support for large favorites collections
- Complete accessibility improvements and comprehensive testing

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