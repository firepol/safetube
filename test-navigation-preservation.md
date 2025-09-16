# Navigation Preservation Test

This document describes how to manually test the navigation preservation functionality for downloaded YouTube videos.

## Test Scenario

1. **Setup**: Have a YouTube video that is downloaded and available locally
2. **Navigate**: Go to a YouTube source page (e.g., `/source/some-channel-id`)
3. **Click Video**: Click on a YouTube video that has been downloaded
4. **Verify Smart Routing**: The video should automatically play the downloaded version (local player) instead of YouTube player
5. **Check Back Button**: Click the back button - it should return to the original source page
6. **Test Reset**: Click the "Reset Download" button in the local player
7. **Verify Navigation**: After reset, it should navigate to YouTube player with preserved navigation context
8. **Check Back Button Again**: From YouTube player, back button should still return to original source

## Expected Behavior

### Before Implementation
- Downloaded videos would lose navigation context
- Back button from downloaded video playback would use browser history (-1)
- Reset functionality would not preserve original source context

### After Implementation
- Downloaded videos preserve original navigation context (`returnTo`, etc.)
- Back button returns to the exact source page the user came from
- Reset functionality maintains navigation context when switching to YouTube player
- All navigation flows work consistently

## Implementation Details

### Key Changes Made

1. **SmartPlaybackRouter.createLocalVideoFromDownload()**: Now accepts and preserves `navigationContext` parameter
2. **PlayerRouter**: Passes `location.state` as navigation context when calling `getVideoData()`
3. **Main IPC Handler**: `get-video-data` now accepts optional navigation context parameter
4. **BasePlayerPage**: Uses preserved navigation context from video object for back button
5. **LocalPlayerResetUI**: Preserves navigation context when resetting and navigating to YouTube player

### Code Flow

```
SourcePage -> PlayerRouter -> Main Process -> SmartPlaybackRouter
    |              |               |                    |
    |              |               |                    v
    |              |               |         createLocalVideoFromDownload()
    |              |               |                    |
    |              |               v                    |
    |              |        get-video-data(id, context) |
    |              |               |                    |
    |              v               |                    |
    |    getVideoData(id, context) |                    |
    |              |               |                    |
    v              |               |                    |
navigate(url, {    |               |                    |
  state: {         |               |                    |
    returnTo: ..., |               |                    |
    ...           |               |                    |
  }               |               |                    |
})                |               |                    |
                  |               |                    |
                  v               v                    v
            PlayerPage <- Video with navigationContext
                  |
                  v
            BasePlayerPage.handleBackClick()
                  |
                  v
            Uses video.navigationContext.returnTo
```

## Testing Commands

```bash
# Build the application
npm run build

# Run the application
npm start

# Run relevant tests
npm test -- --run src/renderer/pages/PlayerRouter.test.tsx
npm test -- --run src/main/__tests__/smartPlaybackRouter.test.ts
```

## Verification Checklist

- [ ] Downloaded YouTube videos automatically use local player
- [ ] Navigation context is preserved in video object
- [ ] Back button from downloaded video returns to correct source
- [ ] Reset download preserves navigation context
- [ ] YouTube player after reset has correct back navigation
- [ ] All existing navigation flows still work
- [ ] No regression in non-downloaded video navigation