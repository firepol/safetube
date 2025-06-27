# Fullscreen Limitations

## Overview

SafeTube has a known limitation with countdown overlay visibility in fullscreen mode. This document explains the technical reasons and current workarounds.

## The Issue

When SafeTube goes into fullscreen mode using Electron's native fullscreen API, the countdown overlay (which appears in the last 30 seconds of daily viewing time) becomes invisible.

## Technical Explanation

### Why This Happens

1. **Electron Fullscreen Architecture**: When Electron enters fullscreen mode, it creates a separate fullscreen window that sits above all other content
2. **DOM Isolation**: The fullscreen window operates in a different DOM context than the main application window
3. **Z-Index Bypass**: Even with very high z-index values and React portals, overlays cannot appear above the fullscreen video window
4. **Browser vs Electron Fullscreen**: This is different from browser fullscreen (`document.requestFullscreen()`), which keeps everything in the same DOM context

### What We Tried

- React portals with `createPortal()` to render overlays to `document.body`
- Z-index values up to `z-[99999]`
- Fixed positioning with `position: fixed`
- Custom fullscreen buttons using Electron's IPC API
- Different positioning strategies (absolute vs fixed)

None of these approaches worked because Electron's fullscreen mode fundamentally bypasses normal DOM rendering.

## Current Behavior

### Windowed Mode ✅
- Countdown overlay appears correctly in the top-right corner
- Overlay is visible and properly positioned
- Timer counts down as expected
- All functionality works as designed

### Fullscreen Mode ❌
- Countdown overlay is not visible
- No visual indication of remaining time
- Time tracking still works in the background
- Time's Up behavior still functions (video stops, exits fullscreen, navigates to Time's Up page)

## Workarounds and Solutions

### 1. Accept the Limitation (Current Approach)
- Countdown works perfectly in windowed mode
- Fullscreen mode is still usable for video viewing
- Time's Up behavior ensures safety even in fullscreen
- Simple, maintainable code without complex workarounds

### 2. Alternative Fullscreen Approaches (Future Considerations)
- **Browser Fullscreen**: Use `document.requestFullscreen()` instead of Electron fullscreen
  - Pros: Overlays would work
  - Cons: Less native feel, different keyboard shortcuts
- **Separate Overlay Window**: Create a transparent Electron window that floats above fullscreen
  - Pros: Would definitely work
  - Cons: Complex implementation, potential performance issues
- **Audio-Only Feedback**: Add audio alerts for time warnings in fullscreen
  - Pros: Simple to implement, works in all modes
  - Cons: No visual feedback

### 3. User Education
- Inform users that countdown is only visible in windowed mode
- Suggest keeping videos in windowed mode when time is running low
- Provide clear messaging about the limitation

## Configuration

The countdown behavior is configurable in `config/timeLimits.json`:

```json
{
  "countdownWarningSeconds": 30,
  "audioWarningSeconds": 10
}
```

- `countdownWarningSeconds`: When to start showing the countdown (default: 30 seconds)
- `audioWarningSeconds`: When to start audio alerts (future feature)

## Testing

To test the countdown overlay:

1. Set today's usage in `config/usageLog.json` to leave 30 seconds or less remaining
2. Start a video in windowed mode
3. The countdown should appear in the top-right corner
4. Try going fullscreen - the countdown will disappear
5. Exit fullscreen - the countdown should reappear

## Future Considerations

If fullscreen countdown visibility becomes a critical requirement, consider:

1. **Audio Feedback**: Implement system beeps or custom sounds for time warnings
2. **Browser Fullscreen**: Switch to browser fullscreen API for better overlay support
3. **Hybrid Approach**: Use browser fullscreen for videos, Electron fullscreen for other scenarios
4. **User Preference**: Allow users to choose between native fullscreen (no overlay) and browser fullscreen (with overlay)

## Conclusion

The fullscreen limitation is a technical constraint of Electron's architecture, not a bug in SafeTube's implementation. The current approach prioritizes code simplicity and reliability over complex workarounds that might introduce other issues.

The countdown overlay works perfectly in windowed mode, and the Time's Up behavior ensures safety regardless of display mode. 