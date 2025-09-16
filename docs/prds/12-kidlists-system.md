# KidLists System PRD (Watch Later & Custom Playlists)

## Overview
The KidLists System provides comprehensive playlist functionality for children to organize videos into custom collections. It includes a special "Watch Later" system kidlist that automatically removes videos when fully watched, and allows children to create and manage their own custom kidlists. The system uses "KidLists" terminology to avoid confusion with YouTube playlists and provides an extensible foundation for future playlist features.

## User Stories
- As a child, I want to save videos to "Watch Later" so that I can come back to them when I have time
- As a child, I want videos to automatically disappear from "Watch Later" after I finish watching them
- As a child, I want to create my own custom kidlists so that I can organize videos by theme or interest
- As a child, I want to add videos to kidlists with a "Save to KidList" button like YouTube
- As a child, I want to choose which kidlist to save to when I click the save button
- As a child, I want to create new kidlists when saving videos if none of my existing ones fit
- As a child, I want to rename and delete my custom kidlists when I no longer need them
- As a child, I want each kidlist to appear as its own source so I can browse them easily
- As a parent, I want my child to be able to organize their content without losing important system features
- As a parent, I want "Watch Later" to be permanent so my child can't accidentally delete it

## Success Criteria
- "Watch Later" kidlist automatically removes videos when fully watched (watched status integration)
- Children can create, rename, and delete custom kidlists through intuitive UI
- "Save to KidList" button appears on video cards and player pages with kidlist selection
- Kidlist creation modal allows immediate creation of new kidlists during save process
- Each kidlist appears as a separate source in the main video grid
- Watch Later cannot be deleted by children (system protection)
- Custom kidlists can be managed by children (create, rename, delete)
- All kidlists support cross-source video addition (YouTube, local, DLNA)
- KidLists persist across app restarts and crashes
- Kidlist functionality integrates seamlessly with existing video infrastructure

## Technical Requirements

### Core Functionality
- **KidLists JSON Storage**: All kidlists stored in `config/kidlists.json` with comprehensive metadata
- **System vs User KidLists**: Different permissions and behaviors for Watch Later vs custom kidlists
- **Auto-Removal Integration**: Watch Later integrates with watch history to remove completed videos
- **Cross-Source Support**: Works with YouTube channels, playlists, local files, and DLNA sources
- **Unique Video Identification**: Uses existing video ID system for consistent identification
- **Complete Metadata Storage**: Store title, thumbnail, duration, source info for immediate display
- **Permission System**: System kidlists (Watch Later) are readonly, user kidlists are manageable

### Data Structure
```typescript
interface KidListVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  duration: number; // seconds
  sourceType: 'youtube_channel' | 'youtube_playlist' | 'local' | 'dlna';
  sourceId: string;
  sourceName: string;
  url?: string; // for YouTube videos
  path?: string; // for local videos
  dateAdded: string; // ISO date string
}

interface KidList {
  id: string;
  name: string;
  type: 'system' | 'user'; // Watch Later vs custom
  readonly: boolean; // Kids can't delete system kidlists
  autoRemoveWatched: boolean; // Watch Later behavior
  videos: KidListVideo[];
  dateCreated: string; // ISO date string
  dateModified: string; // ISO date string
}

interface KidListsConfig {
  kidlists: KidList[];
}
```

### Integration Requirements
- **Source System Integration**: Each kidlist appears as additional source in main video grid
- **Player Integration**: KidList videos work with existing MediaSource and iframe players
- **History Integration**: Watch Later integrates with watch history for auto-removal
- **Time Tracking**: KidList videos respect time limits and contribute to daily usage tracking
- **Video Status Integration**: Auto-removal uses existing watched status calculation

### File Management
- **Configuration File**: `config/kidlists.json` following existing JSON configuration patterns
- **Backup System**: Automatic backup before modifications using existing fileUtils
- **Error Handling**: Graceful handling of corrupted files, missing data, and write failures
- **Type Safety**: Full TypeScript interfaces and validation
- **Migration Support**: Handle upgrades and schema changes gracefully

## UI/UX Requirements

### Save to KidList Button Implementation
- **Button Placement**: Positioned on video cards and player pages alongside existing buttons
- **Save Button Text**: "Save to KidList" with consistent styling
- **Dropdown/Modal**: Click opens kidlist selection interface
- **Existing KidLists**: Show all user kidlists and Watch Later in selection
- **Create New Option**: "+ Create New KidList" option in selection interface
- **Quick Save**: Option to save to most recently used kidlist with single click

### KidList Selection Interface
- **Modal Design**: Clean modal with kidlist list and creation option
- **KidList List**: Show all existing kidlists with names and video counts
- **Watch Later**: Always appears first in list with special icon
- **Custom KidLists**: Listed alphabetically below Watch Later
- **Create New Button**: Prominent "+ Create New KidList" button
- **Creation Input**: Inline text input for new kidlist name
- **Save Actions**: Clear save/cancel buttons for both selection and creation

### KidList Management Interface
- **Settings Access**: KidList management through settings or admin area
- **KidList List**: Display all user kidlists (not Watch Later)
- **Management Actions**: Rename and delete buttons for each custom kidlist
- **Confirmation**: Delete confirmation dialog to prevent accidental deletion
- **Watch Later Protection**: Watch Later not shown in management interface (readonly)

### KidList Source Pages
- **Source Integration**: Each kidlist appears as source with custom kidlist icon
- **Source Naming**: Display as "KidList: [Name]" or just "[Name]" based on design
- **Video Grid Layout**: Standard video grid layout matching other sources
- **Empty State**: Appropriate messaging for empty kidlists
- **Sorting**: Videos sorted by date added (newest first) by default
- **Pagination**: Standard pagination for large kidlists

### Visual Design Consistency
- **Icon System**: Consistent kidlist icons throughout interface
- **Button Styling**: Save buttons follow existing styling patterns
- **Modal Design**: Modal follows existing design patterns
- **Typography**: Consistent font hierarchy and sizing
- **Spacing**: Consistent spacing with existing UI elements
- **Animations**: Smooth transitions for all interactions

## Testing Requirements

### Unit Tests
- KidList data management functions (create, rename, delete, add video, remove video)
- Watch Later auto-removal logic integration with watch history
- TypeScript interface validation and type safety
- JSON file operations and error handling
- Permission system (readonly vs manageable kidlists)
- Cross-source video ID handling and metadata storage

### Integration Tests
- KidList integration with existing video sources
- Save to KidList functionality across all video types
- KidList source page navigation and display
- Video playback from kidlists
- Watch Later auto-removal with actual video completion
- Data persistence across app restarts

### UI Tests
- Save to KidList button functionality and modal behavior
- KidList creation and management interface
- KidList selection and video addition workflow
- Empty state handling for kidlists
- Error handling for corrupted kidlist data
- Accessibility compliance for all kidlist interfaces

### Performance Tests
- Large kidlist handling (1000+ videos per kidlist)
- Multiple kidlists performance (50+ kidlists)
- KidList data loading and display performance
- Memory usage with extensive kidlist metadata
- UI responsiveness during kidlist operations

## Implementation Plan

### Phase 1: Core Data Architecture
- Create KidList and KidListVideo TypeScript interfaces in shared/types.ts
- Implement comprehensive kidlist management functions (CRUD operations)
- Create kidlists.json configuration file structure with system/user distinction
- Implement Watch Later auto-removal integration with watch history
- Add comprehensive unit tests for all data layer functionality

### Phase 2: Save to KidList UI
- Add "Save to KidList" button to VideoCardBase component and player pages
- Create kidlist selection modal with existing kidlists and creation option
- Implement kidlist creation workflow within save interface
- Add click handlers and state management for save functionality
- Integrate with existing button styling and layout patterns

### Phase 3: KidList Management Interface
- Create KidList management interface for custom kidlist CRUD operations
- Implement rename and delete functionality for user kidlists
- Add Watch Later protection (system kidlist cannot be deleted/renamed)
- Create confirmation dialogs and error handling
- Integrate with existing settings or admin interface

### Phase 4: KidList Sources & Integration
- Create KidList source integration with existing source system
- Implement individual KidList pages with standard video grid layout
- Add pagination support for large kidlists
- Integrate Watch Later auto-removal with video completion detection
- Complete comprehensive testing and accessibility improvements

### Phase 5: Polish & Advanced Features
- Performance optimization for large kidlist collections
- Advanced kidlist features (reordering, bulk operations)
- Enhanced UI polish and animations
- Comprehensive error handling and edge case resolution
- Documentation and user guidance features

## Dependencies
- Existing video source system and VideoCardBase component
- JSON configuration management and fileUtils
- Video player infrastructure (MediaSource and iframe players)
- Watch history system for auto-removal functionality
- TypeScript type system and shared interfaces
- Routing system and navigation components
- Modal/dialog component system

## Risks and Mitigation
- **Storage Space**: KidList metadata could grow large with extensive collections
  - *Mitigation*: Implement data cleanup and size monitoring, optional metadata pruning
- **Data Corruption**: JSON file corruption could lose all kidlists
  - *Mitigation*: Use existing backup system, implement data validation and recovery
- **Performance Impact**: Large kidlist collections could slow UI
  - *Mitigation*: Implement pagination, lazy loading, and performance monitoring
- **Auto-Removal Complexity**: Watch Later auto-removal could have edge cases
  - *Mitigation*: Comprehensive testing with various video completion scenarios
- **Permission Confusion**: Users might expect to delete Watch Later
  - *Mitigation*: Clear UI indication of system vs user kidlists, helpful messaging

## Future Enhancements
- **KidList Sharing**: Export/import kidlists between users or devices
- **Smart KidLists**: Auto-generated kidlists based on viewing patterns
- **KidList Categories**: Organize kidlists into categories or folders
- **Collaborative KidLists**: Share kidlists between family members
- **KidList Search**: Search and filtering within large kidlists
- **Advanced Sorting**: Multiple sorting options for kidlist contents
- **Bulk Operations**: Select multiple videos for kidlist operations
- **KidList Templates**: Pre-defined kidlist templates for common use cases

## Notes
- **Terminology**: "KidLists" used throughout to distinguish from YouTube playlists
- **Extensibility**: Architecture designed to support future kidlist types and features
- **Integration**: Seamless integration with existing SafeTube infrastructure
- **User Experience**: Child-friendly interface while maintaining powerful functionality
- **Data Safety**: Multiple layers of protection against data loss
- **Performance**: Designed for scalability with large video collections