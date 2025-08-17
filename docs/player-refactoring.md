# Player Page Refactoring

## Overview

The player pages have been refactored to ensure consistent UI and behavior between the MediaSource player and the YouTube iframe player, while avoiding code duplication.

## What Was Refactored

### 1. Created BasePlayerPage Component

A new `BasePlayerPage` component was created that contains all the common UI elements and functionality:

- **Header Layout**: Back button (top left), video title (top center), time indicator (top right)
- **Time Tracking**: Consistent time tracking behavior for both player types
- **Audio Warnings**: Audio alarm system when daily allowance is almost reached
- **Countdown Overlay**: Visual countdown when time is running low
- **Error Handling**: Consistent error display and loading states
- **Navigation**: Back button functionality with return path support

### 2. Refactored PlayerPage (MediaSource Player)

The existing `PlayerPage` was refactored to:
- Use the `BasePlayerPage` component
- Focus only on video-specific logic (local files, DLNA, YouTube MediaSource)
- Maintain all existing functionality while using the shared UI

### 3. Refactored YouTubePlayerPage (Iframe Player)

The `YouTubePlayerPage` was completely refactored to:
- Use the `BasePlayerPage` component
- Load video data independently (like PlayerPage)
- Implement proper time tracking and monitoring
- Support audio warnings and countdown overlay
- Have consistent UI layout with PlayerPage

## Configuration

### Switching Between Player Types

To switch between player types, update `config/youtubePlayer.json`:

```json
{
  "youtubePlayerType": "iframe"  // or "mediasource"
}
```

### Player Type Differences

| Feature | MediaSource Player | Iframe Player |
|---------|-------------------|---------------|
| **Video Quality** | Configurable (up to 1080p) | YouTube's default quality |
| **Audio Control** | Full control over audio tracks | YouTube's audio handling |
| **Streaming** | Direct stream handling | YouTube's iframe player |
| **UI Layout** | Identical | Identical |
| **Time Tracking** | Identical | Identical |
| **Audio Warnings** | Identical | Identical |
| **Countdown Overlay** | Identical | Identical |

## Benefits of Refactoring

1. **Consistent UI**: Both player types now have identical layouts and behavior
2. **No Code Duplication**: Common functionality is shared through BasePlayerPage
3. **Easier Maintenance**: Changes to UI or common features only need to be made in one place
4. **Better User Experience**: Users get the same interface regardless of player type
5. **Full Feature Parity**: Both players support all time tracking, audio warnings, and UI features

## Technical Details

### Component Structure

```
BasePlayerPage (shared UI and functionality)
├── PlayerPage (MediaSource player implementation)
└── YouTubePlayerPage (iframe player implementation)
```

### Key Shared Features

- **Time Indicator**: Shows time used/total and remaining time
- **Audio Warning Service**: Provides audio alerts at configurable thresholds
- **Countdown Overlay**: Visual timer when time is running low
- **Time Limit Monitoring**: Automatically stops playback when limits are reached
- **Navigation**: Consistent back button behavior with return path support

### Event Handling

Both player types implement the same event interface:
- `onVideoPlay`, `onVideoPause`, `onVideoEnded`
- `onVideoTimeUpdate`, `onVideoSeeking`, `onVideoSeeked`
- `onVideoError`, `onVideoLoaded`

This ensures consistent behavior for time tracking and user interactions.

## Testing

The refactored components maintain all existing functionality while providing a consistent user experience. Both player types now support:

- ✅ Consistent header layout (back button, title, time indicator)
- ✅ Time tracking and monitoring
- ✅ Audio warnings and countdown overlay
- ✅ Error handling and loading states
- ✅ Navigation with return path support
- ✅ Fullscreen handling
- ✅ Time limit enforcement

## Future Enhancements

With the new structure, adding new features to both player types is now much easier:

1. **New UI Elements**: Add to BasePlayerPage to affect both players
2. **New Time Tracking Features**: Implement once, available everywhere
3. **Enhanced Audio Warnings**: Centralized configuration and behavior
4. **Additional Player Types**: Easy to add new players using the same pattern
